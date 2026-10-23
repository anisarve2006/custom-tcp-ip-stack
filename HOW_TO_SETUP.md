# 🚀 How-To Setup Guide: Connecting Two Laptops (Custom TCP/IP Stack)

This guide provides end-to-end instructions for connecting and running the **Custom TCP/IP Protocol Stack** across **two physical laptops** over Wi-Fi, Mobile Hotspot, or an Ethernet cable.

---

## 📌 Architecture Overview

Traditional TCP runs inside the operating system kernel. In this project:
- **Laptop 1 (Client / Sender)** and **Laptop 2 (Receiver / Server)** run our custom C networking stack in unprivileged user space.
- A custom 20-byte transport protocol header (`0xCAFE` magic identifier, 32-bit sequence/ACK numbers, Reno window, 16-bit 1's complement checksum) handles all connection state and reliability.
- Packets are encapsulated into lightweight UDP datagrams (`SOCK_DGRAM`, default port **9999**). This allows the custom packets to cross physical Wi-Fi routers and firewalls without requiring root/raw-socket administrative driver privileges.

```
+------------------------------------+           +------------------------------------+
|         LAPTOP 1 (Client)          |           |         LAPTOP 2 (Server)          |
|  [CustomStackGUI / CLI]            |           |  [CustomStackGUI / CLI]            |
|  User-Space TCP State Machine      |           |  User-Space TCP State Machine      |
|  (Handshake, Seq/Ack, Reno cwnd)   |           |  (State: LISTEN -> ESTABLISHED)    |
+-----------------+------------------+           +-----------------+------------------+
                  |                                                ^
     Encapsulated | UDP Port 9999                     Encapsulated | UDP Port 9999
     Custom Frame | (0xCAFE Magic)                    Custom Frame | (0xCAFE Magic)
                  v                                                |
+-----------------+------------------------------------------------+------------------+
|                    Physical Link: Shared Wi-Fi / Hotspot / LAN                      |
|                                                                                     |
|   Laptop 1 (e.g. 192.168.1.101)  ========>>>  Laptop 2 (e.g. 192.168.1.102)        |
+-------------------------------------------------------------------------------------+
```

---

## 🛠️ Step 1: Pre-requisites & Preparation

Ensure both laptops have the project folder ready.

1. **Option A (Pre-compiled Executables)**:
   - Copy the project folder containing `CustomStackGUI.exe` and `test_custom_stack.exe` (or `bin/test_custom_stack.exe`) to both laptops via USB drive or Git.
2. **Option B (Compile from Source on Windows)**:
   - If MinGW GCC is installed, run `build_windows.bat` on each laptop:
     ```powershell
     .\build_windows.bat
     ```
   - This produces `CustomStackGUI.exe` and `test_custom_stack.exe`.

---

## 🌐 Step 2: Connect Both Laptops to the Same Local Network

Both laptops must be on the **same subnet** so they can reach each other.

### Recommended Network Configurations:
* **Method 1 (Best & Most Reliable - Mobile Hotspot)**:
  - Enable Mobile Hotspot on your phone (or on Laptop 1).
  - Connect both laptops to that hotspot.
  - *Why this is recommended*: College/office Wi-Fi routers frequently enable **"Client Isolation"** or **"AP Isolation"**, which blocks laptops from talking directly to one another. A mobile hotspot has no client isolation.
* **Method 2 (Home / Lab Wi-Fi)**:
  - Connect both laptops to the same Wi-Fi router.
* **Method 3 (Ethernet Cable)**:
  - Connect both laptops with an RJ45 Ethernet cable. Assign static IPs (e.g., `192.168.1.10` and `192.168.1.20`, subnet mask `255.255.255.0`).

---

## 🔍 Step 3: Find Laptop 2's (Server) IP Address

Laptop 1 needs to know Laptop 2's IP address to send packets to it.

1. On **Laptop 2 (Receiver)**, open **Command Prompt** or **PowerShell**:
   ```cmd
   ipconfig
   ```
2. Look for the active network adapter:
   - **Wireless LAN adapter Wi-Fi** (or **Ethernet adapter**):
   - Note down the **IPv4 Address** (e.g., `192.168.1.102` or `192.168.137.45`).
3. *(Optional Test)* On **Laptop 1 (Sender)**, verify reachability:
   ```cmd
   ping 192.168.1.102
   ```
   *(Replace with Laptop 2's actual IP address)*.

---

## 🛡️ Step 4: Windows Firewall Configuration (Crucial!)

When running for the first time, Windows Defender Firewall may display an alert prompt:
1. Click **"Allow access"** on **Private networks**.
2. If Laptop 1 cannot connect to Laptop 2, run this one-line command in **PowerShell as Administrator** on **Laptop 2** to allow UDP port 9999:
   ```powershell
   New-NetFirewallRule -DisplayName "Custom TCP Stack Port 9999" -Direction Inbound -Protocol UDP -LocalPort 9999 -Action Allow
   ```
   *(Optional)* If using the Web Telemetry Dashboard on port 8080:
   ```powershell
   New-NetFirewallRule -DisplayName "Custom Stack Telemetry 8080" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow
   ```

---

## 💻 Step 5: Connecting the Laptops

You can run the connection using either the **Graphical Interface (GUI)** or the **Interactive CLI**.

### Method A: Using the Windows Desktop GUI (`CustomStackGUI.exe`)

#### On Laptop 2 (Server / Receiver):
1. Double-click **`CustomStackGUI.exe`**.
2. Set Port to **`9999`** in the top toolbar (default).
3. Click **`[ Start Server (Port 9999) ]`**.
4. The status indicator will switch to **`LISTEN (Port 9999)`**.

#### On Laptop 1 (Client / Sender):
1. Double-click **`CustomStackGUI.exe`**.
2. In the **Remote IP** box, enter Laptop 2's IP address (e.g. `192.168.1.102`).
3. Set Port to **`9999`**.
4. Click **`[ Connect to Remote IP ]`**.
5. Watch the live 3-way handshake occur! State transitions to **`ESTABLISHED`**.
6. Click **`[ Send Data Message ]`** to transmit custom payload bytes across the network.
7. Click **`[ Simulate Loss ]`** to observe live TCP Reno congestion window reduction and fast recovery.

---

### Method B: Using the Command Line Console (`test_custom_stack.exe`)

#### 1. Start Laptop 2 (Receiver / Server):
Open PowerShell in the project directory and run:
```powershell
.\test_custom_stack.exe --server 9999
```
*Output displayed:*
```text
======================================================================
  [CUSTOM PROTOCOL STACK] - Receiver / Server Mode
  Listening on UDP Port: 9999
======================================================================
[PCAP] Capturing all on-wire frames to 'captures/server_traffic.pcap'...
[STATE: LISTEN] Waiting for client connection...
```

#### 2. Start Laptop 1 (Sender / Client):
Open PowerShell on Laptop 1 and run (replacing with Laptop 2's IP):
```powershell
.\test_custom_stack.exe --client 192.168.1.102 9999
```

#### 3. What You Will Observe Across Both Laptops:
1. **User-Space 3-Way Handshake**:
   - Laptop 1 sends `SYN` (Initial Seq = 10000).
   - Laptop 2 receives, verifies checksum, and responds with `SYN + ACK` (Seq = 50000, Ack = 10001).
   - Laptop 1 sends `ACK` (Seq = 10001, Ack = 50001).
   - Both terminals print: `>>> [CONNECTION ESTABLISHED!] Ready to transmit custom data.`
2. **Interactive Data Exchange**:
   - On Laptop 1, type any message (e.g., `Hello from Laptop 1!`) and press **Enter**.
   - Laptop 1 serializes the 20-byte transport header with `0xCAFE` magic bytes, calculates 16-bit 1's complement checksum, and transmits over UDP.
   - Laptop 2 receives the frame, verifies the checksum mathematically (`0x0000`), displays an ASCII/HEX dump, and replies with a **cumulative ACK**.
3. **Teardown**:
   - Type `exit` or `quit` to perform a graceful 4-way FIN teardown.

---

### Method C: Using the Interactive Console Menu

If you prefer an interactive menu without command-line arguments:
1. Double-click `test_custom_stack.exe` on both laptops.
2. On **Laptop 2**: Press `2` (Start Receiver / Server Mode) and press Enter for port 9999.
3. On **Laptop 1**: Press `3` (Start Sender / Client Mode), enter Laptop 2's IP, and press Enter for port 9999.

---

## 📊 Step 6: Live Web Visualizer & Telemetry Across Laptops

The project includes two web-based visualization tools:

### 1. Embedded HTTP Telemetry Dashboard (Port 8080)
Whenever `test_custom_stack.exe` or `CustomStackGUI.exe` runs, an embedded C HTTP server activates automatically on port `8080`.
- On **Laptop 1** or **Laptop 2**, open a web browser:
  ```
  http://localhost:8080
  ```
- Or access Laptop 2's dashboard remotely from Laptop 1's browser:
  ```
  http://192.168.1.102:8080
  ```
- This shows live JSON status (`/api/status`), live packet feeds (`/api/packets`), and interactive congestion metrics.

### 2. ProtoLink Visual Protocol Lab (Port 5173)
To run the full React + Vite visual protocol studio:
1. On either laptop, run:
   ```cmd
   .\start_frontend.bat
   ```
2. Open your browser to `http://localhost:5173/`.
3. Click the **Settings (gear icon)** at the top right:
   - Configure **Sender IP** (Laptop 1's IP).
   - Configure **Receiver IP** (Laptop 2's IP).
   - Configure **Telemetry API URL** (`http://192.168.1.102:8080`).

---

## 🦈 Step 7: Wireshark Packet Dissection Across Laptops

Every packet transmitted between the two laptops is logged in standard `.pcap` format.

1. Locate the PCAP files generated during the session:
   - On Laptop 1: `captures/client_traffic.pcap`
   - On Laptop 2: `captures/server_traffic.pcap`
2. Open the file in **Wireshark**.
3. To enable the custom protocol dissector:
   - Copy `nexus_proto.lua` to your Wireshark plugins directory, or open Wireshark from the command line:
     ```cmd
     wireshark -X lua_script:nexus_proto.lua captures/server_traffic.pcap
     ```
4. Wireshark will automatically decode:
   - Magic Identifier (`0xCAFE`)
   - Protocol Flags (`SYN`, `ACK`, `DATA`, `FIN`, `RST`)
   - 32-bit Sequence & ACK Numbers
   - RFC 1071 16-bit Checksum Verification
   - Payload Hex and ASCII bytes

---

## ❓ Troubleshooting & FAQs

### Problem 1: Laptop 1 says `[Link] sendto failed` or `Connection timed out`
* **Cause**: Windows Firewall is blocking incoming UDP packets on Laptop 2, or the laptops are on different networks.
* **Fix**:
  1. Ping Laptop 2 from Laptop 1 (`ping <Laptop2_IP>`). If ping fails, check if both are on the same Wi-Fi/Hotspot.
  2. Temporarily disable Windows Firewall on Private Networks on Laptop 2, or run the PowerShell firewall rule in **Step 4**.
  3. Ensure no other application is using UDP port 9999.

### Problem 2: Packets drop on University / Corporate Wi-Fi
* **Cause**: AP Isolation / Client Isolation prevents two devices on Wi-Fi from communicating directly.
* **Fix**: Turn on a **Mobile Hotspot** on a smartphone and connect both laptops to it.

### Problem 3: "Invalid peer IP format"
* **Cause**: A typo in Laptop 2's IP address.
* **Fix**: Run `ipconfig` again on Laptop 2 and verify the exact IPv4 format (e.g. `192.168.1.xxx`).

---

## 📋 Quick Setup Checklist for Presentations / Demos

- [ ] Connect both laptops to the same Mobile Hotspot or Wi-Fi.
- [ ] Run `ipconfig` on Laptop 2 to note its IP (e.g. `192.168.1.102`).
- [ ] Laptop 2: Run `.\test_custom_stack.exe --server 9999` (or `CustomStackGUI.exe` -> Start Server).
- [ ] Laptop 1: Run `.\test_custom_stack.exe --client 192.168.1.102 9999` (or `CustomStackGUI.exe` -> Connect).
- [ ] Watch the 3-way handshake succeed (`ESTABLISHED`).
- [ ] Send sample messages and observe live cumulative ACKs & Wireshark PCAPs!
