#ifndef LINK_UDP_H
#define LINK_UDP_H

#include <stddef.h>
#include <stdint.h>

#define MAX_FRAME_SIZE 2048

/* Initialize the link layer for Wi-Fi / Internet / Local communication */
int link_init(int local_port, const char *peer_ip, int peer_port);

/* Send raw frame to configured peer */
int link_send_frame(const void *frame_data, size_t len);

/* Receive incoming raw frame (non-blocking). Returns bytes received, 0 if no packet, or -1 on error */
int link_recv_frame(void *out_buffer, size_t max_len);

/* Artificial packet loss rate (0 to 100) for testing Reno congestion control and loss recovery */
void link_set_loss_rate(int percent);
int link_get_loss_rate(void);

/* Clean up link layer */
void link_close(void);

#endif /* LINK_UDP_H */
