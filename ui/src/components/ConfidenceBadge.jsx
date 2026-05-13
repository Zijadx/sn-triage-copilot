import React from 'react'

const labels = { high: 'HIGH', medium: 'MED', low: 'LOW' }

export function ConfidenceBadge({ level }) {
  return (
    <span style={{
      fontFamily: 'var(--mono)',
      fontSize: '11px',
      fontWeight: 500,
      letterSpacing: '0.08em',
      padding: '3px 8px',
      borderRadius: '3px',
      border: `1px solid var(--${level})`,
      color: `var(--${level})`,
      background: 'transparent',
    }}>
      {labels[level] || level?.toUpperCase()}
    </span>
  )
}
