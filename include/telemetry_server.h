#ifndef TELEMETRY_SERVER_H
#define TELEMETRY_SERVER_H

#include <stdint.h>

typedef struct {
    char state[32];
    uint32_t cwnd;
    uint32_t ssthresh;
    uint32_t rtt_ms;
    uint32_t rto_ms;
    uint32_t retransmissions;
    uint32_t dup_acks;
    uint32_t bytes_in_flight;
    uint32_t packets_tx;
    uint32_t packets_rx;
    char last_event[128];
} telemetry_data_t;

/* Global telemetry instance */
extern telemetry_data_t g_telemetry;

/* Start HTTP telemetry server on specified port (e.g. 8080) in a background thread */
int telemetry_server_start(int port);

/* Update telemetry metrics */
void telemetry_update_state(const char *state);
void telemetry_log_packet(int is_tx, const char *flags_str, uint32_t seq, uint32_t ack, uint16_t len);
void telemetry_update_cc(uint32_t cwnd, uint32_t ssthresh, uint32_t rtt_ms, uint32_t rto_ms);
void telemetry_record_loss(void);

/* Stop telemetry server */
void telemetry_server_stop(void);

#endif /* TELEMETRY_SERVER_H */
