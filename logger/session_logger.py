import re
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data" / "sessions.db"

# Pola respons AI yang mengandung jawaban langsung (pelanggaran Socratic)
_DIRECT_ANSWER_PATTERNS = [
    r"jawabannya\s+(?:adalah|ialah|yaitu)",
    r"jawaban\s+(?:soal|nya)\s+(?:adalah|ialah|yaitu)",
    r"hasilnya\s+(?:adalah|ialah|yaitu)",
    r"jadi[,\s]+(?:jawaban|hasil|nilai)\s*(?:akhir|nya|x|y|z)?",
    r"maka[,\s]+(?:jawaban|hasil|nilai)",
    r"(?:nilai|hasil)\s+(?:akhir\s+)?[=:]\s*[\d,.]",
]

# Pola pesan siswa yang meminta jawaban langsung
_ANSWER_REQUEST_PATTERNS = [
    r"kasih\s+jawaban",
    r"langsung\s+(?:kasih|tulis|jawab)",
    r"kerjain\s+aja",
    r"tulis\s+aja\s+jawaban",
    r"aku\s+menyerah",
    r"gak\s+punya\s+waktu",
    r"jawab\s+langsung",
]

# Deteksi level Tangga Bantuan dari teks respons AI (fallback saat tidak dikirim eksplisit)
_HINT_LEVEL_PATTERNS: list[tuple[int, list[str]]] = [
    (3, [
        r"walkthrough",
        r"tetap kamu yang (?:ngerjain|mengerjakan)",
        r"kita urut.{1,30}satu per satu",
    ]),
    (2, [
        r"langkah demi langkah",
        r"langkah pertama",
        r"kita urai",
        r"kita pecah.{1,30}langkah",
        r"kita perlu tahu apa dulu",
    ]),
    (1, [
        r"analogi",
        r"coba bayangkan",
        r"ingat.{1,30}(?:materi|pelajaran|konsep)",
        r"pernah (?:belajar|dengar).{1,30}(?:materi|konsep|tentang)",
        r"kita hubungkan",
    ]),
]

_SUBJECT_KEYWORDS: dict[str, list[str]] = {
    "matematika": ["matematika", "aljabar", "turunan", "integral", "fungsi",
                   "trigonometri", "matriks", "vektor", "statistika", "peluang",
                   "persamaan", "limit"],
    "fisika":     ["fisika", "gaya", "kecepatan", "percepatan", "energi", "newton",
                   "momentum", "gelombang", "listrik", "magnet", "optika", "termodinamika"],
    "kimia":      ["kimia", "mol", "atom", "molekul", "reaksi", "larutan", "asam",
                   "basa", "stoikiometri", "elektrokimia", "ikatan", "periodik"],
    "biologi":    ["biologi", "sel", "mitosis", "meiosis", "ekosistem", "genetika",
                   "evolusi", "fotosintesis", "respirasi", "enzim", "jaringan", "organ"],
}


def _detect_direct_answer(text: str) -> bool:
    t = text.lower()
    return any(re.search(p, t) for p in _DIRECT_ANSWER_PATTERNS)


def _ends_with_question(text: str) -> bool:
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    return bool(lines) and lines[-1].endswith("?")


def _detect_answer_request(text: str) -> bool:
    t = text.lower()
    return any(re.search(p, t) for p in _ANSWER_REQUEST_PATTERNS)


def _detect_hint_level(text: str) -> int:
    t = text.lower()
    for level, patterns in _HINT_LEVEL_PATTERNS:
        if any(re.search(p, t) for p in patterns):
            return level
    return 0


def _detect_subject(text: str) -> str | None:
    t = text.lower()
    scores = {s: sum(1 for kw in kws if kw in t) for s, kws in _SUBJECT_KEYWORDS.items()}
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else None


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = _connect()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS sessions (
            id           TEXT PRIMARY KEY,
            started_at   TEXT NOT NULL,
            ended_at     TEXT,
            provider     TEXT,
            client_type  TEXT,
            nama_lengkap TEXT,
            nomor_induk  TEXT,
            subject      TEXT,
            turn_count   INTEGER DEFAULT 0,
            resolved     INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS turns (
            id                       INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id               TEXT NOT NULL,
            turn_number              INTEGER NOT NULL,
            timestamp                TEXT NOT NULL,
            role                     TEXT NOT NULL,
            content                  TEXT NOT NULL,
            word_count               INTEGER,
            ends_with_question       INTEGER,
            direct_answer_detected   INTEGER,
            hint_level               INTEGER,
            student_requested_answer INTEGER,
            FOREIGN KEY (session_id) REFERENCES sessions(id)
        );
    """)
    # migrate existing DBs that predate these columns
    for col in ("nama_lengkap", "nomor_induk"):
        try:
            conn.execute(f"ALTER TABLE sessions ADD COLUMN {col} TEXT")
        except sqlite3.OperationalError:
            pass
    conn.commit()
    conn.close()


def start_session(
    provider: str,
    client_type: str = "cli",
    nama_lengkap: str | None = None,
    nomor_induk: str | None = None,
) -> str:
    init_db()
    session_id = str(uuid.uuid4())
    conn = _connect()
    conn.execute(
        "INSERT INTO sessions (id, started_at, provider, client_type, nama_lengkap, nomor_induk) VALUES (?, ?, ?, ?, ?, ?)",
        (session_id, _now(), provider, client_type, nama_lengkap, nomor_induk),
    )
    conn.commit()
    conn.close()
    return session_id


def log_turn(
    session_id: str,
    turn_number: int,
    role: str,
    content: str,
    hint_level: int | None = None,
) -> None:
    is_assistant = role == "assistant"
    if is_assistant and hint_level is None:
        hint_level = _detect_hint_level(content)
    conn = _connect()
    conn.execute(
        """INSERT INTO turns
           (session_id, turn_number, timestamp, role, content, word_count,
            ends_with_question, direct_answer_detected, hint_level, student_requested_answer)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            session_id,
            turn_number,
            _now(),
            role,
            content,
            len(content.split()),
            int(_ends_with_question(content)) if is_assistant else None,
            int(_detect_direct_answer(content)) if is_assistant else None,
            hint_level if is_assistant else None,
            int(_detect_answer_request(content)) if not is_assistant else None,
        ),
    )
    conn.execute(
        "UPDATE sessions SET turn_count = turn_count + 1 WHERE id = ?",
        (session_id,),
    )
    if role == "user":
        subject = _detect_subject(content)
        if subject:
            conn.execute(
                "UPDATE sessions SET subject = ? WHERE id = ? AND subject IS NULL",
                (subject, session_id),
            )
    conn.commit()
    conn.close()


def end_session(session_id: str, resolved: bool = False) -> None:
    conn = _connect()
    conn.execute(
        "UPDATE sessions SET ended_at = ?, resolved = ? WHERE id = ?",
        (_now(), int(resolved), session_id),
    )
    conn.commit()
    conn.close()
