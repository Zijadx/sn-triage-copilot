/**
 * api/server.js
 *
 * Express server — the orchestration layer.
 * Imports RAG, AI chain, observability, and SN client.
 * Exposes three endpoints:
 *   POST /api/triage   — main triage flow
 *   GET  /api/logs     — recent request log
 *   GET  /api/health   — connectivity check
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');

const rag = require('../rag');
const { triage } = require('../ai-chain');
const { logRequest, getRecentLogs, getStats } = require('../observability');
const snClient = require('../sn-client');

const app = express();
app.use(express.json());
app.use(cors({ origin: 'http://localhost:5173' })); // Vite dev server

// ─── Startup: seed the RAG corpus ────────────────────────────────────────────

async function boot() {
  console.log('[Boot] Connecting to ServiceNow...');
  try {
    const incidents = await snClient.getResolvedIncidents({ limit: 200 });
    await rag.seedCorpus(incidents);
    console.log('[Boot] RAG corpus ready.');
  } catch (err) {
    console.error('[Boot] Failed to seed RAG corpus:', err.message);
    console.warn('[Boot] Continuing without RAG context. Triage will still work.');
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * POST /api/triage
 * Body: { query: string }
 * Returns the full triage result including model metadata.
 */
app.post('/api/triage', async (req, res) => {
  const { query } = req.body;

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return res.status(400).json({ error: 'query is required' });
  }

  const start = Date.now();

  try {
    // 1. RAG — retrieve similar incidents
    const ragResults = await rag.retrieve(query);
    const ragContext = rag.formatContext(ragResults);

    // 2. AI chain — triage with failover
    const aiResult = await triage(query, ragContext);

    const latencyMs = Date.now() - start;

    // 3. Observability — log the request
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

/**
 * GET /api/logs
 * Returns recent triage log entries + aggregate stats.
 */
app.get('/api/logs', (req, res) => {
  try {
    const logs = getRecentLogs(50);
    const stats = getStats();
    res.json({ stats, logs });
  } catch (err) {
    res.status(500).json({ error: 'Could not retrieve logs.' });
  }
});

/**
 * GET /api/health
 * Checks SN connectivity and RAG corpus status.
 */
app.get('/api/health', async (req, res) => {
  const checks = { api: true, servicenow: false, rag_corpus: false };

  try {
    checks.servicenow = await snClient.ping();
  } catch (_) {}

  try {
    const test = await rag.retrieve('test connectivity');
    checks.rag_corpus = true;
  } catch (_) {}

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
