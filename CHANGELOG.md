# Changelog

## v1.0.0 — Initial Release

### What it does

AI-powered IT triage assistant built on Claude + ServiceNow. Describe an IT problem, the system finds similar resolved incidents and KB articles using RAG, and Claude returns a structured resolution with confidence score and source citations.

### Features

**RAG (Retrieval-Augmented Generation)**
- Fetches resolved incidents + published KB articles from ServiceNow at boot
- 64 documents indexed (22 incidents + 42 KB articles)
- TF-IDF cosine similarity search — top-5 matches injected as prompt context
- Claude cites real INC and KB numbers — no hallucinated sources

**Model failover**
- Primary: claude-sonnet-4-5
- Retry: up to 2x with 1.5s backoff
- Fallback: claude-haiku-4-5 on 429 / timeout / 5xx
- Hard degrade: safe message if both models fail

**Structured output**
- Enforced JSON schema: answer · confidence · sources · reasoning
- HIGH / MED / LOW confidence scoring
- Schema validated before rendering

**Error handling**
- Three-tier: retry → fallback → hard degrade
- Every failure state handled — never a blank screen

**Observability**
- Every request logged: model, latency, fallback, confidence, rag_hits
- Live LOGS tab with aggregate stats

**Docker support**
- Containerized with Docker
- Secrets injected at runtime via --env-file
- `docker build -t sn-triage-copilot . && docker run --env-file .env -p 3001:3001 sn-triage-copilot`

### Demo test queries

| Query | Expected result |
|---|---|
| "VPN not working after I changed my password, getting error 691" | HIGH confidence, INC0010366 cited |
| "Outlook is crashing every time I open it" | HIGH confidence, incident match |
| "User got locked out after too many failed login attempts" | HIGH confidence, INC + KB cited |
| "How do I reset my password if I'm locked out?" | MED confidence, KB article cited |
| "Internet is slow and video calls keep dropping" | MED confidence, multiple RAG hits |
| "My keyboard is typing wrong characters" | LOW confidence, no corpus match |

### Tech stack

- Node.js + Express (API)
- React + Vite (UI)
- Anthropic Claude API
- ServiceNow REST API
- Docker

### Project structure

```
sn-triage-copilot/
├── rag/              Embedding + semantic search
├── ai-chain/         Claude calls + failover logic
├── observability/    Request logging
├── sn-client/        ServiceNow REST wrapper
├── api/              Express server
├── scripts/          seed-incidents.js
├── docs/             HOW-IT-WORKS.md
├── Dockerfile
└── ui/               React + Vite
```

### Quick start

```bash
git clone https://github.com/Zijadx/sn-triage-copilot.git
cd sn-triage-copilot
cp .env.example .env   # fill in your keys
npm run install:all
npm start
# UI: http://localhost:5173
```
