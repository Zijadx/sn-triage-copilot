# SN Triage Copilot

AI-powered IT triage assistant built on Claude + ServiceNow. Demonstrates RAG, model failover, structured output, and observability in a single cohesive application.

Built by [Automatiki](https://automatiki.com) as a portfolio demonstration of production AI engineering patterns.

---

## What it demonstrates

| Concept | Where to look |
|---|---|
| **RAG** | `rag/index.js` — embed → search → inject context |
| **Model failover** | `ai-chain/index.js` — Sonnet → Haiku → graceful degradation |
| **Structured output** | `ai-chain/index.js` — enforced JSON schema, validated before render |
| **Error handling** | Retry w/ backoff, three-tier degradation, user-facing status |
| **Observability** | `observability/index.js` — SQLite log, live stats dashboard |
| **SN integration** | `sn-client/index.js` — incident retrieval and write-back |

---

## Architecture

```
User query
    │
    ▼
[ RAG layer ]  rag/
    embed query → cosine similarity → top-K incidents → format context
    │
    ▼
[ Prompt assembly ]
    system prompt + RAG context + user query
    │
    ▼
[ AI chain ]  ai-chain/
    Claude Sonnet (primary)
         │ fails? (429 / timeout / 5xx)
         ▼
    Claude Haiku (fallback)
         │ fails?
         ▼
    Safe degraded response
    │
    ▼
[ Observability ]  observability/
    log: model, latency, fallback, confidence, rag_hits
    │
    ▼
[ Response card ]  ui/
    answer · confidence badge · sources · RAG accordion · meta bar
```

---

## Project structure

```
sn-triage-copilot/
├── rag/              Embedding + semantic search
├── ai-chain/         Claude calls + failover logic
├── observability/    Request logging (SQLite)
├── sn-client/        ServiceNow REST wrapper
├── api/              Express server (orchestration)
└── ui/               React + Vite chat interface
```

Each folder is a discrete, explainable module. The API server in `api/server.js` is the only file that imports from all of them.

---

## Quick start

### 1. Clone and install

```bash
git clone https://github.com/automatiki/sn-triage-copilot.git
cd sn-triage-copilot
npm run install:all
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in your keys — see .env.example for all required values
```

Required:
- `ANTHROPIC_API_KEY` — from [console.anthropic.com](https://console.anthropic.com)
- `SN_INSTANCE_URL`, `SN_USERNAME`, `SN_PASSWORD` — your ServiceNow dev instance

### 3. Run

```bash
npm start
```

Opens:
- API: `http://localhost:3001`
- UI: `http://localhost:5173`

---

## Demo walkthrough

**Step 1 — Show the query input**
Paste a realistic IT issue. Good examples:
- "Outlook keeps crashing after today's Windows update. Error 0x80004005."
- "User can't connect to VPN, error 691 — Access denied. Works on other machines."

**Step 2 — Watch the loading states**
Three sequential steps show in the UI: embedding, searching, calling Claude. Each maps to a real operation.

**Step 3 — Read the result card**
Point out:
- The **confidence badge** — only HIGH if a close past match exists
- The **sources** — incident numbers Claude actually cited from context
- The **RAG accordion** — expand to show the raw incidents that were injected
- The **meta bar** — which model responded, latency, whether fallback fired

**Step 4 — Show the logs tab**
Switch to LOGS. Point out the live stats row: total requests, fallback rate, avg latency. Scroll through the log table.

**Step 5 — Trigger a failover (optional live demo)**
Temporarily set `PRIMARY_MODEL=invalid-model` in `.env` and restart the API. Submit a query — the meta bar will show `⚠ fallback triggered` and `claude-haiku-...` as the model used.

---

## Key design decisions worth discussing

**Why in-memory vector store?**
For a demo, it removes infrastructure dependencies and makes the RAG math visible. The `rag/index.js` interface is identical to what you'd use with Pinecone or pgvector — swap the retrieval implementation, not the contract.

**Why enforce JSON output?**
Free-text LLM output in production is unpredictable. Requiring a schema means the UI can always render the same components, validation catches malformed responses, and downstream systems can parse reliably.

**Why SQLite for observability?**
Zero setup, queryable, and good enough to demo metrics. In production you'd ship these events to Datadog, Splunk, or a ServiceNow table.

**Why separate modules instead of one file?**
Each concept should be explainable in isolation. `rag/index.js` doesn't know about Claude. `ai-chain/index.js` doesn't know about ServiceNow. The API server is the only place that knows about everything — and that's intentional.

---

## Related

- [automatiki-sn-agent](https://github.com/automatiki/automatiki-sn-agent) — ServiceNow MCP connector this project uses for SN access
- [Automatiki](https://automatiki.com) — AI + ServiceNow automation

---

## License

MIT
