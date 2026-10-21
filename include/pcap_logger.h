#ifndef PCAP_LOGGER_H
#define PCAP_LOGGER_H

#include <stddef.h>
#include <stdint.h>

/* Standard PCAP file header (24 bytes) */
typedef struct {
    uint32_t magic_number;   /* 0xa1b2c3d4 */
    uint16_t version_major;  /* 2 */
    uint16_t version_minor;  /* 4 */
    int32_t  thiszone;       /* GMT to local correction */
    uint32_t sigfigs;        /* accuracy of timestamps */
    uint32_t snaplen;        /* max length of captured packets, in octets */
    uint32_t network;        /* data link type (1 = LINKTYPE_ETHERNET) */
} pcap_file_header_t;

/* Standard PCAP packet record header (16 bytes) */
typedef struct {
    uint32_t ts_sec;         /* timestamp seconds */
    uint32_t ts_usec;        /* timestamp microseconds */
    uint32_t incl_len;       /* number of octets of packet saved in file */
    uint32_t orig_len;       /* actual length of packet */
} pcap_packet_header_t;

int pcap_init(const char *filename);
int pcap_write_frame(const void *frame_data, size_t len, int is_tx);
void pcap_close(void);

#endif /* PCAP_LOGGER_H */
