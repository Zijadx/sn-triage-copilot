import React, { useState, useEffect, useRef } from 'react'
import { useTriage } from './hooks/useTriage'
import { TriageResult } from './components/TriageResult'

const PLACEHOLDER = `Describe the IT issue...

e.g. "VPN client fails to connect after Windows update. Error: 691 - Access denied."`

export default function App() {
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('triage')
  const [logs, setLogs] = useState(null)
  const { result, loading, error, submit } = useTriage()
  const textareaRef = useRef(null)

  function handleSubmit() {
    if (!query.trim() || loading) return
    submit(query.trim())
  }

  function handleKey(e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit()
  }

  async function loadLogs() {
    try {
      const res = await fetch('/api/logs')
      const data = await res.json()
      setLogs(data)
    } catch (_) {
      setLogs(null)
    }
  }

  useEffect(() => {
    if (tab === 'logs') loadLogs()
  }, [tab])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header style={{
        borderBottom: '1px solid var(--border)',
        padding: '0 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '52px',
        background: 'var(--bg-2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{
            fontFamily: 'var(--mono)',
            fontSize: '13px',
            color: 'var(--accent)',
            letterSpacing: '0.05em',
          }}>
            SN-TRIAGE-COPILOT
          </span>
          <span style={{ color: 'var(--border)', fontSize: '16px' }}>·</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
            RAG · Failover · Structured Output
          </span>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {['triage', 'logs'].map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              fontFamily: 'var(--mono)',
              fontSize: '11px',
              letterSpacing: '0.08em',
              padding: '5px 12px',
              borderRadius: '4px',
              border: '1px solid',
              borderColor: tab === t ? 'var(--accent)' : 'transparent',
              color: tab === t ? 'var(--accent)' : 'var(--text-muted)',
              background: tab === t ? 'var(--accent-dim)' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}>
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      {/* Main */}
      <main style={{ flex: 1, maxWidth: '800px', width: '100%', margin: '0 auto', padding: '32px 24px' }}>

        {tab === 'triage' && (
          <>
            {/* Query input */}
            <div style={{
              background: 'var(--bg-2)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '8px 14px',
                borderBottom: '1px solid var(--border)',
                fontFamily: 'var(--mono)',
                fontSize: '11px',
                color: 'var(--text-muted)',
                letterSpacing: '0.08em',
              }}>
                ISSUE INPUT <span style={{ color: 'var(--text-muted)', fontWeight: 300 }}>⌘↵ to submit</span>
              </div>
              <textarea
                ref={textareaRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKey}
                placeholder={PLACEHOLDER}
                rows={5}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  padding: '14px 16px',
                  color: 'var(--text)',
                  fontFamily: 'var(--sans)',
                  fontSize: '14px',
                  lineHeight: 1.6,
                  resize: 'vertical',
                }}
              />
              <div style={{
                padding: '10px 14px',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'flex-end',
              }}>
                <button
                  onClick={handleSubmit}
                  disabled={loading || !query.trim()}
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: '12px',
                    letterSpacing: '0.08em',
                    padding: '8px 20px',
                    borderRadius: '4px',
                    border: '1px solid var(--accent)',
                    color: loading ? 'var(--text-muted)' : 'var(--accent)',
                    background: loading ? 'transparent' : 'var(--accent-dim)',
                    cursor: loading || !query.trim() ? 'not-allowed' : 'pointer',
                    opacity: !query.trim() ? 0.4 : 1,
                    transition: 'all 0.15s',
                  }}
                >
                  {loading ? 'TRIAGING...' : 'TRIAGE →'}
                </button>
              </div>
            </div>

            {/* Loading state */}
            {loading && (
              <div style={{
                marginTop: '20px',
                fontFamily: 'var(--mono)',
                fontSize: '12px',
                color: 'var(--text-muted)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}>
                <div>▸ embedding query...</div>
                <div>▸ searching incident corpus...</div>
                <div>▸ calling claude sonnet...</div>
              </div>
            )}

            {/* Error state */}
            {error && (
              <div style={{
                marginTop: '16px',
                padding: '12px 16px',
                background: 'rgba(224,92,92,0.08)',
                border: '1px solid var(--danger)',
                borderRadius: '4px',
                fontFamily: 'var(--mono)',
                fontSize: '12px',
                color: 'var(--danger)',
              }}>
                ✗ {error}
              </div>
            )}

            {/* Result */}
            {result && <TriageResult result={result} />}
          </>
        )}

        {tab === 'logs' && (
          <div>
            {/* Stats row */}
            {logs?.stats && (
              <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
                {[
                  { label: 'total requests', value: logs.stats.total_requests },
                  { label: 'fallbacks', value: logs.stats.total_fallbacks },
                  { label: 'errors', value: logs.stats.total_errors },
                  { label: 'avg latency', value: `${logs.stats.avg_latency_ms}ms` },
                  { label: 'fallback rate', value: `${logs.stats.fallback_rate_pct}%` },
                ].map(({ label, value }) => (
                  <div key={label} style={{
                    background: 'var(--bg-2)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '12px 16px',
                    minWidth: '120px',
                    flex: '1',
                  }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '6px' }}>
                      {label.toUpperCase()}
                    </div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: '20px', color: 'var(--accent)', fontWeight: 500 }}>
                      {value ?? '—'}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Log table */}
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                RECENT REQUESTS
              </div>
              {logs?.logs?.length === 0 && (
                <div style={{ padding: '24px 16px', fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--text-muted)' }}>
                  No requests yet.
                </div>
              )}
              {logs?.logs?.map((log) => (
                <div key={log.id} style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 160px 80px 70px 60px',
                  gap: '12px',
                  padding: '10px 16px',
                  borderBottom: '1px solid var(--border)',
                  fontSize: '12px',
                  alignItems: 'center',
                }}>
                  <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.query_preview}
                  </span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
                    {log.model_used}
                  </span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
                    {log.latency_ms}ms
                  </span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: log.fallback_triggered ? 'var(--warn)' : 'var(--text-muted)' }}>
                    {log.fallback_triggered ? 'FALLBACK' : 'primary'}
                  </span>
                  <span style={{
                    fontFamily: 'var(--mono)',
                    fontSize: '10px',
                    color: log.confidence === 'high' ? 'var(--high)' : log.confidence === 'medium' ? 'var(--medium)' : 'var(--low)',
                  }}>
                    {log.confidence?.toUpperCase() || '—'}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '12px', textAlign: 'right' }}>
              <button onClick={loadLogs} style={{
                fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-muted)',
                background: 'transparent', border: 'none', cursor: 'pointer', letterSpacing: '0.08em',
              }}>
                ↺ REFRESH
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
