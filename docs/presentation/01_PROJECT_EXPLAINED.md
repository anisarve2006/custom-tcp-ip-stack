# 01. StackScope Project Explained

> **Executive Summary for Live Evaluation**  
> **Project Name:** StackScope / ProtoLink — Custom TCP/IP Stack & User-Space Transport Protocol Visualizer  
> **Core Concept:** A user-space implementation of Layer 4 transport reliability (handshake, sequence tracking, cumulative ACK, 16-bit 1's complement checksums, congestion control, and live PCAP generation) running in C over standard UDP datagram tunnels, paired with an interactive visual telemetry laboratory.

---

## The Core Analogy

> *"Imagine two computers communicating through a network. Instead of relying on the operating system's built-in TCP connection management, our program implements its own transport protocol logic in user space. The operating system still carries the UDP packets across the network, while our C code manages the custom connection, sequence numbers, acknowledgments, and other implemented transport functions."*

### Connecting the Analogy to Our Real Code
1. **The Post Office (OS Kernel + UDP)**: The operating system and physical network card act as the postal truck. When our program calls `sendto()` in [`src/link_udp.c`](file:///e:/Main%20Projects/CN%20Project/src/link_udp.c#L115), the OS attaches standard IP and UDP headers and moves the bits across Wi-Fi or Ethernet. The OS does not know what is inside our envelope; to the kernel, it is just an opaque blob of UDP payload data.
2. **The Sealed Letter (Custom 20-Byte Header)**: Inside that UDP payload, our C code writes a custom 20-byte transport header defined in [`include/custom_proto.h`](file:///e:/Main%20Projects/CN%20Project/include/custom_proto.h#L31-L41). This header contains our own magic signature (`0xCAFE`), sequence numbers, acknowledgment numbers, flags (`SYN`, `ACK`, `DATA`, `FIN`, `RST`), window size, and an RFC 1071 16-bit checksum.
3. **The Intelligent Recipient (User-Space State Machine)**: When the packet arrives, the receiver OS simply hands the UDP data to our program via `recvfrom()` in [`src/link_udp.c`](file:///e:/Main%20Projects/CN%20Project/src/link_udp.c#L128). Our C code in [`src/custom_proto.c`](file:///e:/Main%20Projects/CN%20Project/src/custom_proto.c#L64) unpacks the envelope, verifies the checksum, enforces the 3-way handshake state machine in [`src/test_custom_stack.c`](file:///e:/Main%20Projects/CN%20Project/src/test_custom_stack.c#L89), and calculates cumulative acknowledgments.

---

## Comprehensive Question & Answer Guide

### 1. What problem does this project solve?
* **Simple Explanation**: Operating systems hide all the internal mechanics of TCP inside the kernel. When an application calls standard network libraries, it cannot see sequence number increments, packet loss recovery, checksum calculations, or state transitions in real time. StackScope takes the "black box" of transport protocols and rebuilds it in user-space C where every single bit, header field, and state transition is visible, controllable, and verifiable.
* **Technical Details**: OS kernel TCP implementations (e.g., Linux TCP or Windows TCP/IP driver `tcpip.sys`) operate in ring 0. Modifying kernel TCP for experimentation requires kernel rebuilds, kernel debugging, and risks system crashes. By implementing RFC 793 / RFC 1071 transport logic in user space (ring 3), developers and students can inspect packet serialization byte-by-byte, inject simulated packet loss, test custom congestion control, and export exact `.pcap` packet traces for Wireshark inspection.

### 2. Why did we build a custom transport protocol?
* **Simple Explanation**: To prove that reliable communication does not require magic from the operating system—it is simply disciplined software engineering following protocol specifications. Building it from scratch teaches exactly how computers agree on connection states, detect corrupted data, handle lost packets, and prevent network congestion.
* **Technical Details**: Commercial protocols like Google's QUIC (HTTP/3) and Cloudflare's transport layers were born from the realization that kernel TCP evolves too slowly. Building a user-space transport protocol over UDP mirrors modern industry architectural patterns (such as QUIC, WebRTC, and F-Stack) where transport reliability and congestion algorithms are innovated entirely in user space.

### 3. What is TCP/IP, and which parts are we implementing ourselves?
* **Simple Explanation**: TCP/IP is a 4-layer model: Application, Transport, Network, and Link. In our project, we use the operating system for Network (IPv4) and Link (Wi-Fi/Ethernet), but we **completely replace standard TCP with our own custom Layer 4 transport protocol engine**.
* **Technical Details**:
  * **Layer 7 (Application)**: Our own application payloads (`"Hello World"` string buffers, interactive sender menus).
  * **Layer 4 (Transport - Custom C Code)**: **Implemented by us**. 20-byte custom header ([`myproto_hdr_t`](file:///e:/Main%20Projects/CN%20Project/include/custom_proto.h#L31)), 3-way handshake (`SYN` $\to$ `SYN+ACK` $\to$ `ACK`), state machine (`LISTEN`, `SYN_SENT`, `SYN_RCVD`, `ESTABLISHED`, `FIN_WAIT`, `CLOSED`), 16-bit 1's complement checksum ([`compute_checksum`](file:///e:/Main%20Projects/CN%20Project/src/custom_proto.c#L13)), sequence and ACK number accounting, and Reno congestion window tracking.
  * **Layer 4 Tunnel (UDP)**: Handled by OS socket API (`SOCK_DGRAM`) as an encapsulation carrier on port 9999.
  * **Layer 3 (IPv4)**: Handled by host OS routing subsystem.
  * **Layer 2 (Data Link) & Layer 1 (Physical)**: Handled by the network adapter driver and Wi-Fi/Ethernet hardware.

### 4. What does "user space" mean?
* **Simple Explanation**: Modern computers divide memory into two zones: "Kernel space" where the operating system runs with direct hardware access, and "User space" where normal programs (like browsers, text editors, and our C program) run safely without crashing the computer.
* **Technical Details**: Operating system kernels operate in CPU privilege ring 0, managing page tables, device drivers, and core networking stacks. User space runs in ring 3. In standard programming, you call `socket(AF_INET, SOCK_STREAM, 0)` and the kernel handles TCP headers, timers, and buffers. In StackScope, our C binary (`test_custom_stack.exe` or `CustomStackGUI.exe`) executes in ring 3, managing its own packet structures, byte serialization, sequence tracking, and buffer state without kernel privileges.

### 5. What role does UDP play?
* **Simple Explanation**: UDP is an "empty envelope" provider. It delivers raw datagrams from computer A to computer B without doing any handshakes, retransmissions, or ordering. We use UDP as our raw transport pipe across local Wi-Fi or the internet.
* **Technical Details**: Raw Layer 2 Ethernet frame access (`AF_PACKET` on Linux or Npcap on Windows) requires Administrator/root privileges and does not route across ordinary consumer Wi-Fi routers. By encapsulating our 20-byte transport header and payload inside an unprivileged UDP socket (`AF_INET, SOCK_DGRAM, IPPROTO_UDP`), our custom stack runs seamlessly across ordinary residential Wi-Fi, LANs, and loopback without administrative permission or kernel drivers.

### 6. What does the operating system still do?
* **Simple Explanation**: The OS routes the UDP datagrams through the physical Wi-Fi or Ethernet card and delivers incoming datagrams to our port (`9999`).
* **Technical Details**: The OS kernel performs:
  1. Address Resolution Protocol (ARP) to map destination IPs to gateway MAC addresses.
  2. IPv4 packet header generation (TTL, IP identification, IP checksum, IP routing).
  3. UDP outer framing (source port, destination port, UDP length, UDP checksum).
  4. Physical Network Interface Card (NIC) DMA queue scheduling and interrupt handling.

### 7. What happens when the server starts?
* **Simple Explanation**: The receiver initializes its network link on UDP port 9999, opens a packet capture file, sets its protocol state to `LISTEN`, and waits for incoming packets in a non-blocking loop.
* **Technical Details**:
  1. In [`src/test_custom_stack.c:run_server_mode`](file:///e:/Main%20Projects/CN%20Project/src/test_custom_stack.c#L69), `link_init(port, NULL, 0)` is called.
  2. [`src/link_udp.c`](file:///e:/Main%20Projects/CN%20Project/src/link_udp.c#L30) calls `WSAStartup()`, creates `socket(AF_INET, SOCK_DGRAM, 0)`, enables `SO_REUSEADDR`, binds to `0.0.0.0:9999`, and sets `FIONBIO` (non-blocking I/O).
  3. [`pcap_init("captures/server_traffic.pcap")`](file:///e:/Main%20Projects/CN%20Project/src/pcap_logger.c#L16) creates a standard 24-byte PCAP file header.
  4. State variable `state` is set to `STATE_LISTEN`, and the telemetry server is updated with state `"LISTEN"`.
  5. The server selects its Initial Send Sequence number (`my_iss = 50000`) and enters the `link_recv_frame()` polling loop.

### 8. How does the client establish a connection?
* **Simple Explanation**: The client performs a classic 3-way handshake:
  1. Client sends a **SYN** packet to the server.
  2. Server answers with a **SYN + ACK** packet.
  3. Client answers with an **ACK** packet.
  Once this is done, both computers know the other is listening, and both agree on sequence numbers.
* **Technical Details**:
  * **Step 1 (`SYN`)**: Client sets `snd_nxt = 10000`, serializes a packet with `flags = FLAG_SYN (0x01)`, `seq_num = 10000`, `ack_num = 0`, `win_size = 65535`, `payload_len = 0`. It advances `snd_nxt++` to `10001` and transitions state to `SYN_SENT`.
  * **Step 2 (`SYN+ACK`)**: Server receives `SYN`, sets `rcv_nxt = hdr.seq_num + 1 = 10001`, and transitions to `SYN_RCVD`. Server sends a packet with `flags = FLAG_SYN | FLAG_ACK (0x03)`, `seq_num = 50000`, `ack_num = 10001`. Server advances `snd_nxt++` to `50001`.
  * **Step 3 (`ACK`)**: Client receives `SYN+ACK`, verifies `hdr.ack_num == 10001`, sets its `rcv_nxt = hdr.seq_num + 1 = 50001`, and transitions to `ESTABLISHED`. Client sends `flags = FLAG_ACK (0x02)`, `seq_num = 10001`, `ack_num = 50001`.
  * Server receives `ACK` and transitions to `ESTABLISHED`.

### 9. What exactly happens when we send "Hello World"?
* **Simple Explanation**: The client takes the 11 characters of `"Hello World"`, puts our 20-byte transport header in front of it (creating a 31-byte packet), computes the checksum, and sends it through UDP. The server receives the 31 bytes, verifies that nothing was corrupted, checks that the sequence number is exactly what was expected, prints `"Hello World"`, and sends back an ACK packet confirming it received all 11 bytes.
* **Technical Details**:
  * Payload size: `strlen("Hello World") = 11 bytes`.
  * Header size: `sizeof(myproto_hdr_t) = 20 bytes`. Total wire payload: `31 bytes`.
  * Sender sequence number: `Seq = 10001`.
  * Flags: `FLAG_DATA | FLAG_ACK (0x06)`.
  * Receiver receives 31 bytes, verifies `compute_checksum()` equals `0`, confirms `hdr.seq_num == rcv_nxt (10001 == 10001)`, extracts payload to stdout, and advances `rcv_nxt = 10001 + 11 = 10012`.
  * Receiver immediately replies with an ACK packet (`seq=50001, ack=10012`).

### 10. What information does each packet contain?
* **Simple Explanation**: Exactly 20 bytes of transport metadata followed by zero or more bytes of application data:
  * A 2-byte secret handshake signature (`0xCAFE`).
  * A 1-byte version number (`1`).
  * A 1-byte control flags field (`SYN`, `ACK`, `DATA`, `FIN`, `RST`).
  * A 4-byte sequence number.
  * A 4-byte acknowledgment number.
  * A 2-byte flow-control receive window size.
  * A 2-byte payload length indicator.
  * A 2-byte error-checking checksum.
  * A 2-byte reserved alignment padding.
* **Technical Details**: Defined in [`myproto_hdr_t`](file:///e:/Main%20Projects/CN%20Project/include/custom_proto.h#L31) with `#pragma pack(push, 1)` to eliminate compiler structure padding and guarantee byte-level wire compatibility across different architectures and compilers.

### 11. How does the receiver extract and validate the message?
* **Simple Explanation**: In [`src/custom_proto.c:parse_custom_packet`](file:///e:/Main%20Projects/CN%20Project/src/custom_proto.c#L64), the receiver runs three security and integrity checks before accepting any data:
  1. **Length Check**: Is the received buffer at least 20 bytes long? If not, reject (`-1`).
  2. **Checksum Check**: Does the 16-bit 1's complement sum equal zero? If not, reject as corrupted (`-2`).
  3. **Magic Byte Check**: Is the first 16-bit word `0xCAFE`? If not, reject as foreign traffic (`-3`).
  4. **Payload Boundary Check**: Does header `payload_len` match the remaining buffer size? If not, reject (`-4`).
* **Technical Details**: Once validated, all 16-bit and 32-bit fields are translated from network byte order (Big Endian) to host byte order using `ntohs()` and `ntohl()`. A pointer to the first byte after the 20-byte header is returned as the application payload pointer.

### 12. How does the receiver acknowledge the data?
* **Simple Explanation**: The receiver sends back an acknowledgment packet with the `ACK` flag enabled. In the `ack_num` field, the receiver puts the **next sequence number it expects to receive**.
* **Technical Details**: Our stack implements **Cumulative Acknowledgment** (RFC 793). When the receiver gets 11 bytes starting at sequence `10001`, it acknowledges `10001 + 11 = 10012`. This mathematically tells the sender: *"I have received every byte up to byte 10011; send byte 10012 next."*

### 13. How are sequence numbers advanced?
* **Simple Explanation**:
  * Control packets that consume a logical state step (`SYN` and `FIN`) advance the sequence number by **1**.
  * Data packets advance the sequence number by the **exact number of payload bytes carried**.
  * Pure `ACK` packets carry no payload and do not consume sequence numbers.
* **Technical Details**:
  * Initial Handshake: Client `SYN` at `10000` consumes 1 sequence number $\to$ subsequent data begins at `10001`.
  * Transmission: 11 bytes of `"Hello World"` at `Seq = 10001` span sequence numbers `10001` through `10011`.
  * The resulting ACK acknowledges `10012`.
  * Sequence comparisons use RFC 1982 serial number arithmetic ([`include/custom_proto.h:SEQ_LT, SEQ_GT`](file:///e:/Main%20Projects/CN%20Project/include/custom_proto.h#L20-L23)) using signed 32-bit casts `((int32_t)(a - b) > 0)` to guarantee flawless behavior even when sequence numbers wrap around $2^{32} - 1$.

### 14. How is a connection closed?
* **Simple Explanation**: The sender transmits a packet with the `FIN` flag (Finish). The receiver logs the teardown request, sends an `ACK` acknowledging the `FIN`, and transitions its state to `CLOSED`.
* **Technical Details**: In [`src/test_custom_stack.c:340`](file:///e:/Main%20Projects/CN%20Project/src/test_custom_stack.c#L340), the client sends `FLAG_FIN | FLAG_ACK` with `Seq = 10012`. It enters `STATE_FIN_WAIT`. The server detects `FLAG_FIN` at line 154, increments expected sequence `rcv_nxt = hdr.seq_num + 1`, transmits an `ACK` packet, and transitions to `STATE_CLOSED`. The client receives the `ACK` and transitions to `STATE_CLOSED`.

### 15. What does the dashboard display, and where does its data originate?
* **Simple Explanation**: The project features three user interfaces:
  1. **Native Windows Desktop GUI (`CustomStackGUI.exe`)**: Built with Win32/GDI in pure C; renders live congestion window graphs, real-time packet tables, and hex dumps directly from memory.
  2. **Single-File Web Dashboard (`index.html` / `StackScope – Custom TCP_IP Packet Analyzer.html`)**: Connects via HTTP REST polling to `http://localhost:8080/api/packets` and `http://localhost:8080/api/status` exposed by [`src/telemetry_server.c`](file:///e:/Main%20Projects/CN%20Project/src/telemetry_server.c#L360).
  3. **Interactive Protocol Lab (`frontend/` running on `localhost:5173`)**: A modern React visual lab featuring interactive step-by-step header encapsulation/de-encapsulation, sequence calculation, packet modal inspection, and architectural walkthroughs.
* **Technical Details**: The embedded C telemetry server in [`src/telemetry_server.c`](file:///e:/Main%20Projects/CN%20Project/src/telemetry_server.c) maintains a circular ring buffer of the last 128 packets. Whenever `telemetry_log_packet()` is invoked in C, it records timestamp, sequence, ACK, flags, and hex representations, which are served as JSON to any connected web client.

### 16. What can Wireshark verify?
* **Simple Explanation**: Wireshark independently inspects the real `.pcap` files recorded by our C program. When loaded with our custom Lua dissector ([`nexus_proto.lua`](file:///e:/Main%20Projects/CN%20Project/nexus_proto.lua)), Wireshark recognizes our custom packets, labels them as `NEXUS-TCP`, highlights each header field in color, and proves that our packets are real network frames rather than a UI mockup.
* **Technical Details**: Our C stack uses [`src/pcap_logger.c`](file:///e:/Main%20Projects/CN%20Project/src/pcap_logger.c) to write authentic Libpcap 2.4 capture files (`captures/client_traffic.pcap` and `captures/server_traffic.pcap`). The Lua dissector binds to UDP port `9999` and dissects the 20-byte custom header into protocol trees (`nexus.magic`, `nexus.flags`, `nexus.seq`, `nexus.ack`, `nexus.checksum`).

### 17. What are the project's current limitations?
* **Simple Explanation (Honest Academic Transparency)**:
  * Transport is currently encapsulated over UDP sockets rather than a raw kernel TAP device driver on Windows.
  * Congestion control (TCP Reno Slow Start and Fast Recovery) is demonstrated via an automated test harness and telemetry simulation rather than dynamic pacing across a live high-latency WAN.
  * Out-of-order packets generate duplicate ACKs, but an out-of-order packet reassembly queue is not yet implemented.
* **Technical Details**: See [`docs/presentation/06_FEATURE_VERIFICATION.md`](file:///e:/Main%20Projects/CN%20Project/docs/presentation/06_FEATURE_VERIFICATION.md) for a complete matrix of implemented vs simulated vs planned capabilities.

### 18. What makes the project technically valuable?
* **Simple Explanation**: It demystifies the fundamental foundation of the internet. By writing the protocol serialization, byte-order handling, 1's complement arithmetic, non-blocking I/O, state machine transitions, and packet capture generation by hand in C, the project demonstrates a complete, deep understanding of computer networking principles.
* **Technical Details**: It bridges low-level systems programming (Winsock2, memory packing, bitwise arithmetic, endianness, non-blocking sockets, RFC compliance) with modern observability (Wireshark Lua dissectors, REST telemetry APIs, and reactive visualization).
