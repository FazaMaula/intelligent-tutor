import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data" / "sessions.db"


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def compute_metrics() -> dict:
    conn = _connect()

    total = conn.execute("SELECT COUNT(*) FROM sessions").fetchone()[0]
    resolved = conn.execute("SELECT COUNT(*) FROM sessions WHERE resolved = 1").fetchone()[0]
    avg_turns = conn.execute("SELECT AVG(turn_count) FROM sessions").fetchone()[0] or 0
    avg_turns_resolved = (
        conn.execute(
            "SELECT AVG(turn_count) FROM sessions WHERE resolved = 1"
        ).fetchone()[0] or 0
    )

    assistant_turns = conn.execute(
        "SELECT COUNT(*) FROM turns WHERE role = 'assistant'"
    ).fetchone()[0]
    compliant = conn.execute(
        "SELECT COUNT(*) FROM turns"
        " WHERE role = 'assistant' AND ends_with_question = 1 AND direct_answer_detected = 0"
    ).fetchone()[0]
    violations = conn.execute(
        "SELECT COUNT(*) FROM turns WHERE role = 'assistant' AND direct_answer_detected = 1"
    ).fetchone()[0]

    user_turns = conn.execute(
        "SELECT COUNT(*) FROM turns WHERE role = 'user'"
    ).fetchone()[0]
    answer_requests = conn.execute(
        "SELECT COUNT(*) FROM turns WHERE role = 'user' AND student_requested_answer = 1"
    ).fetchone()[0]

    levels = conn.execute(
        "SELECT hint_level, COUNT(*) as n FROM turns"
        " WHERE role = 'assistant' AND hint_level IS NOT NULL"
        " GROUP BY hint_level ORDER BY hint_level"
    ).fetchall()

    subjects = conn.execute(
        "SELECT subject, COUNT(*) as n FROM sessions"
        " WHERE subject IS NOT NULL GROUP BY subject ORDER BY n DESC"
    ).fetchall()

    conn.close()

    return {
        "sessions": {
            "total": total,
            "resolved": resolved,
            "resolution_rate": round(resolved / total, 3) if total else 0,
            "avg_turns": round(avg_turns, 1),
            "avg_turns_resolved": round(avg_turns_resolved, 1),
        },
        "socratic_compliance": {
            "assistant_turns": assistant_turns,
            "compliant_turns": compliant,
            "compliance_rate": round(compliant / assistant_turns, 3) if assistant_turns else 0,
            "violations": violations,
        },
        "student_behavior": {
            "user_turns": user_turns,
            "answer_requests": answer_requests,
            "answer_request_rate": round(answer_requests / user_turns, 3) if user_turns else 0,
        },
        "hint_level_distribution": {str(r["hint_level"]): r["n"] for r in levels},
        "subject_distribution": {r["subject"]: r["n"] for r in subjects},
    }
