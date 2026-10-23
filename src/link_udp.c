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

typedef struct {
    SOCKET sock;
    struct sockaddr_in peer_addr;
    int has_peer;
    int is_listener;
    int local_port;
} link_endpoint_t;

static link_handle_t g_default_endpoint = NULL;
static int g_loss_rate = 0; /* Loss percentage: 0 to 100 */
static int g_winsock_initialized = 0;

static int ensure_winsock(void) {
#ifdef _WIN32
    if (!g_winsock_initialized) {
        WSADATA wsa;
        if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) {
            fprintf(stderr, "[Link] Failed to initialize Winsock.\n");
            return -1;
        }
        g_winsock_initialized = 1;
    }
#endif
    return 0;
}

link_handle_t link_create(int local_port, const char *peer_ip, int peer_port) {
    if (ensure_winsock() != 0) return NULL;

    link_endpoint_t *ep = (link_endpoint_t *)malloc(sizeof(link_endpoint_t));
    if (!ep) return NULL;
    memset(ep, 0, sizeof(link_endpoint_t));
    ep->sock = INVALID_SOCKET;

    ep->sock = socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP);
    if (ep->sock == INVALID_SOCKET) {
        fprintf(stderr, "[Link] Failed to create UDP socket.\n");
        free(ep);
        return NULL;
    }

    /* Configure SO_REUSEADDR */
    int opt = 1;
    setsockopt(ep->sock, SOL_SOCKET, SO_REUSEADDR, (const char *)&opt, sizeof(opt));

    /* Bind to local port. If requested port is busy, auto-try next available port */
    struct sockaddr_in local_addr;
    memset(&local_addr, 0, sizeof(local_addr));
    local_addr.sin_family = AF_INET;
    local_addr.sin_addr.s_addr = INADDR_ANY;

    int bound = 0;
    int try_port = local_port;
    int max_attempts = (local_port > 0) ? 50 : 1;

    for (int attempt = 0; attempt < max_attempts; attempt++) {
        local_addr.sin_port = htons((uint16_t)try_port);
        if (bind(ep->sock, (struct sockaddr *)&local_addr, sizeof(local_addr)) != SOCKET_ERROR) {
            bound = 1;
            break;
        }
        if (local_port == 0) break;
        try_port = (local_port > 1024) ? (local_port - 1 - attempt) : (local_port + 1 + attempt);
    }

    if (!bound) {
        fprintf(stderr, "[Link] Failed to bind local port %d (and subsequent alternatives).\n", local_port);
        CLOSE_SOCKET(ep->sock);
        free(ep);
        return NULL;
    }

    /* Discover actual bound port */
    socklen_t addr_len = sizeof(local_addr);
    if (getsockname(ep->sock, (struct sockaddr *)&local_addr, &addr_len) == 0) {
        ep->local_port = ntohs(local_addr.sin_port);
    } else {
        ep->local_port = try_port;
    }

    /* Set non-blocking mode */
#ifdef _WIN32
    u_long non_blocking = 1;
    ioctlsocket(ep->sock, FIONBIO, &non_blocking);
#else
    int flags = fcntl(ep->sock, F_GETFL, 0);
    fcntl(ep->sock, F_SETFL, flags | O_NONBLOCK);
#endif

    /* Configure peer destination if provided */
    if (peer_ip && peer_port > 0) {
        memset(&ep->peer_addr, 0, sizeof(ep->peer_addr));
        ep->peer_addr.sin_family = AF_INET;
        ep->peer_addr.sin_port = htons((uint16_t)peer_port);
        ep->peer_addr.sin_addr.s_addr = inet_addr(peer_ip);
        if (ep->peer_addr.sin_addr.s_addr == INADDR_NONE) {
            fprintf(stderr, "[Link] Invalid peer IP format: %s\n", peer_ip);
            CLOSE_SOCKET(ep->sock);
            free(ep);
            return NULL;
        }
        ep->has_peer = 1;
        ep->is_listener = 0;
    } else {
        ep->is_listener = 1;
    }

    return (link_handle_t)ep;
}

int link_send(link_handle_t h, const void *frame_data, size_t len) {
    if (!h) return -1;
    link_endpoint_t *ep = (link_endpoint_t *)h;
    if (ep->sock == INVALID_SOCKET || !ep->has_peer) return -1;

    /* Simulated packet loss injection */
    if (g_loss_rate > 0) {
        int r = rand() % 100;
        if (r < g_loss_rate) {
            printf("   [SIMULATED LOSS] >>> Packet dropped intentionally (%d%% loss configured)\n", g_loss_rate);
            return (int)len; /* Return success to simulate drop on wire */
        }
    }

    return sendto(ep->sock, (const char *)frame_data, (int)len, 0,
                  (struct sockaddr *)&ep->peer_addr, sizeof(ep->peer_addr));
}

int link_recv(link_handle_t h, void *out_buffer, size_t max_len) {
    if (!h) return -1;
    link_endpoint_t *ep = (link_endpoint_t *)h;
    if (ep->sock == INVALID_SOCKET) return -1;

    struct sockaddr_in from_addr;
    socklen_t from_len = sizeof(from_addr);

    int received = recvfrom(ep->sock, (char *)out_buffer, (int)max_len, 0,
                            (struct sockaddr *)&from_addr, &from_len);

    if (received > 0) {
        if (!ep->has_peer || ep->is_listener) {
            memcpy(&ep->peer_addr, &from_addr, sizeof(from_addr));
            if (!ep->has_peer) {
                ep->has_peer = 1;
                char *ip_str = inet_ntoa(ep->peer_addr.sin_addr);
                printf("   [Link] Associated with remote peer %s:%d\n", ip_str, ntohs(ep->peer_addr.sin_port));
            }
        }
        return received;
    }

    return 0; /* Non-blocking: no packet waiting */
}

int link_get_peer(link_handle_t h, char *out_ip, int *out_port) {
    if (!h) return -1;
    link_endpoint_t *ep = (link_endpoint_t *)h;
    if (!ep->has_peer) return -1;

    if (out_ip) {
        char *ip_str = inet_ntoa(ep->peer_addr.sin_addr);
        if (ip_str) strcpy(out_ip, ip_str);
    }
    if (out_port) {
        *out_port = ntohs(ep->peer_addr.sin_port);
    }
    return 0;
}

int link_get_local_port(link_handle_t h) {
    if (!h) return -1;
    link_endpoint_t *ep = (link_endpoint_t *)h;
    return ep->local_port;
}

void link_destroy(link_handle_t h) {
    if (!h) return;
    link_endpoint_t *ep = (link_endpoint_t *)h;
    if (ep->sock != INVALID_SOCKET) {
        CLOSE_SOCKET(ep->sock);
        ep->sock = INVALID_SOCKET;
    }
    free(ep);
}

void link_set_loss_rate(int percent) {
    if (percent < 0) percent = 0;
    if (percent > 100) percent = 100;
    g_loss_rate = percent;
}

int link_get_loss_rate(void) {
    return g_loss_rate;
}

/* Legacy single-socket API for backward compatibility */
int link_init(int local_port, const char *peer_ip, int peer_port) {
    if (g_default_endpoint) {
        link_destroy(g_default_endpoint);
        g_default_endpoint = NULL;
    }
    g_default_endpoint = link_create(local_port, peer_ip, peer_port);
    return g_default_endpoint ? 0 : -1;
}

int link_send_frame(const void *frame_data, size_t len) {
    return link_send(g_default_endpoint, frame_data, len);
}

int link_recv_frame(void *out_buffer, size_t max_len) {
    return link_recv(g_default_endpoint, out_buffer, max_len);
}

void link_close(void) {
    if (g_default_endpoint) {
        link_destroy(g_default_endpoint);
        g_default_endpoint = NULL;
    }
}
