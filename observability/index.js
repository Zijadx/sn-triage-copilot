/**
 * observability/index.js
 *
 * Lightweight request logger. Persists each triage request to SQLite
 * so you can demo a live log table and talk through metrics.
 *
 * Schema: id, timestamp, query_preview, model_used, fallback_triggered,
 *         latency_ms, confidence, rag_hits, error
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'triage_log.sqlite');
const db = new Database(DB_PATH);

// Initialize table on first run
db.exec(`
  CREATE TABLE IF NOT EXISTS triage_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp       TEXT    NOT NULL,
    query_preview   TEXT    NOT NULL,
    model_used      TEXT    NOT NULL,
    fallback_triggered INTEGER NOT NULL DEFAULT 0,
    latency_ms      INTEGER NOT NULL,
    confidence      TEXT,
    rag_hits        INTEGER NOT NULL DEFAULT 0,
    error           INTEGER NOT NULL DEFAULT 0
  )
`);

/**
 * Log a completed triage request.
 */
function logRequest({ query, modelUsed, fallbackTriggered, latencyMs, confidence, ragHits, error }) {
  const stmt = db.prepare(`
    INSERT INTO triage_log
      (timestamp, query_preview, model_used, fallback_triggered, latency_ms, confidence, rag_hits, error)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    new Date().toISOString(),
    query.slice(0, 120),        // store preview only — no PII risk
    modelUsed || 'unknown',
    fallbackTriggered ? 1 : 0,
    latencyMs,
    confidence || null,
    ragHits || 0,
    error ? 1 : 0
  );
}

/**
 * Return recent log entries for the dashboard.
 */
function getRecentLogs(limit = 50) {
  return db
    .prepare('SELECT * FROM triage_log ORDER BY id DESC LIMIT ?')
    .all(limit);
}

/**
 * Return aggregate stats for the dashboard header.
 */
function getStats() {
  return db.prepare(`
    SELECT
      COUNT(*)                                          AS total_requests,
      SUM(fallback_triggered)                           AS total_fallbacks,
      SUM(error)                                        AS total_errors,
      ROUND(AVG(latency_ms))                            AS avg_latency_ms,
      ROUND(100.0 * SUM(fallback_triggered) / COUNT(*), 1) AS fallback_rate_pct
    FROM triage_log
  `).get();
}

module.exports = { logRequest, getRecentLogs, getStats };
