import React, { useState } from 'react';

export default function ArchitectureDesignView() {
  const [activeSection, setActiveSection] = useState('subsystems'); // 'subsystems', 'header', 'ladder', 'fsm'
  const [selectedSubsystem, setSelectedSubsystem] = useState('tcb');

  const subsystems = [
    {
      id: 'tcb',
      name: 'Transmission Control Block (TCB)',
      file: 'include/custom_tcp.h & src/custom_tcp.c',
      role: 'Per-connection state context maintaining TCP state, endpoint sockets, sequence variables, and timers.',
      complexity: 'O(1) connection lookup',
      metrics: [
        { label: 'State Tracking', value: 'RFC 793 FSM (CLOSED, SYN_SENT, ESTABLISHED, etc.)' },
        { label: 'Sequence Trackers', value: 'snd_una, snd_nxt, snd_wnd, rcv_nxt, rcv_wnd' },
        { label: 'Timers', value: 'Retransmission (RTO), Keep-Alive, TIME-WAIT' }
      ],
      description: 'The TCB is the core data structure that holds everything required to manage a single end-to-end transport session. It guarantees that packets arriving out-of-order or duplicate ACKs are handled according to strict RFC 793 state rules.'
    },
    {
      id: 'sliding_window',
      name: 'Sliding Window & Ring Buffer Engine',
      file: 'src/custom_tcp.c (Buffer Management)',
      role: 'Implements flow control with circular ring buffers, preventing buffer overrun and enabling continuous byte streaming.',
      complexity: 'O(1) enqueue / dequeue',
      metrics: [
        { label: 'Buffer Size', value: '65,535 Bytes (Standard TCP Window)' },
        { label: 'Sequence Arithmetic', value: '32-bit serial comparisons (SEQ_GT, SEQ_LT)' },
        { label: 'Flow Control', value: 'Advertised receiver window (rwnd) throttles transmitter' }
      ],
      description: 'Unlike Stop-and-Wait protocols, our sliding window protocol allows the sender to transmit multiple segments up to the receiver\'s advertised window without waiting for immediate ACKs, maximizing Wi-Fi bandwidth utilization.'
    },
    {
      id: 'reno',
      name: 'TCP Reno Congestion Control Engine',
      file: 'src/custom_tcp.c (Reno State Machine)',
      role: 'Dynamically adapts sending rate based on network feedback, packet loss, and RTT fluctuations.',
      complexity: 'O(1) per-ACK adjustment',
      metrics: [
        { label: 'Slow Start', value: 'Exponential: cwnd doubles every RTT (cwnd += MSS per ACK)' },
        { label: 'Congestion Avoidance', value: 'Additive: cwnd += (MSS * MSS) / cwnd per RTT' },
        { label: 'Fast Retransmit', value: 'Triggered on 3 duplicate ACKs without waiting for RTO' },
        { label: 'Fast Recovery', value: 'ssthresh = cwnd / 2; cwnd = ssthresh + 3 * MSS' }
      ],
      description: 'Fully implements the classic Reno congestion control algorithm. When the Wi-Fi link drops packets due to queue overflow, Reno detects the 3 duplicate ACKs and performs Fast Retransmit without incurring a catastrophic RTO timeout stall.'
    },
    {
      id: 'rtt',
      name: 'Jacobson / Karels RTO Estimator',
      file: 'src/custom_tcp.c (Timer Subsystem)',
      role: 'Dynamically calculates Retransmission Timeout (RTO) using smoothed Round Trip Time and variance tracking.',
      complexity: 'RFC 6298 Math',
      metrics: [
        { label: 'Smoothed RTT (SRTT)', value: 'SRTT = (1 - α) * SRTT + α * RTT_sample (α = 1/8)' },
        { label: 'RTT Variance (RTTVAR)', value: 'RTTVAR = (1 - β) * RTTVAR + β * |SRTT - RTT_sample| (β = 1/4)' },
        { label: 'Calculated RTO', value: 'RTO = SRTT + max(G, 4 * RTTVAR) [min 200ms, max 60s]' },
        { label: 'Exponential Backoff', value: 'RTO = RTO * 2 on consecutive timeouts' }
      ],
      description: 'Static timeouts either fail on high-latency links or cause premature spurious retransmissions. Jacobson\'s algorithm continuously learns the underlying network latency variance to compute the optimal retransmission timer.'
    },
    {
      id: 'checksum',
      name: '16-Bit One\'s Complement Checksum Engine',
      file: 'src/custom_tcp.c (Checksum Routine)',
      role: 'Validates transport segment integrity across both endpoints including a pseudo-header.',
      complexity: 'O(N) SIMD / 16-bit fold',
      metrics: [
        { label: 'Algorithm', value: 'RFC 1071 16-bit One\'s Complement Sum' },
        { label: 'Pseudo-Header Scope', value: 'Src IP (32b), Dst IP (32b), Zero (8b), Proto 17 (8b), TCP Length (16b)' },
        { label: 'Fold Routine', value: 'Sums 16-bit words; adds carries to LSB; inverts result (~sum)' },
        { label: 'Verification', value: 'Receiver sums whole packet including checksum; must equal 0x0000' }
      ],
      description: 'Ensures that bit errors, corrupt UDP payload data, or mismatched IP endpoints are caught and discarded before payload delivery to the application layer.'
    },
    {
      id: 'link_layer',
      name: 'Pluggable Link-Layer Abstraction',
      file: 'src/link_udp.c & src/link_tap.c',
      role: 'Decouples transport logic from raw socket APIs, providing cross-laptop portability over UDP, virtual TAP, or AF_XDP.',
      complexity: 'Zero-copy ring driver',
      metrics: [
        { label: 'Overlay Mode', value: 'UDP Socket (Port 9999) - runs on any laptop without root' },
        { label: 'Raw Link Mode', value: 'Virtual TAP Device (Raw Ethernet frames)' },
        { label: 'True Bypass Mode', value: 'AF_XDP / DPDK (Zero-copy DMA to user space)' }
      ],
      description: 'The transport protocol does not care whether it travels over raw Ethernet frames, a UDP overlay, or an optical fiber. This abstraction allows the project to run cleanly over standard Wi-Fi while keeping the transport state machine 100% custom.'
    },
    {
      id: 'telemetry',
      name: 'Telemetry Daemon & REST Observation Engine',
      file: 'src/telemetry_server.c & nexus_proto.lua',
      role: 'Provides real-time non-blocking inspection endpoints and Wireshark Lua protocol dissectors.',
      complexity: 'Non-blocking lockless ring',
      metrics: [
        { label: 'HTTP REST Endpoints', value: 'GET /api/status, GET /api/packets (C embedded HTTP)' },
        { label: 'Wireshark Support', value: 'nexus_proto.lua custom protocol dissector' },
        { label: 'CORS Headers', value: 'Enables browser frontend to poll stack statistics in real time' }
      ],
      description: 'Permits judges, professors, and frontend dashboards to observe the internal user-space TCB states, packet logs, and sequence counters live without interrupting high-speed packet flow.'
    }
  ];

  const currentSubsystem = subsystems.find((s) => s.id === selectedSubsystem) || subsystems[0];

  return (
    <div className="card">
      {/* Top Card Header */}
      <div className="card-header" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="card-title">
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'var(--primary-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            boxShadow: 'var(--shadow-violet-glow)'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="3" y1="9" x2="21" y2="9"></line>
              <line x1="9" y1="21" x2="9" y2="9"></line>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.2px' }}>
              System Architecture & Design Blueprint
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
              User-Space Transport Stack Specification • RFC 793 Compliance • Kernel Bypass Roadmap
            </div>
          </div>
        </div>

        {/* Section Navigation Pills */}
        <div style={{ display: 'flex', gap: '6px', background: '#F1F5F9', padding: '4px', borderRadius: 'var(--radius-sm)' }}>
          <button
            onClick={() => setActiveSection('subsystems')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              background: activeSection === 'subsystems' ? '#FFFFFF' : 'transparent',
              color: activeSection === 'subsystems' ? 'var(--primary)' : 'var(--text-muted)',
              boxShadow: activeSection === 'subsystems' ? 'var(--shadow-xs)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            Subsystems Engine
          </button>
          <button
            onClick={() => setActiveSection('header')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              background: activeSection === 'header' ? '#FFFFFF' : 'transparent',
              color: activeSection === 'header' ? 'var(--primary)' : 'var(--text-muted)',
              boxShadow: activeSection === 'header' ? 'var(--shadow-xs)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            RFC 793 Header Spec
          </button>
          <button
            onClick={() => setActiveSection('ladder')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              background: activeSection === 'ladder' ? '#FFFFFF' : 'transparent',
              color: activeSection === 'ladder' ? 'var(--primary)' : 'var(--text-muted)',
              boxShadow: activeSection === 'ladder' ? 'var(--shadow-xs)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            Kernel Bypass Ladder
          </button>
          <button
            onClick={() => setActiveSection('fsm')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              background: activeSection === 'fsm' ? '#FFFFFF' : 'transparent',
              color: activeSection === 'fsm' ? 'var(--primary)' : 'var(--text-muted)',
              boxShadow: activeSection === 'fsm' ? 'var(--shadow-xs)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            State Machine (FSM)
          </button>
        </div>
      </div>

      <div className="card-body" style={{ padding: '24px' }}>
        {/* ========================================================= */}
        {/* SECTION 1: SUBSYSTEMS ENGINE ARCHITECTURE                 */}
        {/* ========================================================= */}
        {activeSection === 'subsystems' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* System Architecture Block Diagram */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                System Architecture Block Diagram
              </div>
              <div style={{
                background: 'linear-gradient(180deg, #FAF8FF 0%, #F8FAFD 100%)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '24px',
                boxShadow: 'var(--shadow-card)',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '14px'
              }}>
                {subsystems.map((sub) => (
                  <div
                    key={sub.id}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '16px',
                      boxShadow: 'var(--shadow-xs)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      userSelect: 'none'
                    }}
                  >
                    <div>
                      <div style={{
                        display: 'inline-block',
                        fontSize: '10px',
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        marginBottom: '4px'
                      }}>
                        {sub.complexity}
                      </div>
                      <h4 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text)' }}>
                        {sub.name}
                      </h4>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.4 }}>
                        {sub.role}
                      </p>
                    </div>

                    <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-subtle)' }}>
                        {sub.file.split(' ')[0]}
                      </span>
                      <span style={{
                        fontSize: '10px',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-muted)',
                        fontWeight: 600
                      }}>
                        RFC 793 Spec
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Drill-down Card for Selected Subsystem */}
            <div style={{
              background: '#FFFFFF',
              border: '1px solid var(--border)',
              borderTop: '4px solid var(--primary)',
              borderRadius: 'var(--radius-md)',
              padding: '24px',
              boxShadow: 'var(--shadow-card)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      color: 'var(--primary)'
                    }}>
                      [subsystem]
                    </span>
                    <span style={{ color: '#CBD5E1' }}>•</span>
                    <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      Source: <strong style={{ color: 'var(--text)' }}>{currentSubsystem.file}</strong>
                    </span>
                  </div>
                  <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text)', marginTop: '6px' }}>
                    {currentSubsystem.name}
                  </h3>
                </div>

                <div style={{
                  background: 'var(--primary-light)',
                  border: '1px solid var(--primary-border)',
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-sm)',
                  textAlign: 'right'
                }}>
                  <div style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Algorithmic Efficiency
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>
                    {currentSubsystem.complexity}
                  </div>
                </div>
              </div>

              <p style={{ fontSize: '14px', color: 'var(--text)', lineHeight: 1.6, marginBottom: '20px' }}>
                {currentSubsystem.description}
              </p>

              {/* Metrics Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '12px'
              }}>
                {currentSubsystem.metrics.map((m, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: '#F9FAFD',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '12px 14px'
                    }}
                  >
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                      {m.label}
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                      {m.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SECTION 2: RFC 793 20-BYTE HEADER WIRE SPECIFICATION      */}
        {/* ========================================================= */}
        {activeSection === 'header' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                RFC 793 32-Bit Word-Aligned Transport Header Layout (20 Bytes)
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Each row represents one 32-bit (4-byte) word. The minimum header size without options is exactly 20 bytes (Data Offset = 5 words).
              </p>

              {/* Wire Format Visual Grid */}
              <div style={{
                border: '2px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-card)',
                background: '#FFFFFF',
                fontFamily: 'var(--font-mono)'
              }}>
                {/* Header Bit Index Ruler */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(32, 1fr)',
                  background: '#F1F5F9',
                  borderBottom: '2px solid var(--border)',
                  padding: '6px 0',
                  fontSize: '9px',
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                  fontWeight: 700
                }}>
                  {[...Array(32)].map((_, i) => (
                    <span key={i} style={{ borderRight: (i + 1) % 8 === 0 && i !== 31 ? '1px solid #CBD5E1' : 'none' }}>
                      {i}
                    </span>
                  ))}
                </div>

                {/* Word 0: Ports */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ padding: '14px', background: '#FAF8FF', borderRight: '1px solid var(--border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 700 }}>Bits 0 - 15 (16 Bits)</div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)' }}>Source Port (9999)</div>
                  </div>
                  <div style={{ padding: '14px', background: '#FAF8FF', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 700 }}>Bits 16 - 31 (16 Bits)</div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)' }}>Destination Port (9999)</div>
                  </div>
                </div>

                {/* Word 1: Sequence Number */}
                <div style={{ padding: '14px', background: '#F5F3FF', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 700 }}>Bits 0 - 31 (32 Bits)</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--primary)' }}>
                    Sequence Number (snd_nxt: 10001)
                  </div>
                </div>

                {/* Word 2: Acknowledgment Number */}
                <div style={{ padding: '14px', background: '#F0FDFA', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: 'var(--teal)', fontWeight: 700 }}>Bits 0 - 31 (32 Bits)</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--teal)' }}>
                    Acknowledgment Number (rcv_nxt: 50001)
                  </div>
                </div>

                {/* Word 3: Offset, Reserved, Flags, Window */}
                <div style={{ display: 'grid', gridTemplateColumns: '4fr 6fr 6fr 16fr', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ padding: '12px 6px', background: '#F8FAFC', borderRight: '1px solid var(--border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>4b</div>
                    <div style={{ fontSize: '12px', fontWeight: 800 }}>Offset (5)</div>
                  </div>
                  <div style={{ padding: '12px 6px', background: '#F8FAFC', borderRight: '1px solid var(--border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>6b</div>
                    <div style={{ fontSize: '12px', fontWeight: 800 }}>Reserved</div>
                  </div>
                  <div style={{ padding: '12px 6px', background: '#ECFDF5', borderRight: '1px solid var(--border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: 'var(--success)' }}>6b Flags</div>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--success)' }}>PSH | ACK</div>
                  </div>
                  <div style={{ padding: '12px 8px', background: '#FAF8FF', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: 'var(--primary)' }}>16b Window</div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text)' }}>Window: 65,535 B</div>
                  </div>
                </div>

                {/* Word 4: Checksum & Urgent Pointer */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                  <div style={{ padding: '14px', background: '#FFFBEB', borderRight: '1px solid var(--border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#B45309', fontWeight: 700 }}>Bits 0 - 15 (16 Bits)</div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: '#D97706' }}>
                      16-bit Checksum (0xA42C)
                    </div>
                  </div>
                  <div style={{ padding: '14px', background: '#F8FAFC', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Bits 16 - 31 (16 Bits)</div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-muted)' }}>Urgent Pointer (0)</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Flags Deep-Dive */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '10px'
            }}>
              {[
                { name: 'SYN (0x02)', desc: 'Synchronize sequence numbers in 3-way handshake', active: false },
                { name: 'ACK (0x10)', desc: 'Acknowledgment field significant', active: true },
                { name: 'PSH (0x08)', desc: 'Push data immediately to receiver application', active: true },
                { name: 'FIN (0x01)', desc: 'Graceful connection termination', active: false },
                { name: 'RST (0x04)', desc: 'Hard connection reset on error', active: false },
                { name: 'URG (0x20)', desc: 'Urgent pointer field significant', active: false }
              ].map((flag, i) => (
                <div
                  key={i}
                  style={{
                    background: flag.active ? 'var(--primary-light)' : '#FFFFFF',
                    border: `1px solid ${flag.active ? 'var(--primary-border)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px',
                    boxShadow: 'var(--shadow-xs)'
                  }}
                >
                  <div style={{
                    fontSize: '12px',
                    fontWeight: 800,
                    fontFamily: 'var(--font-mono)',
                    color: flag.active ? 'var(--primary)' : 'var(--text)'
                  }}>
                    {flag.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.3 }}>
                    {flag.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SECTION 3: KERNEL BYPASS ROADMAP LADDER                  */}
        {/* ========================================================= */}
        {activeSection === 'ladder' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{
              background: '#FAF8FF',
              border: '1px solid var(--primary-border)',
              borderRadius: 'var(--radius-md)',
              padding: '18px 24px'
            }}>
              <h4 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--primary)', marginBottom: '4px' }}>
                Jury / Professor Talking Point: What "Kernel Bypass" Truly Means
              </h4>
              <p style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.6 }}>
                In this project, you have bypassed the <strong>OS Kernel's TCP State Machine</strong> (all handshake, sequencing, Reno congestion control, retransmission timers, and checksumming happen in your user-space C code). In UDP Overlay mode, packets still invoke <code>sendto()</code>/<code>recvfrom()</code> syscalls. The roadmap below demonstrates how you can scale from portable UDP mode to true hardware zero-copy bypass.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[
                {
                  level: 'Level 1: Current Operational Setup',
                  tech: 'User-Space TCP over UDP Overlay Sockets',
                  status: 'IMPLEMENTED & RUNNING',
                  statusColor: 'var(--success)',
                  statusBg: 'var(--success-light)',
                  borderColor: 'var(--success-border)',
                  whatYouGain: '100% control over transport logic, congestion control, windowing, and timeouts. Runs across any two laptops over standard Wi-Fi without needing Administrator or root privileges.',
                  catch: 'One syscall per packet (sendto / recvfrom); OS still verifies outer UDP checksum.'
                },
                {
                  level: 'Level 2: Syscall Batching & Hardware Timestamps',
                  tech: 'recvmmsg / sendmmsg + SO_TIMESTAMPING + Core Pinning',
                  status: 'OPTIMIZATION PHASE',
                  statusColor: '#2563EB',
                  statusBg: '#EFF6FF',
                  borderColor: '#BFDBFE',
                  whatYouGain: 'Amortizes syscall overhead by sending/receiving vectors of up to 64 packets per syscall. Nanosecond hardware NIC timestamps for microsecond-accurate RTT.',
                  catch: 'Still traverses the kernel socket buffer path.'
                },
                {
                  level: 'Level 3: Link-Layer Framing',
                  tech: 'Virtual TAP Device / AF_PACKET Raw Sockets',
                  status: 'LINK-LAYER MODE',
                  statusColor: '#7C3AED',
                  statusBg: '#FAF5FF',
                  borderColor: '#DDD6FE',
                  whatYouGain: 'Direct control over Layer 2 Ethernet frames and raw IP headers. No UDP wrapper needed.',
                  catch: 'Requires root / administrator access and installation of virtual TAP driver on Windows/Linux.'
                },
                {
                  level: 'Level 4: True Zero-Copy Kernel Bypass',
                  tech: 'AF_XDP (eBPF XDP) / DPDK / Netmap',
                  status: 'ENTERPRISE BYPASS',
                  statusColor: '#D97706',
                  statusBg: '#FFFBEB',
                  borderColor: '#FDE68A',
                  whatYouGain: 'True kernel bypass! NIC DMA writes directly into user-space UMEM ring buffers. 0 syscalls per packet, sub-microsecond latency, 10M+ packets/sec.',
                  catch: 'Requires supported NIC drivers (e.g. Intel i40e/ixgbe, Mellanox ConnectX) and Linux eBPF kernel.'
                }
              ].map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    background: '#FFFFFF',
                    border: `1px solid ${item.borderColor}`,
                    borderLeft: `5px solid ${item.statusColor}`,
                    borderRadius: 'var(--radius-sm)',
                    padding: '16px 20px',
                    boxShadow: 'var(--shadow-card)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {item.level}
                    </div>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: item.statusColor,
                      fontFamily: 'var(--font-mono)'
                    }}>
                      {item.status}
                    </span>
                  </div>

                  <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', marginBottom: '8px' }}>
                    {item.tech}
                  </h4>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '13px' }}>
                    <div style={{ background: '#F8FAFC', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                      <strong style={{ color: 'var(--success)' }}>What You Gain: </strong>
                      <span style={{ color: 'var(--text)' }}>{item.whatYouGain}</span>
                    </div>
                    <div style={{ background: '#F8FAFC', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                      <strong style={{ color: '#D97706' }}>Engineering Trade-Off: </strong>
                      <span style={{ color: 'var(--text)' }}>{item.catch}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SECTION 4: RFC 793 STATE MACHINE FLOWCHART                */}
        {/* ========================================================= */}
        {activeSection === 'fsm' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                RFC 793 Finite State Machine (Connection Lifecycle)
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                The full 11-state lifecycle of a connection. In user space, every state transition is enforced explicitly in <code>src/custom_tcp.c</code>.
              </p>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px'
              }}>
                {[
                  { state: 'CLOSED', desc: 'No connection active. Socket is dormant.', tag: 'Initial' },
                  { state: 'LISTEN', desc: 'Server waiting for incoming connection SYN.', tag: 'Passive Open' },
                  { state: 'SYN_SENT', desc: 'Client sent SYN, awaiting SYN+ACK.', tag: 'Active Open' },
                  { state: 'SYN_RCVD', desc: 'Server sent SYN+ACK, awaiting ACK.', tag: 'Handshake' },
                  { state: 'ESTABLISHED', desc: 'Connection open! Data transfer active.', tag: 'Data Transfer', active: true },
                  { state: 'FIN_WAIT_1', desc: 'Active close: sent FIN, awaiting ACK.', tag: 'Teardown' },
                  { state: 'CLOSE_WAIT', desc: 'Passive close: received FIN, sent ACK.', tag: 'Teardown' },
                  { state: 'FIN_WAIT_2', desc: 'Awaiting FIN from remote peer.', tag: 'Teardown' },
                  { state: 'LAST_ACK', desc: 'Sent final FIN, awaiting final ACK.', tag: 'Teardown' },
                  { state: 'TIME_WAIT', desc: 'Waits 2 * MSL (2-4 mins) to drain wire.', tag: 'Clean Shutdown' }
                ].map((st, i) => (
                  <div
                    key={i}
                    style={{
                      background: st.active ? 'var(--primary-light)' : '#FFFFFF',
                      border: `1px solid ${st.active ? 'var(--primary-border)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-sm)',
                      padding: '14px',
                      boxShadow: st.active ? 'var(--shadow-violet-glow)' : 'var(--shadow-xs)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>{st.tag}</span>
                      {st.active && (
                        <span style={{
                          fontSize: '9px',
                          fontWeight: 800,
                          background: 'var(--primary)',
                          color: '#FFFFFF',
                          padding: '1px 5px',
                          borderRadius: '4px'
                        }}>
                          CURRENT STATE
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: 800,
                      fontFamily: 'var(--font-mono)',
                      color: st.active ? 'var(--primary)' : 'var(--text)'
                    }}>
                      {st.state}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.3 }}>
                      {st.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
