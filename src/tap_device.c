#include "../include/tap_device.h"

#ifndef _WIN32
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/ioctl.h>
#include <sys/socket.h>
#include <linux/if.h>
#include <linux/if_tun.h>

int tap_alloc(char *dev_name) {
    struct ifreq ifr;
    int fd, err;

    if ((fd = open("/dev/net/tun", O_RDWR)) < 0) {
        perror("[TAP] Cannot open /dev/net/tun");
        return -1;
    }

    memset(&ifr, 0, sizeof(ifr));
    ifr.ifr_flags = IFF_TAP | IFF_NO_PI; /* Raw Ethernet II frames, no packet info header */

    if (dev_name && *dev_name) {
        strncpy(ifr.ifr_name, dev_name, IFNAMSIZ);
    }

    if ((err = ioctl(fd, TUNSETIFF, (void *)&ifr)) < 0) {
        perror("[TAP] ioctl(TUNSETIFF) failed");
        close(fd);
        return err;
    }

    if (dev_name) {
        strcpy(dev_name, ifr.ifr_name);
    }

    return fd;
}

int tap_read(int fd, void *buf, size_t max_len) {
    return read(fd, buf, max_len);
}

int tap_write(int fd, const void *buf, size_t len) {
    return write(fd, buf, len);
}

void tap_close(int fd) {
    if (fd >= 0) close(fd);
}

#endif
