import React, { useEffect, useState } from 'react';
import LaptopIcon from './LaptopIcon';

export default function TransferringView({
  senderIp,
  receiverIp,
  currentTransfer,
  onComplete,
  onOpenLayers
}) {
  const [phase, setPhase] = useState('data'); // 'data', 'ack', 'done'
  const [elapsed, setElapsed] = useState(0);

  const payload = currentTransfer?.message || 'Hello World!';
  const seq = currentTransfer?.seq || 10001;
  const ack = currentTransfer?.ack || 50001;
  const byteCount = currentTransfer?.bytes || payload.length;

  const [activeLayerIndex, setActiveLayerIndex] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 10);

    const layerTimer = setInterval(() => {
      setActiveLayerIndex((prev) => (prev + 1) % 6);
    }, 280);

    const t1 = setTimeout(() => {
      setPhase('ack');
    }, 1300);

    const t2 = setTimeout(() => {
      setPhase('done');
      clearInterval(interval);
      clearInterval(layerTimer);
      onComplete?.();
    }, 2600);

    return () => {
      clearInterval(interval);
      clearInterval(layerTimer);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onComplete]);

  const isServer = currentTransfer?.direction === 'server_to_client';

  const layersList = [
    { num: 'L7', name: 'Application', detail: 'Payload String', bytes: `${byteCount} B` },
    { num: 'L4', name: 'Custom TCP', detail: '+20B TCP Header', bytes: `${byteCount + 20} B` },
    { num: 'L4', name: 'UDP Tunnel', detail: '+8B UDP Syscall', bytes: `${byteCount + 28} B` },
    { num: 'L3', name: 'IPv4 Network', detail: '+20B IP Routing', bytes: `${byteCount + 48} B` },
    { num: 'L2', name: 'Data Link', detail: '+14B Ethernet II', bytes: `${byteCount + 62} B` },
    { num: 'L1', name: 'Physical Radio', detail: 'Wi-Fi 802.11 Air', bytes: 'RF Wave' }
  ];

  return (
    <div style={{ maxWidth: '1180px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Title & Phase Status Header */}
      <div style={{ textAlign: 'center', marginBottom: '4px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: phase === 'done' ? '#10B981' : (isServer ? 'var(--teal)' : 'var(--primary)')
          }}></span>
          <span style={{ fontWeight: 600, color: 'var(--text)' }}>
            {phase === 'data' && (isServer ? 'Phase 1: Laptop B (Server) Transmitting Segment ➔ Laptop A' : 'Phase 1: Laptop A (Client) Transmitting Segment ➔ Laptop B')}
            {phase === 'ack' && (isServer ? 'Phase 2: Laptop A (Client) Returning Cumulative ACK ➔ Laptop B' : 'Phase 2: Laptop B (Server) Returning Cumulative ACK ➔ Laptop A')}
            {phase === 'done' && 'Phase 3: Payload Delivered, Checksum Validated & Confirmed'}
          </span>
        </div>

        <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.3px', margin: 0 }}>
          {phase === 'data' && (isServer ? 'Server-to-Client Transport in Flight...' : 'Client-to-Server Transport in Flight...')}
          {phase === 'ack' && 'De-encapsulating & Acknowledging on Wire...'}
          {phase === 'done' && 'Segment Acknowledged & Inverted Checksum 0x0000!'}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '640px', margin: '8px auto 0' }}>
          L7 Application ➔ L4 Custom TCP Stack ➔ L4 UDP Tunnel ➔ L3 IP ➔ L2 MAC ➔ L1 Wi-Fi PHY
        </p>
      </div>

      {/* Flight Radar Stage */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-card)',
        padding: '32px 36px',
        display: 'flex',
        flexDirection: 'column',
        gap: '28px'
      }}>
        {/* Wire & Endpoints Stage */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '220px 1fr 220px',
          alignItems: 'center',
          gap: '24px',
          position: 'relative'
        }}>
          {/* Left Node: Laptop A (Client) */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            background: isServer ? '#F0FDFA' : '#FAF8FF',
            border: `1px solid ${isServer ? 'var(--teal-border)' : 'var(--primary-border)'}`,
            borderRadius: 'var(--radius-md)',
            padding: '16px 20px',
            boxShadow: 'var(--shadow-xs)'
          }}>
            <LaptopIcon variant={isServer ? "receiver" : "sender"} width={64} height={52} />
            <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text)', marginTop: '8px' }}>
              Laptop A (Client)
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: isServer ? 'var(--teal)' : 'var(--primary)', fontWeight: 600, marginTop: '2px' }}>
              {senderIp} :1000
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {isServer ? `RX Buffer: ${byteCount} B` : `TX Buffer: ${byteCount} B`}
            </div>
          </div>

          {/* Central Animated Wire Line */}
          <div style={{
            position: 'relative',
            height: '90px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 20px'
          }}>
            {/* Base Wire Track */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '10px',
              right: '10px',
              height: '2px',
              background: '#E2E8F0',
              zIndex: 1
            }}></div>

            {/* In-Flight Packet: DATA */}
            {phase === 'data' && (
              <div style={{
                position: 'absolute',
                zIndex: 3,
                animation: isServer
                  ? 'flyLeft 1.25s cubic-bezier(0.4, 0, 0.2, 1) forwards'
                  : 'flyRight 1.25s cubic-bezier(0.4, 0, 0.2, 1) forwards',
                background: '#FFFFFF',
                color: 'var(--text)',
                padding: '6px 14px',
                borderRadius: '6px',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.1)',
                border: `1px solid ${isServer ? 'var(--teal-border)' : 'var(--primary-border)'}`,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                fontWeight: 600
              }}>
                {isServer && <span style={{ color: 'var(--teal)', fontWeight: 800 }}>←</span>}
                <span style={{
                  color: isServer ? 'var(--teal)' : 'var(--primary)',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 800,
                  background: isServer ? 'var(--teal-light)' : 'var(--primary-light)',
                  padding: '2px 6px',
                  borderRadius: '4px'
                }}>
                  DATA
                </span>
                <span>"{payload.length > 20 ? payload.slice(0, 18) + '...' : payload}"</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                  Seq: {seq}
                </span>
                {!isServer && <span style={{ color: 'var(--primary)', fontWeight: 800 }}>→</span>}
              </div>
            )}

            {/* In-Flight Packet: ACK */}
            {(phase === 'ack' || phase === 'done') && (
              <div style={{
                position: 'absolute',
                zIndex: 3,
                animation: isServer
                  ? 'flyRight 1.25s cubic-bezier(0.4, 0, 0.2, 1) forwards'
                  : 'flyLeft 1.25s cubic-bezier(0.4, 0, 0.2, 1) forwards',
                background: '#FFFFFF',
                color: 'var(--text)',
                padding: '6px 14px',
                borderRadius: '6px',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.1)',
                border: `1px solid ${isServer ? 'var(--primary-border)' : 'var(--teal-border)'}`,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                fontWeight: 600
              }}>
                {!isServer && <span style={{ color: 'var(--teal)', fontWeight: 800 }}>←</span>}
                <span style={{
                  color: isServer ? 'var(--primary)' : 'var(--teal)',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 800,
                  background: isServer ? 'var(--primary-light)' : 'var(--teal-light)',
                  padding: '2px 6px',
                  borderRadius: '4px'
                }}>
                  ACK
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                  Ack: {seq + byteCount}
                </span>
                <span style={{ color: 'var(--text-subtle)', fontSize: '11px' }}>Win: 65,535</span>
                {isServer && <span style={{ color: 'var(--primary)', fontWeight: 800 }}>→</span>}
              </div>
            )}
          </div>

          {/* Right Node: Laptop B (Server) */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            background: isServer ? '#FAF8FF' : '#F0FDFA',
            border: `1px solid ${isServer ? 'var(--primary-border)' : 'var(--teal-border)'}`,
            borderRadius: 'var(--radius-md)',
            padding: '16px 20px',
            boxShadow: 'var(--shadow-xs)'
          }}>
            <LaptopIcon variant={isServer ? "sender" : "receiver"} width={64} height={52} />
            <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text)', marginTop: '8px' }}>
              Laptop B (Server)
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: isServer ? 'var(--primary)' : 'var(--teal)', fontWeight: 600, marginTop: '2px' }}>
              {receiverIp} :9999
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {isServer ? `TX Buffer: ${byteCount} B` : `RX Buffer: ${byteCount} B`}
            </div>
          </div>
        </div>

        {/* Live Layer Traversal Flow */}
        <div style={{
          background: '#F8FAFC',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '18px 24px',
          boxShadow: 'var(--shadow-xs)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary)' }}></span>
              <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Active Layer Encapsulation Flow {phase === 'data' ? '(TX: Top-Down)' : '(RX: Bottom-Up)'}
              </span>
            </div>
            {onOpenLayers && (
              <button
                onClick={onOpenLayers}
                className="btn btn-outline btn-sm"
                style={{ fontSize: '11px', padding: '4px 12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span>Interactive Header Merging</span>
                <span style={{ color: 'var(--primary)', fontWeight: 800 }}>➔</span>
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px' }}>
            {layersList.map((layer, idx) => {
              const isCurrent = phase === 'data' ? activeLayerIndex === idx : activeLayerIndex === (5 - idx);
              return (
                <div
                  key={idx}
                  style={{
                    padding: '12px 10px',
                    borderRadius: '8px',
                    textAlign: 'center',
                    background: isCurrent
                      ? (phase === 'data' ? '#FAF8FF' : '#F0FDFA')
                      : '#FFFFFF',
                    border: `1px solid ${isCurrent ? (phase === 'data' ? 'var(--primary)' : 'var(--teal)') : 'var(--border)'}`,
                    boxShadow: isCurrent ? 'var(--shadow-xs)' : 'none',
                    transform: isCurrent ? 'translateY(-2px)' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    color: isCurrent ? (phase === 'data' ? 'var(--primary)' : 'var(--teal)') : 'var(--text-muted)'
                  }}>
                    {layer.num}
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', marginTop: '2px', whiteSpace: 'nowrap' }}>
                    {layer.name}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                    {layer.detail}
                  </div>
                  <div style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    color: isCurrent ? (phase === 'data' ? 'var(--primary)' : 'var(--teal)') : 'var(--text-subtle)',
                    marginTop: '4px',
                    fontWeight: 700
                  }}>
                    {layer.bytes}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Telemetry Metrics Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px'
        }}>
          <div style={{
            background: '#FFFFFF',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '14px 18px',
            boxShadow: 'var(--shadow-xs)'
          }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
              Smoothed RTT
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
              23.4 ms
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-subtle)', marginTop: '2px' }}>
              RFC 6298 smoothed filter
            </div>
          </div>

          <div style={{
            background: '#FFFFFF',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '14px 18px',
            boxShadow: 'var(--shadow-xs)'
          }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
              On-Wire Sequence
            </div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', marginTop: '6px', fontFamily: 'var(--font-mono)' }}>
              Seq: <span style={{ color: 'var(--primary)' }}>{seq}</span> ➔ Ack: <span style={{ color: 'var(--teal)' }}>{seq + byteCount}</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-subtle)', marginTop: '4px' }}>
              Payload: {byteCount} B • PSH | ACK
            </div>
          </div>

          <div style={{
            background: '#FFFFFF',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '14px 18px',
            boxShadow: 'var(--shadow-xs)'
          }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
              Congestion Window
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
              10 MSS
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-subtle)', marginTop: '2px' }}>
              Reno Fast Recovery (14,000 B)
            </div>
          </div>

          <div style={{
            background: '#FFFFFF',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '14px 18px',
            boxShadow: 'var(--shadow-xs)'
          }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
              Elapsed Timer
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#10B981', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
              {(elapsed / 1000).toFixed(2)}s
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-subtle)', marginTop: '2px' }}>
              Transmission Loop Active
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
