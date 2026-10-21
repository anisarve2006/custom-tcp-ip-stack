-- Wireshark Lua Dissector for NEXUS Custom TCP/IP Transport Protocol
-- Drop this file into your Wireshark 'plugins' folder or load via:
-- Wireshark Menu -> Analyze -> Reload Lua Plugins (Ctrl+Shift+L)

local nexus_proto = Proto("nexus", "NEXUS Transport Protocol")

local f_magic   = ProtoField.uint16("nexus.magic",   "Magic Identifier", base.HEX)
local f_version = ProtoField.uint8("nexus.version",  "Protocol Version", base.DEC)
local f_flags   = ProtoField.uint8("nexus.flags",    "Control Flags",    base.HEX)
local f_flag_syn = ProtoField.bool("nexus.flags.syn", "SYN (Synchronize)", 8, nil, 0x01)
local f_flag_ack = ProtoField.bool("nexus.flags.ack", "ACK (Acknowledgment)", 8, nil, 0x02)
local f_flag_data= ProtoField.bool("nexus.flags.data","DATA (Payload Present)", 8, nil, 0x04)
local f_flag_fin = ProtoField.bool("nexus.flags.fin", "FIN (Finish Teardown)", 8, nil, 0x08)
local f_flag_rst = ProtoField.bool("nexus.flags.rst", "RST (Reset Connection)", 8, nil, 0x10)

local f_seq     = ProtoField.uint32("nexus.seq",     "Sequence Number", base.DEC)
local f_ack     = ProtoField.uint32("nexus.ack",     "Acknowledgment Number", base.DEC)
local f_win     = ProtoField.uint16("nexus.win",     "Advertised Window", base.DEC)
local f_len     = ProtoField.uint16("nexus.len",     "Payload Length", base.DEC)
local f_csum    = ProtoField.uint16("nexus.csum",    "16-bit Checksum", base.HEX)
local f_res     = ProtoField.uint16("nexus.res",     "Reserved", base.HEX)

nexus_proto.fields = {
    f_magic, f_version, f_flags,
    f_flag_syn, f_flag_ack, f_flag_data, f_flag_fin, f_flag_rst,
    f_seq, f_ack, f_win, f_len, f_csum, f_res
}

function nexus_proto.dissector(buffer, pinfo, tree)
    local length = buffer:len()
    if length < 20 then return end

    -- Verify Magic Byte 0xCAFE
    local magic = buffer(0, 2):uint()
    if magic ~= 0xCAFE then return end

    pinfo.cols.protocol = "NEXUS-TCP"

    local flags = buffer(3, 1):uint()
    local flag_str = ""
    if bit.band(flags, 0x01) ~= 0 then flag_str = flag_str .. "[SYN] " end
    if bit.band(flags, 0x02) ~= 0 then flag_str = flag_str .. "[ACK] " end
    if bit.band(flags, 0x04) ~= 0 then flag_str = flag_str .. "[DATA] " end
    if bit.band(flags, 0x08) ~= 0 then flag_str = flag_str .. "[FIN] " end
    if bit.band(flags, 0x10) ~= 0 then flag_str = flag_str .. "[RST] " end

    local seq = buffer(4, 4):uint()
    local ack = buffer(8, 4):uint()
    local plen = buffer(14, 2):uint()

    pinfo.cols.info = string.format("%sSeq=%d Ack=%d Len=%d Win=%d", flag_str, seq, ack, plen, buffer(12, 2):uint())

    local subtree = tree:add(nexus_proto, buffer(0, 20), "NEXUS Custom Transport Header (20 Bytes)")
    subtree:add(f_magic,   buffer(0, 2))
    subtree:add(f_version, buffer(2, 1))

    local flag_tree = subtree:add(f_flags, buffer(3, 1))
    flag_tree:add(f_flag_syn, buffer(3, 1))
    flag_tree:add(f_flag_ack, buffer(3, 1))
    flag_tree:add(f_flag_data, buffer(3, 1))
    flag_tree:add(f_flag_fin, buffer(3, 1))
    flag_tree:add(f_flag_rst, buffer(3, 1))

    subtree:add(f_seq,     buffer(4, 4))
    subtree:add(f_ack,     buffer(8, 4))
    subtree:add(f_win,     buffer(12, 2))
    subtree:add(f_len,     buffer(14, 2))
    subtree:add(f_csum,    buffer(16, 2))
    subtree:add(f_res,     buffer(18, 2))

    if plen > 0 and length >= 20 + plen then
        tree:add(buffer(20, plen), string.format("NEXUS Payload Data (%d bytes)", plen))
    end
end

-- Bind to UDP Port 9999
local udp_table = DissectorTable.get("udp.port")
udp_table:add(9999, nexus_proto)
