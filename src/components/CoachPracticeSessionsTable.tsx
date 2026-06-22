import type { CoachPracticeSessionRow } from '../utils/boatUsageRangeStats'
import { formatDuration } from '../pages/admin/Statistics/utils'

function formatHoursOneDecimal(minutes: number): string {
  return String(Math.round((minutes / 60) * 10) / 10)
}

function formatPracticeStartAt(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

export type CoachPracticeSessionsTableProps = {
  sessions: CoachPracticeSessionRow[]
  /** 顯示「預約人」欄（bookings.contact_name） */
  showContactPerson: boolean
  emptyText?: string
  isMobile?: boolean
}

export function CoachPracticeSessionsTable({
  sessions,
  showContactPerson,
  emptyText = '無紀錄',
  isMobile = false
}: CoachPracticeSessionsTableProps) {
  const cell = { padding: isMobile ? '10px' : '12px', borderBottom: '1px solid #eee' } as const
  const th = { ...cell, textAlign: 'left' as const, borderBottom: '2px solid #e0e0e0' }

  if (sessions.length === 0) {
    return <p style={{ margin: 0, fontSize: '14px', color: '#999' }}>{emptyText}</p>
  }

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {sessions.map((row) => (
          <div
            key={row.bookingId}
            style={{
              background: '#fafafa',
              border: '1px solid #eee',
              borderRadius: '10px',
              padding: '12px 14px',
            }}
          >
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '6px' }}>
              {formatPracticeStartAt(row.startAt)}
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: '12px',
              }}
            >
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#333' }}>{row.boatName}</span>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#7b1fa2', textAlign: 'right' }}>
                {formatDuration(row.durationMin)}
                <span style={{ display: 'block', fontSize: '12px', fontWeight: 400, color: '#888' }}>
                  {formatHoursOneDecimal(row.durationMin)} 小時
                </span>
              </span>
            </div>
            {showContactPerson && (
              <div style={{ marginTop: '6px', fontSize: '13px', color: '#555' }}>
                預約人：{row.contactName}
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: isMobile ? '13px' : '14px' }}>
        <thead>
          <tr style={{ background: '#f3e5f5' }}>
            <th style={th}>開始時間</th>
            <th style={th}>船隻</th>
            {showContactPerson && <th style={th}>預約人</th>}
            <th style={{ ...th, textAlign: 'right' }}>時數</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((row, idx) => (
            <tr key={row.bookingId} style={{ background: idx % 2 === 0 ? 'white' : '#fafafa' }}>
              <td style={{ ...cell, whiteSpace: 'nowrap' }}>{formatPracticeStartAt(row.startAt)}</td>
              <td style={cell}>{row.boatName}</td>
              {showContactPerson && (
                <td style={{ ...cell, color: '#555' }}>{row.contactName}</td>
              )}
              <td
                style={{
                  ...cell,
                  textAlign: 'right',
                  fontWeight: 600,
                  color: '#7b1fa2'
                }}
              >
                {formatDuration(row.durationMin)}
                <span style={{ fontWeight: 400, color: '#888', marginLeft: '6px' }}>
                  （{formatHoursOneDecimal(row.durationMin)} 小時）
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
