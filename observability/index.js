/**
 * observability/index.js
 *
 * Structured logging for the triage service.
 *
 * Every request emits one JSON line to stdout — the canonical log stream
 * that a real deployment ships to Datadog / CloudWatch / Loki / etc.
 * A capped in-memory ring buffer is kept ONLY so the demo dashboard
 * (/api/logs) has something to render without standing up a log backend.
 * Restart wipes it; horizontal scaling makes it per-replica. Do not treat
 * it as durable storage.
 */

const RING_SIZE = parseInt(process.env.LOG_BUFFER_SIZE || '500', 10);
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const ring = [];
let idCounter = 1;

function emit(entry) {
  process.stdout.write(JSON.stringify(entry) + '\n');
}

function logRequest({ query, modelUsed, fallbackTriggered, latencyMs, confidence, ragHits, error }) {
  const entry = {
    ts: new Date().toISOString(),
    level: error ? 'error' : (fallbackTriggered ? 'warn' : 'info'),
    event: 'triage_request',
    id: idCounter++,
    query_preview: (query || '').slice(0, 120),
    model_used: modelUsed || 'unknown',
    fallback_triggered: !!fallbackTriggered,
    latency_ms: latencyMs,
    confidence: confidence || null,
    rag_hits: ragHits || 0,
    error: !!error,
  };

  if (LOG_LEVEL !== 'silent') emit(entry);

  ring.unshift(entry);
  if (ring.length > RING_SIZE) ring.length = RING_SIZE;
}

function getRecentLogs(limit = 50) {
  return ring.slice(0, limit);
}

function getStats() {
  if (ring.length === 0) {
    return { total_requests: 0, total_fallbacks: 0, total_errors: 0, avg_latency_ms: 0, fallback_rate_pct: 0 };
  }
  const total = ring.length;
  const fallbacks = ring.filter(l => l.fallback_triggered).length;
  const errors = ring.filter(l => l.error).length;
  const avgLatency = Math.round(ring.reduce((s, l) => s + (l.latency_ms || 0), 0) / total);
  return {
    total_requests: total,
    total_fallbacks: fallbacks,
    total_errors: errors,
    avg_latency_ms: avgLatency,
    fallback_rate_pct: parseFloat((100 * fallbacks / total).toFixed(1)),
  };
}

module.exports = { logRequest, getRecentLogs, getStats };
