import React from 'react'
import { ConfidenceBadge } from './ConfidenceBadge'
import { MetaBar } from './MetaBar'

const card = {
  background: 'var(--bg-2)',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  padding: '20px 24px',
  marginTop: '16px',
}

export function TriageResult({ result }) {
  const { answer, confidence, sources, reasoning, model_used,
          fallback_triggered, rag_hits, latency_ms, similar_incidents } = result

  return (
    <div style={card}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
          RESOLUTION
        </span>
        <ConfidenceBadge level={confidence} />
      </div>

      {/* Answer */}
      <p style={{ color: 'var(--text)', lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: '16px' }}>
        {answer}
      </p>

      {/* Reasoning */}
      {reasoning && (
        <div style={{
          background: 'var(--bg-3)',
          border: '1px solid var(--border)',
          borderLeft: '3px solid var(--accent-dim)',
          borderRadius: '4px',
          padding: '10px 14px',
          marginBottom: '16px',
          fontSize: '13px',
          color: 'var(--text-muted)',
        }}>
          {reasoning}
        </div>
      )}

      {/* Sources */}
      {sources?.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
            SOURCES{' '}
          </span>
          {sources.map((s) => (
            <span key={s} style={{
              display: 'inline-block',
              fontFamily: 'var(--mono)',
              fontSize: '11px',
              color: 'var(--accent)',
              background: 'var(--accent-dim)',
              padding: '2px 7px',
              borderRadius: '3px',
              marginRight: '6px',
              marginTop: '4px',
            }}>
              {s}
            </span>
          ))}
        </div>
      )}

      {/* Similar incidents accordion */}
      {similar_incidents?.length > 0 && (
        <details style={{ marginTop: '12px' }}>
          <summary style={{
            fontFamily: 'var(--mono)',
            fontSize: '11px',
            color: 'var(--text-muted)',
            letterSpacing: '0.08em',
            cursor: 'pointer',
            userSelect: 'none',
          }}>
            RAG CONTEXT — {similar_incidents.length} similar incidents
          </summary>
          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {similar_incidents.map((inc) => (
              <div key={inc.sys_id} style={{
                background: 'var(--bg-3)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                padding: '10px 14px',
                fontSize: '13px',
              }}>
                <div style={{ fontFamily: 'var(--mono)', color: 'var(--accent)', fontSize: '11px', marginBottom: '4px' }}>
                  {inc.number}
                </div>
                <div style={{ color: 'var(--text)', marginBottom: '4px' }}>{inc.short_description}</div>
                {inc.close_notes && (
                  <div style={{ color: 'var(--text-muted)' }}>{inc.close_notes}</div>
                )}
              </div>
            ))}
          </div>
        </details>
      )}

      <MetaBar
        modelUsed={model_used}
        latencyMs={latency_ms}
        fallbackTriggered={fallback_triggered}
        ragHits={rag_hits}
      />
    </div>
  )
}
