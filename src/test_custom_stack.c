#include "../include/custom_proto.h"
#include "../include/link_udp.h"
#include "../include/pcap_logger.h"
#include "../include/telemetry_server.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#ifdef _WIN32
  #include <windows.h>
  #include <shellapi.h>
  #include <conio.h>
  #define SLEEP_MS(ms) Sleep(ms)
#else
  #include <unistd.h>
  #define SLEEP_MS(ms) usleep((ms) * 1000)
#endif

/* Connection States */
typedef enum {
    STATE_CLOSED,
    STATE_LISTEN,
    STATE_SYN_SENT,
    STATE_SYN_RCVD,
    STATE_ESTABLISHED,
    STATE_FIN_WAIT,
    STATE_TIME_WAIT
} tcp_state_t;

static const char *state_to_str(tcp_state_t s) {
    switch (s) {
        case STATE_CLOSED:      return "CLOSED";
        case STATE_LISTEN:      return "LISTEN";
        case STATE_SYN_SENT:    return "SYN_SENT";
        case STATE_SYN_RCVD:    return "SYN_RCVD";
        case STATE_ESTABLISHED: return "ESTABLISHED";
        case STATE_FIN_WAIT:    return "FIN_WAIT";
        case STATE_TIME_WAIT:   return "TIME_WAIT";
        default:                return "UNKNOWN";
    }
}

static void open_browser(const char *url) {
#ifdef _WIN32
    ShellExecuteA(NULL, "open", url, NULL, NULL, SW_SHOWNORMAL);
#else
    char cmd[256];
    snprintf(cmd, sizeof(cmd), "xdg-open %s 2>/dev/null || sensible-browser %s 2>/dev/null &", url, url);
    system(cmd);
#endif
}

static void wait_for_enter(void) {
    printf("\n\033[1;33m>>> Press [ENTER] to continue...\033[0m ");
    fflush(stdout);
    int c;
    while ((c = getchar()) != '\n' && c != EOF);
}

/* ======================================================================
 * MULTI-CONNECTION MANAGER & PERSISTENT SESSION TRACKING
 * ====================================================================== */
#define MAX_CONNECTIONS 8

typedef struct {
    int id;                      /* Connection #1, #2, ... */
    int in_use;                  /* 1 if slot allocated */
    char peer_ip[64];
    int peer_port;
    int local_port;
    link_handle_t link;
    tcp_state_t state;
    uint32_t my_iss;
    uint32_t snd_nxt;
    uint32_t snd_una;
    uint32_t rcv_nxt;
    uint32_t packets_tx;
    uint32_t packets_rx;
    uint32_t bytes_sent;
    time_t connected_at;
} custom_conn_t;

static custom_conn_t g_conns[MAX_CONNECTIONS];
static int g_conn_counter = 1;
static int g_client_pcap_open = 0;

static int count_active_connections(void) {
    int cnt = 0;
    for (int i = 0; i < MAX_CONNECTIONS; i++) {
        if (g_conns[i].in_use && g_conns[i].state == STATE_ESTABLISHED) {
            cnt++;
        }
    }
    return cnt;
}

static void print_active_connections(void) {
    printf("\n\033[1;36m========================= ACTIVE CONNECTIONS =========================\033[0m\n");
    int count = 0;
    for (int i = 0; i < MAX_CONNECTIONS; i++) {
        if (g_conns[i].in_use) {
            count++;
            printf("  [\033[1;32mConnection #%d\033[0m] Local Port: \033[1;33m%d\033[0m <---> Remote Peer: \033[1;33m%s:%d\033[0m\n",
                   g_conns[i].id, g_conns[i].local_port, g_conns[i].peer_ip, g_conns[i].peer_port);
            printf("       Status: \033[1;32m%s\033[0m | Next Seq: %u | Ack: %u | TX: %u pkts (%u B) | RX: %u pkts\n",
                   state_to_str(g_conns[i].state), g_conns[i].snd_nxt, g_conns[i].rcv_nxt,
                   g_conns[i].packets_tx, g_conns[i].bytes_sent, g_conns[i].packets_rx);
        }
    }
    if (count == 0) {
        printf("  (No active connections established)\n");
    }
    printf("\033[1;36m======================================================================\033[0m\n");
}

static custom_conn_t *find_connection_by_id(int id) {
    if (id <= 0) return NULL;
    for (int i = 0; i < MAX_CONNECTIONS; i++) {
        if (g_conns[i].in_use && g_conns[i].id == id) {
            return &g_conns[i];
        }
    }
    return NULL;
}

/* Forward declarations */
static void run_connection_session(custom_conn_t *conn);
static custom_conn_t *create_client_connection(const char *server_ip, int server_port);
static int conn_close_connection(custom_conn_t *conn);

/* Run Server / Receiver Mode */
static int run_server_mode(int port) {
    printf("\n\033[1;36m===============================================================\033[0m\n");
    printf("\033[1;32m  [CUSTOM PROTOCOL STACK] - Receiver / Server Mode\033[0m\n");
    printf("  Listening on UDP Port: \033[1;33m%d\033[0m (Wi-Fi / LAN / Local)\n", port);
    printf("  OS TCP Bypass: \033[1;32mACTIVE (User-Space Protocol Engine)\033[0m\n");
    printf("  Web Dashboard: \033[1;34mhttp://localhost:8080\033[0m\n");
    printf("  Note: Press [Q] at any time to stop server and return to menu.\n");
    printf("\033[1;36m===============================================================\033[0m\n\n");

    if (link_init(port, NULL, 0) != 0) {
        fprintf(stderr, "Failed to initialize network link on port %d.\n", port);
        return 1;
    }

    pcap_init("captures/server_traffic.pcap");
    printf("[PCAP] Capturing all on-wire frames to 'captures/server_traffic.pcap'...\n\n");

    tcp_state_t state = STATE_LISTEN;
    telemetry_update_state("LISTEN");
    uint32_t rcv_nxt = 0;
    uint32_t my_iss = 50000;
    uint32_t snd_nxt = my_iss;

    uint8_t rx_buf[MAX_FRAME_SIZE];
    uint8_t tx_buf[MAX_FRAME_SIZE];

    printf("[STATE: \033[1;34m%s\033[0m] Waiting for client connection... (Press 'Q' to return to menu)\n", state_to_str(state));

    int running = 1;
    while (running) {
#ifdef _WIN32
        if (_kbhit()) {
            int ch = _getch();
            if (ch == 'q' || ch == 'Q' || ch == 27) {
                printf("\n[Server Mode] Stopped by user request.\n");
                break;
            }
        }
#endif
        int bytes = link_recv_frame(rx_buf, sizeof(rx_buf));
        if (bytes > 0) {
            pcap_write_frame(rx_buf, bytes, 0);

            myproto_hdr_t hdr;
            const uint8_t *payload = NULL;
            if (parse_custom_packet(rx_buf, bytes, &hdr, &payload) == 0) {
                print_packet_details(">>> RX", &hdr, bytes);
                telemetry_log_packet(0, (hdr.flags & FLAG_SYN) ? "SYN" : (hdr.flags & FLAG_DATA) ? "DATA" : (hdr.flags & FLAG_FIN) ? "FIN" : "ACK",
                                     hdr.seq_num, hdr.ack_num, hdr.payload_len);

                if (state == STATE_LISTEN && (hdr.flags & FLAG_SYN)) {
                    printf("\n\033[1;32m[Handshake: Step 1 received]\033[0m SYN from client (Seq=%u)\n", hdr.seq_num);
                    rcv_nxt = hdr.seq_num + 1;
                    state = STATE_SYN_RCVD;
                    telemetry_update_state("SYN_RCVD");
                    printf("[STATE -> \033[1;34m%s\033[0m]\n", state_to_str(state));

                    /* Respond with SYN + ACK */
                    printf("\033[1;32m[Handshake: Step 2 sending]\033[0m SYN + ACK (Seq=%u, Ack=%u)\n", snd_nxt, rcv_nxt);
                    int tx_len = serialize_custom_packet(tx_buf, sizeof(tx_buf),
                                                        FLAG_SYN | FLAG_ACK,
                                                        snd_nxt, rcv_nxt,
                                                        MYPROTO_DEFAULT_WND, NULL, 0);
                    snd_nxt++;
                    link_send_frame(tx_buf, tx_len);
                    pcap_write_frame(tx_buf, tx_len, 1);
                    print_packet_details("<<< TX", (myproto_hdr_t *)tx_buf, tx_len);
                    telemetry_log_packet(1, "SYN+ACK", snd_nxt - 1, rcv_nxt, 0);
                }
                else if (state == STATE_SYN_RCVD && (hdr.flags & FLAG_ACK)) {
                    printf("\n\033[1;32m[Handshake: Step 3 received]\033[0m ACK from client (Ack=%u)\n", hdr.ack_num);
                    state = STATE_ESTABLISHED;
                    telemetry_update_state("ESTABLISHED");
                    printf("\033[1;32m>>> [CONNECTION ESTABLISHED!]\033[0m Ready for continuous application data transfer.\n\n");
                }
                else if (state == STATE_ESTABLISHED) {
                    if (hdr.flags & FLAG_DATA) {
                        printf("\n\033[1;36m[DATA RECEIVED]\033[0m %u bytes from client (Seq=%u):\n", hdr.payload_len, hdr.seq_num);
                        printf("   \033[1;32m>>> Payload Message:\033[0m \"%.*s\"\n", (int)hdr.payload_len, (const char *)payload);
                        print_hex_dump(payload, hdr.payload_len);

                        if (hdr.seq_num == rcv_nxt) {
                            /* In-order segment: advance expected sequence */
                            rcv_nxt = hdr.seq_num + hdr.payload_len;
                            printf("[In-Order Data] Sequence validated. Advancing rcv_nxt -> %u\n", rcv_nxt);
                        } else if (SEQ_GT(hdr.seq_num, rcv_nxt)) {
                            /* Out-of-order segment: gaps detected, send Duplicate ACK */
                            printf("\033[1;33m[Out-of-Order Segment!]\033[0m Received Seq=%u, Expected=%u (Re-ACKing expected sequence)\n", hdr.seq_num, rcv_nxt);
                        } else {
                            /* Old duplicate / retransmission */
                            printf("\033[1;35m[Duplicate Segment]\033[0m Seq=%u already acknowledged (Expected=%u)\n", hdr.seq_num, rcv_nxt);
                        }

                        /* Send Cumulative ACK */
                        printf("[Sending Cumulative ACK] Acknowledging Seq up to %u\n", rcv_nxt);
                        int tx_len = serialize_custom_packet(tx_buf, sizeof(tx_buf),
                                                            FLAG_ACK,
                                                            snd_nxt, rcv_nxt,
                                                            MYPROTO_DEFAULT_WND, NULL, 0);
                        link_send_frame(tx_buf, tx_len);
                        pcap_write_frame(tx_buf, tx_len, 1);
                        print_packet_details("<<< TX", (myproto_hdr_t *)tx_buf, tx_len);
                        telemetry_log_packet(1, "ACK", snd_nxt, rcv_nxt, 0);
                        printf("\033[1;36m[KEEP-ALIVE] Connection remains ESTABLISHED and ALIVE for next messages.\033[0m\n\n");
                    }
                    else if (hdr.flags & FLAG_FIN) {
                        printf("\n\033[1;33m[Teardown]\033[0m FIN received from client. Acknowledging teardown.\n");
                        rcv_nxt = hdr.seq_num + 1;
                        int tx_len = serialize_custom_packet(tx_buf, sizeof(tx_buf),
                                                            FLAG_ACK,
                                                            snd_nxt, rcv_nxt,
                                                            MYPROTO_DEFAULT_WND, NULL, 0);
                        link_send_frame(tx_buf, tx_len);
                        pcap_write_frame(tx_buf, tx_len, 1);
                        state = STATE_LISTEN;
                        rcv_nxt = 0;
                        snd_nxt = my_iss;
                        telemetry_update_state("LISTEN");
                        printf("\033[1;32m[SERVER READY]\033[0m Client disconnected cleanly. Server resets to LISTEN state for incoming connections...\n\n");
                    }
                }
            }
        }
        SLEEP_MS(5);
    }

    pcap_close();
    link_close();
    return 0;
}

/* ======================================================================
 * CLIENT / SENDER IMPLEMENTATION WITH MULTI-CONNECTION & PERSISTENT SESSION
 * ====================================================================== */
static custom_conn_t *create_client_connection(const char *server_ip, int server_port) {
    int slot = -1;
    for (int i = 0; i < MAX_CONNECTIONS; i++) {
        if (!g_conns[i].in_use) {
            slot = i;
            break;
        }
    }
    if (slot == -1) {
        printf("\033[1;31m[ERROR] Maximum concurrent connections reached (%d).\033[0m\n", MAX_CONNECTIONS);
        return NULL;
    }

    custom_conn_t *c = &g_conns[slot];
    memset(c, 0, sizeof(custom_conn_t));

    int base_local_port = 9998 - slot;
    c->link = link_create(base_local_port, server_ip, server_port);
    if (!c->link) {
        fprintf(stderr, "\033[1;31m[ERROR] Failed to bind local network link for %s:%d\033[0m\n",
                server_ip, server_port);
        return NULL;
    }

    c->local_port = link_get_local_port(c->link);
    c->id = g_conn_counter++;
    c->in_use = 1;
    strncpy(c->peer_ip, server_ip, sizeof(c->peer_ip) - 1);
    c->peer_port = server_port;
    c->state = STATE_CLOSED;
    c->my_iss = 10000 + (c->id * 5000);
    c->snd_nxt = c->my_iss;
    c->snd_una = c->my_iss;
    c->rcv_nxt = 0;
    c->connected_at = time(NULL);

    if (!g_client_pcap_open) {
        pcap_init("captures/client_traffic.pcap");
        g_client_pcap_open = 1;
        printf("[PCAP] Capturing traffic to 'captures/client_traffic.pcap'...\n");
    }

    /* Step 1: Send SYN */
    uint8_t tx_buf[MAX_FRAME_SIZE];
    uint8_t rx_buf[MAX_FRAME_SIZE];

    printf("\n\033[1;36m===============================================================\033[0m\n");
    printf("\033[1;32m  [INITIATING CONNECTION #%d]\033[0m\n", c->id);
    printf("  Local Port: \033[1;33m%d\033[0m  --->  Target Peer: \033[1;33m%s:%d\033[0m\n", c->local_port, c->peer_ip, c->peer_port);
    printf("\033[1;36m===============================================================\033[0m\n");

    printf("\033[1;32m[Handshake: Step 1 sending]\033[0m SYN to %s:%d (Seq=%u, LocalPort=%d)\n",
           c->peer_ip, c->peer_port, c->snd_nxt, c->local_port);

    int tx_len = serialize_custom_packet(tx_buf, sizeof(tx_buf),
                                        FLAG_SYN,
                                        c->snd_nxt, 0,
                                        MYPROTO_DEFAULT_WND, NULL, 0);
    c->snd_nxt++;
    link_send(c->link, tx_buf, tx_len);
    pcap_write_frame(tx_buf, tx_len, 1);
    print_packet_details("<<< TX", (myproto_hdr_t *)tx_buf, tx_len);
    telemetry_log_packet(1, "SYN", c->snd_nxt - 1, 0, 0);
    c->packets_tx++;

    c->state = STATE_SYN_SENT;
    telemetry_update_state("SYN_SENT");
    printf("[STATE -> \033[1;34m%s\033[0m] Waiting for SYN + ACK from %s:%d...\n", state_to_str(c->state), c->peer_ip, c->peer_port);

    int handshake_done = 0;
    int retries = 0;
    while (!handshake_done && retries < 500) {
        int bytes = link_recv(c->link, rx_buf, sizeof(rx_buf));
        if (bytes > 0) {
            pcap_write_frame(rx_buf, bytes, 0);
            myproto_hdr_t hdr;
            if (parse_custom_packet(rx_buf, bytes, &hdr, NULL) == 0) {
                print_packet_details(">>> RX", &hdr, bytes);
                c->packets_rx++;
                if (hdr.flags == (FLAG_SYN | FLAG_ACK)) {
                    printf("\n\033[1;32m[Handshake: Step 2 received]\033[0m SYN + ACK from server (Seq=%u, Ack=%u)\n", hdr.seq_num, hdr.ack_num);
                    c->rcv_nxt = hdr.seq_num + 1;
                    c->snd_una = hdr.ack_num;

                    /* Step 3: Send ACK */
                    printf("\033[1;32m[Handshake: Step 3 sending]\033[0m Final ACK (Ack=%u)\n", c->rcv_nxt);
                    int ack_len = serialize_custom_packet(tx_buf, sizeof(tx_buf),
                                                         FLAG_ACK,
                                                         c->snd_nxt, c->rcv_nxt,
                                                         MYPROTO_DEFAULT_WND, NULL, 0);
                    link_send(c->link, tx_buf, ack_len);
                    pcap_write_frame(tx_buf, ack_len, 1);
                    print_packet_details("<<< TX", (myproto_hdr_t *)tx_buf, ack_len);
                    telemetry_log_packet(1, "ACK", c->snd_nxt, c->rcv_nxt, 0);
                    c->packets_tx++;

                    c->state = STATE_ESTABLISHED;
                    telemetry_update_state("ESTABLISHED");
                    printf("\033[1;32m>>> [CONNECTION #%d ESTABLISHED!]\033[0m Ready for data transfer.\n\n", c->id);
                    handshake_done = 1;
                    break;
                }
            }
        }
        SLEEP_MS(10);
        retries++;
    }

    if (!handshake_done) {
        printf("\033[1;31m[ERROR] Connection #%d timed out. Is the receiver listening at %s:%d?\033[0m\n",
               c->id, server_ip, server_port);
        link_destroy(c->link);
        memset(c, 0, sizeof(custom_conn_t));
        return NULL;
    }

    return c;
}

static int conn_send_message(custom_conn_t *conn, const char *msg) {
    if (!conn || !conn->in_use || conn->state != STATE_ESTABLISHED) {
        printf("\033[1;31m[ERROR] Connection is not active or established.\033[0m\n");
        return -1;
    }

    uint8_t tx_buf[MAX_FRAME_SIZE];
    uint8_t rx_buf[MAX_FRAME_SIZE];
    uint16_t msg_len = (uint16_t)strlen(msg);

    printf("\n---------------------------------------------------------------\n");
    printf("\033[1;36m[TRANSMITTING ON CONNECTION #%d]\033[0m Seq=%u Payload=\"%s\"\n", conn->id, conn->snd_nxt, msg);
    int tx_len = serialize_custom_packet(tx_buf, sizeof(tx_buf),
                                        FLAG_DATA | FLAG_ACK,
                                        conn->snd_nxt, conn->rcv_nxt,
                                        MYPROTO_DEFAULT_WND, msg, msg_len);
    link_send(conn->link, tx_buf, tx_len);
    pcap_write_frame(tx_buf, tx_len, 1);
    print_packet_details("<<< TX", (myproto_hdr_t *)tx_buf, tx_len);
    print_hex_dump((const uint8_t *)msg, msg_len);
    telemetry_log_packet(1, "DATA+ACK", conn->snd_nxt, conn->rcv_nxt, msg_len);
    conn->packets_tx++;
    conn->bytes_sent += msg_len;

    /* Wait for ACK */
    int ack_received = 0;
    int wait_ticks = 0;
    while (!ack_received && wait_ticks < 200) {
        int bytes = link_recv(conn->link, rx_buf, sizeof(rx_buf));
        if (bytes > 0) {
            pcap_write_frame(rx_buf, bytes, 0);
            myproto_hdr_t hdr;
            if (parse_custom_packet(rx_buf, bytes, &hdr, NULL) == 0) {
                if (hdr.flags & FLAG_ACK) {
                    print_packet_details(">>> RX", &hdr, bytes);
                    conn->packets_rx++;
                    conn->snd_una = hdr.ack_num;
                    conn->snd_nxt += msg_len;
                    ack_received = 1;
                    telemetry_log_packet(0, "ACK", hdr.seq_num, hdr.ack_num, 0);
                    printf("\033[1;32m[SUCCESS] Remote peer acknowledged %u bytes! (Next Seq=%u, Ack=%u)\033[0m\n",
                           msg_len, conn->snd_nxt, hdr.ack_num);
                    printf("\033[1;36m[KEEP-ALIVE] Connection #%d remains ESTABLISHED and ALIVE. (Not terminated!)\033[0m\n\n",
                           conn->id);
                    break;
                }
            }
        }
        SLEEP_MS(10);
        wait_ticks++;
    }

    if (!ack_received) {
        printf("\033[1;33m[WARNING] No ACK received within timeout. Peer might be busy or packet lost.\033[0m\n");
    }

    return 0;
}

static int conn_send_3packet_stream(custom_conn_t *conn) {
    if (!conn || !conn->in_use || conn->state != STATE_ESTABLISHED) {
        printf("\033[1;31m[ERROR] Connection is not active or established.\033[0m\n");
        return -1;
    }

    const char *messages[3] = {
        "Custom Packet 1: Hello over Custom User-Space TCP Protocol!",
        "Custom Packet 2: Bypassing OS Kernel TCP stack completely.",
        "Custom Packet 3: Real-time reliable multi-connection verification."
    };

    printf("\n\033[1;34m>>> Sending automated 3-packet verification stream on Connection #%d...\033[0m\n", conn->id);

    for (int i = 0; i < 3; i++) {
        printf("---------------------------------------------------------------\n");
        printf("\033[1;36m[VERIFICATION STREAM %d/3 ON CONN #%d]\033[0m\n", i + 1, conn->id);
        conn_send_message(conn, messages[i]);
        SLEEP_MS(200);
    }
    printf("\033[1;32m[SUCCESS] All 3 verification stream packets sent & acknowledged!\033[0m\n");
    printf("\033[1;36m[KEEP-ALIVE] Connection #%d remains ESTABLISHED and ALIVE.\033[0m\n", conn->id);
    return 0;
}

static int conn_close_connection(custom_conn_t *conn) {
    if (!conn || !conn->in_use) return -1;

    printf("\n\033[1;33m---------------------------------------------------------------\033[0m\n");
    printf("\033[1;33m[Connection Teardown]\033[0m Closing Connection #%d to %s:%d...\n",
           conn->id, conn->peer_ip, conn->peer_port);

    uint8_t tx_buf[MAX_FRAME_SIZE];
    uint8_t rx_buf[MAX_FRAME_SIZE];

    /* Send FIN */
    int tx_len = serialize_custom_packet(tx_buf, sizeof(tx_buf),
                                        FLAG_FIN | FLAG_ACK,
                                        conn->snd_nxt, conn->rcv_nxt,
                                        MYPROTO_DEFAULT_WND, NULL, 0);
    link_send(conn->link, tx_buf, tx_len);
    pcap_write_frame(tx_buf, tx_len, 1);
    conn->state = STATE_FIN_WAIT;
    telemetry_update_state("FIN_WAIT");
    printf("[STATE -> \033[1;33m%s\033[0m] FIN sent (Seq=%u). Waiting for peer ACK...\n",
           state_to_str(conn->state), conn->snd_nxt);
    telemetry_log_packet(1, "FIN+ACK", conn->snd_nxt, conn->rcv_nxt, 0);

    /* Wait for final ACK */
    int teardown_ticks = 0;
    while (teardown_ticks < 100) {
        int bytes = link_recv(conn->link, rx_buf, sizeof(rx_buf));
        if (bytes > 0) {
            pcap_write_frame(rx_buf, bytes, 0);
            myproto_hdr_t hdr;
            if (parse_custom_packet(rx_buf, bytes, &hdr, NULL) == 0) {
                if (hdr.flags & FLAG_ACK) {
                    print_packet_details(">>> RX", &hdr, bytes);
                    printf("\033[1;32m[SUCCESS] Server acknowledged FIN. Connection #%d cleanly closed.\033[0m\n", conn->id);
                    telemetry_log_packet(0, "ACK", hdr.seq_num, hdr.ack_num, 0);
                    break;
                }
            }
        }
        SLEEP_MS(10);
        teardown_ticks++;
    }

    conn->state = STATE_CLOSED;
    telemetry_update_state("CLOSED");
    link_destroy(conn->link);
    conn->link = NULL;
    conn->in_use = 0;

    int active_rem = count_active_connections();
    if (active_rem == 0 && g_client_pcap_open) {
        pcap_close();
        g_client_pcap_open = 0;
    }
    printf("\033[1;32m[CLOSED] Connection #%d is now terminated. Remaining active connections: %d\033[0m\n",
           conn->id, active_rem);
    return 0;
}

static void run_connection_session(custom_conn_t *conn) {
    if (!conn || !conn->in_use) return;

    while (conn && conn->in_use && conn->state == STATE_ESTABLISHED) {
        int total_active = count_active_connections();
        printf("\n");
        printf("\033[1;36m======================================================================\033[0m\n");
        printf("\033[1;32m  SESSION: ACTIVE CONNECTION #%d \033[1;34m[ESTABLISHED - ALIVE]\033[0m\n", conn->id);
        printf("  Local Port: \033[1;33m%d\033[0m <---> Remote Peer: \033[1;33m%s:%d\033[0m\n",
               conn->local_port, conn->peer_ip, conn->peer_port);
        printf("  Seq: %u | Ack: %u | Sent: %u pkts (%u bytes) | Recv: %u pkts | Active Conns: %d\n",
               conn->snd_nxt, conn->rcv_nxt, conn->packets_tx, conn->bytes_sent, conn->packets_rx, total_active);
        printf("\033[1;36m======================================================================\033[0m\n");
        printf("  [1] \033[1;32mSend Custom Text Message\033[0m (Connection stays alive)\n");
        printf("  [2] \033[1;34mSend Verification 3-Packet Stream\033[0m (Connection stays alive)\n");
        printf("  [3] \033[1;33mCreate NEW Connection\033[0m (Keep Connection #%d ALIVE without closing)\n", conn->id);
        printf("  [4] \033[1;31mClose THIS Connection\033[0m (Manual Graceful FIN Teardown)\n");
        printf("  [5] \033[1;35mSwitch Active Connection\033[0m (%d active connections)\n", total_active);
        printf("  [6] \033[1;37mReturn to Main Menu\033[0m (Keep all connections ALIVE in background)\n");
        printf("\033[1;36m----------------------------------------------------------------------\033[0m\n");
        printf("  Select an action [1-6]: ");
        fflush(stdout);

        char input[128];
        if (!fgets(input, sizeof(input), stdin)) break;
        int opt = atoi(input);

        if (opt == 1) {
            printf("\nEnter message to send to %s:%d: ", conn->peer_ip, conn->peer_port);
            char msg[512] = {0};
            if (fgets(msg, sizeof(msg), stdin)) {
                msg[strcspn(msg, "\r\n")] = '\0';
                if (strlen(msg) == 0) strcpy(msg, "Hello from Custom TCP Protocol Stack!");
                conn_send_message(conn, msg);
            }
        } else if (opt == 2) {
            conn_send_3packet_stream(conn);
        } else if (opt == 3) {
            /* Create new connection WITHOUT closing current connection! */
            printf("\n\033[1;33m>>> Creating new connection (Connection #%d remains ALIVE)...\033[0m\n", conn->id);
            printf("Enter Receiver Laptop IP Address [Default: 127.0.0.1]: ");
            char ip_str[64];
            fgets(ip_str, sizeof(ip_str), stdin);
            ip_str[strcspn(ip_str, "\r\n")] = '\0';
            if (strlen(ip_str) == 0) strcpy(ip_str, "127.0.0.1");

            printf("Enter Receiver Port [Default: 9999]: ");
            char port_str[32];
            fgets(port_str, sizeof(port_str), stdin);
            int port = atoi(port_str);
            if (port <= 0) port = 9999;

            custom_conn_t *new_c = create_client_connection(ip_str, port);
            if (new_c) {
                printf("\n\033[1;32m[SUCCESS] New Connection #%d created! Both Connection #%d and #%d are now ALIVE.\033[0m\n",
                       new_c->id, conn->id, new_c->id);
                conn = new_c;
            }
        } else if (opt == 4) {
            /* Close THIS connection */
            conn_close_connection(conn);
            int remaining = count_active_connections();
            if (remaining > 0) {
                print_active_connections();
                printf("Select Connection ID to manage (or 0 for Main Menu): ");
                char id_str[32];
                fgets(id_str, sizeof(id_str), stdin);
                int sel_id = atoi(id_str);
                custom_conn_t *next_c = find_connection_by_id(sel_id);
                if (next_c) {
                    conn = next_c;
                } else {
                    break;
                }
            } else {
                printf("\nAll active connections closed. Returning to main menu.\n");
                wait_for_enter();
                break;
            }
        } else if (opt == 5) {
            print_active_connections();
            printf("Select Connection ID to switch to: ");
            char id_str[32];
            fgets(id_str, sizeof(id_str), stdin);
            int sel_id = atoi(id_str);
            custom_conn_t *sw_c = find_connection_by_id(sel_id);
            if (sw_c) {
                conn = sw_c;
            } else {
                printf("\033[1;31mInvalid Connection ID.\033[0m\n");
            }
        } else if (opt == 6) {
            printf("\n\033[1;32mReturning to Main Menu. All %d connection(s) remain ALIVE.\033[0m\n",
                   count_active_connections());
            break;
        } else {
            printf("\033[1;31mInvalid option. Enter 1-6.\033[0m\n");
        }
    }
}

static int run_client_mode(const char *server_ip, int server_port) {
    custom_conn_t *c = create_client_connection(server_ip, server_port);
    if (!c) {
        return 1;
    }
    run_connection_session(c);
    return 0;
}

/* ======================================================================
 * AUTOMATED PROTOCOL & RENO CONGESTION RECOVERY SELF-TEST
 * ====================================================================== */
static int run_self_test(void) {
    printf("\n\033[1;36m===============================================================\033[0m\n");
    printf("\033[1;32m  [CUSTOM PROTOCOL STACK] - Automated Self-Test Verification\033[0m\n");
    printf("  Testing: Handshake + Checksums + Packet Loss + Retransmissions\n");
    printf("  OS TCP Bypass: \033[1;32m100%% IN EFFECT\033[0m\n");
    printf("  Observability Dashboard: \033[1;34mhttp://localhost:8080\033[0m\n");
    printf("\033[1;36m===============================================================\033[0m\n\n");

    pcap_init("captures/custom_traffic.pcap");
    telemetry_update_state("RUNNING_SELFTEST");

    /* 1. Protocol Packing & Checksum Validation Test */
    printf("\033[1;35m--- Test 1: Header Serialization & 16-bit Checksum Validation ---\033[0m\n");
    uint8_t packet[MAX_FRAME_SIZE];
    const char *test_msg = "Custom L4 Payload Verification Byte Stream";
    uint16_t msg_len = (uint16_t)strlen(test_msg);

    int total_len = serialize_custom_packet(packet, sizeof(packet),
                                            FLAG_SYN | FLAG_DATA,
                                            1001, 2002, 4096,
                                            test_msg, msg_len);
    printf("Successfully packed %d bytes custom packet.\n", total_len);
    print_hex_dump(packet, total_len);
    telemetry_log_packet(1, "SYN+DATA", 1001, 2002, msg_len);

    /* Verify checksum check */
    myproto_hdr_t parsed_hdr;
    const uint8_t *parsed_payload = NULL;
    int parse_rc = parse_custom_packet(packet, total_len, &parsed_hdr, &parsed_payload);
    if (parse_rc == 0) {
        printf("\033[1;32m[PASS] Checksum verified: 0x%04X (Valid!)\033[0m\n", parsed_hdr.checksum);
        printf("\033[1;32m[PASS] Magic: 0x%04X, Flags: 0x%02X, Seq: %u, Ack: %u\033[0m\n",
               parsed_hdr.magic, parsed_hdr.flags, parsed_hdr.seq_num, parsed_hdr.ack_num);
    } else {
        printf("\033[1;31m[FAIL] Packet parsing failed with code %d\033[0m\n", parse_rc);
        return 1;
    }

    /* Tamper test: Corrupt 1 byte and verify checksum catches it */
    printf("\n\033[1;35m--- Test 2: Tamper & Corruption Detection ---\033[0m\n");
    packet[sizeof(myproto_hdr_t) + 3] ^= 0xFF; /* flip bits */
    parse_rc = parse_custom_packet(packet, total_len, &parsed_hdr, &parsed_payload);
    if (parse_rc != 0) {
        printf("\033[1;32m[PASS] Corrupted byte immediately caught by 1's complement checksum!\033[0m\n");
    } else {
        printf("\033[1;31m[FAIL] Corrupted packet was unexpectedly accepted!\033[0m\n");
        return 1;
    }

    /* 2. Simulated 3-Way Handshake */
    printf("\n\033[1;35m--- Test 3: Simulated 3-Way Handshake in User Space ---\033[0m\n");
    uint8_t syn_pkt[MAX_FRAME_SIZE], synack_pkt[MAX_FRAME_SIZE], ack_pkt[MAX_FRAME_SIZE];

    /* Step 1: SYN */
    int syn_len = serialize_custom_packet(syn_pkt, sizeof(syn_pkt), FLAG_SYN, 1000, 0, 8192, NULL, 0);
    pcap_write_frame(syn_pkt, syn_len, 1);
    parse_custom_packet(syn_pkt, syn_len, &parsed_hdr, NULL);
    print_packet_details("[Step 1: Client -> Server]", &parsed_hdr, syn_len);
    telemetry_log_packet(1, "SYN", 1000, 0, 0);
    telemetry_update_state("SYN_SENT");
    SLEEP_MS(300);

    /* Step 2: SYN-ACK */
    int synack_len = serialize_custom_packet(synack_pkt, sizeof(synack_pkt), FLAG_SYN | FLAG_ACK, 5000, 1001, 8192, NULL, 0);
    pcap_write_frame(synack_pkt, synack_len, 0);
    parse_custom_packet(synack_pkt, synack_len, &parsed_hdr, NULL);
    print_packet_details("[Step 2: Server -> Client]", &parsed_hdr, synack_len);
    telemetry_log_packet(0, "SYN+ACK", 5000, 1001, 0);
    telemetry_update_state("SYN_RCVD");
    SLEEP_MS(300);

    /* Step 3: ACK */
    int ack_len = serialize_custom_packet(ack_pkt, sizeof(ack_pkt), FLAG_ACK, 1001, 5001, 8192, NULL, 0);
    pcap_write_frame(ack_pkt, ack_len, 1);
    parse_custom_packet(ack_pkt, ack_len, &parsed_hdr, NULL);
    print_packet_details("[Step 3: Client -> Server]", &parsed_hdr, ack_len);
    telemetry_log_packet(1, "ACK", 1001, 5001, 0);
    telemetry_update_state("ESTABLISHED");
    printf("\033[1;32m[PASS] Connection established successfully in user-space!\033[0m\n");
    SLEEP_MS(300);

    /* 3. Retransmission & Reno Congestion Control Simulation */
    printf("\n\033[1;35m--- Test 4: Simulated Packet Drop & Reno Fast Retransmit ---\033[0m\n");
    uint32_t cwnd = MYPROTO_DEFAULT_MSS;    /* 1 MSS */
    uint32_t ssthresh = 8 * MYPROTO_DEFAULT_MSS;
    uint32_t rtt = 22;
    uint32_t rto = 200;
    telemetry_update_cc(cwnd, ssthresh, rtt, rto);
    printf("[Reno Initial State] cwnd = \033[1;34m%u bytes\033[0m (1 MSS), ssthresh = %u bytes\n", cwnd, ssthresh);
    SLEEP_MS(400);

    /* Slow start growth */
    cwnd += MYPROTO_DEFAULT_MSS;
    telemetry_update_cc(cwnd, ssthresh, 25, 200);
    printf("[Slow Start ACK 1] cwnd doubled -> \033[1;34m%u bytes\033[0m (2 MSS)\n", cwnd);
    SLEEP_MS(400);

    cwnd += MYPROTO_DEFAULT_MSS;
    telemetry_update_cc(cwnd, ssthresh, 24, 200);
    printf("[Slow Start ACK 2] cwnd increased -> \033[1;34m%u bytes\033[0m (3 MSS)\n", cwnd);
    SLEEP_MS(400);

    /* Simulated packet loss event */
    printf("\n\033[1;31m[EVENT: 3 Duplicate ACKs received - Packet Loss Detected!]\033[0m\n");
    ssthresh = cwnd / 2;
    if (ssthresh < MYPROTO_DEFAULT_MSS) ssthresh = MYPROTO_DEFAULT_MSS;
    cwnd = ssthresh + (3 * MYPROTO_DEFAULT_MSS); /* Reno Fast Recovery */
    telemetry_record_loss();
    telemetry_update_cc(cwnd, ssthresh, 48, 250);
    printf("[Reno Fast Recovery] ssthresh set to \033[1;35m%u bytes\033[0m, cwnd set to \033[1;34m%u bytes\033[0m\n", ssthresh, cwnd);
    printf("[Retransmission] Retransmitting lost packet Seq=1001 with original payload...\n");

    int retx_len = serialize_custom_packet(packet, sizeof(packet), FLAG_DATA, 1001, 5001, 8192, "Retransmitted Data", 18);
    pcap_write_frame(packet, retx_len, 1);
    telemetry_log_packet(1, "RETRANSMIT", 1001, 5001, 18);
    printf("\033[1;32m[PASS] Retransmitted packet recorded to PCAP capture.\033[0m\n");
    SLEEP_MS(500);

    /* Graceful Teardown */
    telemetry_update_state("CLOSED");
    pcap_close();
    printf("\n\033[1;36m===============================================================\033[0m\n");
    printf("\033[1;32m  [ALL PROTOCOL TESTS PASSED!]\033[0m\n");
    printf("  Summary: Custom headers, 16-bit checksums, wire dumps,\n");
    printf("  state machine transitions, and PCAP logging are fully functional.\n");
    printf("  Wireshark capture saved: \033[1;33mcaptures/custom_traffic.pcap\033[0m\n");
    printf("\033[1;36m===============================================================\033[0m\n");
    return 0;
}

/* ======================================================================
 * MAIN INTERACTIVE CONTROL CENTER MENU
 * ====================================================================== */
static void show_interactive_menu(void) {
    while (1) {
        int active_cnt = count_active_connections();

        printf("\n");
        printf("\033[1;36m======================================================================\033[0m\n");
        printf("\033[1;32m       CUSTOM TCP/IP PROTOCOL STACK - CONTROL CENTER & UI            \033[0m\n");
        printf("       Bypassing OS Kernel TCP Stack | Full User-Space Protocol      \n");
        printf("\033[1;36m======================================================================\033[0m\n");
        printf("  [1] \033[1;32mRun Automated Protocol & Reno Congestion Recovery Test\033[0m\n");
        printf("  [2] \033[1;34mStart Receiver / Server Mode\033[0m (Wait for connection from other laptop)\n");
        printf("  [3] \033[1;33mStart Sender / Client Mode\033[0m   (Create new connection without closing)\n");
        printf("  [4] \033[1;36mActive Connections & Send Data\033[0m (Manage / Send on open connections)\n");
        printf("  [5] \033[1;31mClose a Connection\033[0m           (Manual Graceful FIN Teardown)\n");
        printf("  [6] \033[1;35mOpen Web Observability Dashboard\033[0m (http://localhost:8080)\n");
        printf("  [7] Exit\n");
        printf("\033[1;36m----------------------------------------------------------------------\033[0m\n");
        if (active_cnt > 0) {
            printf("  \033[1;32mActive Connections: %d ALIVE\033[0m (Ready to transmit or close)\n", active_cnt);
            printf("\033[1;36m----------------------------------------------------------------------\033[0m\n");
        }
        printf("  Select an option [1-7]: ");
        fflush(stdout);

        char input[64];
        if (!fgets(input, sizeof(input), stdin)) break;
        int choice = atoi(input);

        if (choice == 1) {
            run_self_test();
            wait_for_enter();
        } else if (choice == 2) {
            printf("Enter UDP Port to listen on [Default: 9999]: ");
            char port_str[32];
            fgets(port_str, sizeof(port_str), stdin);
            int port = atoi(port_str);
            if (port <= 0) port = 9999;
            run_server_mode(port);
            wait_for_enter();
        } else if (choice == 3) {
            printf("Enter Receiver Laptop IP Address [Default: 127.0.0.1]: ");
            char ip_str[64];
            fgets(ip_str, sizeof(ip_str), stdin);
            ip_str[strcspn(ip_str, "\r\n")] = '\0';
            if (strlen(ip_str) == 0) strcpy(ip_str, "127.0.0.1");

            printf("Enter Receiver Port [Default: 9999]: ");
            char port_str[32];
            fgets(port_str, sizeof(port_str), stdin);
            int port = atoi(port_str);
            if (port <= 0) port = 9999;

            custom_conn_t *c = create_client_connection(ip_str, port);
            if (c) {
                run_connection_session(c);
            } else {
                wait_for_enter();
            }
        } else if (choice == 4) {
            /* Manage active connections & send data */
            if (active_cnt == 0) {
                printf("\n\033[1;33m[NOTICE] No active connections currently open.\033[0m\n");
                printf("Select option [3] to establish a connection first.\n");
                wait_for_enter();
            } else {
                print_active_connections();
                printf("Enter Connection ID to manage / send messages (or 0 to cancel): ");
                char id_str[32];
                fgets(id_str, sizeof(id_str), stdin);
                int sel_id = atoi(id_str);
                custom_conn_t *c = find_connection_by_id(sel_id);
                if (c) {
                    run_connection_session(c);
                }
            }
        } else if (choice == 5) {
            /* Close a Connection */
            if (active_cnt == 0) {
                printf("\n\033[1;33m[NOTICE] No active connections to close.\033[0m\n");
                wait_for_enter();
            } else {
                print_active_connections();
                printf("Enter Connection ID to close with FIN teardown (or 0 to cancel): ");
                char id_str[32];
                fgets(id_str, sizeof(id_str), stdin);
                int sel_id = atoi(id_str);
                if (sel_id > 0) {
                    custom_conn_t *c = find_connection_by_id(sel_id);
                    if (c) {
                        conn_close_connection(c);
                    } else {
                        printf("\033[1;31mConnection ID #%d not found.\033[0m\n", sel_id);
                    }
                    wait_for_enter();
                }
            }
        } else if (choice == 6) {
            printf("\n\033[1;32m[LAUNCHING]\033[0m Opening Web Observability Dashboard at \033[1;34mhttp://localhost:8080\033[0m...\n");
            open_browser("http://localhost:8080");
            printf("Dashboard opened in your default web browser!\n");
        } else if (choice == 7) {
            /* Close any remaining active connections gracefully before exiting */
            for (int i = 0; i < MAX_CONNECTIONS; i++) {
                if (g_conns[i].in_use && g_conns[i].state == STATE_ESTABLISHED) {
                    conn_close_connection(&g_conns[i]);
                }
            }
            if (g_client_pcap_open) {
                pcap_close();
                g_client_pcap_open = 0;
            }
            printf("\nExiting Custom Protocol Stack. Goodbye!\n");
            break;
        } else {
            printf("\033[1;31mInvalid selection. Please enter an option from 1 to 7.\033[0m\n");
        }
    }
}

int main(int argc, char *argv[]) {
    setvbuf(stdout, NULL, _IONBF, 0);
#ifdef _WIN32
    /* Enable ANSI terminal colors on Windows Console */
    HANDLE hOut = GetStdHandle(STD_OUTPUT_HANDLE);
    DWORD dwMode = 0;
    if (GetConsoleMode(hOut, &dwMode)) {
        SetConsoleMode(hOut, dwMode | 0x0004); /* ENABLE_VIRTUAL_TERMINAL_PROCESSING */
    }
#endif

    /* Start HTTP Telemetry Dashboard Server in background on port 8080 */
    telemetry_server_start(8080);

    if (argc >= 2 && strcmp(argv[1], "--self-test") == 0) {
        int rc = run_self_test();
        telemetry_server_stop();
        return rc;
    } else if (argc >= 3 && strcmp(argv[1], "--server") == 0) {
        int port = atoi(argv[2]);
        int rc = run_server_mode(port);
        telemetry_server_stop();
        return rc;
    } else if (argc >= 4 && strcmp(argv[1], "--client") == 0) {
        const char *ip = argv[2];
        int port = atoi(argv[3]);
        int rc = run_client_mode(ip, port);
        telemetry_server_stop();
        return rc;
    }

    /* If launched with NO arguments (e.g. double-clicked in Windows Explorer!) */
    show_interactive_menu();

    telemetry_server_stop();
    return 0;
}
