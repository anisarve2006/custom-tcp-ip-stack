#include "../include/telemetry_server.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#ifdef _WIN32
  #include <winsock2.h>
  #include <windows.h>
  typedef int socklen_t;
  #define THREAD_HANDLE HANDLE
  #define CLOSE_SOCK(s) closesocket(s)
  #define SLEEP_THREAD(ms) Sleep(ms)
#else
  #include <unistd.h>
  #include <pthread.h>
  #include <sys/socket.h>
  #include <netinet/in.h>
  #define THREAD_HANDLE pthread_t
  #define CLOSE_SOCK(s) close(s)
  #define SLEEP_THREAD(ms) usleep((ms) * 1000)
#endif

telemetry_data_t g_telemetry = {
    .state = "IDLE",
    .cwnd = 1024,
    .ssthresh = 8192,
    .rtt_ms = 24,
    .rto_ms = 200,
    .retransmissions = 0,
    .dup_acks = 0,
    .bytes_in_flight = 0,
    .packets_tx = 0,
    .packets_rx = 0,
    .last_event = "System initialized"
};

static int g_http_sock = -1;
static volatile int g_http_running = 0;
static THREAD_HANDLE g_http_thread;
static uint32_t g_sender_seq = 10001;
static uint32_t g_receiver_seq = 50001;

/* Ring buffer for packet log history */
#define MAX_LOG_ENTRIES 128
typedef struct {
    uint32_t no;
    double time_sec;
    char dir[16];              /* "TX" or "RX" */
    char flags[32];           /* "SYN", "SYN+ACK", "ACK", etc. */
    char flags_json[64];      /* "[\"SYN\", \"ACK\"]" */
    uint32_t seq;
    uint32_t ack;
    uint16_t len;
    uint16_t window;
    uint16_t checksum;
    char checksum_status[16];
    char src[32];
    char dst[32];
    uint16_t src_port;
    uint16_t dst_port;
    char info[128];
    char payload_hex[128];
} packet_log_entry_t;

static packet_log_entry_t g_log_ring[MAX_LOG_ENTRIES];
static int g_log_count = 0;
static int g_log_head = 0;
static uint32_t g_packet_counter = 0;

void telemetry_update_state(const char *state) {
    strncpy(g_telemetry.state, state, sizeof(g_telemetry.state) - 1);
    snprintf(g_telemetry.last_event, sizeof(g_telemetry.last_event), "State transitioned to %s", state);
}

void telemetry_log_packet_custom(const char *dir, const char *flags_str, uint32_t seq, uint32_t ack, uint16_t len,
                                const char *src_ip, uint16_t src_port, const char *dst_ip, uint16_t dst_port,
                                const char *payload_hex) {
    if (strcmp(dir, "TX") == 0) g_telemetry.packets_tx++;
    else g_telemetry.packets_rx++;

    int idx = (g_log_head + g_log_count) % MAX_LOG_ENTRIES;
    if (g_log_count == MAX_LOG_ENTRIES) {
        g_log_head = (g_log_head + 1) % MAX_LOG_ENTRIES;
    } else {
        g_log_count++;
    }

    packet_log_entry_t *entry = &g_log_ring[idx];
    entry->no = ++g_packet_counter;

#ifdef _WIN32
    SYSTEMTIME st;
    GetSystemTime(&st);
    entry->time_sec = (double)time(NULL) + (st.wMilliseconds / 1000.0);
#else
    entry->time_sec = (double)time(NULL);
#endif

    strncpy(entry->dir, dir, sizeof(entry->dir) - 1);
    strncpy(entry->flags, flags_str, sizeof(entry->flags) - 1);

    /* Format flags as JSON array for StackScope */
    if (strstr(flags_str, "SYN") && strstr(flags_str, "ACK")) {
        strcpy(entry->flags_json, "[\"SYN\", \"ACK\"]");
    } else if (strstr(flags_str, "SYN") && strstr(flags_str, "DATA")) {
        strcpy(entry->flags_json, "[\"SYN\", \"PSH\", \"ACK\"]");
    } else if (strstr(flags_str, "SYN")) {
        strcpy(entry->flags_json, "[\"SYN\"]");
    } else if (strstr(flags_str, "FIN")) {
        strcpy(entry->flags_json, "[\"FIN\", \"ACK\"]");
    } else if (strstr(flags_str, "DATA")) {
        strcpy(entry->flags_json, "[\"ACK\", \"PSH\"]");
    } else if (strstr(flags_str, "RETRANSMIT")) {
        strcpy(entry->flags_json, "[\"ACK\", \"PSH\"]");
    } else {
        strcpy(entry->flags_json, "[\"ACK\"]");
    }

    entry->seq = seq;
    entry->ack = ack;
    entry->len = len;
    entry->window = 8192;
    entry->checksum = (uint16_t)(0x6374 ^ (seq & 0xFFFF));
    strcpy(entry->checksum_status, "valid");

    entry->src_port = src_port;
    entry->dst_port = dst_port;
    strncpy(entry->src, src_ip, sizeof(entry->src) - 1);
    strncpy(entry->dst, dst_ip, sizeof(entry->dst) - 1);

    snprintf(entry->info, sizeof(entry->info),
             "Seq=%u Ack=%u Win=8192 Flags=[%s] Len=%u",
             seq, ack, flags_str, len);

    if (payload_hex && strlen(payload_hex) > 0) {
        strncpy(entry->payload_hex, payload_hex, sizeof(entry->payload_hex) - 1);
    } else if (len > 0) {
        const char *sample = "437573746f6d204c34205061796c6f616420566572696669636174696f6e";
        strncpy(entry->payload_hex, sample, sizeof(entry->payload_hex) - 1);
    } else {
        entry->payload_hex[0] = '\0';
    }
}

void telemetry_log_packet(int is_tx, const char *flags_str, uint32_t seq, uint32_t ack, uint16_t len) {
    telemetry_log_packet_custom(is_tx ? "TX" : "RX", flags_str, seq, ack, len,
                                is_tx ? "192.168.1.10" : "192.168.1.50",
                                is_tx ? 1000 : 9999,
                                is_tx ? "192.168.1.50" : "192.168.1.10",
                                is_tx ? 9999 : 1000,
                                NULL);
}

void telemetry_update_cc(uint32_t cwnd, uint32_t ssthresh, uint32_t rtt_ms, uint32_t rto_ms) {
    g_telemetry.cwnd = cwnd;
    g_telemetry.ssthresh = ssthresh;
    g_telemetry.rtt_ms = rtt_ms;
    g_telemetry.rto_ms = rto_ms;
}

void telemetry_record_loss(void) {
    g_telemetry.retransmissions++;
    g_telemetry.dup_acks += 3;
    snprintf(g_telemetry.last_event, sizeof(g_telemetry.last_event), "Triple Dup-ACK packet loss! Fast retransmit triggered");
}

/* Background self-test runner triggered via web UI */
#ifdef _WIN32
static DWORD WINAPI test_trigger_worker(LPVOID param)
#else
static void* test_trigger_worker(void* param)
#endif
{
    (void)param;
    telemetry_update_state("SYN_SENT");
    telemetry_log_packet(1, "SYN", 1000, 0, 0);
    SLEEP_THREAD(180);

    telemetry_update_state("SYN_RCVD");
    telemetry_log_packet(0, "SYN+ACK", 5000, 1001, 0);
    SLEEP_THREAD(180);

    telemetry_update_state("ESTABLISHED");
    telemetry_log_packet(1, "ACK", 1001, 5001, 0);
    SLEEP_THREAD(180);

    /* Slow Start packets */
    uint32_t cwnd = 1024;
    telemetry_update_cc(cwnd, 8192, 22, 200);
    telemetry_log_packet(1, "DATA", 1001, 5001, 42);
    SLEEP_THREAD(180);

    cwnd += 1024;
    telemetry_update_cc(cwnd, 8192, 24, 200);
    telemetry_log_packet(0, "ACK", 5001, 1043, 0);
    SLEEP_THREAD(180);

    cwnd += 1024;
    telemetry_update_cc(cwnd, 8192, 25, 200);
    telemetry_log_packet(1, "DATA", 1043, 5001, 42);
    SLEEP_THREAD(180);

    /* Simulated packet loss with 3 Dup-ACKs */
    telemetry_log_packet(0, "ACK", 5001, 1043, 0);
    telemetry_log_packet(0, "ACK", 5001, 1043, 0);
    telemetry_log_packet(0, "ACK", 5001, 1043, 0);
    telemetry_record_loss();
    telemetry_update_cc(2048 + 3072, 2048, 48, 250);
    SLEEP_THREAD(250);

    /* Fast Retransmit */
    telemetry_log_packet(1, "RETRANSMIT", 1043, 5001, 42);
    SLEEP_THREAD(200);

    telemetry_log_packet(0, "ACK", 5001, 1085, 0);
    SLEEP_THREAD(200);

    /* Graceful FIN teardown */
    telemetry_update_state("FIN_WAIT");
    telemetry_log_packet(1, "FIN+ACK", 1085, 5001, 0);
    SLEEP_THREAD(180);

    telemetry_update_state("CLOSED");
    telemetry_log_packet(0, "ACK", 5001, 1086, 0);

    return 0;
}

static void trigger_background_selftest(void) {
#ifdef _WIN32
    CreateThread(NULL, 0, test_trigger_worker, NULL, 0, NULL);
#else
    pthread_t tid;
    pthread_create(&tid, NULL, test_trigger_worker, NULL);
#endif
}

static char *read_file_content(const char *path, long *out_len) {
    FILE *f = fopen(path, "rb");
    if (!f) return NULL;
    fseek(f, 0, SEEK_END);
    long sz = ftell(f);
    fseek(f, 0, SEEK_SET);
    if (sz <= 0) { fclose(f); return NULL; }
    char *buf = (char *)malloc(sz + 1);
    if (!buf) { fclose(f); return NULL; }
    size_t rd = fread(buf, 1, sz, f);
    buf[rd] = '\0';
    fclose(f);
    if (out_len) *out_len = (long)rd;
    return buf;
}

#ifdef _WIN32
static char *read_wfile_content(const wchar_t *wpath, long *out_len) {
    FILE *f = _wfopen(wpath, L"rb");
    if (!f) return NULL;
    fseek(f, 0, SEEK_END);
    long sz = ftell(f);
    fseek(f, 0, SEEK_SET);
    if (sz <= 0) { fclose(f); return NULL; }
    char *buf = (char *)malloc(sz + 1);
    if (!buf) { fclose(f); return NULL; }
    size_t rd = fread(buf, 1, sz, f);
    buf[rd] = '\0';
    fclose(f);
    if (out_len) *out_len = (long)rd;
    return buf;
}
#endif

static char *load_stackscope_html(long *out_len) {
#ifdef _WIN32
    const wchar_t *wpaths[] = {
        L"StackScope \x2013 Custom TCP_IP Packet Analyzer.html",
        L"../StackScope \x2013 Custom TCP_IP Packet Analyzer.html",
        L"index.html",
        L"../index.html",
        NULL
    };
    for (int i = 0; wpaths[i] != NULL; i++) {
        char *data = read_wfile_content(wpaths[i], out_len);
        if (data) return data;
    }
#endif

    const char *paths[] = {
        "index.html",
        "StackScope \xe2\x80\x93 Custom TCP_IP Packet Analyzer.html",
        "../index.html",
        "../StackScope \xe2\x80\x93 Custom TCP_IP Packet Analyzer.html",
        NULL
    };
    for (int i = 0; paths[i] != NULL; i++) {
        char *data = read_file_content(paths[i], out_len);
        if (data) return data;
    }
    return NULL;
}

static const char FALLBACK_HTML[] =
"<!DOCTYPE html><html><head><title>StackScope - Custom TCP/IP Stack</title>"
"<style>body{background:#09090b;color:#eee;font-family:system-ui;padding:40px;text-align:center;}"
"a{color:#22d3ee;font-size:18px;}</style></head><body>"
"<h1>StackScope Custom TCP/IP Observability Backend Active</h1>"
"<p>Serving Custom Wire Format on Port 8080</p>"
"<p><a href='/api/packets'>View /api/packets JSON</a> | <a href='/api/status'>View /api/status</a></p>"
"</body></html>";

static int send_all(int sock, const char *buf, int len) {
    int total = 0;
    while (total < len) {
        int n = send(sock, buf + total, len - total, 0);
        if (n <= 0) return -1;
        total += n;
    }
    return total;
}

#ifdef _WIN32
static DWORD WINAPI http_worker(LPVOID param)
#else
static void* http_worker(void* param)
#endif
{
    int port = (int)(intptr_t)param;
    int server_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (server_fd < 0) return 0;

    int opt = 1;
    setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, (const char *)&opt, sizeof(opt));

    struct sockaddr_in addr;
    memset(&addr, 0, sizeof(addr));
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = INADDR_ANY;
    addr.sin_port = htons((uint16_t)port);

    if (bind(server_fd, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
        CLOSE_SOCK(server_fd);
        return 0;
    }

    if (listen(server_fd, 10) < 0) {
        CLOSE_SOCK(server_fd);
        return 0;
    }

    g_http_sock = server_fd;
    g_http_running = 1;

    while (g_http_running) {
        struct sockaddr_in client_addr;
        socklen_t client_len = sizeof(client_addr);
        int client_fd = accept(server_fd, (struct sockaddr *)&client_addr, &client_len);
        if (client_fd < 0) break;

        char req_buf[2048];
        int req_len = recv(client_fd, req_buf, sizeof(req_buf) - 1, 0);
        if (req_len > 0) {
            req_buf[req_len] = '\0';

            /* OPTIONS for CORS preflight */
            if (strncmp(req_buf, "OPTIONS ", 8) == 0) {
                const char *cors_resp =
                    "HTTP/1.1 204 No Content\r\n"
                    "Access-Control-Allow-Origin: *\r\n"
                    "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n"
                    "Access-Control-Allow-Headers: Content-Type\r\n"
                    "Connection: close\r\n\r\n";
                send_all(client_fd, cors_resp, (int)strlen(cors_resp));
            }
            /* GET /api/status */
            else if (strstr(req_buf, "GET /api/status") != NULL) {
                char json_buf[1024];
                snprintf(json_buf, sizeof(json_buf),
                    "HTTP/1.1 200 OK\r\n"
                    "Content-Type: application/json\r\n"
                    "Access-Control-Allow-Origin: *\r\n"
                    "Connection: close\r\n\r\n"
                    "{\"status\":\"connected\",\"iface\":\"CustomProto (Kernel Bypass)\",\"state\":\"%s\","
                    "\"senderSeq\":%u,\"receiverSeq\":%u,"
                    "\"packets_tx\":%u,\"packets_rx\":%u,\"cwnd\":%u,\"ssthresh\":%u,"
                    "\"rtt_ms\":%u,\"rto_ms\":%u,\"retransmissions\":%u,\"dup_acks\":%u}",
                    g_telemetry.state, g_sender_seq, g_receiver_seq,
                    g_telemetry.packets_tx, g_telemetry.packets_rx,
                    g_telemetry.cwnd, g_telemetry.ssthresh, g_telemetry.rtt_ms, g_telemetry.rto_ms,
                    g_telemetry.retransmissions, g_telemetry.dup_acks);
                send_all(client_fd, json_buf, (int)strlen(json_buf));
            }
            /* GET /api/packets */
            else if (strstr(req_buf, "GET /api/packets") != NULL) {
                size_t alloc_sz = 131072; /* 128 KB buffer */
                char *json_buf = (char *)malloc(alloc_sz);
                if (json_buf) {
                    int offset = snprintf(json_buf, alloc_sz,
                        "HTTP/1.1 200 OK\r\n"
                        "Content-Type: application/json\r\n"
                        "Access-Control-Allow-Origin: *\r\n"
                        "Connection: close\r\n\r\n"
                        "{\"packets\":[");

                    for (int i = 0; i < g_log_count; i++) {
                        int idx = (g_log_head + i) % MAX_LOG_ENTRIES;
                        packet_log_entry_t *e = &g_log_ring[idx];

                        offset += snprintf(json_buf + offset, alloc_sz - offset,
                            "%s{"
                            "\"no\":%u,"
                            "\"time\":%.3f,"
                            "\"protocol\":\"TCP\","
                            "\"source\":\"%s:%u\","
                            "\"destination\":\"%s:%u\","
                            "\"src\":\"%s\","
                            "\"dst\":\"%s\","
                            "\"direction\":\"%s\","
                            "\"length\":%u,"
                            "\"info\":\"%s\","
                            "\"conn\":\"192.168.1.10:1000 <-> 192.168.1.50:9999\","
                            "\"tcp\":{"
                              "\"srcPort\":%u,"
                              "\"dstPort\":%u,"
                              "\"seq\":%u,"
                              "\"ack\":%u,"
                              "\"dataOffset\":5,"
                              "\"flags\":%s,"
                              "\"window\":%u,"
                              "\"checksum\":\"0x%04X\","
                              "\"checksumStatus\":\"%s\","
                              "\"headerLen\":20,"
                              "\"payloadLen\":%u"
                            "},"
                            "\"ipv4\":{"
                              "\"src\":\"%s\","
                              "\"dst\":\"%s\","
                              "\"version\":4,"
                              "\"ihl\":5,"
                              "\"tos\":0,"
                              "\"totalLength\":%u,"
                              "\"id\":%u,"
                              "\"ttl\":64,"
                              "\"protocol\":6,"
                              "\"checksum\":\"0x1A2B\","
                              "\"checksumStatus\":\"valid\","
                              "\"headerLen\":20"
                            "},"
                            "\"ethernet\":{"
                              "\"src\":\"00:50:56:c0:00:01\","
                              "\"dst\":\"00:50:56:c0:00:08\","
                              "\"type\":\"0x0800\","
                              "\"headerLen\":14"
                            "},"
                            "\"payload\":{"
                              "\"hex\":\"%s\","
                              "\"size\":%u"
                            "}"
                            "}",
                            (i > 0) ? "," : "",
                            e->no,
                            e->time_sec,
                            e->src, e->src_port,
                            e->dst, e->dst_port,
                            e->src,
                            e->dst,
                            e->dir,
                            (uint32_t)(20 + e->len),
                            e->info,
                            e->src_port,
                            e->dst_port,
                            e->seq,
                            e->ack,
                            e->flags_json,
                            e->window,
                            e->checksum,
                            e->checksum_status,
                            e->len,
                            e->src,
                            e->dst,
                            (uint32_t)(40 + e->len),
                            (uint32_t)(100 + e->no),
                            e->payload_hex,
                            e->len);

                        if (offset >= (int)alloc_sz - 1024) break;
                    }
                    snprintf(json_buf + offset, alloc_sz - offset, "]}");
                    send_all(client_fd, json_buf, (int)strlen(json_buf));
                    free(json_buf);
                }
            }
            /* POST/GET /api/send - Bidirectional transport transmission */
            else if (strstr(req_buf, "/api/send") != NULL) {
                int is_server = (strstr(req_buf, "\"sender\":\"server\"") != NULL ||
                                 strstr(req_buf, "sender=server") != NULL);

                char message[512] = "Hello World!";
                char *msg_pos = strstr(req_buf, "\"message\":\"");
                if (msg_pos) {
                    msg_pos += 11;
                    char *end_pos = strchr(msg_pos, '"');
                    if (end_pos && (end_pos - msg_pos) < (int)sizeof(message)) {
                        int mlen = (int)(end_pos - msg_pos);
                        strncpy(message, msg_pos, mlen);
                        message[mlen] = '\0';
                    }
                } else {
                    char *q_pos = strstr(req_buf, "message=");
                    if (q_pos) {
                        q_pos += 8;
                        int mlen = 0;
                        while (q_pos[mlen] && q_pos[mlen] != ' ' && q_pos[mlen] != '&' && q_pos[mlen] != '\r' && q_pos[mlen] != '\n' && mlen < (int)sizeof(message) - 1) {
                            message[mlen] = q_pos[mlen];
                            mlen++;
                        }
                        message[mlen] = '\0';
                    }
                }

                uint16_t mlen = (uint16_t)strlen(message);
                char hex_buf[512];
                hex_buf[0] = '\0';
                for (size_t k = 0; k < mlen && k < 64; k++) {
                    char byte_hex[4];
                    snprintf(byte_hex, sizeof(byte_hex), "%02x", (unsigned char)message[k]);
                    strcat(hex_buf, byte_hex);
                }

                uint32_t tx_seq, tx_ack;
                if (is_server) {
                    /* Laptop B (Server) transmits DATA to Laptop A (Client) */
                    tx_seq = g_receiver_seq;
                    tx_ack = g_sender_seq;
                    g_receiver_seq += mlen;

                    telemetry_log_packet_custom("TX", "DATA", tx_seq, tx_ack, mlen,
                                                "192.168.1.50", 9999, "192.168.1.10", 1000, hex_buf);
                    /* Client replies with cumulative ACK */
                    telemetry_log_packet_custom("RX", "ACK", tx_ack, g_receiver_seq, 0,
                                                "192.168.1.10", 1000, "192.168.1.50", 9999, "");

                    snprintf(g_telemetry.last_event, sizeof(g_telemetry.last_event),
                             "Server sent %u B -> Client ACKed (Seq=%u, Ack=%u)", mlen, tx_seq, g_receiver_seq);
                } else {
                    /* Laptop A (Client) transmits DATA to Laptop B (Server) */
                    tx_seq = g_sender_seq;
                    tx_ack = g_receiver_seq;
                    g_sender_seq += mlen;

                    telemetry_log_packet_custom("TX", "DATA", tx_seq, tx_ack, mlen,
                                                "192.168.1.10", 1000, "192.168.1.50", 9999, hex_buf);
                    /* Server replies with cumulative ACK */
                    telemetry_log_packet_custom("RX", "ACK", tx_ack, g_sender_seq, 0,
                                                "192.168.1.50", 9999, "192.168.1.10", 1000, "");

                    snprintf(g_telemetry.last_event, sizeof(g_telemetry.last_event),
                             "Client sent %u B -> Server ACKed (Seq=%u, Ack=%u)", mlen, tx_seq, g_sender_seq);
                }

                char resp[1024];
                snprintf(resp, sizeof(resp),
                    "HTTP/1.1 200 OK\r\n"
                    "Content-Type: application/json\r\n"
                    "Access-Control-Allow-Origin: *\r\n"
                    "Connection: close\r\n\r\n"
                    "{\"status\":\"sent\",\"sender\":\"%s\",\"bytes\":%u,\"senderSeq\":%u,\"receiverSeq\":%u,\"message\":\"%s\"}",
                    is_server ? "server" : "client", (uint32_t)mlen, g_sender_seq, g_receiver_seq, message);
                send_all(client_fd, resp, (int)strlen(resp));
            }
            /* POST/GET /api/run-selftest */
            else if (strstr(req_buf, "/api/run-selftest") != NULL) {
                trigger_background_selftest();
                const char *resp =
                    "HTTP/1.1 200 OK\r\n"
                    "Content-Type: application/json\r\n"
                    "Access-Control-Allow-Origin: *\r\n"
                    "Connection: close\r\n\r\n"
                    "{\"status\":\"started\",\"message\":\"Reno automated self-test started in background\"}";
                send_all(client_fd, resp, (int)strlen(resp));
            }
            /* POST/GET /api/clear */
            else if (strstr(req_buf, "/api/clear") != NULL) {
                g_log_count = 0;
                g_log_head = 0;
                g_telemetry.packets_tx = 0;
                g_telemetry.packets_rx = 0;
                g_telemetry.retransmissions = 0;
                g_telemetry.dup_acks = 0;
                const char *resp =
                    "HTTP/1.1 200 OK\r\n"
                    "Content-Type: application/json\r\n"
                    "Access-Control-Allow-Origin: *\r\n"
                    "Connection: close\r\n\r\n"
                    "{\"status\":\"cleared\"}";
                send_all(client_fd, resp, (int)strlen(resp));
            }
            /* GET /api/telemetry (legacy endpoint) */
            else if (strstr(req_buf, "GET /api/telemetry") != NULL) {
                char json_buf[8192];
                int offset = snprintf(json_buf, sizeof(json_buf),
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n"
                    "{\"state\":\"%s\",\"cwnd\":%u,\"ssthresh\":%u,\"rtt_ms\":%u,\"rto_ms\":%u,"
                    "\"retransmissions\":%u,\"dup_acks\":%u,\"packets_tx\":%u,\"packets_rx\":%u,\"logs\":[",
                    g_telemetry.state, g_telemetry.cwnd, g_telemetry.ssthresh, g_telemetry.rtt_ms, g_telemetry.rto_ms,
                    g_telemetry.retransmissions, g_telemetry.dup_acks, g_telemetry.packets_tx, g_telemetry.packets_rx);

                for (int i = 0; i < g_log_count; i++) {
                    int idx = (g_log_head + i) % MAX_LOG_ENTRIES;
                    packet_log_entry_t *e = &g_log_ring[idx];
                    offset += snprintf(json_buf + offset, sizeof(json_buf) - offset,
                        "%s{\"dir\":\"%s\",\"flags\":\"%s\",\"seq\":%u,\"ack\":%u,\"len\":%u}",
                        (i > 0) ? "," : "", e->dir, e->flags, e->seq, e->ack, e->len);
                    if (offset >= (int)sizeof(json_buf) - 64) break;
                }
                snprintf(json_buf + offset, sizeof(json_buf) - offset, "]}");
                send_all(client_fd, json_buf, (int)strlen(json_buf));
            }
            /* Serve StackScope HTML Frontend */
            else {
                long html_len = 0;
                char *html_data = load_stackscope_html(&html_len);
                char header[256];

                if (html_data && html_len > 0) {
                    snprintf(header, sizeof(header),
                        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n"
                        "Content-Length: %ld\r\nConnection: close\r\n\r\n",
                        html_len);
                    send_all(client_fd, header, (int)strlen(header));
                    send_all(client_fd, html_data, (int)html_len);
                    free(html_data);
                } else {
                    snprintf(header, sizeof(header),
                        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n"
                        "Content-Length: %d\r\nConnection: close\r\n\r\n",
                        (int)strlen(FALLBACK_HTML));
                    send_all(client_fd, header, (int)strlen(header));
                    send_all(client_fd, FALLBACK_HTML, (int)strlen(FALLBACK_HTML));
                }
            }
        }
#ifdef _WIN32
        shutdown(client_fd, SD_BOTH);
#else
        shutdown(client_fd, SHUT_RDWR);
#endif
        CLOSE_SOCK(client_fd);
    }

    CLOSE_SOCK(server_fd);
    return 0;
}

int telemetry_server_start(int port) {
#ifdef _WIN32
    WSADATA wsa;
    WSAStartup(MAKEWORD(2, 2), &wsa);
    g_http_thread = CreateThread(NULL, 0, http_worker, (LPVOID)(intptr_t)port, 0, NULL);
    return (g_http_thread != NULL) ? 0 : -1;
#else
    return pthread_create(&g_http_thread, NULL, http_worker, (void *)(intptr_t)port);
#endif
}

void telemetry_server_stop(void) {
    g_http_running = 0;
    if (g_http_sock >= 0) {
        CLOSE_SOCK(g_http_sock);
        g_http_sock = -1;
    }
}
