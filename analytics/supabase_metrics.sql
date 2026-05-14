-- ═══════════════════════════════════════════════════════════════════════════
-- TUTOR CERDAS — Query Validasi Pedagogi Socratic
-- Jalankan satu per satu di Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- 0. RINGKASAN UMUM
-- ───────────────────────────────────────────────────────────────────────────

SELECT
  COUNT(*)                                                              AS total_sesi,
  COUNT(*) FILTER (WHERE resolved = true)                              AS sesi_selesai,
  ROUND(
    COUNT(*) FILTER (WHERE resolved = true)::numeric
    / NULLIF(COUNT(*), 0) * 100, 1
  )                                                                     AS resolution_rate_pct,
  ROUND(AVG(turn_count), 1)                                            AS rata_giliran,
  ROUND(AVG(turn_count) FILTER (WHERE resolved = true), 1)            AS rata_giliran_selesai,
  ROUND(AVG(
    EXTRACT(EPOCH FROM (ended_at::timestamptz - started_at::timestamptz)) / 60
  ) FILTER (WHERE ended_at IS NOT NULL), 1)                            AS rata_durasi_menit
FROM sessions;


-- ───────────────────────────────────────────────────────────────────────────
-- LAYER 1: KONSISTENSI AI
-- Pertanyaan: Apakah Kak Ajar benar-benar Socratic?
-- ───────────────────────────────────────────────────────────────────────────

-- 1a. Compliance rate keseluruhan
SELECT
  COUNT(*)                                                             AS total_giliran_ai,
  COUNT(*) FILTER (WHERE ends_with_question = true
                   AND direct_answer_detected = false)                AS giliran_patuh,
  ROUND(
    COUNT(*) FILTER (WHERE ends_with_question = true
                     AND direct_answer_detected = false)::numeric
    / NULLIF(COUNT(*), 0) * 100, 1
  )                                                                    AS compliance_rate_pct,
  COUNT(*) FILTER (WHERE direct_answer_detected = true)               AS pelanggaran
FROM turns
WHERE role = 'assistant';


-- 1b. Distribusi Tangga Bantuan (hint_level)
SELECT
  hint_level,
  CASE hint_level
    WHEN 0 THEN 'Eksplorasi'
    WHEN 1 THEN 'Kontekstual'
    WHEN 2 THEN 'Scaffolding'
    WHEN 3 THEN 'Walkthrough'
  END                                                                  AS nama_level,
  COUNT(*)                                                             AS jumlah,
  ROUND(
    COUNT(*)::numeric / SUM(COUNT(*)) OVER () * 100, 1
  )                                                                    AS pct
FROM turns
WHERE role = 'assistant' AND hint_level IS NOT NULL
GROUP BY hint_level
ORDER BY hint_level;


-- ───────────────────────────────────────────────────────────────────────────
-- LAYER 2: KETERLIBATAN SISWA
-- Pertanyaan: Apakah siswa mau terlibat?
-- ───────────────────────────────────────────────────────────────────────────

-- 2a. Distribusi durasi sesi
SELECT
  CASE
    WHEN durasi_menit < 5  THEN '< 5 menit'
    WHEN durasi_menit < 10 THEN '5–10 menit'
    WHEN durasi_menit < 20 THEN '10–20 menit'
    ELSE '> 20 menit'
  END                                                                  AS bucket_durasi,
  COUNT(*)                                                             AS jumlah_sesi
FROM (
  SELECT
    EXTRACT(EPOCH FROM (
      ended_at::timestamptz - started_at::timestamptz
    )) / 60                                                            AS durasi_menit
  FROM sessions
  WHERE ended_at IS NOT NULL
) sub
GROUP BY bucket_durasi
ORDER BY MIN(durasi_menit);


-- 2b. Distribusi jumlah giliran per sesi
SELECT
  CASE
    WHEN turn_count <= 4  THEN '1–4 giliran'
    WHEN turn_count <= 8  THEN '5–8 giliran'
    WHEN turn_count <= 12 THEN '9–12 giliran'
    ELSE '> 12 giliran'
  END                                                                  AS bucket_giliran,
  COUNT(*)                                                             AS jumlah_sesi,
  ROUND(
    COUNT(*) FILTER (WHERE resolved = true)::numeric
    / NULLIF(COUNT(*), 0) * 100, 1
  )                                                                    AS resolution_rate_pct
FROM sessions
GROUP BY bucket_giliran
ORDER BY MIN(turn_count);


-- 2c. Perilaku siswa: menyerah vs. bertahan
SELECT
  COUNT(*) FILTER (WHERE role = 'user')                               AS total_giliran_siswa,
  COUNT(*) FILTER (WHERE role = 'user'
                   AND student_requested_answer = true)               AS minta_jawaban_langsung,
  ROUND(
    COUNT(*) FILTER (WHERE role = 'user'
                     AND student_requested_answer = true)::numeric
    / NULLIF(COUNT(*) FILTER (WHERE role = 'user'), 0) * 100, 1
  )                                                                    AS answer_request_rate_pct
FROM turns;


-- ───────────────────────────────────────────────────────────────────────────
-- LAYER 3: TRANSFER AGENCY
-- Pertanyaan: Apakah metode Socratic berhasil memindahkan kontrol ke siswa?
-- ───────────────────────────────────────────────────────────────────────────

-- 3a. Student question rate keseluruhan
SELECT
  COUNT(*) FILTER (WHERE role = 'user')                               AS total_giliran_siswa,
  COUNT(*) FILTER (WHERE role = 'user' AND content LIKE '%?%')       AS siswa_bertanya_sendiri,
  ROUND(
    COUNT(*) FILTER (WHERE role = 'user' AND content LIKE '%?%')::numeric
    / NULLIF(COUNT(*) FILTER (WHERE role = 'user'), 0) * 100, 1
  )                                                                    AS student_question_rate_pct
FROM turns;


-- 3b. Apakah sesi yang resolved punya student_question_rate lebih tinggi?
--     (sinyal terkuat transfer agency)
SELECT
  CASE WHEN s.resolved THEN 'Selesai' ELSE 'Tidak selesai' END       AS status_sesi,
  ROUND(AVG(sq.student_q_rate) * 100, 1)                             AS rata_student_question_rate_pct,
  ROUND(AVG(sq.avg_hint), 2)                                         AS rata_hint_level,
  COUNT(*)                                                             AS jumlah_sesi
FROM sessions s
JOIN (
  SELECT
    session_id,
    COUNT(*) FILTER (WHERE role = 'user' AND content LIKE '%?%')::numeric
      / NULLIF(COUNT(*) FILTER (WHERE role = 'user'), 0)             AS student_q_rate,
    AVG(hint_level) FILTER (WHERE role = 'assistant')                AS avg_hint
  FROM turns
  GROUP BY session_id
) sq ON sq.session_id = s.id
GROUP BY s.resolved
ORDER BY s.resolved DESC;


-- 3c. Pola eskalasi hint_level per posisi giliran
--     (apakah siswa makin butuh bantuan atau makin mandiri?)
SELECT
  turn_number,
  ROUND(AVG(hint_level), 2)                                          AS avg_hint_level,
  COUNT(*)                                                            AS n_observasi
FROM turns
WHERE role = 'assistant' AND hint_level IS NOT NULL
GROUP BY turn_number
HAVING COUNT(*) >= 5
ORDER BY turn_number
LIMIT 20;


-- ───────────────────────────────────────────────────────────────────────────
-- BONUS: PER MATA PELAJARAN
-- ───────────────────────────────────────────────────────────────────────────

SELECT
  COALESCE(subject, '(belum terdeteksi)')                            AS mata_pelajaran,
  COUNT(*)                                                            AS total_sesi,
  ROUND(AVG(turn_count), 1)                                          AS rata_giliran,
  ROUND(AVG(
    EXTRACT(EPOCH FROM (ended_at::timestamptz - started_at::timestamptz)) / 60
  ) FILTER (WHERE ended_at IS NOT NULL), 1)                          AS rata_durasi_menit,
  COUNT(*) FILTER (WHERE resolved = true)                            AS sesi_selesai,
  ROUND(
    COUNT(*) FILTER (WHERE resolved = true)::numeric
    / NULLIF(COUNT(*), 0) * 100, 1
  )                                                                   AS resolution_rate_pct
FROM sessions
GROUP BY subject
ORDER BY total_sesi DESC;
