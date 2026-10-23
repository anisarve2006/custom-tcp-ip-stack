#ifndef LINK_UDP_H
#define LINK_UDP_H

#include <stddef.h>
#include <stdint.h>

#define MAX_FRAME_SIZE 2048

typedef void *link_handle_t;

/* Multi-connection handle-based API */
link_handle_t link_create(int local_port, const char *peer_ip, int peer_port);
int link_send(link_handle_t h, const void *frame_data, size_t len);
int link_recv(link_handle_t h, void *out_buffer, size_t max_len);
int link_get_peer(link_handle_t h, char *out_ip, int *out_port);
int link_get_local_port(link_handle_t h);
void link_destroy(link_handle_t h);

/* Legacy single-socket API (backward compatible) */
int link_init(int local_port, const char *peer_ip, int peer_port);
int link_send_frame(const void *frame_data, size_t len);
int link_recv_frame(void *out_buffer, size_t max_len);
void link_set_loss_rate(int percent);
int link_get_loss_rate(void);
void link_close(void);

#endif /* LINK_UDP_H */
