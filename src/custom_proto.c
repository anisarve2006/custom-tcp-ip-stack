#include "../include/custom_proto.h"
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

#ifdef _WIN32
#include <winsock2.h>
#else
#include <arpa/inet.h>
#endif

/* 16-bit 1's complement checksum (RFC 1071 / Internet Checksum) */
uint16_t compute_checksum(const void *data, size_t len) {
    const uint16_t *ptr = (const uint16_t *)data;
    uint32_t sum = 0;

    while (len > 1) {
        sum += *ptr++;
        len -= 2;
    }

    if (len == 1) {
        uint16_t odd_byte = 0;
        *(uint8_t *)&odd_byte = *(const uint8_t *)ptr;
        sum += odd_byte;
    }

    while (sum >> 16) {
        sum = (sum & 0xFFFF) + (sum >> 16);
    }

    return (uint16_t)(~sum);
}

int serialize_custom_packet(uint8_t *out_buffer, size_t max_len, 
                            uint8_t flags, uint32_t seq, uint32_t ack,
                            uint16_t win_size, const void *payload, uint16_t payload_len) {
    size_t total_len = sizeof(myproto_hdr_t) + payload_len;
    if (total_len > max_len) {
        return -1;
    }

    myproto_hdr_t *hdr = (myproto_hdr_t *)out_buffer;
    hdr->magic = htons(MYPROTO_MAGIC);
    hdr->version = MYPROTO_VERSION;
    hdr->flags = flags;
    hdr->seq_num = htonl(seq);
    hdr->ack_num = htonl(ack);
    hdr->win_size = htons(win_size);
    hdr->payload_len = htons(payload_len);
    hdr->checksum = 0; /* Zeroed during checksum calculation */
    hdr->reserved = 0;

    if (payload && payload_len > 0) {
        memcpy(out_buffer + sizeof(myproto_hdr_t), payload, payload_len);
    }

    /* Compute checksum over entire header and payload */
    hdr->checksum = compute_checksum(out_buffer, total_len);

    return (int)total_len;
}

int parse_custom_packet(const uint8_t *in_buffer, size_t buffer_len,
                        myproto_hdr_t *out_hdr, const uint8_t **out_payload) {
    if (buffer_len < sizeof(myproto_hdr_t)) {
        return -1; /* Packet smaller than header */
    }

    /* Verify checksum over raw incoming bytes */
    uint16_t csum = compute_checksum(in_buffer, buffer_len);
    if (csum != 0) {
        return -2; /* Checksum verification failed */
    }

    const myproto_hdr_t *raw_hdr = (const myproto_hdr_t *)in_buffer;
    uint16_t magic = ntohs(raw_hdr->magic);
    if (magic != MYPROTO_MAGIC) {
        return -3; /* Invalid magic */
    }

    out_hdr->magic = magic;
    out_hdr->version = raw_hdr->version;
    out_hdr->flags = raw_hdr->flags;
    out_hdr->seq_num = ntohl(raw_hdr->seq_num);
    out_hdr->ack_num = ntohl(raw_hdr->ack_num);
    out_hdr->win_size = ntohs(raw_hdr->win_size);
    out_hdr->payload_len = ntohs(raw_hdr->payload_len);
    out_hdr->checksum = ntohs(raw_hdr->checksum);
    out_hdr->reserved = ntohs(raw_hdr->reserved);

    if (sizeof(myproto_hdr_t) + out_hdr->payload_len > buffer_len) {
        return -4; /* Payload length field exceeds actual buffer length */
    }

    if (out_payload) {
        *out_payload = (out_hdr->payload_len > 0) ? (in_buffer + sizeof(myproto_hdr_t)) : NULL;
    }

    return 0;
}

void print_packet_details(const char *prefix, const myproto_hdr_t *hdr, size_t total_len) {
    char flag_str[64] = "";
    if (hdr->flags & FLAG_SYN)  strcat(flag_str, "SYN ");
    if (hdr->flags & FLAG_ACK)  strcat(flag_str, "ACK ");
    if (hdr->flags & FLAG_DATA) strcat(flag_str, "DATA ");
    if (hdr->flags & FLAG_FIN)  strcat(flag_str, "FIN ");
    if (hdr->flags & FLAG_RST)  strcat(flag_str, "RST ");
    if (flag_str[0] == '\0')    strcpy(flag_str, "NONE");

    /* Check if header is already in host byte order (magic == MYPROTO_MAGIC) or network byte order */
    uint32_t seq = (hdr->magic == MYPROTO_MAGIC) ? hdr->seq_num : ntohl(hdr->seq_num);
    uint32_t ack = (hdr->magic == MYPROTO_MAGIC) ? hdr->ack_num : ntohl(hdr->ack_num);
    uint16_t win = (hdr->magic == MYPROTO_MAGIC) ? hdr->win_size : ntohs(hdr->win_size);
    uint16_t len = (hdr->magic == MYPROTO_MAGIC) ? hdr->payload_len : ntohs(hdr->payload_len);

    printf("%s [CustomProto] Flags=[%s] Seq=%u Ack=%u Win=%u Len=%u (Total=%u bytes)\n",
           prefix, flag_str, seq, ack, win, len, (unsigned int)total_len);
}

void print_hex_dump(const uint8_t *buffer, size_t len) {
    printf("   --- On-Wire Hex Dump (%u bytes) ---\n", (unsigned int)len);
    for (size_t i = 0; i < len; i++) {
        if (i % 16 == 0) printf("   %04x: ", (unsigned int)i);
        printf("%02x ", buffer[i]);
        if ((i + 1) % 16 == 0 || i + 1 == len) {
            /* Align and print ASCII */
            size_t pad = (16 - ((i + 1) % 16)) % 16;
            for (size_t p = 0; p < pad; p++) printf("   ");
            printf(" |");
            size_t start = i - (i % 16);
            for (size_t a = start; a <= i; a++) {
                char c = (char)buffer[a];
                printf("%c", (c >= 32 && c <= 126) ? c : '.');
            }
            printf("|\n");
        }
    }
}
