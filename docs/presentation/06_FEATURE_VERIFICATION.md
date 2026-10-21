# 06. Feature Verification & Implementation Matrix

> **Academic Rigor & Intellectual Honesty Statement**: In scientific evaluations and engineering presentations, credibility is established by accurately distinguishing between features that are **fully compiled and executing in C**, features that are **modeled or simulated in telemetry**, and features that are **architectural proposals for future milestones**.

---

## 1. Feature Status Matrix

| Subsystem / Feature | Status | Primary Code Location | Verification Evidence | Notes & Evaluation Defense |
| :--- | :---: | :--- | :--- | :--- |
| **Custom 20B Protocol Header** | **IMPLEMENTED** | [`include/custom_proto.h:31`](file:///e:/Main%20Projects/CN%20Project/include/custom_proto.h#L31) | Packets serialized with `0xCAFE`, verified in Wireshark | Full byte packing `#pragma pack(push, 1)`. |
| **16-bit 1's Complement Checksum** | **IMPLEMENTED** | [`src/custom_proto.c:13`](file:///e:/Main%20Projects/CN%20Project/src/custom_proto.c#L13) | `--self-test` Test 1 & Test 2 | Catches corrupted bytes; evaluated across full header + data. |
| **3-Way Handshake (`SYN` $\to$ `SYN+ACK` $\to$ `ACK`)** | **IMPLEMENTED** | [`src/test_custom_stack.c:100`](file:///e:/Main%20Projects/CN%20Project/src/test_custom_stack.c#L100) | Live terminal exchange & `--self-test` | Sequence numbers initialize at 10000 and 50000. |
| **Cumulative Acknowledgment** | **IMPLEMENTED** | [`src/test_custom_stack.c:144`](file:///e:/Main%20Projects/CN%20Project/src/test_custom_stack.c#L144) | Terminal output: acknowledges up to $10012$ | Acknowledges `rcv_nxt = seq + payload_len`. |
| **In-Order Sequence Enforcement** | **IMPLEMENTED** | [`src/test_custom_stack.c:131`](file:///e:/Main%20Projects/CN%20Project/src/test_custom_stack.c#L131) | Rejects out-of-order sequence, emits Duplicate ACK | Enforces exact byte continuity. |
| **Connection Teardown (`FIN` $\to$ `ACK`)** | **IMPLEMENTED** | [`src/test_custom_stack.c:340`](file:///e:/Main%20Projects/CN%20Project/src/test_custom_stack.c#L340) | Transitions `FIN_WAIT` $\to$ `CLOSED` | Graceful state transition on both sides. |
| **UDP Overlay Transport Link** | **IMPLEMENTED** | [`src/link_udp.c:30`](file:///e:/Main%20Projects/CN%20Project/src/link_udp.c#L30) | Transmits across port 9999 over LAN / Wi-Fi | Uses non-blocking Winsock2 `SOCK_DGRAM`. |
| **PCAP Logging (Wireshark Capture)** | **IMPLEMENTED** | [`src/pcap_logger.c:16`](file:///e:/Main%20Projects/CN%20Project/src/pcap_logger.c#L16) | `captures/client_traffic.pcap`, `server_traffic.pcap` | Authentic Libpcap 2.4 binary file format. |
| **Wireshark Custom Lua Dissector** | **IMPLEMENTED** | [`nexus_proto.lua:1`](file:///e:/Main%20Projects/CN%20Project/nexus_proto.lua#L1) | Dissects `NEXUS-TCP` on port 9999 in Wireshark | Formats flags, sequence numbers, and payload. |
| **Native Win32 GUI (`CustomStackGUI.exe`)** | **IMPLEMENTED** | [`src/gui_app.c:1`](file:///e:/Main%20Projects/CN%20Project/src/gui_app.c#L1) | Direct Windows GDI graph rendering, event log | Pure C, compiled via MinGW with zero web runtimes. |
| **Embedded C Telemetry HTTP Server** | **IMPLEMENTED** | [`src/telemetry_server.c:307`](file:///e:/Main%20Projects/CN%20Project/src/telemetry_server.c#L307) | Serves REST `/api/status` & `/api/packets` on `:8080` | Ring buffer stores last 128 packets. |
| **Interactive Header Merging Engine** | **IMPLEMENTED** | [`frontend/src/components/InteractiveHeaderMerging.jsx:1`](file:///e:/Main%20Projects/CN%20Project/frontend/src/components/InteractiveHeaderMerging.jsx#L1) | Browser verification on `localhost:5173` | TX encapsulation and RX header stripping. |
| **Simulated Loss Injection** | **IMPLEMENTED** | [`src/link_udp.c:107`](file:///e:/Main%20Projects/CN%20Project/src/link_udp.c#L107) | `link_set_loss_rate(percent)` randomly drops packets | Proves retransmission on loss. |
| **TCP Reno Fast Recovery Algorithm** | **PARTIAL** | [`src/test_custom_stack.c:484`](file:///e:/Main%20Projects/CN%20Project/src/test_custom_stack.c#L484) | Verified in `--self-test` loopback suite | Fully operational in test suite; live stream uses stop-and-wait pacing. |
| **Out-of-Order Packet Buffer Queue** | **PLANNED** | Proposed in architectural specifications | Not yet in active C polling loop | Server emits duplicate ACK but does not store subsequent segments in a linked list. |
| **Linux TAP Device Interface** | **STUB / PLANNED**| [`src/tap_device.c:14`](file:///e:/Main%20Projects/CN%20Project/src/tap_device.c#L14) | Wrapped with `#ifndef _WIN32` | Code is written for Linux `/dev/net/tun`; inactive on Windows. |
| **Pluggable Multi-CC (CUBIC, BBR)** | **PLANNED** | [`include/cc_ops.h:18`](file:///e:/Main%20Projects/CN%20Project/include/cc_ops.h#L18) | Interface definitions (`cc_ops_t`) declared | Reno is implemented; CUBIC and BBR-lite are future milestones. |

---

## 2. Telemetry & User Interface Analysis

### How the Web Dashboards Connect to the C Program

```
┌─────────────────────────────────┐           ┌──────────────────────────────────┐
│   C Program (test_custom_stack) │           │   Browser / Web UI               │
│                                 │  HTTP/REST│   • index.html (StackScope)      │
│  telemetry_server.c             │ ────────> │   • React UI (localhost:5173)    │
│  Serves /api/status, /api/packets          │   Polls every 1000ms / 4000ms    │
└─────────────────────────────────┘           └──────────────────────────────────┘
```

1. **How connection establishment is detected**:
   * In C: `run_server_mode` calls `telemetry_update_state("ESTABLISHED")` when the 3rd handshake packet arrives.
   * In UI: The React frontend polls `http://localhost:8080/api/status`. If the server responds with `"state": "ESTABLISHED"`, the UI status indicator turns green (`ESTABLISHED`). If the C backend is offline, the React UI runs in interactive simulation mode.
2. **How message input triggers a send operation**:
   * In C: The user enters text in the client console prompt.
   * In React UI: The user enters text into the message box on Step 2 (`SendMessageView.jsx`) and clicks **Send Message**, which computes the exact sequence offset ($10001 + \text{bytes}$) and advances the visual state machine.
3. **How send and receive timestamps are recorded**:
   * In C: `pcap_logger.c` records exact Windows microsecond timestamps via `GetSystemTimeAsFileTime()`.
   * In React UI: Timestamps are recorded in local ISO time strings when the transfer is dispatched and acknowledged.
4. **How transfer history is stored**:
   * In C: `telemetry_server.c` stores up to 128 packets in a circular ring buffer (`g_log_ring`).
   * In React UI: Transfers are stored in React state array `transfers`, viewable in the **Packet History & Logs** tab.

### Distinguishing Live, Simulated, and Static Elements

| UI Component | Operating Mode | Data Source |
| :--- | :--- | :--- |
| **Terminal Console (`test_custom_stack.exe`)** | **100% LIVE** | Direct C socket syscalls, real sequence math, real RFC 1071 checksums. |
| **Wireshark (`nexus_proto.lua`)** | **100% LIVE** | Real binary `.pcap` files written by C stack. |
| **Native Win32 GUI (`CustomStackGUI.exe`)** | **100% LIVE** | Multithreaded C shared memory telemetry, live Windows GDI graphs. |
| **StackScope Dashboard (`index.html` on `:8080`)** | **LIVE via REST** | Real-time JSON polling from `telemetry_server.c` over HTTP. |
| **ProtoLink React UI (`:5173`) - Handshake / Stepper** | **HYBRID** | Displays live C status when `:8080` is alive; falls back to interactive client-side simulation. |
| **ProtoLink React UI - Header Merging Engine** | **INTERACTIVE LAB** | Interactive visual model computing exact mathematical sequence, header byte lengths, and field serializations. |
| **Architecture Block Diagram** | **STATIC SPECIFICATION** | Clean static architectural reference diagram. |

---

## 3. Minimal Practical Changes for Full Live Web Synchronization

To make the React web interface (`localhost:5173`) dispatch live socket transmissions directly from the browser to the C backend, the following minimal changes are needed:

1. **Add a `POST /api/send` endpoint in `src/telemetry_server.c`**:
   ```c
   else if (strstr(req_buf, "POST /api/send") != NULL) {
       char *body = strstr(req_buf, "\r\n\r\n");
       if (body) {
           body += 4;
           // Dispatch payload directly into link_send_frame()
           // Return 200 OK with sequence number
       }
   }
   ```
2. **Update `handleSendMessage` in `frontend/src/App.jsx`**:
   ```javascript
   const handleSendMessage = async (messageText) => {
     try {
       await fetch(`${config.apiUrl}/api/send`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ message: messageText })
       });
     } catch (err) {
       console.log('Backend offline, running simulated visual transfer');
     }
   };
   ```
This enhancement creates a live bidirectional bridge between the modern React visual interface and the low-level C protocol daemon.
