import React from 'react';
import LaptopIcon from './LaptopIcon';

export default function ConnectionView({ senderIp, receiverIp, onContinue }) {
  const handshakeSteps = [
    {
      id: 1,
      direction: 'right',
      stepNum: '01',
      title: 'SYN (Synchronize Sequence)',
      flags: ['SYN'],
      seq: '10000',
      ack: '0',
      win: '65,535',
      time: '0.00 ms',
      clientState: 'SYN_SENT',
      serverState: 'SYN_RECEIVED',
      desc: 'Client allocates TCB and transmits Initial Sequence Number (ISN).'
    },
    {
      id: 2,
      direction: 'left',
      stepNum: '02',
      title: 'SYN + ACK (Sync & Acknowledgment)',
      flags: ['SYN', 'ACK'],
      seq: '50000',
      ack: '10001',
      win: '65,535',
      time: '+11.72 ms',
      clientState: 'ESTABLISHED',
      serverState: 'SYN_RECEIVED',
      desc: 'Server responds with its own ISN and acknowledges client ISN + 1.'
    },
    {
      id: 3,
      direction: 'right',
      stepNum: '03',
      title: 'ACK (Final Acknowledgment)',
      flags: ['ACK'],
      seq: '10001',
      ack: '50001',
      win: '65,535',
      time: '+23.44 ms',
      clientState: 'ESTABLISHED',
      serverState: 'ESTABLISHED',
      desc: 'Client confirms server sequence. Both TCBs enter ESTABLISHED state.'
    }
  ];

  return (
    <div style={{ maxWidth: '1180px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Title & Introduction */}
      <div style={{ textAlign: 'center', marginBottom: '4px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.3px', margin: 0 }}>
          User-Space 3-Way Handshake
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '620px', margin: '8px auto 0' }}>
          RFC 793 connection establishment between endpoints using 20-byte transport headers over a raw UDP tunnel.
        </p>
      </div>

      {/* Main Interactive Stage */}
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
        {/* Endpoints Header Bar */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '260px 1fr 260px',
          alignItems: 'center',
          gap: '20px',
          paddingBottom: '20px',
          borderBottom: '1px solid var(--border-subtle)'
        }}>
          {/* Client Node */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            background: '#FAF8FF',
            border: '1px solid var(--primary-border)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 18px'
          }}>
            <LaptopIcon variant="sender" width={56} height={46} />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text)' }}>
                Client (Sender)
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: 'var(--primary)', marginTop: '2px' }}>
                {senderIp} :9999
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                State: <strong style={{ color: '#10B981' }}>ESTABLISHED</strong>
              </div>
            </div>
          </div>

          {/* Central Exchange Summary */}
          <div style={{ textAlign: 'center' }}>
            <span style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              color: 'var(--primary)',
              background: 'var(--primary-light)',
              padding: '3px 10px',
              borderRadius: '4px'
            }}>
              FULL-DUPLEX TCB CHANNEL
            </span>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
              Handshake RTT: <strong style={{ color: 'var(--text)' }}>23.44 ms</strong> • Window: <strong style={{ color: 'var(--text)' }}>65,535 B</strong>
            </div>
          </div>

          {/* Server Node */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            background: '#F0FDFA',
            border: '1px solid var(--teal-border)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 18px'
          }}>
            <LaptopIcon variant="receiver" width={56} height={46} />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text)' }}>
                Server (Receiver)
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: 'var(--teal)', marginTop: '2px' }}>
                {receiverIp} :9999
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                State: <strong style={{ color: '#10B981' }}>ESTABLISHED</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Packet Exchange Flow Ladder */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {handshakeSteps.map((step) => {
            const isClientToServer = step.direction === 'right';

            return (
              <div
                key={step.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '120px 1fr 120px',
                  alignItems: 'center',
                  gap: '16px',
                  background: isClientToServer ? '#FAF9FF' : '#F4FBFA',
                  border: `1px solid ${isClientToServer ? 'var(--primary-border)' : 'var(--teal-border)'}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 20px',
                  boxShadow: 'var(--shadow-xs)'
                }}
              >
                {/* Left Origin Label */}
                <div style={{ textAlign: 'left' }}>
                  <span style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    color: isClientToServer ? 'var(--primary)' : 'var(--text-subtle)'
                  }}>
                    {isClientToServer ? 'TX: CLIENT' : 'RX: CLIENT'}
                  </span>
                  <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {step.time}
                  </div>
                </div>

                {/* Packet Details Body */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      fontFamily: 'var(--font-mono)',
                      background: isClientToServer ? 'var(--primary)' : 'var(--teal)',
                      color: '#FFFFFF',
                      padding: '2px 8px',
                      borderRadius: '4px'
                    }}>
                      {step.stepNum}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text)' }}>
                      {step.title}
                    </span>
                    {/* Directional Arrow */}
                    <span style={{
                      color: isClientToServer ? 'var(--primary)' : 'var(--teal)',
                      fontWeight: 900,
                      fontSize: '14px'
                    }}>
                      {isClientToServer ? '──────▶' : '◀──────'}
                    </span>
                  </div>

                  {/* Packet Header Fields */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    background: '#FFFFFF',
                    padding: '4px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)'
                  }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>SEQ: </span>
                      <strong style={{ color: isClientToServer ? 'var(--primary)' : 'var(--text)' }}>{step.seq}</strong>
                    </div>
                    {step.ack !== '0' && (
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>ACK: </span>
                        <strong style={{ color: 'var(--teal)' }}>{step.ack}</strong>
                      </div>
                    )}
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>WIN: </span>
                      <span>{step.win}</span>
                    </div>
                  </div>
                </div>

                {/* Right Target Label */}
                <div style={{ textAlign: 'right' }}>
                  <span style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    color: !isClientToServer ? 'var(--teal)' : 'var(--text-subtle)'
                  }}>
                    {!isClientToServer ? 'TX: SERVER' : 'RX: SERVER'}
                  </span>
                  <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Window: {step.win}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* State Machine Transition Timeline */}
        <div style={{
          background: '#F8FAFC',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          padding: '16px 20px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '20px'
        }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Client TCP State Progression
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
              <span style={{ color: 'var(--text-subtle)' }}>CLOSED</span>
              <span style={{ color: '#CBD5E1' }}>➔</span>
              <span style={{ color: 'var(--primary)', fontWeight: 600 }}>SYN_SENT</span>
              <span style={{ color: '#CBD5E1' }}>➔</span>
              <span style={{ color: '#10B981', fontWeight: 700 }}>ESTABLISHED</span>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Server TCP State Progression
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
              <span style={{ color: 'var(--text-subtle)' }}>LISTEN</span>
              <span style={{ color: '#CBD5E1' }}>➔</span>
              <span style={{ color: 'var(--teal)', fontWeight: 600 }}>SYN_RECEIVED</span>
              <span style={{ color: '#CBD5E1' }}>➔</span>
              <span style={{ color: '#10B981', fontWeight: 700 }}>ESTABLISHED</span>
            </div>
          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '16px',
          borderTop: '1px solid var(--border-subtle)',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#166534', fontWeight: 600 }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10B981' }}></span>
            <span>Handshake Verified • Socket Ready for Payload Transmission</span>
          </div>

          <button className="btn btn-primary btn-lg" onClick={onContinue}>
            <span>Proceed to Send Message</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
