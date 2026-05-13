import React from 'react'

export function MetaBar({ modelUsed, latencyMs, fallbackTriggered, ragHits }) {
  return (
    <div style={{
      display: 'flex',
      gap: '20px',
      flexWrap: 'wrap',
      fontFamily: 'var(--mono)',
      fontSize: '11px',
      color: 'var(--text-muted)',
      padding: '10px 0',
      borderTop: '1px solid var(--border)',
      marginTop: '16px',
    }}>
      <span>model <span style={{ color: 'var(--accent)' }}>{modelUsed}</span></span>
      <span>latency <span style={{ color: 'var(--text)' }}>{latencyMs}ms</span></span>
      <span>rag hits <span style={{ color: 'var(--text)' }}>{ragHits}</span></span>
      {fallbackTriggered && (
        <span style={{ color: 'var(--warn)' }}>⚠ fallback triggered</span>
      )}
    </div>
  )
}
