# Custom Networking Protocol & Kernel TCP Bypass

A user-space networking protocol stack written in **C** that completely bypasses the operating system's built-in TCP/IP stack. It implements custom Layer-4 transport headers, reliability, 3-way handshakes, sequence/ACK tracking, 16-bit 1's complement checksums, Reno congestion control mechanics, and Wireshark PCAP logging.

---

## 1. How It Bypasses the OS Kernel Stack

In standard network applications:
```
Application  -->  socket(SOCK_STREAM)  -->  OS Kernel (TCP/IP/ARP/Ethernet)  -->  Network Card (NIC)
```
The OS kernel owns the handshake, sequence numbers, checksum calculation, retransmissions, and congestion control.

In this **Custom Protocol Stack**:
```
Application  -->  Custom Transport Protocol (C)  -->  Raw L2 / UDP Bridge  -->  Wi-Fi / Internet
```
- **Custom Wire Format**: Uses a custom 20-byte header with a unique magic byte (`0xCAFE`), custom flags (`SYN`, `ACK`, `DATA`, `FIN`, `RST`), custom 32-bit sequence numbers, flow control window, and 16-bit Internet checksum.
- **Kernel Bypass**: The OS kernel does not participate in the TCP state machine. The application constructs, serializes, verifies, and acknowledges all frames directly in user space.
- **Wireless 2-Laptop Communication**: For wireless communication across Wi-Fi, Hotspots, or the Internet, the stack uses a **UDP encapsulation bridge** (analogous to QUIC / VXLAN / WireGuard), allowing custom user-space frames to cross wireless routers without being blocked.

---

## 2. Packet Wire Format (20-byte Header)

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|          Magic (0xCAFE)       |    Version    |     Flags     |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                        Sequence Number                        |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                     Acknowledgment Number                     |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|        Window Size (Flow)     |         Payload Length        |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|       16-bit Checksum         |            Reserved           |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                      Payload Data (...)                       |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

---

## 3. Native Windows Desktop Application (`CustomStackGUI.exe`)

A standalone **native Windows GUI Desktop Application** (no browser, no web server required):

Double-click **`CustomStackGUI.exe`** directly from the project folder.

### What the Desktop Application Displays:
* **Interactive Control Toolbar**:
  * `[ Automated Self-Test (Reno) ]`: Runs user-space handshake, data streaming, artificial packet drop, and Reno fast retransmit with live graphical updates.
  * `[ Start Server (Port 9999) ]`: Puts the stack in receiver mode to listen for packets from another laptop over Wi-Fi.
  * `[ Connect to Remote IP ]`: Connects as sender to a remote laptop's IP address.
  * `[ Simulate Loss ]`: Injects manual packet loss to observe immediate `cwnd` deflation and fast recovery.
* **5 Real-Time Telemetry Cards**:
  * **Congestion Window (`cwnd`)**: Live bytes and MSS count.
  * **Slow Start Threshold (`ssthresh`)**: Bytes & current Reno phase (`SLOW START` vs `CONGESTION AVOIDANCE`).
  * **Smoothed RTT & RTO**: Millisecond round-trip time and dynamic backoff timeout.
  * **Loss & Retransmissions**: Track duplicate ACKs and retransmitted packets.
  * **Packets (TX / RX)**: Cumulative on-wire packet count.
* **Real-Time Dynamic Reno Graph Canvas**:
  * Native 20 FPS double-buffered GDI graph plotting `cwnd` (solid blue curve) and `ssthresh` (purple dashed line) over time as packets flow and loss occurs.
* **Live Wire Event Stream Table**:
  * Shows every on-wire frame with timestamp, direction (`TX >>>` or `<<< RX`), flags (`SYN`, `ACK`, `DATA`, `FIN`), sequence number, ACK number, payload length, and explanation.
* **On-Wire Hex / Payload Inspector Box**:
  * Displays the exact raw payload bytes and checksum verification status.

---

## 4. Quick Start (Windows)

### Build the Project
Double-click `build_windows.bat` or run in PowerShell:
```powershell
.\build_windows.bat
```
This produces:
1. **`CustomStackGUI.exe`**: Native Windows Desktop GUI Application.
2. **`test_custom_stack.exe`**: Interactive Console Control Center.

---

## 5. Running Between 2 Laptops Over Wi-Fi / Hotspot

> 📖 **Full Guide**: For complete end-to-end instructions, troubleshooting, GUI steps, and firewall rules, see [HOW_TO_SETUP.md](file:///e:/Main%20Projects/CN%20Project/HOW_TO_SETUP.md).

You can test wirelessly between two laptops connected to the same Wi-Fi or Mobile Hotspot:

### Step 1: On Laptop 2 (Receiver / Server)
1. Find Laptop 2's Wi-Fi IP address:
   ```powershell
   ipconfig
   # Look for "IPv4 Address", e.g., 192.168.1.50
   ```
2. Start the receiver on port `9999`:
   ```powershell
   .\bin\test_custom_stack.exe --server 9999
   ```

### Step 2: On Laptop 1 (Sender / Client)
Run the client targeting Laptop 2's IP:
```powershell
.\bin\test_custom_stack.exe --client 192.168.1.50 9999
```

### What You Will Observe:
1. **Step 1**: Laptop 1 sends custom `FLAG_SYN` packet with Seq=10000.
2. **Step 2**: Laptop 2 receives it, parses header in user-space, verifies checksum, and responds with `FLAG_SYN | FLAG_ACK` (Seq=50000, Ack=10001).
3. **Step 3**: Laptop 1 sends final `FLAG_ACK` (Ack=50001). Both transition to `ESTABLISHED`.
4. **Data Stream**: Laptop 1 transmits custom payload messages; Laptop 2 verifies checksum, hex dumps the on-wire bytes, and sends custom ACKs.
5. **Teardown**: Graceful teardown using custom `FLAG_FIN` and `FLAG_ACK`.
6. **PCAP Capture**: Both laptops generate `.pcap` files in `captures/` ready to open in Wireshark.

---

## 6. Wireshark Packet Inspection

All packets are logged in standard PCAP format to:
- `captures/custom_traffic.pcap` (from self-test)
- `captures/server_traffic.pcap`
- `captures/client_traffic.pcap`

You can open these files in **Wireshark** to show:
- Standard simulated Ethernet II frames (`EtherType: 0x88B5` IEEE Local Experimental).
- Custom 20-byte transport headers with `0xCAFE` magic bytes.
- Actual byte payloads and checksums on the wire.

---

## 7. Linux / WSL Compilation

To build and run on Linux or WSL:
```bash
make
./bin/test_custom_stack --self-test
```
For native Linux TAP devices (`/dev/net/tun`), the project includes `src/tap_device.c` and `include/tap_device.h`.
