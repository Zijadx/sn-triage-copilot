const logs = [];
let idCounter = 1;

function logRequest({ query, modelUsed, fallbackTriggered, latencyMs, confidence, ragHits, error }) {
  logs.unshift({
    id: idCounter++,
    timestamp: new Date().toISOString(),
    query_preview: (query || '').slice(0, 120),
    model_used: modelUsed || 'unknown',
    fallback_triggered: fallbackTriggered ? 1 : 0,
    latency_ms: latencyMs,
    confidence: confidence || null,
    rag_hits: ragHits || 0,
    error: error ? 1 : 0,
  });
}

function getRecentLogs(limit = 50) {
  return logs.slice(0, limit);
}

function getStats() {
  if (logs.length === 0) {
    return { total_requests: 0, total_fallbacks: 0, total_errors: 0, avg_latency_ms: 0, fallback_rate_pct: 0 };
  }
  const total = logs.length;
  const fallbacks = logs.filter(l => l.fallback_triggered).length;
  const errors = logs.filter(l => l.error).length;
  const avgLatency = Math.round(logs.reduce((s, l) => s + l.latency_ms, 0) / total);
  return {
    total_requests: total,
    total_fallbacks: fallbacks,
    total_errors: errors,
    avg_latency_ms: avgLatency,
    fallback_rate_pct: parseFloat((100 * fallbacks / total).toFixed(1)),
  };
}

module.exports = { logRequest, getRecentLogs, getStats };
