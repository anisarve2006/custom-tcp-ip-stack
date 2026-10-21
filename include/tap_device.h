#ifndef TAP_DEVICE_H
#define TAP_DEVICE_H

#include <stddef.h>

#ifndef _WIN32
/* Linux TAP allocation and I/O */
int tap_alloc(char *dev_name);
int tap_read(int fd, void *buf, size_t max_len);
int tap_write(int fd, const void *buf, size_t len);
void tap_close(int fd);
#endif

#endif /* TAP_DEVICE_H */
