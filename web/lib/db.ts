import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Detection helpers (ported from session_logger.py) ────────────────────────

const DIRECT_ANSWER_PATTERNS = [
  /jawabannya\s+(?:adalah|ialah|yaitu)/i,
  /jawaban\s+(?:soal|nya)\s+(?:adalah|ialah|yaitu)/i,
  /hasilnya\s+(?:adalah|ialah|yaitu)/i,
  /jadi[,\s]+(?:jawaban|hasil|nilai)\s*(?:akhir|nya|x|y|z)?/i,
  /maka[,\s]+(?:jawaban|hasil|nilai)/i,
  /(?:nilai|hasil)\s+(?:akhir\s+)?[=:]\s*[\d,.]/i,
];

const ANSWER_REQUEST_PATTERNS = [
  /kasih\s+jawaban/i,
  /langsung\s+(?:kasih|tulis|jawab)/i,
  /kerjain\s+aja/i,
  /tulis\s+aja\s+jawaban/i,
  /aku\s+menyerah/i,
  /gak\s+punya\s+waktu/i,
  /jawab\s+langsung/i,
];

const SUBJECT_KEYWORDS: Record<string, string[]> = {
  matematika: ["matematika","aljabar","turunan","integral","fungsi","trigonometri","matriks","vektor","statistika","peluang","persamaan","limit"],
  fisika:     ["fisika","gaya","kecepatan","percepatan","energi","newton","momentum","gelombang","listrik","magnet","optika","termodinamika"],
  kimia:      ["kimia","mol","atom","molekul","reaksi","larutan","asam","basa","stoikiometri","elektrokimia","ikatan","periodik"],
  biologi:    ["biologi","sel","mitosis","meiosis","ekosistem","genetika","evolusi","fotosintesis","respirasi","enzim","jaringan","organ"],
};

function detectDirectAnswer(text: string): boolean {
  return DIRECT_ANSWER_PATTERNS.some((p) => p.test(text));
}

function endsWithQuestion(text: string): boolean {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.length > 0 && lines[lines.length - 1].endsWith("?");
}

function detectAnswerRequest(text: string): boolean {
  return ANSWER_REQUEST_PATTERNS.some((p) => p.test(text));
}

const HINT_LEVEL_PATTERNS: Array<[number, RegExp[]]> = [
  [3, [/walkthrough/i, /tetap kamu yang (?:ngerjain|mengerjakan)/i, /kita urut.{1,30}satu per satu/i]],
  [2, [/langkah demi langkah/i, /langkah pertama/i, /kita urai/i, /kita pecah.{1,30}langkah/i, /kita perlu tahu apa dulu/i]],
  [1, [/analogi/i, /coba bayangkan/i, /ingat.{1,30}(?:materi|pelajaran|konsep)/i, /pernah (?:belajar|dengar).{1,30}(?:materi|konsep|tentang)/i, /kita hubungkan/i]],
];

function detectHintLevel(text: string): number {
  for (const [level, patterns] of HINT_LEVEL_PATTERNS) {
    if (patterns.some((p) => p.test(text))) return level;
  }
  return 0;
}

function detectSubject(text: string): string | null {
  const t = text.toLowerCase();
  let best = { subject: "", score: 0 };
  for (const [subject, keywords] of Object.entries(SUBJECT_KEYWORDS)) {
    const score = keywords.filter((kw) => t.includes(kw)).length;
    if (score > best.score) best = { subject, score };
  }
  return best.score > 0 ? best.subject : null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function startSession(
  provider: string,
  clientType: string,
  namaLengkap: string | null,
  nomorInduk: string | null
): Promise<string> {
  const id = crypto.randomUUID();
  await supabase.from("sessions").insert({
    id,
    started_at: new Date().toISOString(),
    provider,
    client_type: clientType,
    nama_lengkap: namaLengkap,
    nomor_induk: nomorInduk,
  });
  return id;
}

export async function endSession(sessionId: string, resolved: boolean): Promise<void> {
  await supabase
    .from("sessions")
    .update({ ended_at: new Date().toISOString(), resolved })
    .eq("id", sessionId);
}

export async function logTurn(
  sessionId: string,
  turnNumber: number,
  role: "user" | "assistant",
  content: string,
  hintLevel: number | null
): Promise<void> {
  const isAssistant = role === "assistant";
  await supabase.from("turns").insert({
    session_id: sessionId,
    turn_number: turnNumber,
    timestamp: new Date().toISOString(),
    role,
    content,
    word_count: content.split(/\s+/).filter(Boolean).length,
    ends_with_question: isAssistant ? endsWithQuestion(content) : null,
    direct_answer_detected: isAssistant ? detectDirectAnswer(content) : null,
    hint_level: isAssistant ? (hintLevel ?? detectHintLevel(content)) : null,
    student_requested_answer: !isAssistant ? detectAnswerRequest(content) : null,
  });
  await supabase.rpc("increment_turn_count", { session_id_arg: sessionId });
  if (role === "user") {
    const subject = detectSubject(content);
    if (subject) {
      await supabase
        .from("sessions")
        .update({ subject })
        .eq("id", sessionId)
        .is("subject", null);
    }
  }
}
