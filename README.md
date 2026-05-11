# Tutor Cerdas

Sistem tutor AI untuk siswa SMA Indonesia. Membimbing siswa dengan metode Sokrates — tidak pernah memberi jawaban langsung, hanya mengajukan pertanyaan pengarah.

## Tujuan Proyek

Memvalidasi pendekatan pedagogis AI untuk sekolah-sekolah di daerah terpencil Indonesia, lalu menggunakannya untuk menghasilkan data latih sintetis guna melakukan *fine-tuning* model bahasa kecil (Qwen 2.5) yang dapat berjalan secara *offline* di server sekolah lokal.

**Target pengguna**: Siswa SMA (Kelas 10–12), Indonesia  
**Bahasa**: Bahasa Indonesia  
**Kurikulum**: Kurikulum Merdeka — Matematika & IPA (Fisika, Kimia, Biologi), Fase E & F

---

## Fase Pengembangan

| Fase | Status | Deskripsi |
|------|--------|-----------|
| **Fase 1** | Selesai | Prototipe CLI + web app berbasis Claude/Gemini API untuk validasi pedagogi |
| **Fase 2** | Berikutnya | Hasilkan 5.000–10.000 dialog pedagogis sintetis → *fine-tune* Qwen 2.5 (3B/7B) → kuantisasi ke GGUF → deploy via Ollama + FastAPI |

---

## Persona: Kak Ajar

Tutor AI bernama **Kak Ajar** menggunakan **Tangga Bantuan** (4 tingkat):

| Tingkat | Nama | Deskripsi |
|---------|------|-----------|
| 0 | Eksplorasi | Ajak siswa berpikir sendiri |
| 1 | Petunjuk Kontekstual | Beri clue dari konteks soal |
| 2 | Scaffolding Langkah | Pecah soal menjadi langkah kecil |
| 3 | Walkthrough Penuh | Panduan lengkap, tetap dalam bentuk tanya-jawab |

Kak Ajar **tidak pernah memberi jawaban langsung**. Selalu membimbing dengan pertanyaan.

---

## Fitur

- Percakapan Sokrates multi-gilir dalam Bahasa Indonesia
- **OCR formula** — siswa foto soal dari buku, formula terbaca otomatis via pix2tex
- Pratinjau formula hasil OCR dengan render KaTeX sebelum dikirim
- Streaming respons real-time
- Dukungan multi-provider: **Claude** (Anthropic) atau **Gemini** (Google), mudah diganti via satu baris konfigurasi

---

## Teknologi

### CLI (`/`)
- Python + Anthropic SDK / OpenAI SDK
- `tutor/prompts.py` — system prompt Bahasa Indonesia (~5.000 token, di-cache)
- `tutor/tutor.py` — kelas `IntelligentTutor` dengan streaming
- `main.py` — antarmuka CLI dengan Rich (`/baru`, `/bantuan`, `/keluar`)

### Web App (`web/`)
- Next.js 15 + TypeScript + Tailwind CSS
- `web/app/api/chat/route.ts` — API route, streaming respons LLM
- `web/app/page.tsx` — antarmuka chat dengan streaming real-time + render Markdown + KaTeX
- `web/app/api/ocr/route.ts` — proxy ke layanan OCR

### Layanan OCR (`ocr/`)
- FastAPI + pix2tex (ViT decoder khusus formula matematika)
- Menerima gambar → mengembalikan string LaTeX
- Berjalan lokal di port 8000

---

## Cara Menjalankan

### Prasyarat

- Python 3.9+
- Node.js 18+
- API key: Anthropic **atau** Google Gemini (pilih salah satu)

### 1. Klon & Konfigurasi

```bash
git clone <repo-url>
cd intelligent-tutor
```

Salin file konfigurasi:
```bash
cp .env.example .env
cp web/.env.local.example web/.env.local
```

Isi API key dan pilih provider di kedua file:
```env
ANTHROPIC_API_KEY=...   # jika pakai Claude
GEMINI_API_KEY=...      # jika pakai Gemini (gratis di aistudio.google.com)
LLM_PROVIDER=gemini     # "claude" atau "gemini"
```

### 2. Jalankan Layanan OCR

```bash
pip install -r ocr/requirements.txt
python3 -m uvicorn ocr.ocr_api:app --port 8000
```

> Pertama kali dijalankan, model pix2tex (~115 MB) akan diunduh otomatis.

### 3. Jalankan Web App

```bash
cd web
npm install
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000)

### 4. Atau Jalankan via CLI

```bash
pip install -r requirements.txt
python main.py
```

**Perintah CLI:**
- `/baru` — mulai sesi baru
- `/bantuan` — tampilkan daftar perintah
- `/keluar` — keluar

---

## Mengganti Provider LLM

Cukup ubah satu baris di `web/.env.local` (web) atau `.env` (CLI):

```env
LLM_PROVIDER=gemini   # gunakan Gemini (Google AI Studio, gratis)
LLM_PROVIDER=claude   # gunakan Claude Opus (Anthropic, berbayar)
```

Restart server setelah mengubah nilai ini.

---

## Struktur File

```
intelligent-tutor/
├── main.py                      # Entry point CLI
├── tutor/
│   ├── prompts.py               # System prompt Kak Ajar (inti pedagogi)
│   └── tutor.py                 # Integrasi LLM, streaming, multi-provider
├── ocr/
│   ├── ocr_api.py               # FastAPI OCR service (pix2tex)
│   └── requirements.txt
├── web/
│   ├── app/
│   │   ├── api/chat/route.ts    # Backend chat, streaming, multi-provider
│   │   ├── api/ocr/route.ts     # Proxy ke layanan OCR
│   │   └── page.tsx             # Antarmuka chat
│   └── lib/prompts.ts           # System prompt (sama dengan versi Python)
└── requirements.txt
```

---

## Deploy ke Replit

1. Push repo ke GitHub
2. Import di Replit, set *root directory* ke `web/`
3. Tambahkan `GEMINI_API_KEY` dan `LLM_PROVIDER=gemini` di Secrets
4. Untuk OCR: deploy `ocr/ocr_api.py` sebagai Repl terpisah, lalu set `OCR_SERVICE_URL` ke URL-nya

---

## Lisensi

MIT
