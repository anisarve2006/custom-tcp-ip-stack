import React from 'react';
import LaptopIcon from './LaptopIcon';

export default function ResultsView({
  transfer,
  senderIp,
  receiverIp,
  onSendAgain,
  onViewHistory,
  onInspectPacket,
  onViewLayers
}) {
  const payload = transfer?.message || 'Hello World!';
  const bytes = transfer?.bytes || new TextEncoder().encode(payload).length;
  const seq = transfer?.seq || 10001;
  const ack = transfer?.ack || 50001;
  const sentTime = transfer?.sentTime || '2026-10-22 01:21:04.120';
  const recvTime = transfer?.recvTime || '2026-10-22 01:21:04.143';
  const rtt = transfer?.rtt || '23.4 ms';
  const totalWire = 14 + 20 + 8 + 20 + bytes + 4; // Eth + IP + UDP + CustomTCP + Payload + FCS
  const isServer = transfer?.direction === 'server_to_client';
  const activeSenderName = isServer ? `Laptop B - Server (${receiverIp})` : `Laptop A - Client (${senderIp})`;
  const activeReceiverName = isServer ? `Laptop A - Client (${senderIp})` : `Laptop B - Server (${receiverIp})`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Clean Delivery Confirmation Header */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: 'var(--shadow-sm)',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            background: '#ECFDF5',
            border: '1px solid #A7F3D0',
            color: '#059669',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 700
          }}>
            ✓
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)' }}>
              Message Delivered & Acknowledged ({isServer ? 'Server ➔ Client' : 'Client ➔ Server'})
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '1px' }}>
              Verified in user-space RX buffer • Inverted 16-bit Checksum: <span className="mono-text" style={{ color: '#059669', fontWeight: 600 }}>0x0000</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {onViewLayers && (
            <button
              className="btn btn-outline btn-sm"
              onClick={onViewLayers}
              style={{ borderColor: 'var(--primary-border)', color: 'var(--primary)', background: '#FFFFFF' }}
            >
              OSI Layer Breakdown ↗
            </button>
          )}
          <button
            className="btn btn-outline btn-sm"
            onClick={() => onInspectPacket?.(transfer)}
            style={{ borderColor: 'var(--success-border)', color: '#065F46', background: '#FFFFFF' }}
          >
            Inspect 20-Byte Header
          </button>
        </div>
      </div>

      {/* Layer Encapsulation Overview Strip */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '16px 20px',
        boxShadow: 'var(--shadow-card)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Multi-Layer Packet Encapsulation Summary
          </span>
          <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--primary)', fontWeight: 700 }}>
            Total On-Wire Frame: {totalWire} Bytes
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
          <div style={{ padding: '6px 12px', borderRadius: '6px', background: 'var(--primary-light)', border: '1px solid var(--primary-border)', textAlign: 'center' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--primary)' }}>Application</div>
            <div style={{ fontSize: '12px', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{bytes} B</div>
          </div>
          <span style={{ color: 'var(--text-muted)' }}>+</span>
          <div style={{ padding: '6px 12px', borderRadius: '6px', background: '#FAF5FF', border: '1px solid #DDD6FE', textAlign: 'center' }}>
            <div style={{ fontSize: '10px', fontWeight: 800, color: '#7C3AED' }}>Custom TCP</div>
            <div style={{ fontSize: '12px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#7C3AED' }}>20 B</div>
          </div>
          <span style={{ color: 'var(--text-muted)' }}>+</span>
          <div style={{ padding: '6px 12px', borderRadius: '6px', background: 'var(--teal-light)', border: '1px solid var(--teal-border)', textAlign: 'center' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--teal)' }}>UDP Tunnel</div>
            <div style={{ fontSize: '12px', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>8 B</div>
          </div>
          <span style={{ color: 'var(--text-muted)' }}>+</span>
          <div style={{ padding: '6px 12px', borderRadius: '6px', background: '#EFF6FF', border: '1px solid #BFDBFE', textAlign: 'center' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#2563EB' }}>IPv4 Header</div>
            <div style={{ fontSize: '12px', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>20 B</div>
          </div>
          <span style={{ color: 'var(--text-muted)' }}>+</span>
          <div style={{ padding: '6px 12px', borderRadius: '6px', background: '#F8FAFC', border: '1px solid #CBD5E1', textAlign: 'center' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748B' }}>Ethernet + FCS</div>
            <div style={{ fontSize: '12px', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>18 B</div>
          </div>
          <span style={{ color: 'var(--text-muted)' }}>=</span>
          <div style={{ padding: '6px 14px', borderRadius: '6px', background: '#FAF5FF', border: '1px solid var(--primary)', textAlign: 'center' }}>
            <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--primary)' }}>Physical Wire</div>
            <div style={{ fontSize: '12px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>{totalWire * 8} bits</div>
          </div>
        </div>
      </div>

      {/* Side-by-Side Comparison Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '20px'
      }}>
        {/* Sender Side */}
        <div className="card">
          <div className="card-header" style={{ borderTop: `4px solid ${isServer ? 'var(--teal)' : 'var(--primary)'}` }}>
            <div className="card-title">
              <LaptopIcon variant={isServer ? "receiver" : "sender"} width={28} height={24} />
              <span>Sender Side: {activeSenderName}</span>
            </div>
            <span style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)'
            }}>
              TX Buffer
            </span>
          </div>
          <div className="card-body">
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Transmitted Message:</div>
              <div style={{
                background: isServer ? '#F0FDFA' : '#FAF8FF',
                border: `1px solid ${isServer ? 'var(--teal-border)' : 'var(--primary-border)'}`,
                borderRadius: 'var(--radius-sm)',
                padding: '14px',
                fontFamily: 'var(--font-mono)',
                fontSize: '14px',
                color: 'var(--text)',
                fontWeight: 600,
                wordBreak: 'break-all',
                boxShadow: 'var(--shadow-inner)'
              }}>
                {payload}
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '10px 0', color: 'var(--text-muted)' }}>Payload Size</td>
                  <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{bytes} bytes</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '10px 0', color: 'var(--text-muted)' }}>Sequence Number (TX)</td>
                  <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-mono)', color: isServer ? 'var(--teal)' : 'var(--primary)' }}>{seq}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '10px 0', color: 'var(--text-muted)' }}>Timestamp Sent</td>
                  <td style={{ padding: '10px 0', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{sentTime}</td>
                </tr>
                <tr>
                  <td style={{ padding: '10px 0', color: 'var(--text-muted)' }}>Congestion Window (cwnd)</td>
                  <td style={{ padding: '10px 0', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>10 MSS (14,000 B)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Receiver Side */}
        <div className="card">
          <div className="card-header" style={{ borderTop: `4px solid ${isServer ? 'var(--primary)' : 'var(--teal)'}` }}>
            <div className="card-title">
              <LaptopIcon variant={isServer ? "sender" : "receiver"} width={28} height={24} />
              <span>Receiver Side: {activeReceiverName}</span>
            </div>
            <span style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)'
            }}>
              RX Buffer
            </span>
          </div>
          <div className="card-body">
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Received Message:</div>
              <div style={{
                background: '#F0FDFA',
                border: '1px solid var(--teal-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '14px',
                fontFamily: 'var(--font-mono)',
                fontSize: '14px',
                color: '#0F766E',
                fontWeight: 700,
                wordBreak: 'break-all',
                boxShadow: 'var(--shadow-inner)'
              }}>
                {payload}
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '10px 0', color: 'var(--text-muted)' }}>Bytes Verified</td>
                  <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{bytes} bytes</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '10px 0', color: 'var(--text-muted)' }}>Acknowledgment Generated (RX)</td>
                  <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--teal)' }}>{seq + bytes}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '10px 0', color: 'var(--text-muted)' }}>Timestamp Received</td>
                  <td style={{ padding: '10px 0', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{recvTime}</td>
                </tr>
                <tr>
                  <td style={{ padding: '10px 0', color: 'var(--text-muted)' }}>Round Trip Measured (RTT)</td>
                  <td style={{ padding: '10px 0', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--success)' }}>{rtt}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 0'
      }}>
        <button
          className="btn btn-outline"
          onClick={onViewHistory}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="12 8 12 12 14 14"></polyline>
            <path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5"></path>
          </svg>
          <span>View All Packet History ({transfer?.totalCount || 1})</span>
        </button>

        <button
          className="btn btn-primary btn-lg"
          onClick={onSendAgain}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
          <span>Send Another Message</span>
        </button>
      </div>
    </div>
  );
}
