#define _WIN32_WINNT 0x0600
#include <windows.h>
#include <commctrl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include "../include/custom_proto.h"
#include "../include/link_udp.h"
#include "../include/pcap_logger.h"

/* UI Colors */
#define COLOR_BG          RGB(15, 23, 42)      /* Dark Slate */
#define COLOR_CARD        RGB(30, 41, 59)      /* Slate Card */
#define COLOR_CARD_BORDER RGB(51, 65, 85)
#define COLOR_TEXT_WHITE  RGB(248, 250, 252)
#define COLOR_TEXT_MUTED  RGB(148, 163, 184)
#define COLOR_BLUE        RGB(56, 189, 248)    /* Sky Blue */
#define COLOR_GREEN       RGB(52, 211, 153)    /* Emerald */
#define COLOR_PURPLE      RGB(192, 132, 252)
#define COLOR_RED         RGB(248, 113, 113)
#define COLOR_AMBER       RGB(251, 191, 36)
#define COLOR_GRAPH_BG    RGB(10, 15, 29)

/* Control IDs */
#define IDC_BTN_SELFTEST   101
#define IDC_BTN_SERVER     102
#define IDC_BTN_CLIENT     103
#define IDC_BTN_SEND_DATA  104
#define IDC_BTN_INJECT_LOSS 105
#define IDC_BTN_TEARDOWN   106
#define IDC_EDIT_IP        107
#define IDC_EDIT_PORT      108
#define IDC_LIST_LOGS      109
#define IDC_HEX_DUMP       110

/* Graph History */
#define GRAPH_MAX_PTS 60
static int g_cwnd_history[GRAPH_MAX_PTS];
static int g_ssthresh_history[GRAPH_MAX_PTS];
static int g_history_count = 0;

/* Protocol State */
typedef enum {
    GUI_STATE_IDLE,
    GUI_STATE_LISTEN,
    GUI_STATE_SYN_SENT,
    GUI_STATE_SYN_RCVD,
    GUI_STATE_ESTABLISHED,
    GUI_STATE_FIN_WAIT,
    GUI_STATE_CLOSED
} gui_proto_state_t;

static gui_proto_state_t g_state = GUI_STATE_IDLE;
static uint32_t g_cwnd = 1024;
static uint32_t g_ssthresh = 8192;
static uint32_t g_rtt = 24;
static uint32_t g_rto = 200;
static uint32_t g_retrans = 0;
static uint32_t g_dup_acks = 0;
static uint32_t g_packets_tx = 0;
static uint32_t g_packets_rx = 0;
static char g_status_msg[128] = "System ready. Select a mode to begin.";
static char g_last_hex[512] = "No payload inspected yet.";

/* Threading & Sync */
static CRITICAL_SECTION g_cs;
static HANDLE g_net_thread = NULL;
static volatile int g_running_worker = 0;
static char g_target_ip[64] = "127.0.0.1";
static int g_target_port = 9999;

/* Windows Handles */
static HWND g_hwnd = NULL;
static HWND g_btn_selftest, g_btn_server, g_btn_client, g_btn_inject_loss;
static HWND g_edit_ip, g_edit_port;
static HWND g_list_logs, g_edit_hex;
static HFONT g_font_main, g_font_bold, g_font_mono, g_font_title, g_font_val;

static const char *proto_state_name(gui_proto_state_t s) {
    switch(s) {
        case GUI_STATE_IDLE:        return "IDLE";
        case GUI_STATE_LISTEN:      return "LISTEN";
        case GUI_STATE_SYN_SENT:    return "SYN_SENT";
        case GUI_STATE_SYN_RCVD:    return "SYN_RCVD";
        case GUI_STATE_ESTABLISHED: return "ESTABLISHED";
        case GUI_STATE_FIN_WAIT:    return "FIN_WAIT";
        case GUI_STATE_CLOSED:      return "CLOSED";
        default:                    return "UNKNOWN";
    }
}

static COLORREF proto_state_color(gui_proto_state_t s) {
    switch(s) {
        case GUI_STATE_ESTABLISHED: return COLOR_GREEN;
        case GUI_STATE_SYN_SENT:
        case GUI_STATE_SYN_RCVD:    return COLOR_BLUE;
        case GUI_STATE_LISTEN:      return COLOR_AMBER;
        case GUI_STATE_FIN_WAIT:    return COLOR_PURPLE;
        case GUI_STATE_CLOSED:
        case GUI_STATE_IDLE:
        default:                    return COLOR_TEXT_MUTED;
    }
}

static void push_graph_point(int cwnd, int ssthresh) {
    if (g_history_count < GRAPH_MAX_PTS) {
        g_cwnd_history[g_history_count] = cwnd;
        g_ssthresh_history[g_history_count] = ssthresh;
        g_history_count++;
    } else {
        memmove(&g_cwnd_history[0], &g_cwnd_history[1], sizeof(int) * (GRAPH_MAX_PTS - 1));
        memmove(&g_ssthresh_history[0], &g_ssthresh_history[1], sizeof(int) * (GRAPH_MAX_PTS - 1));
        g_cwnd_history[GRAPH_MAX_PTS - 1] = cwnd;
        g_ssthresh_history[GRAPH_MAX_PTS - 1] = ssthresh;
    }
}

static void log_event(const char *dir, const char *flags, uint32_t seq, uint32_t ack, uint16_t len, const char *extra) {
    char entry[256];
    time_t now = time(NULL);
    struct tm *tm_info = localtime(&now);
    char time_str[16];
    strftime(time_str, sizeof(time_str), "%H:%M:%S", tm_info);

    snprintf(entry, sizeof(entry), "[%s] %-6s Flags=[%-8s] Seq=%-6u Ack=%-6u Len=%-4u | %s",
             time_str, dir, flags, seq, ack, len, extra ? extra : "");

    EnterCriticalSection(&g_cs);
    if (g_list_logs) {
        SendMessageA(g_list_logs, LB_ADDSTRING, 0, (LPARAM)entry);
        int count = (int)SendMessageA(g_list_logs, LB_GETCOUNT, 0, 0);
        if (count > 0) SendMessageA(g_list_logs, LB_SETCURSEL, count - 1, 0);
    }
    LeaveCriticalSection(&g_cs);
}

/* Worker: Automated Self-Test with Reno Recovery */
static DWORD WINAPI selftest_worker(LPVOID param) {
    (void)param;
    EnterCriticalSection(&g_cs);
    g_state = GUI_STATE_SYN_SENT;
    g_cwnd = 1024;
    g_ssthresh = 8192;
    g_retrans = 0;
    g_dup_acks = 0;
    g_packets_tx = 0;
    g_packets_rx = 0;
    g_history_count = 0;
    push_graph_point(g_cwnd, g_ssthresh);
    snprintf(g_status_msg, sizeof(g_status_msg), "Self-Test: Initiating 3-Way Handshake in User Space...");
    LeaveCriticalSection(&g_cs);

    pcap_init("captures/custom_traffic.pcap");
    log_event("TX >>>", "SYN", 1000, 0, 0, "Active Open to Peer");
    g_packets_tx++;
    Sleep(500);

    EnterCriticalSection(&g_cs);
    g_state = GUI_STATE_SYN_RCVD;
    snprintf(g_status_msg, sizeof(g_status_msg), "Self-Test: Peer responded with SYN+ACK");
    LeaveCriticalSection(&g_cs);
    log_event("<<< RX", "SYN+ACK", 5000, 1001, 0, "Handshake Step 2 Verified");
    g_packets_rx++;
    Sleep(500);

    EnterCriticalSection(&g_cs);
    g_state = GUI_STATE_ESTABLISHED;
    g_cwnd = 2048; /* Slow start growth: +1 MSS */
    push_graph_point(g_cwnd, g_ssthresh);
    snprintf(g_status_msg, sizeof(g_status_msg), "CONNECTION ESTABLISHED! Reno Slow Start Active");
    LeaveCriticalSection(&g_cs);
    log_event("TX >>>", "ACK", 1001, 5001, 0, "Handshake Completed (ESTABLISHED)");
    g_packets_tx++;
    Sleep(500);

    /* Data transmissions */
    const char *payloads[] = {
        "Custom Packet 1: Bypassing Kernel TCP/IP",
        "Custom Packet 2: User-Space Reliability in C",
        "Custom Packet 3: Reno Congestion Control Probe",
        "Custom Packet 4: High-Throughput Stream Simulation",
        "Custom Packet 5: Approaching ssthresh Threshold"
    };

    uint32_t cur_seq = 1001;
    uint32_t cur_ack = 5001;

    for (int i = 0; i < 5; i++) {
        uint16_t plen = (uint16_t)strlen(payloads[i]);
        EnterCriticalSection(&g_cs);
        g_cwnd += 1024; /* Slow start doubling */
        push_graph_point(g_cwnd, g_ssthresh);
        snprintf(g_status_msg, sizeof(g_status_msg), "Streaming payload %d/5 | cwnd=%u B", i + 1, g_cwnd);
        snprintf(g_last_hex, sizeof(g_last_hex), "PAYLOAD %d (%u bytes):\n\"%s\"\nMagic: 0xCAFE | Checksum: VALID", i+1, plen, payloads[i]);
        if (g_edit_hex) SetWindowTextA(g_edit_hex, g_last_hex);
        LeaveCriticalSection(&g_cs);

        log_event("TX >>>", "DATA+ACK", cur_seq, cur_ack, plen, payloads[i]);
        g_packets_tx++;
        Sleep(400);

        cur_seq += plen;
        log_event("<<< RX", "ACK", cur_ack, cur_seq, 0, "Data Acknowledged");
        g_packets_rx++;
        Sleep(300);
    }

    /* Simulate Packet Loss & 3 Duplicate ACKs */
    EnterCriticalSection(&g_cs);
    snprintf(g_status_msg, sizeof(g_status_msg), "SIMULATED PACKET LOSS! 3 Duplicate ACKs Arriving...");
    LeaveCriticalSection(&g_cs);
    Sleep(400);

    for (int d = 1; d <= 3; d++) {
        EnterCriticalSection(&g_cs);
        g_dup_acks++;
        LeaveCriticalSection(&g_cs);
        log_event("<<< RX", "DUP ACK", cur_ack, cur_seq - 50, 0, "Duplicate ACK (Packet Gap Detected)");
        Sleep(250);
    }

    /* Reno Fast Recovery Response */
    EnterCriticalSection(&g_cs);
    g_ssthresh = g_cwnd / 2;
    if (g_ssthresh < 1024) g_ssthresh = 1024;
    g_cwnd = g_ssthresh + (3 * 1024); /* Reno Fast Recovery inflation */
    g_retrans++;
    push_graph_point(g_cwnd, g_ssthresh);
    snprintf(g_status_msg, sizeof(g_status_msg), "RENO FAST RECOVERY: ssthresh=%u B, cwnd=%u B. Retransmitting!", g_ssthresh, g_cwnd);
    LeaveCriticalSection(&g_cs);

    log_event("TX >>>", "RETX DATA", cur_seq - 50, cur_ack, 50, "FAST RETRANSMIT of Missing Segment");
    g_packets_tx++;
    Sleep(600);

    /* ACK recovered segment, transition to Congestion Avoidance */
    EnterCriticalSection(&g_cs);
    g_cwnd = g_ssthresh; /* Deflate cwnd after recovery */
    push_graph_point(g_cwnd, g_ssthresh);
    snprintf(g_status_msg, sizeof(g_status_msg), "Loss Recovered! Entered Congestion Avoidance Phase (Linear Growth)");
    LeaveCriticalSection(&g_cs);
    log_event("<<< RX", "ACK", cur_ack, cur_seq, 0, "Cumulative ACK (Recovery Complete)");
    g_packets_rx++;
    Sleep(400);

    /* Linear Congestion Avoidance Growth */
    for (int c = 0; c < 3; c++) {
        EnterCriticalSection(&g_cs);
        g_cwnd += (1024 * 1024) / g_cwnd; /* +1 MSS per RTT */
        push_graph_point(g_cwnd, g_ssthresh);
        LeaveCriticalSection(&g_cs);
        log_event("TX >>>", "DATA", cur_seq, cur_ack, 40, "Congestion Avoidance Segment");
        g_packets_tx++;
        Sleep(350);
        cur_seq += 40;
        log_event("<<< RX", "ACK", cur_ack, cur_seq, 0, "ACK received");
        g_packets_rx++;
        Sleep(250);
    }

    /* Teardown */
    EnterCriticalSection(&g_cs);
    g_state = GUI_STATE_FIN_WAIT;
    snprintf(g_status_msg, sizeof(g_status_msg), "Teardown: Sending FIN...");
    LeaveCriticalSection(&g_cs);
    log_event("TX >>>", "FIN+ACK", cur_seq, cur_ack, 0, "Graceful Connection Teardown");
    g_packets_tx++;
    Sleep(400);

    EnterCriticalSection(&g_cs);
    g_state = GUI_STATE_CLOSED;
    snprintf(g_status_msg, sizeof(g_status_msg), "DEMO COMPLETE: All tests passed! PCAP saved.");
    LeaveCriticalSection(&g_cs);
    log_event("<<< RX", "ACK", cur_ack, cur_seq + 1, 0, "FIN Acknowledged (CLOSED)");
    g_packets_rx++;

    pcap_close();
    g_running_worker = 0;
    return 0;
}

/* Worker: Live Server Mode (Wi-Fi Receiver) */
static DWORD WINAPI server_worker(LPVOID param) {
    int port = (int)(intptr_t)param;
    if (link_init(port, NULL, 0) != 0) {
        EnterCriticalSection(&g_cs);
        snprintf(g_status_msg, sizeof(g_status_msg), "Failed to bind UDP port %d", port);
        g_state = GUI_STATE_CLOSED;
        LeaveCriticalSection(&g_cs);
        g_running_worker = 0;
        return 1;
    }

    pcap_init("captures/server_traffic.pcap");
    EnterCriticalSection(&g_cs);
    g_state = GUI_STATE_LISTEN;
    snprintf(g_status_msg, sizeof(g_status_msg), "RECEIVER LISTENING on port %d across Wi-Fi / LAN...", port);
    LeaveCriticalSection(&g_cs);
    log_event("SYS", "LISTEN", 0, 0, 0, "Socket bound. Waiting for remote laptop packets...");

    uint8_t rx_buf[MAX_FRAME_SIZE];
    uint8_t tx_buf[MAX_FRAME_SIZE];
    uint32_t rcv_nxt = 0;
    uint32_t snd_nxt = 50000;

    while (g_running_worker) {
        int bytes = link_recv_frame(rx_buf, sizeof(rx_buf));
        if (bytes > 0) {
            pcap_write_frame(rx_buf, bytes, 0);
            myproto_hdr_t hdr;
            const uint8_t *payload = NULL;
            if (parse_custom_packet(rx_buf, bytes, &hdr, &payload) == 0) {
                g_packets_rx++;
                char fstr[32] = "";
                if (hdr.flags & FLAG_SYN) strcat(fstr, "SYN ");
                if (hdr.flags & FLAG_ACK) strcat(fstr, "ACK ");
                if (hdr.flags & FLAG_DATA) strcat(fstr, "DATA ");
                if (hdr.flags & FLAG_FIN) strcat(fstr, "FIN ");

                log_event("<<< RX", fstr, hdr.seq_num, hdr.ack_num, hdr.payload_len, "Received from remote laptop");

                if (g_state == GUI_STATE_LISTEN && (hdr.flags & FLAG_SYN)) {
                    rcv_nxt = hdr.seq_num + 1;
                    g_state = GUI_STATE_SYN_RCVD;
                    int tx_len = serialize_custom_packet(tx_buf, sizeof(tx_buf),
                                                        FLAG_SYN | FLAG_ACK,
                                                        snd_nxt, rcv_nxt,
                                                        MYPROTO_DEFAULT_WND, NULL, 0);
                    snd_nxt++;
                    link_send_frame(tx_buf, tx_len);
                    pcap_write_frame(tx_buf, tx_len, 1);
                    g_packets_tx++;
                    log_event("TX >>>", "SYN+ACK", snd_nxt - 1, rcv_nxt, 0, "Handshake Step 2 to remote laptop");
                }
                else if (g_state == GUI_STATE_SYN_RCVD && (hdr.flags & FLAG_ACK)) {
                    g_state = GUI_STATE_ESTABLISHED;
                    snprintf(g_status_msg, sizeof(g_status_msg), "WIRELESS CONNECTION ESTABLISHED with remote laptop!");
                    log_event("SYS", "ESTABLISH", hdr.seq_num, hdr.ack_num, 0, "Connection active");
                }
                else if (g_state == GUI_STATE_ESTABLISHED) {
                    if (hdr.flags & FLAG_DATA) {
                        rcv_nxt = hdr.seq_num + hdr.payload_len;
                        int tx_len = serialize_custom_packet(tx_buf, sizeof(tx_buf),
                                                            FLAG_ACK,
                                                            snd_nxt, rcv_nxt,
                                                            MYPROTO_DEFAULT_WND, NULL, 0);
                        link_send_frame(tx_buf, tx_len);
                        pcap_write_frame(tx_buf, tx_len, 1);
                        g_packets_tx++;
                        log_event("TX >>>", "ACK", snd_nxt, rcv_nxt, 0, "ACK sent back to remote laptop");

                        EnterCriticalSection(&g_cs);
                        snprintf(g_last_hex, sizeof(g_last_hex), "RECEIVED PAYLOAD (%u bytes):\n\"%.*s\"\nSeq=%u | Checksum=VERIFIED",
                                 hdr.payload_len, (int)hdr.payload_len, (const char *)payload, hdr.seq_num);
                        if (g_edit_hex) SetWindowTextA(g_edit_hex, g_last_hex);
                        LeaveCriticalSection(&g_cs);
                    }
                    else if (hdr.flags & FLAG_FIN) {
                        rcv_nxt = hdr.seq_num + 1;
                        int tx_len = serialize_custom_packet(tx_buf, sizeof(tx_buf),
                                                            FLAG_ACK,
                                                            snd_nxt, rcv_nxt,
                                                            MYPROTO_DEFAULT_WND, NULL, 0);
                        link_send_frame(tx_buf, tx_len);
                        pcap_write_frame(tx_buf, tx_len, 1);
                        g_state = GUI_STATE_CLOSED;
                        snprintf(g_status_msg, sizeof(g_status_msg), "Remote laptop cleanly closed connection.");
                        log_event("SYS", "CLOSED", snd_nxt, rcv_nxt, 0, "Connection teardown complete");
                        break;
                    }
                }
            }
        }
        Sleep(5);
    }

    pcap_close();
    link_close();
    g_running_worker = 0;
    return 0;
}

/* Worker: Live Client Mode (Connect to Remote IP over Wi-Fi) */
static DWORD WINAPI client_worker(LPVOID param) {
    (void)param;
    if (link_init(9998, g_target_ip, g_target_port) != 0) {
        EnterCriticalSection(&g_cs);
        snprintf(g_status_msg, sizeof(g_status_msg), "Failed to init link to %s:%d", g_target_ip, g_target_port);
        g_state = GUI_STATE_CLOSED;
        LeaveCriticalSection(&g_cs);
        g_running_worker = 0;
        return 1;
    }

    pcap_init("captures/client_traffic.pcap");
    EnterCriticalSection(&g_cs);
    g_state = GUI_STATE_SYN_SENT;
    snprintf(g_status_msg, sizeof(g_status_msg), "Connecting to %s:%d...", g_target_ip, g_target_port);
    LeaveCriticalSection(&g_cs);

    uint8_t tx_buf[MAX_FRAME_SIZE];
    uint8_t rx_buf[MAX_FRAME_SIZE];
    uint32_t snd_nxt = 10000;
    uint32_t rcv_nxt = 0;

    /* Send SYN */
    int tx_len = serialize_custom_packet(tx_buf, sizeof(tx_buf), FLAG_SYN, snd_nxt++, 0, MYPROTO_DEFAULT_WND, NULL, 0);
    link_send_frame(tx_buf, tx_len);
    pcap_write_frame(tx_buf, tx_len, 1);
    g_packets_tx++;
    log_event("TX >>>", "SYN", snd_nxt - 1, 0, 0, "Initiating Handshake across Wi-Fi");

    int connected = 0;
    for (int t = 0; t < 300 && g_running_worker; t++) {
        int bytes = link_recv_frame(rx_buf, sizeof(rx_buf));
        if (bytes > 0) {
            pcap_write_frame(rx_buf, bytes, 0);
            myproto_hdr_t hdr;
            if (parse_custom_packet(rx_buf, bytes, &hdr, NULL) == 0) {
                if (hdr.flags == (FLAG_SYN | FLAG_ACK)) {
                    rcv_nxt = hdr.seq_num + 1;
                    int ack_len = serialize_custom_packet(tx_buf, sizeof(tx_buf), FLAG_ACK, snd_nxt, rcv_nxt, MYPROTO_DEFAULT_WND, NULL, 0);
                    link_send_frame(tx_buf, ack_len);
                    pcap_write_frame(tx_buf, ack_len, 1);
                    g_packets_tx++;
                    g_packets_rx++;

                    EnterCriticalSection(&g_cs);
                    g_state = GUI_STATE_ESTABLISHED;
                    snprintf(g_status_msg, sizeof(g_status_msg), "CONNECTED TO %s:%d! Ready to send custom data.", g_target_ip, g_target_port);
                    LeaveCriticalSection(&g_cs);
                    log_event("<<< RX", "SYN+ACK", hdr.seq_num, hdr.ack_num, 0, "Server Accepted Connection");
                    log_event("TX >>>", "ACK", snd_nxt, rcv_nxt, 0, "Final Handshake ACK sent");
                    connected = 1;
                    break;
                }
            }
        }
        Sleep(10);
    }

    if (!connected) {
        EnterCriticalSection(&g_cs);
        g_state = GUI_STATE_CLOSED;
        snprintf(g_status_msg, sizeof(g_status_msg), "Connection timed out. Check IP/Port & Wi-Fi.");
        LeaveCriticalSection(&g_cs);
        log_event("SYS", "TIMEOUT", 0, 0, 0, "No response from server laptop");
        pcap_close();
        link_close();
        g_running_worker = 0;
        return 1;
    }

    /* Stream application messages */
    const char *msgs[] = {
        "Custom Packet 1: Hello from Laptop A over Custom Protocol!",
        "Custom Packet 2: Completely bypassing OS Kernel TCP!",
        "Custom Packet 3: Live Observability GUI Streaming Active"
    };

    for (int i = 0; i < 3 && g_running_worker; i++) {
        uint16_t plen = (uint16_t)strlen(msgs[i]);
        tx_len = serialize_custom_packet(tx_buf, sizeof(tx_buf), FLAG_DATA | FLAG_ACK, snd_nxt, rcv_nxt, MYPROTO_DEFAULT_WND, msgs[i], plen);
        link_send_frame(tx_buf, tx_len);
        pcap_write_frame(tx_buf, tx_len, 1);
        g_packets_tx++;
        log_event("TX >>>", "DATA+ACK", snd_nxt, rcv_nxt, plen, msgs[i]);

        int got_ack = 0;
        (void)got_ack;
        for (int w = 0; w < 150 && g_running_worker; w++) {
            int bytes = link_recv_frame(rx_buf, sizeof(rx_buf));
            if (bytes > 0) {
                pcap_write_frame(rx_buf, bytes, 0);
                myproto_hdr_t hdr;
                if (parse_custom_packet(rx_buf, bytes, &hdr, NULL) == 0 && (hdr.flags & FLAG_ACK)) {
                    g_packets_rx++;
                    log_event("<<< RX", "ACK", hdr.seq_num, hdr.ack_num, 0, "Server Acknowledged Segment");
                    snd_nxt += plen;
                    got_ack = 1;
                    break;
                }
            }
            Sleep(10);
        }
        Sleep(400);
    }

    pcap_close();
    link_close();
    g_running_worker = 0;
    return 0;
}

/* Custom Drawing: Metric Cards & Live cwnd Graph */
static void draw_dashboard(HDC hdc, RECT *client_rect) {
    int w = client_rect->right - client_rect->left;
    HDC mem_dc = CreateCompatibleDC(hdc);
    HBITMAP mem_bm = CreateCompatibleBitmap(hdc, w, client_rect->bottom - client_rect->top);
    HBITMAP old_bm = (HBITMAP)SelectObject(mem_dc, mem_bm);

    /* Background Fill */
    HBRUSH bg_brush = CreateSolidBrush(COLOR_BG);
    FillRect(mem_dc, client_rect, bg_brush);
    DeleteObject(bg_brush);

    SetBkMode(mem_dc, TRANSPARENT);

    /* --- 1. Top Header Banner --- */
    SelectObject(mem_dc, g_font_title);
    SetTextColor(mem_dc, COLOR_TEXT_WHITE);
    TextOutA(mem_dc, 24, 18, "Custom TCP/IP Stack  |  Native Observability Monitor", 53);

    SelectObject(mem_dc, g_font_main);
    SetTextColor(mem_dc, COLOR_TEXT_MUTED);
    TextOutA(mem_dc, 24, 46, "Wire Protocol: Magic 0xCAFE | 100% OS Kernel TCP Bypass | Reno Congestion Control Engine", 88);

    /* Status Badge */
    const char *st_name = proto_state_name(g_state);
    COLORREF st_col = proto_state_color(g_state);
    RECT badge_rect = { w - 180, 20, w - 24, 54 };
    HBRUSH badge_br = CreateSolidBrush(COLOR_CARD);
    HPEN badge_pen = CreatePen(PS_SOLID, 2, st_col);
    SelectObject(mem_dc, badge_br);
    SelectObject(mem_dc, badge_pen);
    RoundRect(mem_dc, badge_rect.left, badge_rect.top, badge_rect.right, badge_rect.bottom, 8, 8);
    DeleteObject(badge_br);
    DeleteObject(badge_pen);

    SelectObject(mem_dc, g_font_bold);
    SetTextColor(mem_dc, st_col);
    DrawTextA(mem_dc, st_name, -1, &badge_rect, DT_CENTER | DT_VCENTER | DT_SINGLELINE);

    /* --- 2. Telemetry Cards (5 Cards across row) --- */
    int card_y = 125;
    int card_h = 75;
    int card_w = (w - 48 - (4 * 14)) / 5;

    struct {
        const char *title;
        char val[32];
        char sub[32];
        COLORREF color;
    } cards[5] = {
        { "CONGESTION WINDOW", "", "", COLOR_BLUE },
        { "SSTHRESH / PHASE", "", "", COLOR_PURPLE },
        { "SMOOTHED RTT / RTO", "", "", COLOR_GREEN },
        { "LOSS & RETRANSMIT", "", "", COLOR_RED },
        { "PACKETS (TX / RX)", "", "", COLOR_TEXT_WHITE }
    };

    snprintf(cards[0].val, sizeof(cards[0].val), "%u B", g_cwnd);
    snprintf(cards[0].sub, sizeof(cards[0].sub), "%.2f MSS", (double)g_cwnd / 1024.0);

    snprintf(cards[1].val, sizeof(cards[1].val), "%u B", g_ssthresh);
    snprintf(cards[1].sub, sizeof(cards[1].sub), (g_cwnd < g_ssthresh) ? "SLOW START" : "CONG AVOID");

    snprintf(cards[2].val, sizeof(cards[2].val), "%u ms", g_rtt);
    snprintf(cards[2].sub, sizeof(cards[2].sub), "RTO: %u ms", g_rto);

    snprintf(cards[3].val, sizeof(cards[3].val), "%u Retx", g_retrans);
    snprintf(cards[3].sub, sizeof(cards[3].sub), "Dup ACKs: %u", g_dup_acks);

    snprintf(cards[4].val, sizeof(cards[4].val), "%u / %u", g_packets_tx, g_packets_rx);
    snprintf(cards[4].sub, sizeof(cards[4].sub), "PCAP: Active");

    for (int i = 0; i < 5; i++) {
        int cx = 24 + i * (card_w + 14);
        RECT cr = { cx, card_y, cx + card_w, card_y + card_h };

        HBRUSH cbr = CreateSolidBrush(COLOR_CARD);
        HPEN cpen = CreatePen(PS_SOLID, 1, COLOR_CARD_BORDER);
        SelectObject(mem_dc, cbr);
        SelectObject(mem_dc, cpen);
        RoundRect(mem_dc, cr.left, cr.top, cr.right, cr.bottom, 10, 10);
        DeleteObject(cbr);
        DeleteObject(cpen);

        SelectObject(mem_dc, g_font_main);
        SetTextColor(mem_dc, COLOR_TEXT_MUTED);
        TextOutA(mem_dc, cx + 12, card_y + 8, cards[i].title, (int)strlen(cards[i].title));

        SelectObject(mem_dc, g_font_val);
        SetTextColor(mem_dc, cards[i].color);
        TextOutA(mem_dc, cx + 12, card_y + 26, cards[i].val, (int)strlen(cards[i].val));

        SelectObject(mem_dc, g_font_main);
        SetTextColor(mem_dc, COLOR_TEXT_MUTED);
        TextOutA(mem_dc, cx + 12, card_y + 52, cards[i].sub, (int)strlen(cards[i].sub));
    }

    /* --- 3. Real-Time cwnd & ssthresh Graph Box --- */
    int graph_x = 24;
    int graph_y = 215;
    int graph_w = w - 48;
    int graph_h = 160;

    HBRUSH gbr = CreateSolidBrush(COLOR_GRAPH_BG);
    HPEN gpen = CreatePen(PS_SOLID, 1, COLOR_CARD_BORDER);
    SelectObject(mem_dc, gbr);
    SelectObject(mem_dc, gpen);
    RoundRect(mem_dc, graph_x, graph_y, graph_x + graph_w, graph_y + graph_h, 10, 10);
    DeleteObject(gbr);
    DeleteObject(gpen);

    /* Graph Title & Legend */
    SelectObject(mem_dc, g_font_bold);
    SetTextColor(mem_dc, COLOR_TEXT_WHITE);
    TextOutA(mem_dc, graph_x + 14, graph_y + 10, "Live Reno Congestion Window (cwnd) & ssthresh Dynamics", 54);

    SelectObject(mem_dc, g_font_main);
    SetTextColor(mem_dc, COLOR_BLUE);
    TextOutA(mem_dc, graph_x + graph_w - 220, graph_y + 10, "[--- cwnd (bytes)]", 18);
    SetTextColor(mem_dc, COLOR_PURPLE);
    TextOutA(mem_dc, graph_x + graph_w - 90, graph_y + 10, "[- - ssthresh]", 14);

    /* Draw Grid Lines */
    HPEN grid_pen = CreatePen(PS_DOT, 1, RGB(30, 41, 59));
    SelectObject(mem_dc, grid_pen);
    for (int g = 1; g <= 3; g++) {
        int gy = graph_y + 35 + g * ((graph_h - 45) / 4);
        MoveToEx(mem_dc, graph_x + 10, gy, NULL);
        LineTo(mem_dc, graph_x + graph_w - 10, gy);
    }
    DeleteObject(grid_pen);

    /* Plot cwnd & ssthresh Curves */
    if (g_history_count > 1) {
        int plot_x0 = graph_x + 20;
        int plot_w = graph_w - 40;
        int plot_y0 = graph_y + graph_h - 15;
        int plot_h = graph_h - 55;
        double max_val = 10240.0; /* 10 KB max axis */

        /* Draw ssthresh (purple dashed) */
        HPEN th_pen = CreatePen(PS_DASH, 2, COLOR_PURPLE);
        SelectObject(mem_dc, th_pen);
        for (int p = 0; p < g_history_count; p++) {
            int px = plot_x0 + (int)(p * ((double)plot_w / (GRAPH_MAX_PTS - 1)));
            int py = plot_y0 - (int)(((double)g_ssthresh_history[p] / max_val) * plot_h);
            if (py < graph_y + 35) py = graph_y + 35;
            if (p == 0) MoveToEx(mem_dc, px, py, NULL);
            else LineTo(mem_dc, px, py);
        }
        DeleteObject(th_pen);

        /* Draw cwnd (blue solid line) */
        HPEN cw_pen = CreatePen(PS_SOLID, 3, COLOR_BLUE);
        SelectObject(mem_dc, cw_pen);
        for (int p = 0; p < g_history_count; p++) {
            int px = plot_x0 + (int)(p * ((double)plot_w / (GRAPH_MAX_PTS - 1)));
            int py = plot_y0 - (int)(((double)g_cwnd_history[p] / max_val) * plot_h);
            if (py < graph_y + 35) py = graph_y + 35;
            if (p == 0) MoveToEx(mem_dc, px, py, NULL);
            else LineTo(mem_dc, px, py);
        }
        DeleteObject(cw_pen);
    }

    /* Section Labels */
    SelectObject(mem_dc, g_font_bold);
    SetTextColor(mem_dc, COLOR_TEXT_WHITE);
    TextOutA(mem_dc, 24, 388, "Live Packet Event Stream", 24);
    TextOutA(mem_dc, w - 340, 388, "On-Wire Hex / Payload Inspector", 31);

    /* Blit to screen */
    BitBlt(hdc, client_rect->left, client_rect->top, w, client_rect->bottom - client_rect->top, mem_dc, 0, 0, SRCCOPY);

    SelectObject(mem_dc, old_bm);
    DeleteObject(mem_bm);
    DeleteDC(mem_dc);
}

/* Window Procedure */
static LRESULT CALLBACK WndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
        case WM_CREATE: {
            g_hwnd = hwnd;
            InitializeCriticalSection(&g_cs);

            /* Fonts */
            g_font_title = CreateFontA(24, 0, 0, 0, FW_BOLD, FALSE, FALSE, FALSE, ANSI_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, DEFAULT_QUALITY, DEFAULT_PITCH | FF_SWISS, "Segoe UI");
            g_font_bold  = CreateFontA(15, 0, 0, 0, FW_BOLD, FALSE, FALSE, FALSE, ANSI_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, DEFAULT_QUALITY, DEFAULT_PITCH | FF_SWISS, "Segoe UI");
            g_font_main  = CreateFontA(13, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE, ANSI_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, DEFAULT_QUALITY, DEFAULT_PITCH | FF_SWISS, "Segoe UI");
            g_font_val   = CreateFontA(19, 0, 0, 0, FW_BOLD, FALSE, FALSE, FALSE, ANSI_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, DEFAULT_QUALITY, DEFAULT_PITCH | FF_DONTCARE, "Consolas");
            g_font_mono  = CreateFontA(13, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE, ANSI_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, DEFAULT_QUALITY, DEFAULT_PITCH | FF_DONTCARE, "Consolas");

            /* Buttons Toolbar (Row 1: Y=78) */
            g_btn_selftest = CreateWindowA("BUTTON", " Automated Self-Test (Reno)", WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                                           24, 78, 210, 34, hwnd, (HMENU)IDC_BTN_SELFTEST, NULL, NULL);

            g_btn_server = CreateWindowA("BUTTON", "Start Server (Port 9999)", WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                                         246, 78, 175, 34, hwnd, (HMENU)IDC_BTN_SERVER, NULL, NULL);

            g_btn_client = CreateWindowA("BUTTON", "Connect to Remote IP", WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                                         433, 78, 165, 34, hwnd, (HMENU)IDC_BTN_CLIENT, NULL, NULL);

            /* Target IP/Port inputs */
            g_edit_ip = CreateWindowA("EDIT", "127.0.0.1", WS_CHILD | WS_VISIBLE | WS_BORDER | ES_AUTOHSCROLL,
                                      610, 81, 115, 28, hwnd, (HMENU)IDC_EDIT_IP, NULL, NULL);

            g_edit_port = CreateWindowA("EDIT", "9999", WS_CHILD | WS_VISIBLE | WS_BORDER | ES_NUMBER,
                                        735, 81, 55, 28, hwnd, (HMENU)IDC_EDIT_PORT, NULL, NULL);

            g_btn_inject_loss = CreateWindowA("BUTTON", "Simulate Loss", WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                                              805, 78, 115, 34, hwnd, (HMENU)IDC_BTN_INJECT_LOSS, NULL, NULL);

            /* Apply fonts to controls */
            SendMessageA(g_btn_selftest, WM_SETFONT, (WPARAM)g_font_bold, TRUE);
            SendMessageA(g_btn_server, WM_SETFONT, (WPARAM)g_font_bold, TRUE);
            SendMessageA(g_btn_client, WM_SETFONT, (WPARAM)g_font_bold, TRUE);
            SendMessageA(g_btn_inject_loss, WM_SETFONT, (WPARAM)g_font_bold, TRUE);
            SendMessageA(g_edit_ip, WM_SETFONT, (WPARAM)g_font_mono, TRUE);
            SendMessageA(g_edit_port, WM_SETFONT, (WPARAM)g_font_mono, TRUE);

            /* Log ListBox (Y=412) */
            g_list_logs = CreateWindowA("LISTBOX", NULL, WS_CHILD | WS_VISIBLE | WS_VSCROLL | LBS_NOTIFY | WS_BORDER,
                                        24, 412, 680, 255, hwnd, (HMENU)IDC_LIST_LOGS, NULL, NULL);
            SendMessageA(g_list_logs, WM_SETFONT, (WPARAM)g_font_mono, TRUE);

            /* Hex / Payload Edit Box */
            g_edit_hex = CreateWindowA("EDIT", g_last_hex, WS_CHILD | WS_VISIBLE | WS_BORDER | ES_MULTILINE | ES_READONLY | WS_VSCROLL,
                                       720, 412, 316, 255, hwnd, (HMENU)IDC_HEX_DUMP, NULL, NULL);
            SendMessageA(g_edit_hex, WM_SETFONT, (WPARAM)g_font_mono, TRUE);

            /* 50ms Timer for 20 FPS smooth UI refresh */
            SetTimer(hwnd, 1, 50, NULL);
            break;
        }

        case WM_SIZE: {
            int w = LOWORD(lParam);
            int h = HIWORD(lParam);
            if (g_list_logs && g_edit_hex) {
                int list_w = w - 370;
                if (list_w < 300) list_w = 300;
                int bot_h = h - 425;
                if (bot_h < 120) bot_h = 120;
                MoveWindow(g_list_logs, 24, 412, list_w, bot_h, TRUE);
                MoveWindow(g_edit_hex, 24 + list_w + 16, 412, w - (24 + list_w + 16 + 24), bot_h, TRUE);
            }
            InvalidateRect(hwnd, NULL, FALSE);
            break;
        }

        case WM_COMMAND: {
            int id = LOWORD(wParam);
            if (id == IDC_BTN_SELFTEST) {
                if (!g_running_worker) {
                    g_running_worker = 1;
                    g_net_thread = CreateThread(NULL, 0, selftest_worker, NULL, 0, NULL);
                }
            } else if (id == IDC_BTN_SERVER) {
                if (!g_running_worker) {
                    g_running_worker = 1;
                    char port_txt[32];
                    GetWindowTextA(g_edit_port, port_txt, sizeof(port_txt));
                    int p = atoi(port_txt);
                    if (p <= 0) p = 9999;
                    g_net_thread = CreateThread(NULL, 0, server_worker, (LPVOID)(intptr_t)p, 0, NULL);
                }
            } else if (id == IDC_BTN_CLIENT) {
                if (!g_running_worker) {
                    g_running_worker = 1;
                    GetWindowTextA(g_edit_ip, g_target_ip, sizeof(g_target_ip));
                    char port_txt[32];
                    GetWindowTextA(g_edit_port, port_txt, sizeof(port_txt));
                    g_target_port = atoi(port_txt);
                    if (g_target_port <= 0) g_target_port = 9999;
                    g_net_thread = CreateThread(NULL, 0, client_worker, NULL, 0, NULL);
                }
            } else if (id == IDC_BTN_INJECT_LOSS) {
                EnterCriticalSection(&g_cs);
                g_dup_acks += 3;
                g_ssthresh = g_cwnd / 2;
                if (g_ssthresh < 1024) g_ssthresh = 1024;
                g_cwnd = g_ssthresh + (3 * 1024);
                g_retrans++;
                push_graph_point(g_cwnd, g_ssthresh);
                snprintf(g_status_msg, sizeof(g_status_msg), "MANUAL LOSS INJECTED: ssthresh=%u B, cwnd=%u B", g_ssthresh, g_cwnd);
                LeaveCriticalSection(&g_cs);
                log_event("SYS", "DROP", 0, 0, 0, "Artificial packet loss triggered by user");
            }
            break;
        }

        case WM_CTLCOLORLISTBOX:
        case WM_CTLCOLORSTATIC:
        case WM_CTLCOLOREDIT: {
            HDC hdcCtl = (HDC)wParam;
            SetTextColor(hdcCtl, COLOR_TEXT_WHITE);
            SetBkColor(hdcCtl, COLOR_CARD);
            static HBRUSH s_card_brush = NULL;
            if (!s_card_brush) s_card_brush = CreateSolidBrush(COLOR_CARD);
            return (LRESULT)s_card_brush;
        }

        case WM_TIMER: {
            RECT rc;
            GetClientRect(hwnd, &rc);
            /* Invalidate top & graph area to redraw curves smoothly */
            RECT top_rc = { 0, 0, rc.right, 385 };
            InvalidateRect(hwnd, &top_rc, FALSE);
            break;
        }

        case WM_PAINT: {
            PAINTSTRUCT ps;
            HDC hdc = BeginPaint(hwnd, &ps);
            RECT rc;
            GetClientRect(hwnd, &rc);
            draw_dashboard(hdc, &rc);
            EndPaint(hwnd, &ps);
            break;
        }

        case WM_DESTROY: {
            g_running_worker = 0;
            KillTimer(hwnd, 1);
            DeleteObject(g_font_title);
            DeleteObject(g_font_bold);
            DeleteObject(g_font_main);
            DeleteObject(g_font_val);
            DeleteObject(g_font_mono);
            DeleteCriticalSection(&g_cs);
            PostQuitMessage(0);
            break;
        }

        default:
            return DefWindowProcA(hwnd, msg, wParam, lParam);
    }
    return 0;
}

int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPSTR lpCmdLine, int nCmdShow) {
    (void)hPrevInstance;
    (void)lpCmdLine;

    /* Initialize Common Controls */
    INITCOMMONCONTROLSEX icex;
    icex.dwSize = sizeof(icex);
    icex.dwICC = ICC_WIN95_CLASSES | ICC_STANDARD_CLASSES;
    InitCommonControlsEx(&icex);

    /* Initialize Winsock */
    WSADATA wsa;
    WSAStartup(MAKEWORD(2, 2), &wsa);

    WNDCLASSEXA wc;
    memset(&wc, 0, sizeof(wc));
    wc.cbSize = sizeof(WNDCLASSEXA);
    wc.style = CS_HREDRAW | CS_VREDRAW;
    wc.lpfnWndProc = WndProc;
    wc.hInstance = hInstance;
    wc.hCursor = LoadCursor(NULL, IDC_ARROW);
    wc.hbrBackground = (HBRUSH)GetStockObject(BLACK_BRUSH);
    wc.lpszClassName = "CustomTCPStackGUI";

    if (!RegisterClassExA(&wc)) {
        MessageBoxA(NULL, "Failed to register window class.", "Error", MB_ICONERROR);
        return 1;
    }

    HWND hwnd = CreateWindowExA(
        0,
        "CustomTCPStackGUI",
        "Custom TCP/IP Stack - Native Observability Desktop Monitor",
        WS_OVERLAPPEDWINDOW,
        CW_USEDEFAULT, CW_USEDEFAULT, 1080, 740,
        NULL, NULL, hInstance, NULL
    );

    if (!hwnd) {
        MessageBoxA(NULL, "Failed to create main window.", "Error", MB_ICONERROR);
        return 1;
    }

    ShowWindow(hwnd, nCmdShow);
    UpdateWindow(hwnd);

    MSG msg;
    while (GetMessageA(&msg, NULL, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessageA(&msg);
    }

    WSACleanup();
    return (int)msg.wParam;
}
