
## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

## Rule 5 — Use the model only for judgment calls
Use Claude for: classification, drafting, summarization, extraction from unstructured text.
Do NOT use Claude for: routing, retries, status-code handling, deterministic transforms.
If a status code already answers the question, plain code answers the question.

## Rule 6 — Token budgets are not advisory
Per-task budget: 4,000 tokens.
Per-session budget: 30,000 tokens.
If a task is approaching budget, summarize and start fresh. Do not push through.
Surfacing the breach > silently overrunning.

## Rule 7 — Surface conflicts, don't average them
If two existing patterns in the codebase contradict, don't blend them.
Pick one (the more recent / more tested), explain why, and flag the other for cleanup.
"Average" code that satisfies both rules is the worst code.

## Rule 8 — Read before you write
Before adding code in a file, read the file's exports, the immediate caller, and any obvious shared utilities.
If you don't understand why existing code is structured the way it is, ask before adding to it.
"Looks orthogonal to me" is the most dangerous phrase in this codebase.

## Rule 9 — Tests verify intent, not just behavior
Every test must encode WHY the behavior matters, not just WHAT it does.
A test like `expect(getUserName()).toBe('John')` is worthless if the function takes a hardcoded ID.
If you can't write a test that would fail when business logic changes, the function is wrong.

## Rule 10 — Checkpoint after every significant step
After completing each step in a multi-step task: summarize what was done, what's verified, what's left.
Don't continue from a state you can't describe back to me.
If you lose track, stop and restate.

## Rule 11 — Match the codebase's conventions, even if you disagree
If the codebase uses snake_case and you'd prefer camelCase: snake_case.
If the codebase uses class-based components and you'd prefer hooks: class-based.
Disagreement is a separate conversation. Inside the codebase, conformance > taste.
If you genuinely think the convention is harmful, surface it. Don't fork it silently.

## Rule 12 — Fail loud
If you can't be sure something worked, say so explicitly.
"Migration completed" is wrong if 30 records were skipped silently.
"Tests pass" is wrong if you skipped any.
"Feature works" is wrong if you didn't verify the edge case I asked about.
Default to surfacing uncertainty, not hiding it.

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

