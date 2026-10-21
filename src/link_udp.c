#include "../include/link_udp.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#ifdef _WIN32
  #include <winsock2.h>
  #include <ws2tcpip.h>
  typedef int socklen_t;
  #define CLOSE_SOCKET(s) closesocket(s)
#else
  #include <unistd.h>
  #include <fcntl.h>
  #include <sys/types.h>
  #include <sys/socket.h>
  #include <netinet/in.h>
  #include <arpa/inet.h>
  #define SOCKET int
  #define INVALID_SOCKET -1
  #define SOCKET_ERROR -1
  #define CLOSE_SOCKET(s) close(s)
#endif

static SOCKET g_sock = INVALID_SOCKET;
static struct sockaddr_in g_peer_addr;
static int g_has_peer = 0;
static int g_loss_rate = 0; /* Loss percentage: 0 to 100 */

int link_init(int local_port, const char *peer_ip, int peer_port) {
#ifdef _WIN32
    WSADATA wsa;
    if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) {
        fprintf(stderr, "[Link] Failed to initialize Winsock.\n");
        return -1;
    }
#endif

    g_sock = socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP);
    if (g_sock == INVALID_SOCKET) {
        fprintf(stderr, "[Link] Failed to create UDP socket.\n");
        return -1;
    }

    /* Configure SO_REUSEADDR */
    int opt = 1;
    setsockopt(g_sock, SOL_SOCKET, SO_REUSEADDR, (const char *)&opt, sizeof(opt));

    /* Bind to local port */
    struct sockaddr_in local_addr;
    memset(&local_addr, 0, sizeof(local_addr));
    local_addr.sin_family = AF_INET;
    local_addr.sin_addr.s_addr = INADDR_ANY;
    local_addr.sin_port = htons((uint16_t)local_port);

    if (bind(g_sock, (struct sockaddr *)&local_addr, sizeof(local_addr)) == SOCKET_ERROR) {
        fprintf(stderr, "[Link] Failed to bind local port %d.\n", local_port);
        CLOSE_SOCKET(g_sock);
        g_sock = INVALID_SOCKET;
        return -1;
    }

    /* Set non-blocking mode */
#ifdef _WIN32
    u_long non_blocking = 1;
    ioctlsocket(g_sock, FIONBIO, &non_blocking);
#else
    int flags = fcntl(g_sock, F_GETFL, 0);
    fcntl(g_sock, F_SETFL, flags | O_NONBLOCK);
#endif

    /* Configure peer destination if provided */
    if (peer_ip && peer_port > 0) {
        memset(&g_peer_addr, 0, sizeof(g_peer_addr));
        g_peer_addr.sin_family = AF_INET;
        g_peer_addr.sin_port = htons((uint16_t)peer_port);
        g_peer_addr.sin_addr.s_addr = inet_addr(peer_ip);
        if (g_peer_addr.sin_addr.s_addr == INADDR_NONE) {
            fprintf(stderr, "[Link] Invalid peer IP format: %s\n", peer_ip);
            return -1;
        }
        g_has_peer = 1;
    }

    /* Seed random generator for simulated loss */
    srand((unsigned int)time(NULL));

    return 0;
}

void link_set_loss_rate(int percent) {
    if (percent < 0) percent = 0;
    if (percent > 100) percent = 100;
    g_loss_rate = percent;
}

int link_get_loss_rate(void) {
    return g_loss_rate;
}

int link_send_frame(const void *frame_data, size_t len) {
    if (g_sock == INVALID_SOCKET || !g_has_peer) {
        return -1;
    }

    /* Simulated packet loss injection */
    if (g_loss_rate > 0) {
        int r = rand() % 100;
        if (r < g_loss_rate) {
            printf("   [SIMULATED LOSS] >>> Packet dropped intentionally (%d%% loss configured)\n", g_loss_rate);
            return (int)len; /* Return success to sender to simulate drop on the wire */
        }
    }

    int sent = sendto(g_sock, (const char *)frame_data, (int)len, 0,
                      (struct sockaddr *)&g_peer_addr, sizeof(g_peer_addr));
    return sent;
}

int link_recv_frame(void *out_buffer, size_t max_len) {
    if (g_sock == INVALID_SOCKET) {
        return -1;
    }

    struct sockaddr_in from_addr;
    socklen_t from_len = sizeof(from_addr);

    int received = recvfrom(g_sock, (char *)out_buffer, (int)max_len, 0,
                            (struct sockaddr *)&from_addr, &from_len);

    if (received > 0) {
        /* If we did not have a fixed peer (e.g., listening server), learn peer's address dynamically! */
        if (!g_has_peer) {
            memcpy(&g_peer_addr, &from_addr, sizeof(from_addr));
            g_has_peer = 1;
            char *ip_str = inet_ntoa(g_peer_addr.sin_addr);
            printf("   [Link] Associated with remote peer %s:%d\n", ip_str, ntohs(g_peer_addr.sin_port));
        }
        return received;
    }

    return 0; /* No packet waiting (non-blocking) */
}

void link_close(void) {
    if (g_sock != INVALID_SOCKET) {
        CLOSE_SOCKET(g_sock);
        g_sock = INVALID_SOCKET;
    }
#ifdef _WIN32
    WSACleanup();
#endif
    g_has_peer = 0;
}
