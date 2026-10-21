import React from 'react';

export default function StepperNav({ activeStep, completedSteps = [], onSelectStep }) {
  const flowSteps = [
    { id: 1, label: 'Handshake', step: '01' },
    { id: 2, label: 'Send Payload', step: '02' },
    { id: 3, label: 'In-Flight Transfer', step: '03' },
    { id: 4, label: 'Delivery Results', step: '04' }
  ];

  return (
    <nav style={{
      background: '#FAFAFE',
      borderBottom: '1px solid var(--border)',
      padding: '10px 36px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '12px'
    }}>
      {/* Clean Minimalist Tab Rail */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: '#EEF2F6',
        padding: '3px',
        borderRadius: '8px',
        gap: '2px'
      }}>
        {flowSteps.map((s) => {
          const isActive = activeStep === s.id;
          const isDone = completedSteps.includes(s.id) && !isActive;

          return (
            <button
              key={s.id}
              onClick={() => onSelectStep(s.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 16px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                border: 'none',
                background: isActive ? '#FFFFFF' : 'transparent',
                color: isActive ? 'var(--text)' : 'var(--text-muted)',
                boxShadow: isActive ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.color = 'var(--text)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.color = 'var(--text-muted)';
              }}
            >
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: isActive ? 'var(--primary)' : isDone ? '#10B981' : '#94A3B8',
                fontWeight: 600
              }}>
                {isDone ? '✓' : s.step}
              </span>
              <span>{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* Understated Status Metadata */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '12px',
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono)'
      }}>
        <span style={{ color: 'var(--text-subtle)' }}>protocol:</span>
        <span style={{ color: 'var(--text)', fontWeight: 600 }}>RFC 793 User-Space</span>
      </div>
    </nav>
  );
}
