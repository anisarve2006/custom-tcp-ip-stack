import React from 'react';

export default function Header({
  senderIp = '192.168.1.101',
  receiverIp = '192.168.1.102',
  port = '9999',
  status = 'ESTABLISHED',
  onOpenSettings
}) {
  const isConnected = status === 'ESTABLISHED';

  return (
    <header style={{
      background: '#FFFFFF',
      borderBottom: '1px solid var(--border)',
      padding: '16px 36px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }}>
      {/* Brand & Stack Identity - Clean & Minimal */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <img
          src="/logo.png"
          alt="ProtoLink Logo"
          style={{
            height: '42px',
            width: 'auto',
            maxHeight: '42px',
            objectFit: 'contain',
            display: 'block'
          }}
        />
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.3px' }}>
              ProtoLink
            </span>
            <span style={{ color: '#CBD5E1', fontSize: '14px' }}>/</span>
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)' }}>
              Custom Network Protocol Lab
            </span>
          </div>
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-subtle)', marginTop: '1px', letterSpacing: '0.2px' }}>
            Connect. Transmit. Acknowledge.
          </div>
        </div>
      </div>

      {/* Minimal Status & Socket Endpoint Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        {/* Connection State - Minimalist Dot + Typography */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
          <span style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: isConnected ? '#10B981' : '#F59E0B'
          }}></span>
          <span style={{ fontWeight: 600, color: 'var(--text)' }}>
            {isConnected ? 'ESTABLISHED' : status}
          </span>
          <span style={{ color: '#CBD5E1' }}>•</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>
            UDP :{port}
          </span>
        </div>

        {/* Minimal Settings Trigger */}
        <button
          className="icon-btn"
          onClick={onOpenSettings}
          title="Protocol Settings"
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '6px',
            border: '1px solid var(--border)',
            background: '#FFFFFF'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>
      </div>
    </header>
  );
}
