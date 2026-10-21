#ifndef LINK_OPS_H
#define LINK_OPS_H

#include <stdint.h>
#include <stddef.h>

#define MAX_FRAME_LEN 1500

/* Preallocated frame structure for zero-allocation hot paths */
typedef struct frame {
    uint8_t  data[MAX_FRAME_LEN];
    uint16_t len;
    uint64_t rx_timestamp_ns;   /* Hardware / kernel timestamp if available */
    void    *priv;              /* Buffer pool metadata or packet descriptor */
} frame_t;

typedef struct link link_t;

/* Pluggable Link Layer Interface
 * Allows swapping between UDP overlay, Linux TAP, AF_XDP, and loopback simulation
 */
typedef struct {
    const char *name;
    int  (*open)(link_t *lnk, const char *cfg);
    int  (*rx_burst)(link_t *lnk, frame_t **out, int max);
    int  (*tx_burst)(link_t *lnk, frame_t **in, int n);
    void (*release)(link_t *lnk, frame_t *f);
    void (*close)(link_t *lnk);
} link_ops_t;

struct link {
    const link_ops_t *ops;
    void             *ctx;      /* Driver-specific context (socket fd, tap fd, xsk ring) */
    int               is_open;
};

#endif /* LINK_OPS_H */
