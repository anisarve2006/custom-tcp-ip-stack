import React, { useState } from 'react';

export default function SendMessageView({
  senderIp,
  receiverIp,
  senderSeq,
  receiverSeq,
  onSend,
  onRefreshSeq
}) {
  const [direction, setDirection] = useState('client_to_server'); // 'client_to_server' or 'server_to_client'
  const [message, setMessage] = useState('Hello World!');

  const isServer = direction === 'server_to_client';
  const activeSenderIp = isServer ? receiverIp : senderIp;
  const activeSenderPort = isServer ? 9999 : 1000;
  const activeReceiverIp = isServer ? senderIp : receiverIp;
  const activeReceiverPort = isServer ? 1000 : 9999;

  const activeTxSeq = isServer ? receiverSeq : senderSeq;
  const activeRxAck = isServer ? senderSeq : receiverSeq;

  const byteLength = new TextEncoder().encode(message).length;

  const clientShortcuts = [
    'Hello World!',
    'GET /api/data',
    'Custom L4 Transport Test',
    'Hello Professor!'
  ];

  const serverShortcuts = [
    'HTTP/1.1 200 OK - Stream Ready',
    'ACK: 42 Bytes Received & Verified',
    'Server Telemetry OK',
    'Hello Client from Laptop B!'
  ];

  const currentShortcuts = isServer ? serverShortcuts : clientShortcuts;

  const handleSend = () => {
    if (!message.trim()) {
      alert('Please enter a message to send!');
      return;
    }
    onSend(message, direction);
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1.5fr 1fr',
      gap: '20px'
    }}>
      {/* Left Composer Card */}
      <div className="card">
        <div className="card-header" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="card-title">
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              background: isServer ? 'var(--teal-light)' : 'var(--primary-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `1px solid ${isServer ? 'var(--teal-border)' : 'var(--primary-border)'}`
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isServer ? 'var(--teal)' : 'var(--primary)'} strokeWidth="2.2">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </div>
            <span>Send Transport Payload</span>
          </div>
          <span style={{
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)'
          }}>
            MSS: 1,400 B
          </span>
        </div>

        <div className="card-body">
          {/* Transmission Role / Direction Selector */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              display: 'block',
              marginBottom: '8px'
            }}>
              Transmission Direction (Bidirectional Support)
            </label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              background: '#F1F5F9',
              padding: '4px',
              borderRadius: '8px'
            }}>
              <button
                type="button"
                onClick={() => {
                  setDirection('client_to_server');
                  setMessage('Hello World!');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: direction === 'client_to_server' ? '1px solid var(--primary-border)' : '1px solid transparent',
                  background: direction === 'client_to_server' ? '#FFFFFF' : 'transparent',
                  color: direction === 'client_to_server' ? 'var(--primary)' : 'var(--text-muted)',
                  boxShadow: direction === 'client_to_server' ? 'var(--shadow-xs)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>Laptop A (Client) ➔ Laptop B</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDirection('server_to_client');
                  setMessage('HTTP/1.1 200 OK - Stream Ready');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: direction === 'server_to_client' ? '1px solid var(--teal-border)' : '1px solid transparent',
                  background: direction === 'server_to_client' ? '#FFFFFF' : 'transparent',
                  color: direction === 'server_to_client' ? 'var(--teal)' : 'var(--text-muted)',
                  boxShadow: direction === 'server_to_client' ? 'var(--shadow-xs)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>Laptop B (Server) ➔ Laptop A</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text)' }}>
                Application Message ({isServer ? 'Server Payload' : 'Client Payload'})
              </label>
              <div style={{
                fontSize: '11px',
                color: byteLength > 1400 ? 'var(--danger)' : 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                background: '#F8FAFC',
                padding: '2px 8px',
                borderRadius: '4px',
                border: '1px solid var(--border)'
              }}>
                {byteLength} / 1400 bytes
              </div>
            </div>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message to send over the custom user-space transport protocol..."
              style={{
                width: '100%',
                height: '115px',
                padding: '14px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-sans)',
                fontSize: '14px',
                color: 'var(--text)',
                resize: 'vertical',
                background: '#FFFFFF',
                boxShadow: 'var(--shadow-inner)'
              }}
            />
          </div>

          <button
            className={`btn ${isServer ? 'btn-teal' : 'btn-primary'}`}
            onClick={handleSend}
            style={{
              width: '100%',
              padding: '12px 20px',
              fontSize: '15px',
              background: isServer ? 'var(--teal)' : undefined,
              borderColor: isServer ? 'var(--teal)' : undefined
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
            <span>
              {isServer ? 'Transmit from Server (Laptop B) ➔ Client (Laptop A)' : 'Transmit from Client (Laptop A) ➔ Server (Laptop B)'}
            </span>
          </button>

          {/* Preset Chips */}
          <div style={{ marginTop: '20px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
              Sample Quick-Fill Payloads ({isServer ? 'Server Responses' : 'Client Requests'})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {currentShortcuts.map((text) => (
                <button
                  key={text}
                  onClick={() => setMessage(text)}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '5px 12px',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--text)',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-xs)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = isServer ? 'var(--teal)' : 'var(--primary)';
                    e.currentTarget.style.color = isServer ? 'var(--teal)' : 'var(--primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.color = 'var(--text)';
                  }}
                >
                  {text}
                </button>
              ))}
              <button
                onClick={() => setMessage('')}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '5px 12px',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--danger)';
                  e.currentTarget.style.borderColor = 'var(--danger-border)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-muted)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                }}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Info Panels */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {/* Connection Info */}
        <div className="card">
          <div className="card-header" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="card-title">
              <div style={{
                width: '26px',
                height: '26px',
                borderRadius: '6px',
                background: 'var(--primary-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--primary-border)'
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
              </div>
              <span>Connection Parameters</span>
            </div>
          </div>
          <div className="card-body" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Protocol Status:</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#10B981' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981' }}></span>
                  ESTABLISHED
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                  Sender ({isServer ? 'Laptop B - Server' : 'Laptop A - Client'}):
                </span>
                <span className="mono-text" style={{ fontWeight: 600, color: isServer ? 'var(--teal)' : 'var(--primary)' }}>
                  {activeSenderIp}:{activeSenderPort}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                  Receiver ({isServer ? 'Laptop A - Client' : 'Laptop B - Server'}):
                </span>
                <span className="mono-text" style={{ fontWeight: 600, color: isServer ? 'var(--primary)' : 'var(--teal)' }}>
                  {activeReceiverIp}:{activeReceiverPort}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Underlying Transport:</span>
                <span style={{ fontWeight: 600, fontSize: '13px' }}>User UDP Tunnel</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Protocol Mode:</span>
                <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--primary)' }}>Full Duplex / Bidirectional</span>
              </div>
            </div>
          </div>
        </div>

        {/* Current Sequence Numbers */}
        <div className="card">
          <div className="card-header" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="card-title">
              <div style={{
                width: '26px',
                height: '26px',
                borderRadius: '6px',
                background: 'var(--primary-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--primary-border)'
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
              </div>
              <span>Sequence Tracking ({isServer ? 'Server Sending' : 'Client Sending'})</span>
            </div>
            <button
              className="icon-btn"
              onClick={onRefreshSeq}
              title="Increment / Advance Sequence"
              style={{ width: '30px', height: '30px' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M23 4v6h-6"></path>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
              </svg>
            </button>
          </div>
          <div className="card-body" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px',
                background: isServer ? 'var(--teal-light)' : 'var(--primary-light)',
                border: `1px solid ${isServer ? 'var(--teal-border)' : 'var(--primary-border)'}`,
                borderRadius: 'var(--radius-sm)'
              }}>
                <div>
                  <div style={{ fontSize: '11px', color: isServer ? 'var(--teal)' : 'var(--primary)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Active Sender Seq (TX: {isServer ? 'Server' : 'Client'})
                  </div>
                  <div className="mono-text" style={{ fontWeight: 800, color: isServer ? 'var(--teal)' : 'var(--primary)', fontSize: '18px', marginTop: '2px' }}>
                    {activeTxSeq}
                  </div>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>+{byteLength}B on send</span>
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px',
                background: isServer ? 'var(--primary-light)' : 'var(--teal-light)',
                border: `1px solid ${isServer ? 'var(--primary-border)' : 'var(--teal-border)'}`,
                borderRadius: 'var(--radius-sm)'
              }}>
                <div>
                  <div style={{ fontSize: '11px', color: isServer ? 'var(--primary)' : 'var(--teal)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Expected Receiver Ack (RX: {isServer ? 'Client' : 'Server'})
                  </div>
                  <div className="mono-text" style={{ fontWeight: 800, color: isServer ? 'var(--primary)' : 'var(--teal)', fontSize: '18px', marginTop: '2px' }}>
                    {activeRxAck}
                  </div>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Cumul. Ack</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
