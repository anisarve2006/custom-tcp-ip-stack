CC = gcc
CFLAGS = -Wall -Wextra -Iinclude -O2 -pthread
TARGET = bin/test_custom_stack

SRCS = src/custom_proto.c src/link_udp.c src/pcap_logger.c src/telemetry_server.c src/test_custom_stack.c

all: $(TARGET)

$(TARGET): $(SRCS)
	@mkdir -p bin captures
	$(CC) $(CFLAGS) $(SRCS) -o $(TARGET)
	@echo "[BUILD SUCCESS] Binary created at $(TARGET)"

clean:
	rm -rf bin captures/*.pcap

.PHONY: all clean
