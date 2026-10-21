#include "../include/pcap_logger.h"
#include "../include/custom_proto.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#ifdef _WIN32
  #include <windows.h>
#else
  #include <sys/time.h>
#endif

static FILE *g_pcap_file = NULL;

int pcap_init(const char *filename) {
    g_pcap_file = fopen(filename, "wb");
    if (!g_pcap_file) {
        fprintf(stderr, "[PCAP] Could not open %s for writing.\n", filename);
        return -1;
    }

    pcap_file_header_t file_hdr;
    file_hdr.magic_number = 0xa1b2c3d4;
    file_hdr.version_major = 2;
    file_hdr.version_minor = 4;
    file_hdr.thiszone = 0;
    file_hdr.sigfigs = 0;
    file_hdr.snaplen = 65535;
    file_hdr.network = 1; /* LINKTYPE_ETHERNET */

    if (fwrite(&file_hdr, sizeof(file_hdr), 1, g_pcap_file) != 1) {
        fclose(g_pcap_file);
        g_pcap_file = NULL;
        return -1;
    }
    fflush(g_pcap_file);
    return 0;
}

int pcap_write_frame(const void *frame_data, size_t len, int is_tx) {
    if (!g_pcap_file) return -1;

    uint32_t sec = 0, usec = 0;
#ifdef _WIN32
    FILETIME ft;
    GetSystemTimeAsFileTime(&ft);
    unsigned long long t = ((unsigned long long)ft.dwHighDateTime << 32) | ft.dwLowDateTime;
    t -= 116444736000000000ULL; /* Convert Windows epoch (1601) to Unix epoch (1970) in 100ns */
    sec = (uint32_t)(t / 10000000ULL);
    usec = (uint32_t)((t % 10000000ULL) / 10);
#else
    struct timeval tv;
    gettimeofday(&tv, NULL);
    sec = (uint32_t)tv.tv_sec;
    usec = (uint32_t)tv.tv_usec;
#endif

    /* Synthesize simulated Layer 2 Ethernet Frame */
    eth_hdr_t eth;
    memset(&eth, 0, sizeof(eth));
    if (is_tx) {
        /* Client -> Server */
        eth.dst_mac[0] = 0x02; eth.dst_mac[5] = 0x02;
        eth.src_mac[0] = 0x02; eth.src_mac[5] = 0x01;
    } else {
        /* Server -> Client */
        eth.dst_mac[0] = 0x02; eth.dst_mac[5] = 0x01;
        eth.src_mac[0] = 0x02; eth.src_mac[5] = 0x02;
    }
#ifdef _WIN32
    eth.ethertype = htons(ETH_TYPE_CUSTOM);
#else
    eth.ethertype = __builtin_bswap16(ETH_TYPE_CUSTOM);
#endif

    size_t total_pcap_len = sizeof(eth) + len;
    pcap_packet_header_t pkt_hdr;
    pkt_hdr.ts_sec = sec;
    pkt_hdr.ts_usec = usec;
    pkt_hdr.incl_len = (uint32_t)total_pcap_len;
    pkt_hdr.orig_len = (uint32_t)total_pcap_len;

    fwrite(&pkt_hdr, sizeof(pkt_hdr), 1, g_pcap_file);
    fwrite(&eth, sizeof(eth), 1, g_pcap_file);
    fwrite(frame_data, len, 1, g_pcap_file);
    fflush(g_pcap_file);

    return 0;
}

void pcap_close(void) {
    if (g_pcap_file) {
        fclose(g_pcap_file);
        g_pcap_file = NULL;
    }
}
