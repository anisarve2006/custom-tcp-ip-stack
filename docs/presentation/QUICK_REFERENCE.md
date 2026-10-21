# StackScope Presentation Quick Reference

> **Keep this one-page reference open during your presentation.**

---

## 1-Minute Elevator Pitch
*"StackScope is a custom Layer 4 transport protocol engine and visual laboratory built from scratch in user-space C. We bypassed the operating system's built-in TCP stack to implement our own 20-byte transport header, an RFC 793 state machine, 16-bit 1's complement checksums, cumulative sequence acknowledgments, and TCP Reno congestion control. The packets travel across ordinary Wi-Fi encapsulated in UDP datagrams without requiring administrator privileges. The entire packet exchange is logged in real Libpcap format, decoded in Wireshark via our custom Lua dissector, and visualized in an interactive web laboratory."*

---

## Key Technical Specifications

| Parameter | Exact Value / Implementation |
| :--- | :--- |
| **Magic Signature** | `0xCAFE` (16-bit Big-Endian word in bytes 0–1) |
| **Protocol Version** | `1` (8-bit integer in byte 2) |
| **Transport Header Size** | Exactly **20 Bytes** (packed `#pragma pack(push, 1)`) |
| **Control Flags** | `SYN (0x01)`, `ACK (0x02)`, `DATA (0x04)`, `FIN (0x08)`, `RST (0x10)` |
| **Checksum Algorithm** | **RFC 1071** 16-bit 1's complement Internet checksum |
| **Acknowledgment Mode** | **RFC 793** Cumulative Acknowledgment |
| **Sequence Wrap Safety** | **RFC 1982** Serial Number Arithmetic (`(int32_t)(a - b) > 0`) |
| **Underlying Carrier** | UDP Socket (`SOCK_DGRAM`) on Port **9999** (Client on 9998) |
| **Packet Capture Format** | **Libpcap 2.4** (`captures/client_traffic.pcap`, `server_traffic.pcap`) |
| **Wireshark Plugin** | Lua Dissector (`nexus_proto.lua`) binding to UDP port 9999 |
| **Telemetry REST Server** | Embedded HTTP server on Port **8080** (`/api/status`, `/api/packets`) |
| **Visual Laboratory** | React + Vite UI running on `http://localhost:5173/` |

---

## Essential Commands

```cmd
:: 1. Compile Everything (MinGW GCC)
build_windows.bat

:: 2. Run Automated Self-Test (Tests Checksum Corruption, Handshake, Reno CC)
.\test_custom_stack.exe --self-test

:: 3. Start Server / Receiver on Port 9999
.\test_custom_stack.exe --server 9999

:: 4. Start Client / Sender (Connect to Receiver IP)
.\test_custom_stack.exe --client 127.0.0.1 9999

:: 5. Launch Native Windows Desktop GUI
.\CustomStackGUI.exe

:: 6. Launch Modern Web Visual Lab (ProtoLink)
cd frontend
npm run dev
```

---

## "Hello World" Sequence Math (Memorize This!)

* **Client Initial Send Sequence (`my_iss`)**: `10000`
* **Server Initial Send Sequence (`my_iss`)**: `50000`

```text
1. Client -> Server : SYN      (Seq = 10000, Len = 0)  --> Consumes 1 sequence number
2. Server -> Client : SYN+ACK  (Seq = 50000, Ack = 10001, Len = 0)
3. Client -> Server : ACK      (Seq = 10001, Ack = 50001, Len = 0)

[CONNECTION ESTABLISHED]

4. Client -> Server : DATA+ACK (Seq = 10001, Ack = 50001, Len = 11, "Hello World")
   (Spans sequence offsets 10001 through 10011)

5. Server -> Client : ACK      (Seq = 50001, Ack = 10012, Len = 0)
   (Cumulative ACK = 10001 + 11 = 10012! Acknowledges receipt of all 11 bytes)

[CONNECTION TEARDOWN]

6. Client -> Server : FIN+ACK  (Seq = 10012, Ack = 50001, Len = 0)
7. Server -> Client : ACK      (Seq = 50001, Ack = 10013, Len = 0)
```

---

## Header Byte Map (20 Bytes Total)

```
[00-01] 0xCAFE (Magic ID)
[02]    0x01   (Version)
[03]    0x06   (Flags: DATA | ACK)
[04-07] 0x00002711 (Sequence Number = 10001)
[08-11] 0x0000C351 (Acknowledgment Number = 50001)
[12-13] 0xFFFF (Advertised Window = 65,535 B)
[14-15] 0x000B (Payload Length = 11 B)
[16-17] 0xA42C (16-bit 1's Complement Checksum)
[18-19] 0x0000 (Reserved Alignment Padding)
[20-30] 48 65 6C 6C 6F 20 57 6F 72 6C 64 ("Hello World")
```

---

## Core Definitions for Evaluation
* **User Space (Ring 3)**: Safe, unprivileged application zone where our C program executes, preventing system crashes.
* **Kernel Bypass (Transport Only)**: Bypassing the OS TCP driver (`tcpip.sys`) while using standard UDP datagrams to move bytes across physical Wi-Fi.
* **Cumulative ACK**: Acknowledging the next sequential byte expected ($10001 + 11 = 10012$), confirming all prior bytes arrived intact.
* **1's Complement Arithmetic**: Summing 16-bit words and folding carry bits so that computing the checksum over the entire valid packet results in `0x0000`.
* **Fast Retransmit**: Re-sending a missing segment after receiving 3 Duplicate ACKs without waiting for a retransmission timer to expire.
