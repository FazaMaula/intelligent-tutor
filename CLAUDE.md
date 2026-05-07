# Tutor Cerdas — Intelligent Tutor

AI tutoring system for Indonesian high school students. Guides students using the Socratic method — never gives direct answers, only asks guiding questions.

## Project Goal

Validate a pedagogical AI approach for rural Indonesian schools, then use it to generate synthetic training data for fine-tuning a small language model (Qwen 2.5) that can run offline on local school servers.

**Target users**: SMA students (Grade 10–12), rural Indonesia  
**Language**: Bahasa Indonesia  
**Curriculum**: Kurikulum Merdeka — Matematika & IPA (Fisika, Kimia, Biologi), Fase E & F

## Phases

- **Phase 1 (current)**: Claude API prototype — CLI + web app — to validate pedagogy and generate synthetic dialogues
- **Phase 2 (next)**: Use Phase 1 to generate 5,000–10,000 synthetic Indonesian pedagogical dialogues → QLoRA fine-tune Qwen 2.5 (3B or 7B) → quantize to GGUF → deploy via Ollama + FastAPI

## Core Pedagogy — Never Violate This

The tutor persona is **Kak Ajar**. Key rules enforced by the system prompt:
- **NEVER give direct answers** — always guide with questions
- Use the **Tangga Bantuan** (4-level hint ladder): Level 0 (exploration) → Level 1 (contextual clues) → Level 2 (step scaffolding) → Level 3 (full walkthrough, still Q&A style)
- Escalate levels only when the student is genuinely stuck
- Use Indonesian analogies (becak, sawah, warung) to explain concepts

## Tech Stack

### CLI (`/` root)
- Python + Anthropic SDK
- `tutor/prompts.py` — system prompt in Bahasa Indonesia (~5,000 tokens, cached)
- `tutor/tutor.py` — `IntelligentTutor` class with streaming + prompt caching
- `main.py` — Rich CLI with commands `/baru`, `/bantuan`, `/keluar`

### Web App (`web/`)
- Next.js 15 + TypeScript + Tailwind CSS
- `web/app/api/chat/route.ts` — API route, streams Claude responses
- `web/app/page.tsx` — chat UI with real-time streaming, markdown rendering
- `web/lib/prompts.ts` — same system prompt as Python version
- Deployed on Replit (GitHub import, root dir = `web/`)

## Claude API Settings (both CLI and web)

```python
model = "claude-opus-4-7"
max_tokens = 1024
thinking = {"type": "adaptive"}
output_config = {"effort": "high"}
cache_control = {"type": "ephemeral"}  # on system prompt
```

Prompt caching saves ~70% cost on the large system prompt after the first turn.

## How to Run

**CLI:**
```bash
pip install -r requirements.txt
cp .env.example .env  # add ANTHROPIC_API_KEY
python main.py
```

**Web (local):**
```bash
cd web
npm install
cp .env.local.example .env.local  # add ANTHROPIC_API_KEY
npm run dev  # http://localhost:3000
```

## Key Files

| File | Purpose |
|---|---|
| `tutor/prompts.py` | System prompt — edit this to tune pedagogy |
| `tutor/tutor.py` | Claude API integration (streaming, caching) |
| `web/app/api/chat/route.ts` | Web backend — same logic as tutor.py |
| `web/app/page.tsx` | Chat UI (React, streaming, markdown) |

## Deployment

- **GitHub repo**: push entire `intelligent-tutor/` folder
- **Replit**: import from GitHub, set root directory to `web/`, add `ANTHROPIC_API_KEY` in Secrets
- API key: console.anthropic.com (separate from claude.ai Pro subscription)

## What NOT to Change Without Care

- The pedagogical guardrails in `tutor/prompts.py` — these are the core value of the system
- `stream.get_final_message().content` in `tutor.py` — stores full content blocks including thinking blocks; using plain text breaks multi-turn state
