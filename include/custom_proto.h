#ifndef CUSTOM_PROTO_H
#define CUSTOM_PROTO_H

#include <stdint.h>
#include <stddef.h>

#define MYPROTO_MAGIC        0xCAFE  /* 16-bit magic identifier to verify protocol authenticity */
#define MYPROTO_VERSION      1
#define MYPROTO_DEFAULT_MSS  1400    /* Sized to fit 1500B MTU without IP fragmentation (1500 - 20 IP - 8 UDP - 20 Nexus = 1452B) */
#define MYPROTO_DEFAULT_WND  65535   /* 64 KB advertised receive window */

/* Protocol Flags */
#define FLAG_SYN   (1 << 0)  /* Synchronize sequence numbers */
#define FLAG_ACK   (1 << 1)  /* Acknowledgment field is valid */
#define FLAG_DATA  (1 << 2)  /* Packet carries application data payload */
#define FLAG_FIN   (1 << 3)  /* Graceful connection teardown */
#define FLAG_RST   (1 << 4)  /* Reset connection */

/* RFC 1982 Serial Number Arithmetic for 32-bit sequence wrap-around safety */
#define SEQ_LT(a, b)  ((int32_t)((a) - (b)) < 0)
#define SEQ_LEQ(a, b) ((int32_t)((a) - (b)) <= 0)
#define SEQ_GT(a, b)  ((int32_t)((a) - (b)) > 0)
#define SEQ_GEQ(a, b) ((int32_t)((a) - (b)) >= 0)

#pragma pack(push, 1)

/* 
 * Custom Protocol Header (Total: 20 bytes on wire)
 * Designed to demonstrate custom L4 transport bypassing OS TCP.
 */
typedef struct {
    uint16_t magic;         /* Protocol Magic: 0xCAFE (Network Byte Order) */
    uint8_t  version;       /* Protocol version = 1 */
    uint8_t  flags;         /* SYN, ACK, DATA, FIN, RST */
    uint32_t seq_num;       /* Sequence Number */
    uint32_t ack_num;       /* Acknowledgment Number */
    uint16_t win_size;      /* Advertised Receive Window (Flow Control) */
    uint16_t payload_len;   /* Length of payload in bytes */
    uint16_t checksum;      /* 16-bit 1's complement checksum */
    uint16_t reserved;      /* Future extensions / alignment */
} myproto_hdr_t;

/* Optional Simulated Ethernet Layer-2 Header (14 bytes) */
typedef struct {
    uint8_t  dst_mac[6];
    uint8_t  src_mac[6];
    uint16_t ethertype;     /* Custom EtherType e.g., 0x88B5 (Local Experimental) */
} eth_hdr_t;

#pragma pack(pop)

#define ETH_TYPE_CUSTOM 0x88B5

/* Function prototypes */
uint16_t compute_checksum(const void *data, size_t len);
int serialize_custom_packet(uint8_t *out_buffer, size_t max_len, 
                            uint8_t flags, uint32_t seq, uint32_t ack,
                            uint16_t win_size, const void *payload, uint16_t payload_len);

int parse_custom_packet(const uint8_t *in_buffer, size_t buffer_len,
                        myproto_hdr_t *out_hdr, const uint8_t **out_payload);

void print_packet_details(const char *prefix, const myproto_hdr_t *hdr, size_t total_len);
void print_hex_dump(const uint8_t *buffer, size_t len);

#endif /* CUSTOM_PROTO_H */
