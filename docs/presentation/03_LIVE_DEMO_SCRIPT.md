# 03. Live Demonstration Script (5–7 Minutes)

> **Speaker Instructions**: Speak clearly, maintain eye contact with the evaluators, and pause slightly when pointing out specific packet fields on the screen. Follow each stage step-by-step using the exact commands provided below.

---

## Quick Demo Setup Checklist Before Presenting
* [ ] Open Terminal 1 in project root: `e:\Main Projects\CN Project`
* [ ] Open Terminal 2 in project root: `e:\Main Projects\CN Project`
* [ ] Open Web Browser at: `http://localhost:5173/` (ProtoLink Visual Lab) and `http://localhost:8080/` (StackScope Dashboard)
* [ ] Open Wireshark (have `nexus_proto.lua` loaded or ready in `captures/`)

---

## Minute 0:00 – 1:00 | Stage 1 & 2: Introduction & Architecture

### What to Do
* Have the **ProtoLink Visual Lab** open on screen (`http://localhost:5173`), showing the *System Architecture & Protocol Stack* tab.

### What to Say
> *"Good morning, Professor and members of the evaluation committee. Today, I am demonstrating **StackScope**—a complete, user-space implementation of a custom TCP/IP transport protocol and visual protocol laboratory written in C.*
> 
> *In traditional networking, the operating system's TCP stack is a black box inside the kernel. Applications simply send bytes and receive bytes, but cannot observe sequence number mechanics, checksum verification, or state machine transitions in real time.*
> 
> *In our project, we bypassed the operating system's TCP layer entirely. Instead, we designed our own 20-byte transport protocol header, implemented an RFC 793 state machine, built our own 16-bit 1's complement checksum engine, and run everything in user space over standard UDP datagram tunnels. This gives us 100% control and visibility over every single bit that travels across the network."*

### Technical Detail to Point Out
* Point to the **Architecture diagram on screen**:
  > *"Notice the separation of concerns: The OS handles the physical Wi-Fi and outer UDP routing, while all reliability—handshakes, sequence tracking, and cumulative ACKs—executes in our user-space C codebase."*

---

## Minute 1:00 – 2:30 | Stage 3, 4 & 5: Starting Server, Connecting Client & Handshake

### What to Do
1. In **Terminal 1**, run the receiver:
   ```cmd
   .\test_custom_stack.exe --server 9999
   ```
2. In **Terminal 2**, run the sender connecting to localhost (or remote laptop IP):
   ```cmd
   .\test_custom_stack.exe --client 127.0.0.1 9999
   ```

### What Appears on the Screen
* **Terminal 1 (Server)**:
  ```text
  [CUSTOM PROTOCOL STACK] - Receiver / Server Mode
  Listening on UDP Port: 9999
  [PCAP] Capturing all on-wire frames to 'captures/server_traffic.pcap'...
  [STATE: LISTEN] Waiting for client connection...
  ```
* **Terminal 2 (Client)**:
  ```text
  [Handshake: Step 1 sending] Initiating 3-way handshake with SYN (Seq=10000)
  <<< TX [CustomProto] Flags=[SYN ] Seq=10000 Ack=0 Win=65535 Len=0 (Total=20 bytes)
  [STATE -> SYN_SENT] Waiting for SYN + ACK from 127.0.0.1...
  >>> RX [CustomProto] Flags=[SYN ACK ] Seq=50000 Ack=10001 Win=65535 Len=0 (Total=20 bytes)
  [Handshake: Step 2 received] SYN + ACK from server (Seq=50000, Ack=10001)
  [Handshake: Step 3 sending] Final ACK (Ack=50001)
  <<< TX [CustomProto] Flags=[ACK ] Seq=10001 Ack=50001 Win=65535 Len=0 (Total=20 bytes)
  >>> [CONNECTION ESTABLISHED!] Ready to transmit custom data.
  ```

### What to Say
> *"Watch Terminal 1 and Terminal 2 closely. The server initializes on UDP port 9999 and enters the `LISTEN` state. It also immediately starts logging raw on-wire traffic to a standard `.pcap` capture file.*
> 
> *Now, in Terminal 2, I launch the client. Instantly, our user-space 3-way handshake executes:*
> * First, our client serializes a 20-byte packet with the `SYN` flag and initial sequence number `10000`.*
> * The server receives it, advances expected sequence `rcv_nxt` to `10001`, and replies with `SYN + ACK`, picking its own initial sequence number `50000`.*
> * Finally, our client validates the server's sequence and sends back an `ACK` acknowledging `50001`.*
> 
> *Both terminals have now transitioned to `ESTABLISHED`. Notice that not a single byte of standard OS TCP was involved in this connection setup!"*

### Technical Detail to Point Out
* Point to the terminal sequence accounting:
  > *"Notice how `SYN` consumes exactly 1 sequence number. That is why the server acknowledges `10001` instead of `10000`, strictly following RFC 793 protocol standards."*

---

## Minute 2:30 – 4:00 | Stage 6, 7 & 8: Sending "Hello World" & Verifying ACKs

### What to Do
* In **Terminal 2 (Client)**, where the prompt asks:
  ```text
  Enter custom text to send (e.g., 'Hello'):
  ```
  Type:
  ```text
  Hello World
  ```
  And press **[ENTER]**.

### What Appears on the Screen
* **Terminal 2 (Client Output)**:
  ```text
  >>> Sending custom message: "Hello World"
  [TRANSMITTING DATA 1/1] Seq=10001 Payload="Hello World"
  <<< TX [CustomProto] Flags=[DATA ACK ] Seq=10001 Ack=50001 Win=65535 Len=11 (Total=31 bytes)
     --- On-Wire Hex Dump (11 bytes) ---
     0000: 48 65 6c 6c 6f 20 57 6f 72 6c 64                 |Hello World     |
  >>> RX [CustomProto] Flags=[ACK ] Seq=50001 Ack=10012 Win=65535 Len=0 (Total=20 bytes)
  [SUCCESS] Remote peer acknowledged 11 bytes! (Ack=10012)
  ```
* **Terminal 1 (Server Output)**:
  ```text
  >>> RX [CustomProto] Flags=[DATA ACK ] Seq=10001 Ack=50001 Win=65535 Len=11 (Total=31 bytes)
  [DATA RECEIVED] 11 bytes from client (Seq=10001):
     >>> Payload Message: "Hello World"
     --- On-Wire Hex Dump (11 bytes) ---
     0000: 48 65 6c 6c 6f 20 57 6f 72 6c 64                 |Hello World     |
  [In-Order Data] Sequence validated. Advancing rcv_nxt -> 10012
  [Sending Cumulative ACK] Acknowledging Seq up to 10012
  <<< TX [CustomProto] Flags=[ACK ] Seq=50001 Ack=10012 Win=65535 Len=0 (Total=20 bytes)
  ```

### What to Say
> *"I have just typed `"Hello World"`. Let us look at what happened:*
> * Our client calculated the string length: exactly 11 bytes.*
> * It prepended our 20-byte transport header, creating a 31-byte packet on the wire.*
> * It computed an RFC 1071 16-bit 1's complement checksum across all 31 bytes, converted the sequence numbers to Big-Endian network byte order, and transmitted the datagram.*
> 
> *Now look at Terminal 1 on the receiver:*
> * The receiver's `parse_custom_packet` function ran the checksum algorithm. Because 1's complement checksumming over the full packet yields exactly `0x0000`, the receiver proved mathematically that not a single bit was corrupted.*
> * It verified that the sequence number `10001` matches its expected `rcv_nxt`.*
> * It extracted and printed `"Hello World"` to the screen.*
> * And most importantly, look at the acknowledgment number: the server acknowledged `10012`! That is $10001 + 11 = 10012$—confirming receipt of all 11 bytes."*

### Technical Detail to Point Out
* Point to `Ack=10012` in the server log:
  > *"This proves that our stack implements true **cumulative acknowledgment**. The receiver doesn't just say 'OK'—it explicitly advances the sequence boundary to the next expected byte offset."*

---

## Minute 4:00 – 5:30 | Stage 9 & 10: Interactive Visualizer & Wireshark Proof

### What to Do
1. Switch browser to **ProtoLink Visual Lab** (`http://localhost:5173`).
2. Click on the sidebar icon: **Header Merging & OSI Stack**.
3. Click through **Step 01** to **Step 06** in **TX (Merge Headers)**, then click **RX (Strip Headers)** and step through.
4. Open **Wireshark** with `captures/client_traffic.pcap`.

### What Appears on the Screen
* **In ProtoLink Visual Lab**:
  * The visual frame dynamically shows the 11-byte payload getting prepended with the 20B Custom TCP header, 8B UDP header, 20B IPv4 header, and 14B Ethernet header + 4B FCS trailer, expanding from 11B to 77B total frame.
  * In RX mode, headers are visibly marked `[STRIPPED ✕]` as the packet travels back up to user space.
* **In Wireshark**:
  * Wireshark displays the custom packets parsed cleanly as `NEXUS-TCP` on port 9999, showing sequence numbers `10000`, `10001`, and `10012`.

### What to Say
> *"To make this completely intuitive for classroom teaching and technical evaluations, we also built two observability systems.*
> 
> *Here in our ProtoLink Visual Lab, we have an interactive Header Merging and Stripping engine. In TX mode, students and evaluators can watch how an 11-byte payload progressively expands to 77 bytes on the physical wire as each layer prepends its header.*
> *When we toggle to RX mode, we can watch the receiver validate the CRC32, strip the MAC header, strip the IP header, strip the UDP tunnel, and finally strip our 20-byte custom TCP header, leaving the pure verified string.*
> 
> *And to prove beyond any doubt that our C code generates authentic network packets, look at Wireshark. Using our custom Wireshark Lua dissector `nexus_proto.lua`, Wireshark independently inspects our `.pcap` capture and decodes our custom flags, sequence numbers, and payload directly from raw network bytes."*

---

## Minute 5:30 – 6:30 | Stage 11 & 12: Limitations, Future Work & Conclusion

### What to Say
> *"To be completely transparent about our current engineering status:*
> * Our transport is currently encapsulated over UDP sockets rather than a raw kernel TAP device driver, making it 100% portable across standard Windows and Wi-Fi networks without administrative privileges.*
> * TCP Reno Slow Start and Fast Recovery are fully validated in our automated test suite and telemetry pipeline, with live dynamic WAN pacing planned for our next milestone.*
> 
> *In conclusion, **StackScope** takes the invisible, complex transport mechanics of the internet and makes them tangible, inspectable, and completely transparent in user space.*
> 
> *Thank you, Professor. I am now ready for your questions."*
