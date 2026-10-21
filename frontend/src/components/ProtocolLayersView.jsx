import React, { useState } from 'react';
import InteractiveHeaderMerging from './InteractiveHeaderMerging';

export default function ProtocolLayersView({
  payload = 'Hello World!',
  seq = 10001,
  ack = 50001,
  senderIp = '192.168.1.101',
  receiverIp = '192.168.1.102',
  port = '9999'
}) {
  const [viewMode, setViewMode] = useState('merging'); // 'merging' (Interactive Header Merging Engine) | 'spec' (Static OSI Layer Specs)
  const [activeLayer, setActiveLayer] = useState(4); // default: Layer 4 Custom TCP Stack
  const [direction, setDirection] = useState('sender'); // 'sender' (TX encapsulation) or 'receiver' (RX de-encapsulation)

  const payloadBytes = new TextEncoder().encode(payload).length;
  const customTcpBytes = 20;
  const udpBytes = 8;
  const ipBytes = 20;
  const ethBytes = 14;
  const fcsBytes = 4;
  const totalWireBytes = ethBytes + ipBytes + udpBytes + customTcpBytes + payloadBytes + fcsBytes;

  const layers = [
    {
      id: 7,
      osi: 'Layer 7',
      name: 'Application Layer',
      space: 'User Space',
      badgeColor: '#7C3AED',
      badgeBg: 'var(--primary-light)',
      borderColor: 'var(--primary-border)',
      headerSize: `${payloadBytes} Bytes`,
      cumulative: `${payloadBytes} Bytes`,
      senderAction: 'Generates application data buffer and encodes text string into raw binary octets.',
      receiverAction: 'Extracts validated binary stream from user-space socket buffer and renders text in application.',
      fields: [
        { label: 'Application Protocol', value: 'Custom ASCII / Text Stream' },
        { label: 'Raw Payload Content', value: `"${payload}"` },
        { label: 'Character Encoding', value: 'UTF-8 / ASCII (1 byte per char)' },
        { label: 'Payload Size', value: `${payloadBytes} Bytes` }
      ],
      details: 'This is where your program initiates the data transfer. No headers are added yet; the payload exists as a continuous stream of application bytes waiting for reliable transport.'
    },
    {
      id: 4,
      osi: 'Layer 4 (Custom)',
      name: 'Custom User-Space Transport Stack',
      space: 'User Space (Your C Implementation)',
      isCustom: true,
      badgeColor: '#7C3AED',
      badgeBg: '#FAF5FF',
      borderColor: '#DDD6FE',
      headerSize: '+ 20 Bytes',
      cumulative: `${20 + payloadBytes} Bytes`,
      senderAction: 'Prepends 20-byte RFC 793 transport header, computes 16-bit 1\'s complement checksum, updates Reno congestion window (cwnd), advances sequence numbers, and manages retransmission timers (RTO).',
      receiverAction: 'Strips 20-byte transport header, validates inverted 16-bit checksum (must be 0x0000), verifies sequence matches rcv_nxt, and fires cumulative ACK.',
      fields: [
        { label: 'Source / Dest Port', value: `${port} → ${port}` },
        { label: 'Sequence Number (TX)', value: `${seq}` },
        { label: 'Acknowledgment Number (RX)', value: `${ack}` },
        { label: 'Data Offset / Header Len', value: '5 (20 Bytes)' },
        { label: 'TCP Control Flags', value: 'PSH | ACK (0x18)' },
        { label: 'Advertised Window', value: '65,535 Bytes' },
        { label: '16-bit 1\'s Complement Checksum', value: '0xA42C (Valid across pseudo-header + data)' },
        { label: 'Congestion Algorithm', value: 'TCP Reno (Slow Start, Congestion Avoidance, Fast Retransmit)' }
      ],
      details: 'This is the heart of your project! All transport reliability—3-way handshake, sequence tracking, windowing, sliding window ACK, Reno congestion control, and packet retransmission—runs entirely in your user-space C codebase without relying on OS kernel TCP.'
    },
    {
      id: 35,
      osi: 'Layer 4 (Tunnel)',
      name: 'UDP Transport Overlay',
      space: 'Kernel Boundary (Syscall Path)',
      badgeColor: '#0D9488',
      badgeBg: 'var(--teal-light)',
      borderColor: 'var(--teal-border)',
      headerSize: '+ 8 Bytes',
      cumulative: `${28 + payloadBytes} Bytes`,
      senderAction: 'Your stack calls sendto() syscall. The OS kernel wraps the custom TCP segment inside a standard UDP datagram so it can traverse standard Wi-Fi / network interfaces.',
      receiverAction: 'Kernel calls recvfrom() on UDP port 9999 and delivers the raw 20-byte transport segment + payload directly to your user-space stack.',
      fields: [
        { label: 'Source Port', value: `${port}` },
        { label: 'Destination Port', value: `${port}` },
        { label: 'UDP Datagram Length', value: `${28 + payloadBytes} Bytes (8B UDP + 20B Custom TCP + Data)` },
        { label: 'Kernel UDP Checksum', value: 'Computed by OS/NIC hardware offload' }
      ],
      details: 'Why UDP? Raw IP packets require root/administrator privileges on Windows and Linux. By running your reliable custom TCP transport over UDP datagrams (the exact architecture used by Google QUIC and HTTP/3), your stack communicates seamlessly between laptops over Wi-Fi without special privileges.'
    },
    {
      id: 3,
      osi: 'Layer 3',
      name: 'Network Layer (IPv4)',
      space: 'Operating System Kernel',
      badgeColor: '#2563EB',
      badgeBg: '#EFF6FF',
      borderColor: '#BFDBFE',
      headerSize: '+ 20 Bytes',
      cumulative: `${48 + payloadBytes} Bytes`,
      senderAction: 'OS IP stack adds 20-byte IPv4 header, determines routing via local subnet routing table, and assigns TTL.',
      receiverAction: 'Kernel IP stack inspects destination IP, validates IP header checksum, and demultiplexes to UDP protocol handler (Protocol 17).',
      fields: [
        { label: 'Source IP Address', value: senderIp },
        { label: 'Destination IP Address', value: receiverIp },
        { label: 'IP Protocol ID', value: '17 (UDP Transport)' },
        { label: 'Time To Live (TTL)', value: '64 hops' },
        { label: 'IP Header Checksum', value: '0x3F21 (Header integrity)' },
        { label: 'Total Length', value: `${48 + payloadBytes} Bytes` }
      ],
      details: 'Handles logical addressing and routing between the two laptops over the local Wi-Fi router or peer-to-peer ad-hoc network.'
    },
    {
      id: 2,
      osi: 'Layer 2',
      name: 'Data Link Layer (Ethernet / 802.11)',
      space: 'NIC Driver & Network Hardware',
      badgeColor: '#64748B',
      badgeBg: '#F8FAFC',
      borderColor: '#CBD5E1',
      headerSize: '+ 18 Bytes',
      cumulative: `${66 + payloadBytes} Bytes`,
      senderAction: 'NIC driver encapsulates IP packet into an Ethernet II or 802.11 Wi-Fi frame, resolves MAC addresses via ARP, and appends a 4-byte CRC Frame Check Sequence (FCS).',
      receiverAction: 'NIC filters frames matching its local hardware MAC address, verifies FCS CRC32 checksum, and strips Ethernet framing.',
      fields: [
        { label: 'Source Hardware MAC', value: '00:1A:2B:3C:4D:5E' },
        { label: 'Destination Hardware MAC', value: '00:1A:2B:3C:4D:9F' },
        { label: 'EtherType', value: '0x0800 (IPv4)' },
        { label: 'Frame Check Sequence (FCS)', value: '4-byte CRC-32 cyclic redundancy check' }
      ],
      details: 'Enables node-to-node frame delivery between adjacent network devices on the local wireless access point or switch.'
    },
    {
      id: 1,
      osi: 'Layer 1',
      name: 'Physical Layer (PHY / Radio)',
      space: 'Physical Airwaves / Copper Wire',
      badgeColor: '#10B981',
      badgeBg: '#ECFDF5',
      borderColor: '#A7F3D0',
      headerSize: 'Preamble + Bits',
      cumulative: `${(totalWireBytes * 8)} Bits on Wire`,
      senderAction: 'Transmitter Wi-Fi chip converts binary digital frames into radio wave symbols via Orthogonal Frequency Division Multiplexing (OFDM) modulation over 2.4 GHz / 5 GHz spectrum.',
      receiverAction: 'Receiver antenna detects electromagnetic waveforms, demodulates RF signals, synchronizes preamble, and reconstructs binary bit stream.',
      fields: [
        { label: 'Physical Medium', value: 'IEEE 802.11ax / 802.11ac Wi-Fi Radio Waves' },
        { label: 'Channel / Frequency', value: '5.180 GHz (Channel 36) / 2.4 GHz' },
        { label: 'Modulation', value: '1024-QAM / 256-QAM with OFDM' },
        { label: 'Total Bit Transmission', value: `${(totalWireBytes * 8)} bits (${totalWireBytes} bytes)` }
      ],
      details: 'The actual physical transmission of energy over air or wire. This is where packets physically cross from Laptop A to Laptop B!'
    }
  ];

  const currentLayerData = layers.find((l) => l.id === activeLayer) || layers[1];

  return (
    <div className="card">
      <div className="card-header" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="card-title">
          <div style={{
            width: '30px',
            height: '30px',
            borderRadius: '8px',
            background: 'var(--primary-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--primary-border)'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.2">
              <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
              <polyline points="2 17 12 22 22 17"></polyline>
              <polyline points="2 12 12 17 22 12"></polyline>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}>
              Protocol Stack Layer Walkthrough
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
              End-to-End Packet Encapsulation & De-encapsulation Anatomy
            </div>
          </div>
        </div>

        {/* View Mode & Direction Switchers */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '4px', background: '#F1F5F9', padding: '3px', borderRadius: 'var(--radius-sm)' }}>
            <button
              onClick={() => setViewMode('merging')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                background: viewMode === 'merging' ? '#FFFFFF' : 'transparent',
                color: viewMode === 'merging' ? 'var(--primary)' : 'var(--text-muted)',
                boxShadow: viewMode === 'merging' ? 'var(--shadow-xs)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              Interactive Header Merging
            </button>
            <button
              onClick={() => setViewMode('spec')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                background: viewMode === 'spec' ? '#FFFFFF' : 'transparent',
                color: viewMode === 'spec' ? 'var(--primary)' : 'var(--text-muted)',
                boxShadow: viewMode === 'spec' ? 'var(--shadow-xs)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              OSI Layer Architecture
            </button>
          </div>

          {viewMode === 'spec' && (
            <div style={{ display: 'flex', gap: '4px', background: '#F1F5F9', padding: '3px', borderRadius: 'var(--radius-sm)' }}>
              <button
                onClick={() => setDirection('sender')}
                style={{
                  padding: '5px 10px',
                  borderRadius: '5px',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: direction === 'sender' ? '#FFFFFF' : 'transparent',
                  color: direction === 'sender' ? 'var(--primary)' : 'var(--text-muted)',
                  boxShadow: direction === 'sender' ? 'var(--shadow-xs)' : 'none'
                }}
              >
                TX (↓)
              </button>
              <button
                onClick={() => setDirection('receiver')}
                style={{
                  padding: '5px 10px',
                  borderRadius: '5px',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: direction === 'receiver' ? '#FFFFFF' : 'transparent',
                  color: direction === 'receiver' ? 'var(--teal)' : 'var(--text-muted)',
                  boxShadow: direction === 'receiver' ? 'var(--shadow-xs)' : 'none'
                }}
              >
                RX (↑)
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="card-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {viewMode === 'merging' ? (
          <InteractiveHeaderMerging
            payload={payload}
            seq={seq}
            ack={ack}
            senderIp={senderIp}
            receiverIp={receiverIp}
            port={port}
            embedded={true}
          />
        ) : (
          <>
            {/* On-Wire Visual Frame Diagram */}
            <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Complete On-Wire Frame Structure ({totalWireBytes} Bytes Total)
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Click any header block to inspect
            </span>
          </div>

          <div style={{
            display: 'flex',
            border: '2px solid var(--border)',
            borderRadius: '10px',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-card)',
            background: '#FFFFFF'
          }}>
            {/* L2 Eth */}
            <div
              onClick={() => setActiveLayer(2)}
              style={{
                flex: '1.2',
                padding: '12px 6px',
                textAlign: 'center',
                background: activeLayer === 2 ? '#E2E8F0' : '#F8FAFC',
                borderRight: '1px solid var(--border)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Ethernet II Framing"
            >
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>Layer 2</div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text)' }}>Ethernet II</div>
              <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>14 B</div>
            </div>

            {/* L3 IP */}
            <div
              onClick={() => setActiveLayer(3)}
              style={{
                flex: '1.4',
                padding: '12px 6px',
                textAlign: 'center',
                background: activeLayer === 3 ? '#DBEAFE' : '#EFF6FF',
                borderRight: '1px solid var(--border)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="IPv4 Network Header"
            >
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#1D4ED8' }}>Layer 3</div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#1E40AF' }}>IPv4 Header</div>
              <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#1D4ED8' }}>20 B</div>
            </div>

            {/* L4 UDP */}
            <div
              onClick={() => setActiveLayer(35)}
              style={{
                flex: '1.2',
                padding: '12px 6px',
                textAlign: 'center',
                background: activeLayer === 35 ? '#CCFBF1' : '#F0FDFA',
                borderRight: '1px solid var(--border)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="UDP Tunnel Overlay Header"
            >
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#0F766E' }}>L4 Tunnel</div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#115E59' }}>UDP Header</div>
              <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#0F766E' }}>8 B</div>
            </div>

            {/* L4 Custom TCP */}
            <div
              onClick={() => setActiveLayer(4)}
              style={{
                flex: '2.5',
                padding: '12px 8px',
                textAlign: 'center',
                background: activeLayer === 4 ? '#DDD6FE' : '#F5F3FF',
                borderRight: '2px solid var(--primary)',
                borderLeft: '2px solid var(--primary)',
                cursor: 'pointer',
                position: 'relative',
                transition: 'all 0.15s ease'
              }}
              title="Custom TCP Transport Header (Your Stack)"
            >
              <div style={{
                position: 'absolute',
                top: '2px',
                right: '4px',
                fontSize: '8px',
                fontWeight: 800,
                background: 'var(--primary)',
                color: '#FFFFFF',
                padding: '1px 4px',
                borderRadius: '3px'
              }}>
                CUSTOM
              </div>
              <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--primary)' }}>Layer 4 (Custom Stack)</div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#5B21B6' }}>Custom TCP Header</div>
              <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--primary)', fontWeight: 700 }}>20 B</div>
            </div>

            {/* L7 Payload */}
            <div
              onClick={() => setActiveLayer(7)}
              style={{
                flex: '2.8',
                padding: '12px 8px',
                textAlign: 'center',
                background: activeLayer === 7 ? '#EDE9FE' : '#FAF8FF',
                borderRight: '1px solid var(--border)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Application Text Payload"
            >
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--primary)' }}>Application Data</div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                "{payload}"
              </div>
              <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{payloadBytes} B</div>
            </div>

            {/* L2 CRC Trailer */}
            <div
              onClick={() => setActiveLayer(2)}
              style={{
                flex: '0.9',
                padding: '12px 6px',
                textAlign: 'center',
                background: activeLayer === 2 ? '#E2E8F0' : '#F8FAFC',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Ethernet Frame Check Sequence (CRC32)"
            >
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>FCS</div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text)' }}>CRC32</div>
              <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>4 B</div>
            </div>
          </div>
        </div>

        {/* Layer Selector Chips - Minimalist */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {layers.map((layer) => {
            const isSelected = activeLayer === layer.id;
            return (
              <button
                key={layer.id}
                onClick={() => setActiveLayer(layer.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '7px 14px',
                  borderRadius: '6px',
                  border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border)',
                  background: isSelected ? '#FAF8FF' : '#FFFFFF',
                  color: isSelected ? 'var(--primary)' : 'var(--text)',
                  fontSize: '12px',
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: isSelected ? 'var(--shadow-xs)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{layer.osi}: {layer.name}</span>
                {layer.isCustom && (
                  <span style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--primary)',
                    fontWeight: 700
                  }}>
                    [custom]
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Layer Detailed Breakdown */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '24px',
          boxShadow: 'var(--shadow-card)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: currentLayerData.badgeColor,
                  fontFamily: 'var(--font-mono)'
                }}>
                  {currentLayerData.osi}
                </span>
                <span style={{ color: '#CBD5E1' }}>•</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Execution Space: <strong style={{ color: 'var(--text)' }}>{currentLayerData.space}</strong>
                </span>
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text)', marginTop: '6px' }}>
                {currentLayerData.name}
              </h3>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{
                background: '#FAF8FF',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 14px',
                textAlign: 'right'
              }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Layer Overhead
                </div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: currentLayerData.badgeColor, fontFamily: 'var(--font-mono)' }}>
                  {currentLayerData.headerSize}
                </div>
              </div>

              <div style={{
                background: '#FAF8FF',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 14px',
                textAlign: 'right'
              }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Cumulative Frame Size
                </div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                  {currentLayerData.cumulative}
                </div>
              </div>
            </div>
          </div>

          {/* Action on this layer (Sender vs Receiver) */}
          <div style={{
            background: direction === 'sender' ? 'var(--primary-light)' : 'var(--teal-light)',
            border: `1px solid ${direction === 'sender' ? 'var(--primary-border)' : 'var(--teal-border)'}`,
            borderRadius: 'var(--radius-sm)',
            padding: '14px 18px',
            marginBottom: '20px'
          }}>
            <div style={{
              fontSize: '11px',
              fontWeight: 800,
              color: direction === 'sender' ? 'var(--primary)' : 'var(--teal)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '4px'
            }}>
              {direction === 'sender' ? '➔ Transmitter Encapsulation Action:' : '➔ Receiver De-encapsulation Action:'}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 500, lineHeight: 1.6 }}>
              {direction === 'sender' ? currentLayerData.senderAction : currentLayerData.receiverAction}
            </div>
          </div>

          {/* Fields Grid */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
              Extracted Header Fields & Parameters at this Layer
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '10px'
            }}>
              {currentLayerData.fields.map((f, i) => (
                <div
                  key={i}
                  style={{
                    background: '#F9FAFD',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px 14px'
                  }}
                >
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>{f.label}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: 'var(--text)', marginTop: '2px' }}>
                    {f.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Educational Note / Defense Point */}
          <div style={{
            background: '#FAF8FF',
            border: '1px dashed var(--primary-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 16px',
            fontSize: '12px',
            color: '#475569',
            lineHeight: 1.5
          }}>
            <strong style={{ color: 'var(--primary)' }}>Key Jury / Professor Explanation: </strong>
            {currentLayerData.details}
          </div>
        </div>
        </>
      )}
      </div>
    </div>
  );
}
