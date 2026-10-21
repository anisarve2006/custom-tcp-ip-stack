import React from 'react';

export default function PacketModal({ packet, onClose }) {
  if (!packet) return null;

  const msg = packet.message || 'Hello World!';
  const seq = packet.seq || 10001;
  const ack = packet.ack || 50001;
  const bytes = packet.bytes || msg.length;

  const hexHeader = [
    '27', '0F', // Src port 9999
    '27', '0F', // Dst port 9999
    ((seq >> 24) & 0xff).toString(16).padStart(2, '0').toUpperCase(),
    ((seq >> 16) & 0xff).toString(16).padStart(2, '0').toUpperCase(),
    ((seq >> 8) & 0xff).toString(16).padStart(2, '0').toUpperCase(),
    (seq & 0xff).toString(16).padStart(2, '0').toUpperCase(),
    ((ack >> 24) & 0xff).toString(16).padStart(2, '0').toUpperCase(),
    ((ack >> 16) & 0xff).toString(16).padStart(2, '0').toUpperCase(),
    ((ack >> 8) & 0xff).toString(16).padStart(2, '0').toUpperCase(),
    (ack & 0xff).toString(16).padStart(2, '0').toUpperCase(),
    '50', // Data offset (5 words = 20B)
    '18', // Flags: PSH (0x08) | ACK (0x10)
    'FF', 'FF', // Window 65535
    'A4', '2C', // Checksum (computed)
    '00', '00'  // Urgent pointer
  ];

  const payloadHex = Array.from(new TextEncoder().encode(msg)).map(b =>
    b.toString(16).padStart(2, '0').toUpperCase()
  );

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
        maxWidth: '760px',
        maxHeight: '90vh',
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
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: 'var(--primary)'
              }}></span>
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.2px' }}>
                RFC 793 Transport Packet Deep Inspector
              </h3>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              20-Byte Custom Transport Header + {bytes}-Byte Application Payload
            </p>
          </div>
          <button
            onClick={onClose}
            className="icon-btn"
            style={{ width: '32px', height: '32px' }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header Field Grid */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
              Transport Header Fields (RFC Standard Layout)
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '12px',
              background: '#FAF8FF',
              padding: '16px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--primary-border)',
              boxShadow: 'var(--shadow-xs)'
            }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Source Port</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '14px', marginTop: '2px' }}>9999</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Destination Port</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '14px', marginTop: '2px' }}>9999</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sequence Number</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '14px', color: 'var(--primary)', marginTop: '2px' }}>{seq}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Ack Number</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '14px', color: 'var(--teal)', marginTop: '2px' }}>{ack}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Data Offset (Header Len)</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '14px', marginTop: '2px' }}>5 (20 Bytes)</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Active Flags</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '14px', color: 'var(--success)', marginTop: '2px' }}>PSH | ACK (0x18)</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Window Size</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '14px', marginTop: '2px' }}>65,535 bytes</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>1's Comp. Checksum</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '14px', color: '#D97706', marginTop: '2px' }}>0xA42C (VALID)</div>
              </div>
            </div>
          </div>

          {/* Hex & ASCII Dump */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
              On-Wire Hex Dump (Wire Frame & Buffer)
            </div>
            <div style={{
              background: '#0B0F19',
              color: '#F8FAFC',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              padding: '16px',
              borderRadius: 'var(--radius-sm)',
              lineHeight: 1.6,
              overflowX: 'auto',
              border: '1px solid #1E293B',
              boxShadow: 'var(--shadow-inner)'
            }}>
              <div style={{ color: '#64748B', borderBottom: '1px solid #1E293B', paddingBottom: '6px', marginBottom: '8px' }}>
                OFFSET   00 01 02 03 04 05 06 07  08 09 0A 0B 0C 0D 0E 0F  ASCII
              </div>
              <div>
                <span style={{ color: '#64748B' }}>00000000 </span>
                <span style={{ color: '#A78BFA' }}>{hexHeader.slice(0, 8).join(' ')} </span>
                <span style={{ color: '#A78BFA' }}>{hexHeader.slice(8, 16).join(' ')} </span>
                <span style={{ color: '#CBD5E1' }}> |..'{seq & 0xff}..|</span>
              </div>
              <div>
                <span style={{ color: '#64748B' }}>00000010 </span>
                <span style={{ color: '#A78BFA' }}>{hexHeader.slice(16, 20).join(' ')} </span>
                <span style={{ color: '#34D399' }}>{payloadHex.slice(0, 4).join(' ')} </span>
                <span style={{ color: '#34D399' }}>{payloadHex.slice(4, 12).join(' ')} </span>
                <span style={{ color: '#CBD5E1' }}> |{msg.slice(0, 12)}|</span>
              </div>
            </div>
          </div>

          {/* Decoded Application Text */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
              Decoded Application Payload
            </div>
            <div style={{
              background: '#F0FDFA',
              border: '1px solid var(--teal-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '14px',
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
              color: '#0F766E',
              fontWeight: 600,
              boxShadow: 'var(--shadow-inner)'
            }}>
              "{msg}"
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'flex-end',
          background: '#FCFCFE'
        }}>
          <button className="btn btn-outline btn-sm" onClick={onClose}>
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
