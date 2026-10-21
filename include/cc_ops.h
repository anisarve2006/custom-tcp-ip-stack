#ifndef CC_OPS_H
#define CC_OPS_H

#include <stdint.h>
#include <stddef.h>

typedef enum {
    LOSS_DUP_ACK_3,     /* 3 Duplicate ACKs (Fast Retransmit) */
    LOSS_RTO_TIMEOUT,   /* Full retransmission timeout expired */
    LOSS_SACK_HOLE      /* SACK-identified packet drop */
} loss_kind_t;

typedef struct conn conn_t;

/* Pluggable Congestion Control Interface
 * Enables live algorithm switching between Reno, NewReno, CUBIC, and BBR-lite
 */
typedef struct {
    const char *name;
    void     (*init)(conn_t *c, uint32_t init_mss);
    void     (*on_ack)(conn_t *c, uint32_t acked_bytes, uint32_t rtt_us);
    void     (*on_dup_ack)(conn_t *c);
    void     (*on_loss)(conn_t *c, loss_kind_t kind);
    uint32_t (*get_cwnd)(conn_t *c);
    uint32_t (*get_ssthresh)(conn_t *c);
    uint64_t (*get_pacing_rate)(conn_t *c); /* Bytes per second for link pacing */
} cc_ops_t;

/* Generic connection abstraction holding transport & CC state */
struct conn {
    uint32_t cwnd;           /* Current congestion window (bytes) */
    uint32_t ssthresh;       /* Slow start threshold (bytes) */
    uint32_t mss;            /* Maximum segment size */
    uint32_t srtt_us;        /* Smoothed RTT in microseconds */
    uint32_t rttvar_us;      /* RTT variation in microseconds */
    uint32_t rto_ms;         /* Retransmission timeout in milliseconds */
    uint32_t dup_ack_count;  /* Consecutive duplicate ACK counter */
    uint64_t pacing_rate;    /* Current pacing rate in bytes/sec */
    const cc_ops_t *cc;      /* Active congestion control algorithm */
    void     *cc_priv;       /* Algorithm-specific state (e.g., CUBIC epoch parameters) */
};

#endif /* CC_OPS_H */
