/**
 * api/server.js
 *
 * Express server — the orchestration layer.
 * Imports RAG, AI chain, observability, and SN client.
 *
 * Endpoints:
 *   POST /api/triage    — main triage flow (auth + rate-limited)
 *   POST /api/reindex   — re-pull SN and rebuild RAG corpus (auth)
 *   GET  /api/logs      — recent request log (auth)
 *   GET  /api/health    — connectivity check (open, for load balancers)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const rag = require('../rag');
const { triage } = require('../ai-chain');
const { logRequest, getRecentLogs, getStats } = require('../observability');
const snClient = require('../sn-client');

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '10kb' }));
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));

// ─── Auth ────────────────────────────────────────────────────────────────────

const API_TOKEN = process.env.API_TOKEN;
const NODE_ENV = process.env.NODE_ENV || 'development';

if (!API_TOKEN) {
  if (NODE_ENV === 'production') {
    console.error('[Boot] API_TOKEN is required when NODE_ENV=production. Refusing to start.');
    process.exit(1);
  }
  console.warn('[Boot] API_TOKEN not set — auth is DISABLED. Do not run this way outside local dev.');
}

function requireAuth(req, res, next) {
  if (!API_TOKEN) return next();
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || token !== API_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ─── Rate limiting ───────────────────────────────────────────────────────────

const triageLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: parseInt(process.env.TRIAGE_RATE_LIMIT || '20', 10),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many triage requests. Please slow down.' },
});

// ─── Corpus lifecycle ────────────────────────────────────────────────────────
//
// reindex() is the single path that pulls SN data and rebuilds the RAG
// corpus. It's called at boot, from POST /api/reindex, and (optionally) on
// a fixed interval. A mutex prevents overlapping runs so a slow SN response
// can't stack up if the interval fires or an operator hits the endpoint.
// On failure the existing corpus is left in place — a bad refresh must
// never leave the service worse off than it was.

let reindexInFlight = null;
let lastReindex = { at: null, ok: false, count: 0, error: null };

async function reindex({ trigger = 'manual' } = {}) {
  if (reindexInFlight) return reindexInFlight;

  reindexInFlight = (async () => {
    const start = Date.now();
    console.log(`[Reindex] Starting (trigger=${trigger})`);
    try {
      const [incidents, kbArticles] = await Promise.all([
        snClient.getResolvedIncidents({ limit: 200 }),
        snClient.getKBArticles({ limit: 200 }),
      ]);
      const corpus = [...incidents, ...kbArticles];
      await rag.seedCorpus(corpus);

      const durationMs = Date.now() - start;
      lastReindex = { at: new Date().toISOString(), ok: true, count: corpus.length, error: null, duration_ms: durationMs, trigger };
      console.log(`[Reindex] OK: ${corpus.length} documents in ${durationMs}ms`);
      return lastReindex;
    } catch (err) {
      const durationMs = Date.now() - start;
      lastReindex = { at: new Date().toISOString(), ok: false, count: 0, error: err.message, duration_ms: durationMs, trigger };
      console.error(`[Reindex] FAILED after ${durationMs}ms: ${err.message}`);
      throw err;
    } finally {
      reindexInFlight = null;
    }
  })();

  return reindexInFlight;
}

async function boot() {
  console.log('[Boot] Connecting to ServiceNow...');
  try {
    await reindex({ trigger: 'boot' });
  } catch (_) {
    console.warn('[Boot] Continuing without RAG context. Triage will still work.');
  }

  const intervalMs = parseInt(process.env.REINDEX_INTERVAL_MS || '0', 10);
  if (intervalMs > 0) {
    console.log(`[Boot] Scheduling reindex every ${intervalMs}ms`);
    setInterval(() => {
      reindex({ trigger: 'interval' }).catch(() => {});
    }, intervalMs).unref();
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

app.post('/api/triage', requireAuth, triageLimiter, async (req, res) => {
  const { query } = req.body;

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return res.status(400).json({ error: 'query is required' });
  }
  if (query.length > 4000) {
    return res.status(400).json({ error: 'query too long (max 4000 chars)' });
  }

  const start = Date.now();

  try {
    const ragResults = await rag.retrieve(query);
    const ragContext = rag.formatContext(ragResults);
    const aiResult = await triage(query, ragContext);
    const latencyMs = Date.now() - start;

    logRequest({
      query,
      modelUsed: aiResult.model_used,
      fallbackTriggered: aiResult.fallback_triggered,
      latencyMs,
      confidence: aiResult.confidence,
      ragHits: ragResults.length,
      error: aiResult.error || false,
    });

    res.json({
      ...aiResult,
      rag_hits: ragResults.length,
      latency_ms: latencyMs,
      similar_incidents: ragResults.map((r) => r.metadata),
    });

  } catch (err) {
    const latencyMs = Date.now() - start;
    console.error('[/api/triage] Unhandled error:', err);

    logRequest({
      query,
      modelUsed: 'none',
      fallbackTriggered: true,
      latencyMs,
      confidence: 'low',
      ragHits: 0,
      error: true,
    });

    res.status(500).json({ error: 'Triage failed. Please try again.' });
  }
});

app.post('/api/reindex', requireAuth, async (req, res) => {
  try {
    const result = await reindex({ trigger: 'endpoint' });
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: 'Reindex failed', message: err.message, last: lastReindex });
  }
});

app.get('/api/logs', requireAuth, (req, res) => {
  try {
    const logs = getRecentLogs(50);
    const stats = getStats();
    res.json({ stats, logs });
  } catch (err) {
    res.status(500).json({ error: 'Could not retrieve logs.' });
  }
});

app.get('/api/health', async (req, res) => {
  const checks = { api: true, servicenow: false, rag_corpus: false };
  try { checks.servicenow = await snClient.ping(); } catch (_) {}
  try { await rag.retrieve('test'); checks.rag_corpus = true; } catch (_) {}
  const status = checks.servicenow && checks.rag_corpus ? 200 : 207;
  res.status(status).json(checks);
});

// ─── Start ───────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;

boot().then(() => {
  app.listen(PORT, () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
  });
});
