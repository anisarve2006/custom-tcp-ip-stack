# 05. Code Walkthrough: 12 Core Architecture Symbols

> **Document Purpose**: A high-yield reference guide to the 12 most important source files, structures, functions, and macros in the repository. Use this to navigate the codebase and explain the implementation line-by-line to evaluators.

---

### 1. `myproto_hdr_t` (The 20-Byte Wire Header)
* **File Path**: [`include/custom_proto.h:31-41`](file:///e:/Main%20Projects/CN%20Project/include/custom_proto.h#L31-L41)
* **Symbol Type**: Packed C structure (`#pragma pack(push, 1)`)
* **Code Excerpt**:
  ```c
  typedef struct {
      uint16_t magic;         /* 0xCAFE (2 Bytes) */
      uint8_t  version;       /* Protocol Version = 1 (1 Byte) */
      uint8_t  flags;         /* SYN, ACK, DATA, FIN, RST (1 Byte) */
      uint32_t seq_num;       /* Sequence Number (4 Bytes) */
      uint32_t ack_num;       /* Acknowledgment Number (4 Bytes) */
      uint16_t win_size;      /* Advertised Receive Window (2 Bytes) */
      uint16_t payload_len;   /* Length of payload in bytes (2 Bytes) */
      uint16_t checksum;      /* 16-bit 1's complement checksum (2 Bytes) */
      uint16_t reserved;      /* Future extensions (2 Bytes) */
  } myproto_hdr_t;
  ```
* **Responsibility**: Defines the exact 20-byte binary layout that travels over the wire.
* **Who Uses It**: Serializer (`serialize_custom_packet`), Parser (`parse_custom_packet`), Packet Logger, and Wireshark dissector.
* **Why It Matters**: `#pragma pack(push, 1)` prevents the C compiler from adding hidden memory alignment padding bytes, ensuring exact wire compatibility across different architectures and compilers.
* **What to Tell the Professor**: *"This is our custom Layer 4 header. It mirrors the core capabilities of standard TCP (RFC 793) within a fixed 20-byte memory block."*

---

### 2. `compute_checksum` (RFC 1071 1's Complement Internet Checksum)
* **File Path**: [`src/custom_proto.c:13-33`](file:///e:/Main%20Projects/CN%20Project/src/custom_proto.c#L13-L33)
* **Signature**: `uint16_t compute_checksum(const void *data, size_t len)`
* **Code Excerpt**:
  ```c
  uint16_t compute_checksum(const void *data, size_t len) {
      const uint16_t *ptr = (const uint16_t *)data;
      uint32_t sum = 0;
      while (len > 1) { sum += *ptr++; len -= 2; }
      if (len == 1) {
          uint16_t odd_byte = 0;
          *(uint8_t *)&odd_byte = *(const uint8_t *)ptr;
          sum += odd_byte;
      }
      while (sum >> 16) { sum = (sum & 0xFFFF) + (sum >> 16); }
      return (uint16_t)(~sum);
  }
  ```
* **Responsibility**: Computes the official 16-bit 1's complement checksum over header and data.
* **Called By**: `serialize_custom_packet` (to generate checksum) and `parse_custom_packet` (to verify checksum).
* **What It Calls**: Bitwise shift and addition operations; no external dependencies.
* **Why It Matters**: Standard TCP and IP integrity rely on this exact algorithm. When calculated over an incoming packet including the checksum, the mathematical result must equal `0x0000`.
* **What to Tell the Professor**: *"This is the authentic RFC 1071 algorithm. It sums 16-bit words, handles odd trailing bytes, folds the overflow carries into the lower 16 bits, and inverts the result."*

---

### 3. `serialize_custom_packet` (Packet Assembly & Byte Ordering)
* **File Path**: [`src/custom_proto.c:35-62`](file:///e:/Main%20Projects/CN%20Project/src/custom_proto.c#L35-L62)
* **Signature**: `int serialize_custom_packet(uint8_t *out_buffer, size_t max_len, uint8_t flags, uint32_t seq, uint32_t ack, uint16_t win_size, const void *payload, uint16_t payload_len)`
* **Responsibility**: Formats the packet in memory, converts integers to Big-Endian Network Byte Order (`htons`, `htonl`), copies application data, and calculates the final checksum.
* **Called By**: Handshake handlers, data transmission loops, and teardown routines in `test_custom_stack.c` and `gui_app.c`.
* **What It Calls**: `htons()`, `htonl()`, `memcpy()`, and `compute_checksum()`.
* **Why It Matters**: Prevents endianness bugs between x86 (Little-Endian) and network wire protocol (Big-Endian).
* **What to Tell the Professor**: *"This function packages raw data into our wire format. Notice line 51: `hdr->checksum = 0;`—the checksum field must be zeroed before the checksum is calculated, or the calculation would be circular."*

---

### 4. `parse_custom_packet` (Integrity Verification & Extraction)
* **File Path**: [`src/custom_proto.c:64-101`](file:///e:/Main%20Projects/CN%20Project/src/custom_proto.c#L64-L101)
* **Signature**: `int parse_custom_packet(const uint8_t *in_buffer, size_t buffer_len, myproto_hdr_t *out_hdr, const uint8_t **out_payload)`
* **Responsibility**: Enforces protocol integrity: checks buffer size $\ge 20$, validates checksum equals 0, checks magic number equals `0xCAFE`, converts fields back to host byte order (`ntohs`, `ntohl`), and points to the payload.
* **Called By**: Server receiver loop, client ACK receiver loop, and self-test harness.
* **What It Calls**: `compute_checksum()`, `ntohs()`, `ntohl()`.
* **Why It Matters**: Protects the receiver from buffer overflows, malformed packets, and corrupted data.
* **What to Tell the Professor**: *"This function validates incoming packets. If a single bit was flipped during transmission, line 71 catches it and returns -2. If a non-StackScope packet arrives, line 78 catches it and returns -3."*

---

### 5. `link_init` (Winsock & UDP Socket Setup)
* **File Path**: [`src/link_udp.c:30-89`](file:///e:/Main%20Projects/CN%20Project/src/link_udp.c#L30-L89)
* **Signature**: `int link_init(int local_port, const char *peer_ip, int peer_port)`
* **Responsibility**: Initializes Winsock (`WSAStartup`), creates the underlying UDP socket (`SOCK_DGRAM`), sets `SO_REUSEADDR`, binds to the local port, and configures non-blocking I/O (`ioctlsocket(FIONBIO)`).
* **Called By**: `run_server_mode`, `run_client_mode`, and GUI worker threads.
* **What It Calls**: Winsock2 socket APIs: `socket()`, `setsockopt()`, `bind()`, `ioctlsocket()`.
* **Why It Matters**: Configures the underlying network transport without requiring administrative privileges.
* **What to Tell the Professor**: *"We use non-blocking UDP sockets (`FIONBIO`), allowing our custom protocol loop to poll for incoming packets without blocking the process or UI thread."*

---

### 6. `link_send_frame` (Loss Injection & Transmit)
* **File Path**: [`src/link_udp.c:101-118`](file:///e:/Main%20Projects/CN%20Project/src/link_udp.c#L101-L118)
* **Signature**: `int link_send_frame(const void *frame_data, size_t len)`
* **Responsibility**: Implements simulated packet loss injection (0% to 100%) and transmits the raw frame using the operating system's `sendto()` syscall.
* **Called By**: Protocol engine whenever a packet (SYN, ACK, DATA, FIN) needs to be sent.
* **What It Calls**: `rand()` for loss simulation, and `sendto()` for socket transmission.
* **Why It Matters**: Allows evaluators to test retransmission and recovery mechanisms on a local loopback link without needing physical network impairments.
* **What to Tell the Professor**: *"Line 107 contains our loss injector. If we set loss to 20%, it randomly drops 20% of outgoing packets to trigger and demonstrate our retransmission logic."*

---

### 7. `link_recv_frame` (Datagram Ingestion & Peer Auto-Discovery)
* **File Path**: [`src/link_udp.c:120-154`](file:///e:/Main%20Projects/CN%20Project/src/link_udp.c#L120-L154)
* **Signature**: `int link_recv_frame(void *out_buffer, size_t max_len)`
* **Responsibility**: Non-blocking packet reception via `recvfrom()`. Automatically records the remote peer's IP and port from the first incoming packet.
* **Called By**: Server and client polling loops.
* **What It Calls**: `recvfrom()`, `memcpy()`, `inet_ntoa()`.
* **Why It Matters**: Enables the server to listen on port 9999 without knowing the client's IP in advance. The server dynamically learns where to send replies.
* **What to Tell the Professor**: *"Notice lines 133–138: When the server receives its first SYN, it dynamically extracts `from_addr` and associates the peer address, enabling two laptops to communicate over Wi-Fi without hardcoded IPs."*

---

### 8. `pcap_write_frame` (Standard Wireshark Capture Generation)
* **File Path**: [`src/pcap_logger.c:41-90`](file:///e:/Main%20Projects/CN%20Project/src/pcap_logger.c#L41-L90)
* **Signature**: `int pcap_write_frame(const void *frame_data, size_t len, int is_tx)`
* **Responsibility**: Translates high-resolution Windows `FILETIME` to Unix microsecond timestamps, synthesizes a standard Layer 2 Ethernet header (`0x88B5`), and appends the frame to the `.pcap` file.
* **Called By**: Sender and receiver whenever a packet is transmitted or received.
* **What It Calls**: `GetSystemTimeAsFileTime()`, `fwrite()`, `fflush()`.
* **Why It Matters**: Produces binary `.pcap` files compatible with Wireshark, tcpdump, and network analyzers.
* **What to Tell the Professor**: *"Every packet that enters or leaves our stack is written in authentic Libpcap 2.4 format. Evaluators can open `captures/client_traffic.pcap` in Wireshark and see our traffic independently verified."*

---

### 9. `run_server_mode` (Server Handshake & In-Order Verification)
* **File Path**: [`src/test_custom_stack.c:61-177`](file:///e:/Main%20Projects/CN%20Project/src/test_custom_stack.c#L61-L177)
* **Responsibility**: Manages the server state machine: handles `SYN` $\to$ sends `SYN+ACK` $\to$ handles `ACK` $\to$ enforces in-order sequence numbers for incoming `DATA` $\to$ emits cumulative `ACK`s $\to$ handles `FIN` teardown.
* **Called By**: Main menu option `[2]` or command-line `--server <port>`.
* **What to Tell the Professor**: *"Lines 131–140 show our sequence validation logic: If `hdr.seq_num == rcv_nxt`, we accept the data and advance `rcv_nxt`. If an out-of-order segment arrives, we emit a duplicate ACK for the missing sequence."*

---

### 10. `run_client_mode` (Client 3-Way Handshake & Data Loop)
* **File Path**: [`src/test_custom_stack.c:180-378`](file:///e:/Main%20Projects/CN%20Project/src/test_custom_stack.c#L180-L378)
* **Responsibility**: Initiates the 3-way handshake (`SYN`), prompts the user for custom text (e.g., `"Hello World"`), transmits data segments with `FLAG_DATA | FLAG_ACK`, waits for remote ACKs, and closes cleanly with `FIN`.
* **Called By**: Main menu option `[3]` or command-line `--client <ip> <port>`.
* **What to Tell the Professor**: *"This drives the sender side. Lines 314–333 implement our ACK wait loop, ensuring data is acknowledged before proceeding to connection teardown."*

---

### 11. `run_self_test` (Automated Test Suite & Reno Fast Recovery)
* **File Path**: [`src/test_custom_stack.c:381-509`](file:///e:/Main%20Projects/CN%20Project/src/test_custom_stack.c#L381-L509)
* **Responsibility**: Automated loopback test suite: verifies serialization, intentionally flips a byte to prove checksum error detection, simulates a 3-way handshake, and demonstrates TCP Reno Slow Start and Fast Recovery upon 3 duplicate ACKs.
* **Called By**: Main menu option `[1]` or command-line `--self-test`.
* **What to Tell the Professor**: *"This is our automated regression suite. Line 421 flips bits in the payload, proving that corrupted data is immediately rejected by our 1's complement checksum engine."*

---

### 12. `telemetry_server_start` / `http_worker` (Embedded REST Telemetry API)
* **File Path**: [`src/telemetry_server.c:307-550`](file:///e:/Main%20Projects/CN%20Project/src/telemetry_server.c#L307-L550)
* **Responsibility**: Runs a background HTTP server on port 8080. Exposes `/api/status` and `/api/packets` as JSON, enabling web dashboards and external tools to monitor protocol events in real time.
* **Called By**: `main()` at startup.
* **What to Tell the Professor**: *"Lines 360–385 implement our REST API in pure C. The dashboard on port 8080 polls this endpoint to visualize live sequence numbers and packet events."*
