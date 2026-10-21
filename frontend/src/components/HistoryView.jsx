import React, { useState } from 'react';

export default function HistoryView({
  transfers = [],
  onInspectPacket,
  onNewTransfer,
  onClearHistory
}) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTransfers = transfers.filter((t) => {
    const q = searchTerm.toLowerCase();
    return (
      (t.message && t.message.toLowerCase().includes(q)) ||
      (t.seq && String(t.seq).includes(q)) ||
      (t.ack && String(t.ack).includes(q)) ||
      (t.status && t.status.toLowerCase().includes(q))
    );
  });

  return (
    <div className="card">
      <div className="card-header" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="card-title">
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            background: 'var(--primary-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--primary-border)'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.2">
              <polyline points="12 8 12 12 14 14"></polyline>
              <path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5"></path>
            </svg>
          </div>
          <span>Packet & Transfer History Log</span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {transfers.length > 0 && (
            <button
              className="btn btn-outline btn-sm"
              onClick={onClearHistory}
              style={{ color: 'var(--text-muted)' }}
            >
              Clear Log
            </button>
          )}
          <button
            className="btn btn-primary btn-sm"
            onClick={onNewTransfer}
          >
            + New Message
          </button>
        </div>
      </div>

      <div className="card-body">
        {/* Search Bar with Focus Ring */}
        <div style={{ marginBottom: '18px', display: 'flex', gap: '14px', alignItems: 'center' }}>
          <div style={{
            position: 'relative',
            flex: 1,
            display: 'flex',
            alignItems: 'center'
          }}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth="2.2"
              style={{ position: 'absolute', left: '14px' }}
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              placeholder="Filter transfers by payload, sequence number, or ACK..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px 10px 40px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-sans)',
                fontSize: '13px',
                color: 'var(--text)',
                background: '#FFFFFF',
                boxShadow: 'var(--shadow-inner)'
              }}
            />
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: '12px',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            whiteSpace: 'nowrap'
          }}>
            Showing {filteredTransfers.length} of {transfers.length} records
          </div>
        </div>

        {/* History Table */}
        <div style={{
          overflowX: 'auto',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          boxShadow: 'var(--shadow-xs)'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#FAF9FE', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>#</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>Message Payload</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>Bytes</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>Seq Num (TX)</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>Ack Num (RX)</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>Sent / Recv Timestamps</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>RTT</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>Status</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransfers.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '4px', color: 'var(--text)' }}>No transfers recorded yet</div>
                    <div style={{ fontSize: '13px' }}>Compose and send a message to observe user-space transport packet logs.</div>
                  </td>
                </tr>
              ) : (
                filteredTransfers.map((item, idx) => (
                  <tr
                    key={item.id || idx}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'all 0.15s ease',
                      cursor: 'pointer',
                      background: idx % 2 === 0 ? '#FFFFFF' : '#FCFCFE'
                    }}
                    onClick={() => onInspectPacket?.(item)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#FAF5FF')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 0 ? '#FFFFFF' : '#FCFCFE')}
                  >
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {idx + 1}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      "{item.message}"
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {item.bytes} B
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', color: 'var(--primary)', fontWeight: 700 }}>
                      {item.seq}
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', color: 'var(--teal)', fontWeight: 700 }}>
                      {item.ack}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      <div>TX: {item.sentTime ? item.sentTime.split(' ')[1] : '01:21:04'}</div>
                      <div>RX: {item.recvTime ? item.recvTime.split(' ')[1] : '01:21:04'}</div>
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--success)' }}>
                      {item.rtt || '23.4 ms'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#10B981' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981' }}></span>
                        {item.status || 'Delivered'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onInspectPacket?.(item);
                        }}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
