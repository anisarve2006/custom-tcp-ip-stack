# 04. Professor & Technical Evaluator Q&A Defense Guide

> **Preparation Note**: Evaluators look for intellectual honesty, rigorous understanding of protocol standards, and the ability to distinguish implemented features from simulated models. Use these concise, defensible answers.

---

### Q1: Why build a custom protocol instead of just using standard TCP?
**Answer**:  
Standard TCP operates in kernel space (ring 0). Applications cannot observe, modify, or instrument its internal state machine, sequence arithmetic, or congestion algorithms without compiling custom kernel modules. We built our custom protocol in user space (ring 3) to demystify transport mechanics, inspect packet serialization bit-by-bit, demonstrate protocol design from first principles, and test custom transport behaviors in user space—mirroring modern industry protocols like Google QUIC and WebRTC.

---

### Q2: Why did you use UDP underneath instead of raw Ethernet frames or a TAP device?
**Answer**:  
Raw Layer-2 Ethernet sockets (`AF_PACKET` on Linux or Npcap on Windows) require elevated administrator/root privileges and are immediately dropped by consumer Wi-Fi access points and NAT routers, which only forward standard IP packets. By using UDP (`SOCK_DGRAM`) on port 9999 as our Layer 4 overlay carrier, our custom transport protocol runs across real Wi-Fi networks, home routers, and multi-hop LANs with zero administrator privileges and zero custom kernel drivers.

---

### Q3: Is the operating system kernel actually bypassed?
**Answer**:  
**The OS TCP stack is 100% bypassed, but the OS network interface and UDP/IP stack are not.**  
Our program does not invoke OS TCP connection management, sequence tracking, or retransmission logic. However, to physically move bits through the Wi-Fi card without kernel-bypass drivers like DPDK or AF_XDP, we invoke standard `sendto()` and `recvfrom()` syscalls on UDP sockets. The kernel merely serves as an unprivileged packet carrier.

---

### Q4: Exactly how does your 3-way handshake work?
**Answer**:  
1. **Client $\to$ Server (`SYN`)**: Client picks an Initial Sequence Number (`my_iss = 10000`), sets `flags = FLAG_SYN (0x01)`, `ack_num = 0`, advances its sequence by 1 (`snd_nxt = 10001`), and transitions state to `SYN_SENT`.
2. **Server $\to$ Client (`SYN+ACK`)**: Server receives `SYN`, sets `rcv_nxt = 10000 + 1 = 10001`, transitions to `SYN_RCVD`, picks its own sequence number (`50000`), advances `snd_nxt = 50001`, and sends `FLAG_SYN | FLAG_ACK (0x03)`.
3. **Client $\to$ Server (`ACK`)**: Client verifies `ack_num == 10001`, sets `rcv_nxt = 50001`, transitions to `ESTABLISHED`, and sends `FLAG_ACK (0x02)` acknowledging `50001`.
4. The server receives the ACK and transitions to `ESTABLISHED`.

---

### Q5: What happens if an ACK is lost on the network?
**Answer**:  
Because our stack uses **Cumulative Acknowledgment**, if an intermediate ACK is dropped, a subsequent higher ACK for later data automatically acknowledges all preceding bytes. In our sender implementation ([`src/test_custom_stack.c:314`](file:///e:/Main%20Projects/CN%20Project/src/test_custom_stack.c#L314)), the sender runs a non-blocking wait loop with a timeout (2 seconds). If no ACK arrives before the timeout expires, the sender retransmits the unacknowledged segment.

---

### Q6: What happens if packets arrive out of order?
**Answer**:  
In [`src/test_custom_stack.c:135`](file:///e:/Main%20Projects/CN%20Project/src/test_custom_stack.c#L135), the receiver compares `hdr.seq_num` against its expected `rcv_nxt`:
* If `hdr.seq_num == rcv_nxt`, data is accepted in order, and `rcv_nxt` advances by `payload_len`.
* If `SEQ_GT(hdr.seq_num, rcv_nxt)`, an out-of-order gap is detected. The receiver **does not advance `rcv_nxt`**; instead, it immediately transmits a **Duplicate ACK** repeating its current `rcv_nxt`.
* *Honest limitation*: An out-of-order reassembly queue (holding subsequent packets in memory while waiting for the missing segment) is defined in our proposal architecture but not yet implemented in the current C loop.

---

### Q7: How are duplicate packets handled?
**Answer**:  
In [`src/test_custom_stack.c:139`](file:///e:/Main%20Projects/CN%20Project/src/test_custom_stack.c#L139), if the receiver gets a packet where `hdr.seq_num + hdr.payload_len <= rcv_nxt`, it recognizes that these bytes have already been delivered to the application buffer. The receiver drops the duplicate payload but re-sends an ACK with `rcv_nxt` to ensure the sender updates its unacknowledged pointer (`snd_una`).

---

### Q8: What happens when a 32-bit sequence number wraps around ($2^{32}-1 \to 0$)?
**Answer**:  
We implemented **RFC 1982 Serial Number Arithmetic** in [`include/custom_proto.h:19-23`](file:///e:/Main%20Projects/CN%20Project/include/custom_proto.h#L19-L23):
```c
#define SEQ_LT(a, b)  ((int32_t)((a) - (b)) < 0)
#define SEQ_GT(a, b)  ((int32_t)((a) - (b)) > 0)
```
By casting the difference of two unsigned 32-bit integers to a signed 32-bit integer (`int32_t`), differences up to $2^{31}-1$ correctly evaluate across the $0$ boundary without arithmetic errors.

---

### Q9: How is the 16-bit checksum calculated?
**Answer**:  
We implemented the official **RFC 1071 Internet Checksum** in [`src/custom_proto.c:compute_checksum`](file:///e:/Main%20Projects/CN%20Project/src/custom_proto.c#L13):
1. The packet memory is treated as an array of 16-bit unsigned integers.
2. During transmission, `hdr->checksum` is zeroed.
3. All 16-bit words across the 20-byte header and payload are added into a 32-bit accumulator. If an odd byte remains, it is padded with zero.
4. Carries are folded back into the lower 16 bits (`sum = (sum & 0xFFFF) + (sum >> 16)`).
5. The bitwise 1's complement (`~sum`) is returned.
6. Upon receipt, computing this checksum over the entire packet (including the received checksum) mathematically evaluates to `0x0000`. If non-zero, the packet is rejected.

---

### Q10: Does your checksum provide cryptographic security against tampering?
**Answer**:  
**No, and it is not intended to.**  
The 16-bit 1's complement checksum is strictly an **error-detecting code** designed to catch transmission errors (bit flips, electrical noise) with low computational overhead. It does not provide cryptographic integrity or authentication. An active attacker can modify payload bytes and recompute a valid checksum. To achieve cryptographic security, a Message Authentication Code (HMAC-SHA256) or TLS/AES-GCM encryption layer would be required.

---

### Q11: How are timestamps measured in your stack?
**Answer**:  
In [`src/pcap_logger.c:45-57`](file:///e:/Main%20Projects/CN%20Project/src/pcap_logger.c#L45-L57), Windows systems use `GetSystemTimeAsFileTime()`, which reads the high-resolution 64-bit integer of 100-nanosecond intervals since January 1, 1601. We subtract the 116,444,736,000,000,000 $100\text{ns}$ offset to translate to Unix Epoch (January 1, 1970) and split the result into whole seconds (`ts_sec`) and microseconds (`ts_usec`) for standard Libpcap headers.

---

### Q12: How is Round Trip Time (RTT) calculated?
**Answer**:  
In [`include/cc_ops.h`](file:///e:/Main%20Projects/CN%20Project/include/cc_ops.h#L34) and the telemetry engine, RTT is measured by recording the microsecond timestamp when a data segment is transmitted and taking the difference when its corresponding ACK arrives. It follows RFC 6298 smoothed filtering:
$$\text{SRTT} = (1 - \alpha) \cdot \text{SRTT} + \alpha \cdot \text{RTT}_{\text{sample}} \quad (\alpha = 0.125)$$
$$\text{RTTVAR} = (1 - \beta) \cdot \text{RTTVAR} + \beta \cdot |\text{SRTT} - \text{RTT}_{\text{sample}}| \quad (\beta = 0.25)$$
$$\text{RTO} = \text{SRTT} + \max(G, 4 \cdot \text{RTTVAR})$$

---

### Q13: How is packet loss detected in your codebase?
**Answer**:  
Packet loss is detected through two distinct mechanisms:
1. **Fast Retransmit via 3 Duplicate ACKs**: In [`src/test_custom_stack.c:484`](file:///e:/Main%20Projects/CN%20Project/src/test_custom_stack.c#L484), when the receiver sends 3 consecutive ACKs with the same acknowledgment number, the sender concludes an intermediate packet was lost without waiting for a timer to expire.
2. **Retransmission Timeout (RTO)**: If no ACK arrives within the timeout period ($200\text{ms}$ base), an RTO expiration triggers retransmission.

---

### Q14: Is packet retransmission actually implemented in code?
**Answer**:  
**Yes.** In [`src/test_custom_stack.c:run_self_test`](file:///e:/Main%20Projects/CN%20Project/src/test_custom_stack.c#L493), the retransmission path serializes the original payload with the unacknowledged sequence number (`Seq=1001`), writes the retransmitted frame to PCAP, and sends it to the link layer. Additionally, [`src/link_udp.c:link_set_loss_rate`](file:///e:/Main%20Projects/CN%20Project/src/link_udp.c#L91) provides a simulated packet loss injector (0%–100%) to test retransmission recovery.

---

### Q15: Is TCP Reno congestion control operational or simulated?
**Answer**:  
* **In the Automated Test Suite (`run_self_test`)**: Fully operational in C code. Slow Start exponentially increases `cwnd` by $1\text{ MSS}$ per ACK; upon 3 duplicate ACKs, `ssthresh` is cut in half ($2100\text{ B}$), and `cwnd` enters Fast Recovery ($6300\text{ B}$).
* **In the Live Client/Server Terminal Transfer**: Currently, transmissions operate in single-segment synchronous transfer mode, while live congestion window telemetry is displayed via the GUI/HTTP telemetry bridge. Full multi-packet sliding window pacing is our next planned milestone.

---

### Q16: How can Wireshark independently verify your custom protocol?
**Answer**:  
Because our C stack logs real Libpcap 2.4 files using [`src/pcap_logger.c`](file:///e:/Main%20Projects/CN%20Project/src/pcap_logger.c) and we built a custom Wireshark dissector in Lua ([`nexus_proto.lua`](file:///e:/Main%20Projects/CN%20Project/nexus_proto.lua)). When Wireshark opens `captures/client_traffic.pcap`, the Lua script binds to port 9999, parses bytes 0–19 into protocol fields (`nexus.flags`, `nexus.seq`, `nexus.ack`), and validates `0xCAFE`. This proves the packet captures are authentic binary network frames.

---

### Q17: What are the differences between your custom stack and the OS TCP stack?
**Answer**:  
| Feature | Operating System TCP | Our Custom Protocol |
| :--- | :--- | :--- |
| **Execution Space** | Kernel space (Ring 0) | User space (Ring 3) |
| **Header Length** | 20–60 bytes (with variable TCP options) | Fixed 20 bytes (simpler, zero option overhead) |
| **Underlying Carrier** | Direct IP / Raw Ethernet | UDP Datagram Overlay (Port 9999) |
| **Magic Identifier** | None (identified by IP Protocol 6) | `0xCAFE` (verifies protocol authenticity) |
| **Privileges Needed** | Administrative / Kernel permissions | Standard user privileges |
| **Observability** | Requires kernel eBPF / Npcap drivers | Built-in PCAP logger, REST API, & Web UI |

---

### Q18: What are the primary limitations of your current implementation?
**Answer**:  
1. **UDP Encapsulation Overhead**: Encapsulating inside UDP adds 8 bytes of outer UDP header and 20 bytes of outer IP header.
2. **Single Connection State**: The current test server manages one active peer connection at a time rather than a multi-threaded connection table with thousands of concurrent sockets.
3. **Selective Acknowledgment (SACK)**: While SACK is defined in our modular architecture proposal (`SIH_COMPLETE_PROJECT_ARCHITECTURE_AND_PROPOSAL.md`), the currently active C implementation uses RFC 793 Cumulative Acknowledgment.

---

### Q19: Why do you convert numbers using `htons` and `htonl`?
**Answer**:  
Different CPU architectures represent multi-byte numbers in different byte orders. x86 and ARM processors are **Little Endian** (least significant byte first), whereas Internet protocol standards mandate **Big Endian** (most significant byte first, or Network Byte Order). Functions `htons()` (host-to-network short, 16 bits) and `htonl()` (host-to-network long, 32 bits) guarantee that a packet sent from an Intel laptop can be parsed correctly by any machine regardless of its CPU endianness.

---

### Q20: How would you fairly benchmark your custom protocol against standard TCP?
**Answer**:  
We would establish an isolated Gigabit Ethernet testbed using `iperf3` for standard TCP and a high-volume transmission script for our custom stack. We would measure:
1. **Goodput (MB/s)**: Payload bytes delivered per second excluding protocol overhead.
2. **CPU Utilization**: User vs. Kernel CPU cycles per gigabyte transferred.
3. **Recovery Latency**: Time required to recover from 1%, 5%, and 10% packet drop rates injected via Linux `tc netem` or our built-in loss injector.
