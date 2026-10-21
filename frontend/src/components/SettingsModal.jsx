import React, { useState } from 'react';

export default function SettingsModal({
  isOpen,
  config,
  onSave,
  onClose
}) {
  if (!isOpen) return null;

  const [senderIp, setSenderIp] = useState(config.senderIp || '192.168.1.101');
  const [receiverIp, setReceiverIp] = useState(config.receiverIp || '192.168.1.102');
  const [port, setPort] = useState(config.port || '9999');
  const [apiUrl, setApiUrl] = useState(config.apiUrl || 'http://localhost:8080');

  const handleSave = (e) => {
    e.preventDefault();
    onSave({ senderIp, receiverIp, port, apiUrl });
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.55)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }} onClick={onClose}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: 'var(--radius-md)',
        width: '100%',
        maxWidth: '500px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(109, 40, 217, 0.25), 0 0 0 1px rgba(124, 58, 237, 0.1)',
        border: '1px solid var(--border)',
        overflow: 'hidden'
      }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(180deg, #FAF8FF 0%, #FFFFFF 100%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--primary)'
            }}></span>
            <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.2px' }}>
              Stack Configuration
            </h3>
          </div>
          <button onClick={onClose} className="icon-btn" style={{ width: '32px', height: '32px' }}>
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--text)', marginBottom: '6px' }}>
              Sender IP (Local Device)
            </label>
            <input
              type="text"
              value={senderIp}
              onChange={(e) => setSenderIp(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                color: 'var(--text)',
                boxShadow: 'var(--shadow-inner)'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--text)', marginBottom: '6px' }}>
              Receiver IP (Remote Peer)
            </label>
            <input
              type="text"
              value={receiverIp}
              onChange={(e) => setReceiverIp(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                color: 'var(--text)',
                boxShadow: 'var(--shadow-inner)'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--text)', marginBottom: '6px' }}>
                UDP Tunnel Port
              </label>
              <input
                type="text"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '13px',
                  color: 'var(--text)',
                  boxShadow: 'var(--shadow-inner)'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--text)', marginBottom: '6px' }}>
                MSS (Clamped)
              </label>
              <input
                type="text"
                value="1400 bytes"
                disabled
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  background: '#F8FAFC',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '13px'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--text)', marginBottom: '6px' }}>
              C Telemetry API Endpoint
            </label>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="http://localhost:8080"
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                color: 'var(--text)',
                boxShadow: 'var(--shadow-inner)'
              }}
            />
            <small style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '4px', display: 'block' }}>
              Synchronizes with C transport telemetry server (`src/telemetry_server.c`)
            </small>
          </div>

          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            marginTop: '8px',
            paddingTop: '18px',
            borderTop: '1px solid var(--border)'
          }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
