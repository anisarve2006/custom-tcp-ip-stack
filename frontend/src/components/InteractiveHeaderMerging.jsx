import React, { useState, useEffect } from 'react';

export default function InteractiveHeaderMerging({
  payload = 'Hello World!',
  seq = 10001,
  ack = 50001,
  senderIp = '192.168.1.101',
  receiverIp = '192.168.1.102',
  port = '9999',
  embedded = false
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mode, setMode] = useState('tx'); // 'tx' (encapsulation / merge) or 'rx' (de-encapsulation / strip)

  const payloadBytes = new TextEncoder().encode(payload).length;

  // TX Steps: Encapsulation (Layer 7 down to Layer 1)
  const txSteps = [
    {
      step: 1,
      layer: 'Layer 7 — Application',
      title: 'Generate Application Payload',
      headerAdded: 'User Application Data',
      headerBytes: payloadBytes,
      cumulativeBytes: payloadBytes,
      color: '#7C3AED',
      bg: '#FAF5FF',
      border: '#DDD6FE',
      explanation: 'Application writes raw string buffer to user-space memory. No protocol headers exist yet.',
      fields: [
        { label: 'Data String', value: `"${payload}"` },
        { label: 'Encoding', value: 'UTF-8 / ASCII (1 B/char)' },
        { label: 'Payload Length', value: `${payloadBytes} Bytes` },
        { label: 'Layer Status', value: 'Pure User Data' }
      ],
      cCode: `char msg[] = "${payload}";\nint len = strlen(msg); // ${payloadBytes} bytes in user space`
    },
    {
      step: 2,
      layer: 'Layer 4 — Custom TCP Stack',
      title: 'Prepend 20-Byte TCP Header',
      headerAdded: '+20B Custom TCP',
      headerBytes: 20,
      cumulativeBytes: 20 + payloadBytes,
      color: '#7C3AED',
      bg: '#FAF5FF',
      border: '#7C3AED',
      explanation: 'Your custom C stack prepends a 20-byte RFC 793 header with ports, sequence tracking, window size, and 16-bit 1\'s complement checksum.',
      fields: [
        { label: 'Source Port', value: `${port}` },
        { label: 'Destination Port', value: `${port}` },
        { label: 'Sequence Number', value: `${seq}` },
        { label: 'Ack Number', value: `${ack}` },
        { label: 'Flags', value: 'PSH | ACK (0x18)' },
        { label: 'Window Size', value: '65,535 B' },
        { label: '16b Checksum', value: '0xA42C' },
        { label: 'Layer Status', value: '+20 Bytes Prepended' }
      ],
      cCode: `struct custom_tcp_hdr hdr;\nhdr.src_port = htons(${port});\nhdr.dst_port = htons(${port});\nhdr.seq_num  = htonl(${seq});\nhdr.ack_num  = htonl(${ack});\nhdr.data_offset_flags = htons(0x5018); // 20B, PSH|ACK\nhdr.checksum = compute_checksum(&hdr, msg, len);`
    },
    {
      step: 3,
      layer: 'Layer 4 — UDP Tunnel Overlay',
      title: 'Prepend 8-Byte UDP Datagram Header',
      headerAdded: '+8B UDP Tunnel',
      headerBytes: 8,
      cumulativeBytes: 28 + payloadBytes,
      color: '#0D9488',
      bg: '#F0FDFA',
      border: '#0D9488',
      explanation: 'Your stack invokes sendto() syscall. The OS kernel wraps the custom TCP segment in an 8-byte UDP header so it can travel over standard Wi-Fi.',
      fields: [
        { label: 'UDP Source Port', value: `${port}` },
        { label: 'UDP Dest Port', value: `${port}` },
        { label: 'UDP Length', value: `${28 + payloadBytes} Bytes (8B UDP + 20B TCP + Data)` },
        { label: 'UDP Checksum', value: 'Offloaded to OS/NIC' }
      ],
      cCode: `// User-space socket syscall:\nsendto(udp_socket, tcp_packet, 20 + len, 0, (struct sockaddr*)&remote, sizeof(remote));`
    },
    {
      step: 4,
      layer: 'Layer 3 — IPv4 Network Layer',
      title: 'Prepend 20-Byte IPv4 Packet Header',
      headerAdded: '+20B IPv4 Header',
      headerBytes: 20,
      cumulativeBytes: 48 + payloadBytes,
      color: '#2563EB',
      bg: '#EFF6FF',
      border: '#2563EB',
      explanation: 'The kernel IP subsystem adds a 20-byte IPv4 routing header containing sender/receiver IPs, TTL=64, and Protocol 17 (UDP).',
      fields: [
        { label: 'Source IP', value: `${senderIp}` },
        { label: 'Destination IP', value: `${receiverIp}` },
        { label: 'Time to Live (TTL)', value: '64 Hops' },
        { label: 'Protocol ID', value: '17 (UDP Transport)' },
        { label: 'Total IP Length', value: `${48 + payloadBytes} Bytes` },
        { label: 'Header Checksum', value: '0x4F8A' }
      ],
      cCode: `// OS Kernel IP stack routing:\nip_hdr->saddr = inet_addr("${senderIp}");\nip_hdr->daddr = inet_addr("${receiverIp}");\nip_hdr->protocol = IPPROTO_UDP;`
    },
    {
      step: 5,
      layer: 'Layer 2 — Ethernet Data Link',
      title: 'Prepend 14-Byte MAC Header + Append 4-Byte FCS Trailer',
      headerAdded: '+18B Ethernet & FCS',
      headerBytes: 18,
      cumulativeBytes: 66 + payloadBytes,
      color: '#475569',
      bg: '#F8FAFC',
      border: '#475569',
      explanation: 'Network Interface Card (NIC) prepends 14-byte Ethernet II header (MAC addresses + EtherType 0x0800) and appends 4-byte CRC32 Frame Check Sequence.',
      fields: [
        { label: 'Source MAC', value: '00:1A:2B:3C:4D:5F' },
        { label: 'Dest MAC', value: '00:1A:2B:3C:4D:5E' },
        { label: 'EtherType', value: '0x0800 (IPv4)' },
        { label: 'FCS Trailer (CRC32)', value: '0x9B2C4E1A' },
        { label: 'Total Frame Size', value: `${66 + payloadBytes} Bytes` }
      ],
      cCode: `// Hardware NIC driver:\neth_hdr->h_proto = htons(ETH_P_IP);\ncrc32 = compute_crc32(frame, len);`
    },
    {
      step: 6,
      layer: 'Layer 1 — Physical Radio (Wi-Fi 802.11)',
      title: 'Modulate Raw Octets to 624 Physical Bits',
      headerAdded: '624-Bit RF Signal',
      headerBytes: 0,
      cumulativeBytes: 66 + payloadBytes,
      color: '#10B981',
      bg: '#ECFDF5',
      border: '#10B981',
      explanation: 'Physical transceiver modulates the on-wire octets into 624 binary bits transmitted as 2.4/5 GHz radio frequency electromagnetic waves.',
      fields: [
        { label: 'Total On-Wire Frame', value: `${66 + payloadBytes} Bytes` },
        { label: 'Total Bitstream', value: `${(66 + payloadBytes) * 8} Bits` },
        { label: 'Physical Medium', value: '802.11ax Wi-Fi RF Waves' },
        { label: 'Modulation', value: '1024-QAM / OFDM' }
      ],
      cCode: `// Physical RF Carrier:\n// Transmitting ${(66 + payloadBytes) * 8} bits through air interface over UDP socket tunnel.`
    }
  ];

  // RX Steps: De-encapsulation & Stripping (Layer 1 up to Layer 7)
  const rxSteps = [
    {
      step: 1,
      layer: 'Layer 1 — Physical Radio Reception',
      title: 'Ingest 624-Bit RF Signal & Reconstruct Frame',
      headerAdded: 'Full 78B Ingested',
      headerBytes: 0,
      cumulativeBytes: 66 + payloadBytes, // 78 B
      color: '#10B981',
      bg: '#ECFDF5',
      border: '#10B981',
      explanation: 'Transceiver antenna detects Wi-Fi preamble, demodulates OFDM radio waves into 624 raw binary bits, and reconstructs the full 78-byte frame into the NIC buffer.',
      fields: [
        { label: 'RF Demodulation', value: '802.11 Wi-Fi (OFDM)' },
        { label: 'Bits Ingested', value: `${(66 + payloadBytes) * 8} Bits` },
        { label: 'Initial Frame Size', value: `${66 + payloadBytes} Bytes` },
        { label: 'Headers Stripped', value: '0 Bytes (Full Frame Intact)' }
      ],
      cCode: `// Hardware Physical NIC:\n// Ingesting ${(66 + payloadBytes) * 8} raw bits into ring buffer\nuint8_t rx_raw_frame[${66 + payloadBytes}];`
    },
    {
      step: 2,
      layer: 'Layer 2 — Ethernet Data Link',
      title: 'Validate CRC32 & Strip 14B MAC + 4B FCS Trailer',
      headerAdded: 'Strip Eth & FCS (-18B)',
      headerBytes: -18,
      cumulativeBytes: 48 + payloadBytes, // 60 B
      color: '#475569',
      bg: '#F8FAFC',
      border: '#475569',
      explanation: 'NIC hardware verifies FCS CRC32 (checksum valid with 0 errors). NIC strips the 14-byte Ethernet II header and 4-byte CRC32 trailer, delivering 60 bytes to IPv4 stack.',
      fields: [
        { label: 'MAC Address Match', value: '00:1A:2B:3C:4D:5E (Local Host)' },
        { label: 'FCS CRC32 Check', value: '0x9B2C4E1A (VALID PASS)' },
        { label: 'Headers Stripped', value: '14B MAC + 4B FCS = -18 Bytes' },
        { label: 'Remaining Buffer', value: `${48 + payloadBytes} Bytes` }
      ],
      cCode: `if (validate_crc32(rx_raw_frame, ${66 + payloadBytes}) != 0) drop_frame();\n// Strip Ethernet framing (-18 B)\nuint8_t *ip_buf = rx_raw_frame + 14;\n// Passes ${48 + payloadBytes} bytes to IPv4 stack`
    },
    {
      step: 3,
      layer: 'Layer 3 — IPv4 Network Layer',
      title: 'Verify Local IP & Strip 20B IPv4 Header',
      headerAdded: 'Strip IPv4 (-20B)',
      headerBytes: -20,
      cumulativeBytes: 28 + payloadBytes, // 40 B
      color: '#2563EB',
      bg: '#EFF6FF',
      border: '#2563EB',
      explanation: 'Kernel IP stack verifies destination IP matches local host (192.168.1.102), verifies 16-bit header checksum (0x4F8A), decrements TTL, and strips the 20B IPv4 header.',
      fields: [
        { label: 'Destination IP', value: `${receiverIp} (Match)` },
        { label: 'IPv4 Checksum', value: '0x4F8A (PASS)' },
        { label: 'Protocol ID', value: '17 (UDP Transport)' },
        { label: 'Headers Stripped', value: '-20 Bytes (IPv4 Header)' },
        { label: 'Remaining Buffer', value: `${28 + payloadBytes} Bytes` }
      ],
      cCode: `if (ip_hdr->daddr != inet_addr("${receiverIp}")) return DROP;\nif (verify_ip_checksum(ip_hdr) != 0) return DROP;\n// Strip 20-byte IPv4 header\nuint8_t *udp_buf = ip_buf + 20;\n// Passes ${28 + payloadBytes} bytes to UDP stack`
    },
    {
      step: 4,
      layer: 'Layer 4 — UDP Tunnel Overlay',
      title: 'Route to UDP Port 9999 & Strip 8B UDP Header',
      headerAdded: 'Strip UDP (-8B)',
      headerBytes: -8,
      cumulativeBytes: 20 + payloadBytes, // 32 B
      color: '#0D9488',
      bg: '#F0FDFA',
      border: '#0D9488',
      explanation: 'Kernel UDP layer matches port 9999, strips the 8B UDP datagram header, and delivers 32 bytes of custom TCP segment to user-space recvfrom() socket buffer.',
      fields: [
        { label: 'Bound Socket Port', value: `UDP :${port}` },
        { label: 'UDP Header Length', value: '8 Bytes' },
        { label: 'Headers Stripped', value: '-8 Bytes (UDP Header)' },
        { label: 'Delivered to Custom Stack', value: `${20 + payloadBytes} Bytes` }
      ],
      cCode: `// User-space custom stack receiver loop:\nssize_t n = recvfrom(udp_sock, custom_tcp_buf, sizeof(custom_tcp_buf), 0, ...);\n// Kernel stripped 8B UDP header. Received ${20 + payloadBytes} bytes into user space!`
    },
    {
      step: 5,
      layer: 'Layer 4 — Custom TCP Stack',
      title: 'Validate Checksum, Sequence & Strip 20B Custom TCP Header',
      headerAdded: 'Strip TCP (-20B)',
      headerBytes: -20,
      cumulativeBytes: payloadBytes, // 12 B
      color: '#7C3AED',
      bg: '#FAF5FF',
      border: '#7C3AED',
      explanation: 'Your custom C stack verifies 16-bit 1\'s complement checksum (result 0x0000), checks sequence matches rcv_nxt, generates cumulative ACK (${seq + payloadBytes}), and strips the 20B TCP header.',
      fields: [
        { label: '16b Checksum Result', value: '0x0000 (VALID 1\'s Complement)' },
        { label: 'Seq Received', value: `${seq} (Matches rcv_nxt)` },
        { label: 'Cumulative ACK Sent', value: `Ack: ${seq + payloadBytes}` },
        { label: 'Headers Stripped', value: '-20 Bytes (Custom TCP Header)' },
        { label: 'Remaining Buffer', value: `${payloadBytes} Bytes Clean Data` }
      ],
      cCode: `if (compute_checksum(tcp_hdr, payload, ${payloadBytes}) != 0) return DROP;\nif (ntohl(tcp_hdr->seq_num) == stack->rcv_nxt) {\n    stack->rcv_nxt += ${payloadBytes};\n    send_ack(stack, stack->rcv_nxt); // Send ACK packet\n    // Strip 20B TCP Header, copy clean data to app\n    memcpy(app_buf, custom_tcp_buf + 20, ${payloadBytes});\n}`
    },
    {
      step: 6,
      layer: 'Layer 7 — Application Layer',
      title: 'Deliver Clean Payload to User Space',
      headerAdded: 'Delivered (12B)',
      headerBytes: 0,
      cumulativeBytes: payloadBytes, // 12 B
      color: '#10B981',
      bg: '#ECFDF5',
      border: '#10B981',
      explanation: 'Pure application payload is delivered to application memory. All 66 bytes of protocol overhead have been stripped and verified with 0% data corruption!',
      fields: [
        { label: 'Delivered Data', value: `"${payload}"` },
        { label: 'Payload Size', value: `${payloadBytes} Bytes` },
        { label: 'Total Stripped Overhead', value: '66 Bytes (18B Eth/FCS + 20B IP + 8B UDP + 20B TCP)' },
        { label: 'Transport Status', value: '100% Verified Delivery' }
      ],
      cCode: `printf("Application Received: %s\\n", app_buf);\n// String displayed in user UI: "${payload}"`
    }
  ];

  const steps = mode === 'tx' ? txSteps : rxSteps;
  const activeStepData = steps[currentStep - 1] || steps[0];

  // Auto-play interval
  useEffect(() => {
    let timer = null;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= 6) {
            setIsPlaying(false);
            return 6;
          }
          return prev + 1;
        });
      }, 1800);
    }
    return () => clearInterval(timer);
  }, [isPlaying]);

  const handleModeSwitch = (newMode) => {
    if (newMode !== mode) {
      setMode(newMode);
      setCurrentStep(1);
      setIsPlaying(false);
    }
  };

  // Determine header visibility/stripping status based on current mode and step
  // In TX mode: headers attach as step progresses
  // In RX mode: all headers start present, and get stripped as step progresses
  const isEthPresent = mode === 'tx' ? currentStep >= 5 : currentStep === 1;
  const isEthStripped = mode === 'rx' && currentStep >= 2;

  const isIpPresent = mode === 'tx' ? currentStep >= 4 : currentStep <= 2;
  const isIpStripped = mode === 'rx' && currentStep >= 3;

  const isUdpPresent = mode === 'tx' ? currentStep >= 3 : currentStep <= 3;
  const isUdpStripped = mode === 'rx' && currentStep >= 4;

  const isTcpPresent = mode === 'tx' ? currentStep >= 2 : currentStep <= 4;
  const isTcpStripped = mode === 'rx' && currentStep >= 5;

  return (
    <div style={{
      background: '#FFFFFF',
      border: embedded ? 'none' : '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: embedded ? '0px' : '28px',
      boxShadow: embedded ? 'none' : 'var(--shadow-card)',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px'
    }}>
      {/* Top Header & Mode Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: mode === 'tx' ? 'var(--primary)' : 'var(--teal)' }}></span>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.3px' }}>
              {mode === 'tx' ? 'Interactive Header Merging & Encapsulation Engine' : 'Interactive Header Stripping & De-encapsulation Engine'}
            </h3>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', margin: 0 }}>
            {mode === 'tx'
              ? 'Watch protocol headers sequentially attach to the packet at each layer of the custom stack (Top-Down).'
              : 'Watch protocol headers sequentially validate and strip from the socket buffer as it reaches user space (Bottom-Up).'}
          </p>
        </div>

        {/* Playback Controls & Mode Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setIsPlaying(!isPlaying)}
            style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {isPlaying ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16"></rect>
                  <rect x="14" y="4" width="4" height="16"></rect>
                </svg>
                <span>Pause</span>
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                <span>Auto Step-Through</span>
              </>
            )}
          </button>

          <button
            className="btn btn-outline btn-sm"
            onClick={() => {
              setIsPlaying(false);
              setCurrentStep(1);
            }}
            title="Reset to Step 1"
          >
            ↺ Reset
          </button>

          <div style={{
            display: 'inline-flex',
            background: '#F1F5F9',
            padding: '2px',
            borderRadius: '6px',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)'
          }}>
            <button
              onClick={() => handleModeSwitch('tx')}
              style={{
                border: 'none',
                padding: '5px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                background: mode === 'tx' ? '#FFFFFF' : 'transparent',
                color: mode === 'tx' ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: mode === 'tx' ? 800 : 500,
                boxShadow: mode === 'tx' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              TX (Merge Headers)
            </button>
            <button
              onClick={() => handleModeSwitch('rx')}
              style={{
                border: 'none',
                padding: '5px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                background: mode === 'rx' ? '#FFFFFF' : 'transparent',
                color: mode === 'rx' ? 'var(--teal)' : 'var(--text-muted)',
                fontWeight: mode === 'rx' ? 800 : 500,
                boxShadow: mode === 'rx' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              RX (Strip Headers)
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Step-by-Step Navigation Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: '8px',
        padding: '4px',
        background: '#F8FAFC',
        borderRadius: '8px',
        border: '1px solid var(--border)'
      }}>
        {steps.map((s) => {
          const isSelected = currentStep === s.step;
          const isPassed = currentStep >= s.step;

          return (
            <button
              key={s.step}
              onClick={() => {
                setIsPlaying(false);
                setCurrentStep(s.step);
              }}
              style={{
                border: isSelected
                  ? `1px solid ${mode === 'tx' ? 'var(--primary)' : 'var(--teal)'}`
                  : '1px solid transparent',
                borderRadius: '6px',
                padding: '10px 8px',
                textAlign: 'center',
                background: isSelected ? '#FFFFFF' : isPassed ? '#F1F5F9' : 'transparent',
                cursor: 'pointer',
                boxShadow: isSelected ? 'var(--shadow-xs)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                color: isSelected
                  ? (mode === 'tx' ? 'var(--primary)' : 'var(--teal)')
                  : isPassed ? 'var(--text)' : 'var(--text-subtle)'
              }}>
                STEP 0{s.step}
              </div>
              <div style={{
                fontSize: '11px',
                fontWeight: isSelected ? 800 : 600,
                color: isSelected ? 'var(--text)' : 'var(--text-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                marginTop: '2px'
              }}>
                {s.headerAdded}
              </div>
              <div style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                color: isSelected ? (mode === 'tx' ? 'var(--primary)' : 'var(--teal)') : 'var(--text-subtle)',
                marginTop: '2px',
                fontWeight: 700
              }}>
                {s.cumulativeBytes} B
              </div>
            </button>
          );
        })}
      </div>

      {/* Dynamic Frame Assembly Visualizer */}
      <div style={{
        background: '#FAF9FE',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '24px 28px',
        position: 'relative'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {mode === 'tx'
              ? `Live On-Wire Frame Assembly: Step ${currentStep} of 6 (Encapsulation)`
              : `Live Receiver Header Stripping: Step ${currentStep} of 6 (De-encapsulation)`}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700 }}>
            {mode === 'tx' ? 'Total Segment: ' : 'Remaining Socket Buffer: '}
            <span style={{ color: mode === 'tx' ? 'var(--primary)' : 'var(--teal)', fontSize: '14px' }}>
              {activeStepData.cumulativeBytes} Bytes
            </span>
            {mode === 'rx' && (
              <span style={{ color: '#EF4444', fontWeight: 600, marginLeft: '8px' }}>
                (Stripped: {(66 + payloadBytes) - activeStepData.cumulativeBytes} B)
              </span>
            )}
          </div>
        </div>

        {/* Visual Frame Blocks */}
        <div style={{
          display: 'flex',
          alignItems: 'stretch',
          minHeight: '72px',
          border: '2px dashed var(--border)',
          borderRadius: '8px',
          background: '#FFFFFF',
          padding: '6px',
          gap: '6px',
          overflowX: 'auto',
          transition: 'all 0.3s ease'
        }}>
          {/* L2 Ethernet Header */}
          {(isEthPresent || isEthStripped) && (
            <div style={{
              flex: '1.2',
              background: isEthStripped ? '#F8FAFC' : '#F1F5F9',
              border: isEthStripped ? '1px dashed #CBD5E1' : '1px solid #475569',
              opacity: isEthStripped ? 0.38 : 1,
              borderRadius: '6px',
              padding: '8px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              transition: 'all 0.25s ease'
            }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#475569' }}>L2 Header</div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#1E293B', textDecoration: isEthStripped ? 'line-through' : 'none' }}>
                Ethernet II
              </div>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: isEthStripped ? '#EF4444' : 'var(--text-muted)' }}>
                {isEthStripped ? 'STRIPPED ✕' : '+14 Bytes'}
              </div>
            </div>
          )}

          {/* L3 IPv4 Header */}
          {(isIpPresent || isIpStripped) && (
            <div style={{
              flex: '1.4',
              background: isIpStripped ? '#F8FAFC' : '#EFF6FF',
              border: isIpStripped ? '1px dashed #CBD5E1' : '1px solid #2563EB',
              opacity: isIpStripped ? 0.38 : 1,
              borderRadius: '6px',
              padding: '8px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              transition: 'all 0.25s ease'
            }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#2563EB' }}>L3 Header</div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#1E40AF', textDecoration: isIpStripped ? 'line-through' : 'none' }}>
                IPv4
              </div>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: isIpStripped ? '#EF4444' : '#2563EB' }}>
                {isIpStripped ? 'STRIPPED ✕' : '+20 Bytes'}
              </div>
            </div>
          )}

          {/* L4 UDP Tunnel Header */}
          {(isUdpPresent || isUdpStripped) && (
            <div style={{
              flex: '1.1',
              background: isUdpStripped ? '#F8FAFC' : '#F0FDFA',
              border: isUdpStripped ? '1px dashed #CBD5E1' : '1px solid #0D9488',
              opacity: isUdpStripped ? 0.38 : 1,
              borderRadius: '6px',
              padding: '8px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              transition: 'all 0.25s ease'
            }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#0D9488' }}>L4 Tunnel</div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#0F766E', textDecoration: isUdpStripped ? 'line-through' : 'none' }}>
                UDP Socket
              </div>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: isUdpStripped ? '#EF4444' : '#0D9488' }}>
                {isUdpStripped ? 'STRIPPED ✕' : '+8 Bytes'}
              </div>
            </div>
          )}

          {/* L4 Custom TCP Header */}
          {(isTcpPresent || isTcpStripped) && (
            <div style={{
              flex: '2.2',
              background: isTcpStripped ? '#F8FAFC' : '#FAF5FF',
              border: isTcpStripped ? '1px dashed #CBD5E1' : '2px solid var(--primary)',
              opacity: isTcpStripped ? 0.38 : 1,
              borderRadius: '6px',
              padding: '8px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              position: 'relative',
              transition: 'all 0.25s ease',
              boxShadow: (mode === 'tx' && currentStep === 2) || (mode === 'rx' && currentStep === 5)
                ? '0 0 10px rgba(124, 58, 237, 0.25)'
                : 'none'
            }}>
              <div style={{
                position: 'absolute',
                top: '2px',
                right: '4px',
                fontSize: '8px',
                fontWeight: 800,
                background: isTcpStripped ? '#94A3B8' : 'var(--primary)',
                color: '#FFFFFF',
                padding: '1px 4px',
                borderRadius: '3px'
              }}>
                CUSTOM STACK
              </div>
              <div style={{ fontSize: '10px', fontWeight: 800, color: isTcpStripped ? 'var(--text-muted)' : 'var(--primary)' }}>
                Layer 4 Transport
              </div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: isTcpStripped ? 'var(--text-muted)' : '#5B21B6', textDecoration: isTcpStripped ? 'line-through' : 'none' }}>
                Custom TCP Header
              </div>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: isTcpStripped ? '#EF4444' : 'var(--primary)', fontWeight: 700 }}>
                {isTcpStripped ? 'STRIPPED ✕ (ACK EMITTED)' : '+20 Bytes (RFC 793)'}
              </div>
            </div>
          )}

          {/* Application Payload (Always Present) */}
          <div style={{
            flex: '2.8',
            background: mode === 'rx' && currentStep === 6 ? '#ECFDF5' : '#FAF8FF',
            border: mode === 'rx' && currentStep === 6 ? '2px solid #10B981' : '1px solid var(--border)',
            borderRadius: '6px',
            padding: '8px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            minWidth: '140px',
            transition: 'all 0.25s ease',
            boxShadow: mode === 'rx' && currentStep === 6 ? '0 0 12px rgba(16, 185, 129, 0.25)' : 'none'
          }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: mode === 'rx' && currentStep === 6 ? '#059669' : 'var(--primary)' }}>
              {mode === 'rx' && currentStep === 6 ? '✓ Clean User Payload' : 'L7 Application Payload'}
            </div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              "{payload}"
            </div>
            <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              {payloadBytes} Bytes
            </div>
          </div>

          {/* L2 Ethernet FCS Trailer */}
          {(isEthPresent || isEthStripped) && (
            <div style={{
              flex: '0.9',
              background: isEthStripped ? '#F8FAFC' : '#F1F5F9',
              border: isEthStripped ? '1px dashed #CBD5E1' : '1px solid #475569',
              opacity: isEthStripped ? 0.38 : 1,
              borderRadius: '6px',
              padding: '8px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              transition: 'all 0.25s ease'
            }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#475569' }}>L2 Trailer</div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#1E293B', textDecoration: isEthStripped ? 'line-through' : 'none' }}>
                CRC32
              </div>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: isEthStripped ? '#EF4444' : 'var(--text-muted)' }}>
                {isEthStripped ? 'STRIPPED ✕' : '+4 Bytes'}
              </div>
            </div>
          )}
        </div>

        {/* Physical Bitstream Banner */}
        {((mode === 'tx' && currentStep === 6) || (mode === 'rx' && currentStep === 1)) && (
          <div style={{
            marginTop: '14px',
            padding: '10px 14px',
            background: '#0F172A',
            borderRadius: '6px',
            color: '#10B981',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            overflowX: 'auto',
            whiteSpace: 'nowrap',
            letterSpacing: '1px'
          }}>
            {mode === 'tx'
              ? `[L1 PHY RF BITSTREAM]: 01001000 01100101 01101100 01101100 01101111 00100000 01010111 01101111 01110010 01101100 01100100 00100001 (624 bits modulated over Wi-Fi RF carrier)`
              : `[L1 PHY RF INGESTION]: Antenna demodulated 624 physical bits into 78-byte NIC ring buffer.`}
          </div>
        )}

        {/* RX Step 6 Delivery Success Banner */}
        {mode === 'rx' && currentStep === 6 && (
          <div style={{
            marginTop: '14px',
            padding: '10px 14px',
            background: '#ECFDF5',
            border: '1px solid #10B981',
            borderRadius: '6px',
            color: '#065F46',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ fontWeight: 800 }}>✓ SUCCESS:</span>
            <span>All 66 bytes of protocol headers successfully verified & stripped. Application buffer holds clean string: "{payload}".</span>
          </div>
        )}
      </div>

      {/* Active Step Detailed Breakdown & Fields */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr',
        gap: '20px'
      }}>
        {/* Left: What Was Merged / Stripped In This Step */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          padding: '20px',
          boxShadow: 'var(--shadow-xs)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 800,
              fontFamily: 'var(--font-mono)',
              background: activeStepData.color,
              color: '#FFFFFF',
              padding: '2px 8px',
              borderRadius: '4px'
            }}>
              STEP 0{activeStepData.step}
            </span>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
              {activeStepData.layer}
            </span>
          </div>

          <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', marginBottom: '8px' }}>
            {activeStepData.title}
          </h4>

          <p style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.5, marginBottom: '16px' }}>
            {activeStepData.explanation}
          </p>

          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
            {mode === 'tx' ? 'Prepended Header Fields (Serialized):' : 'Validated & Stripped Header Fields:'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
            {activeStepData.fields.map((f, i) => (
              <div key={i} style={{ background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: '4px', padding: '6px 10px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '10px', display: 'block' }}>{f.label}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text)' }}>{f.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: C Implementation & Serialization / De-encapsulation Code */}
        <div style={{
          background: '#0F172A',
          color: '#F8FAFC',
          borderRadius: 'var(--radius-sm)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                C Source Implementation
              </span>
              <span style={{ fontSize: '10px', color: mode === 'tx' ? '#38BDF8' : '#10B981', fontFamily: 'var(--font-mono)' }}>
                {mode === 'tx' ? '● TX Serialization' : '● RX De-encapsulation & Strip'}
              </span>
            </div>

            <pre style={{
              margin: 0,
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              lineHeight: 1.5,
              color: '#38BDF8',
              overflowX: 'auto',
              whiteSpace: 'pre-wrap'
            }}>
              {activeStepData.cCode}
            </pre>
          </div>

          <div style={{
            marginTop: '16px',
            paddingTop: '12px',
            borderTop: '1px solid #1E293B',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '11px',
            color: '#94A3B8'
          }}>
            <span>Step {currentStep} of 6 ({mode === 'tx' ? 'TX Merge' : 'RX Strip'})</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                className="btn btn-sm"
                disabled={currentStep <= 1}
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentStep((p) => Math.max(1, p - 1));
                }}
                style={{
                  background: '#1E293B',
                  color: '#FFFFFF',
                  border: '1px solid #334155',
                  padding: '3px 10px',
                  fontSize: '11px'
                }}
              >
                ◀ Prev
              </button>
              <button
                className="btn btn-sm"
                disabled={currentStep >= 6}
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentStep((p) => Math.min(6, p + 1));
                }}
                style={{
                  background: mode === 'tx' ? 'var(--primary)' : 'var(--teal)',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '3px 10px',
                  fontSize: '11px'
                }}
              >
                Next ▶
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
