// 會員基本資料（LIFF）

import { getMembershipTypeLabel, type Member } from '../types'

interface MemberProfileViewProps {
  member: Member
}

/** 生日僅顯示月日 */
function formatBirthdayMonthDay(iso: string | null | undefined): string {
  if (!iso) return '—'
  const part = iso.trim().split('T')[0]
  const [, m, d] = part.split('-').map(Number)
  if (!m || !d) return iso
  return `${m} 月 ${d} 日`
}

/** 到期日等：含年份 */
function formatDateWithYear(iso: string | null | undefined): string {
  if (!iso) return '—'
  const part = iso.trim().split('T')[0]
  const [y, m, d] = part.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${y} 年 ${m} 月 ${d} 日`
}

/** 置板起迄：缺資料時顯示 ?（與後台列表一致） */
function formatBoardSegment(iso: string | null | undefined): string {
  if (!iso || !String(iso).trim()) return '?'
  return formatDateWithYear(iso)
}

function membershipTypeLine(member: Member): string {
  const label = getMembershipTypeLabel(member.membership_type)
  if (member.membership_type === 'dual') {
    const p = member.partner
    const who = p?.nickname?.trim() || p?.name
    if (who) return `${label}（與 ${who}）`
  }
  return label
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '14px 0',
        borderBottom: '1px solid #f0f0f0'
      }}
    >
      <span style={{ fontSize: '13px', color: '#888' }}>{label}</span>
      <span style={{ fontSize: '16px', color: '#333', fontWeight: 500, wordBreak: 'break-all' }}>
        {value || '—'}
      </span>
    </div>
  )
}

export function MemberProfileView({ member }: MemberProfileViewProps) {
  return (
    <div
      style={{
        background: 'white',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
      }}
    >
      <p style={{ fontSize: '13px', color: '#888', margin: '0 0 16px 0' }}>
        以下為綁定於本 LINE 帳號的會員資料；儲值與票券請至「查儲值」分頁。
      </p>

      <Row label="會員類型" value={membershipTypeLine(member)} />
      <Row label="手機號碼" value={member.phone?.trim() || '—'} />
      <Row label="生日" value={formatBirthdayMonthDay(member.birthday)} />
      <Row label="會員到期日" value={formatDateWithYear(member.membership_end_date)} />

      <div
        style={{
          padding: '14px 0',
          borderBottom: '1px solid #f0f0f0'
        }}
      >
        <span style={{ fontSize: '13px', color: '#888' }}>置板</span>
        {member.board_slots && member.board_slots.length > 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              marginTop: '8px'
            }}
          >
            {member.board_slots.map(s => (
              <div
                key={s.id}
                style={{
                  fontSize: '15px',
                  color: '#333',
                  fontWeight: 500,
                  lineHeight: 1.45,
                  wordBreak: 'break-word'
                }}
              >
                🏄 位子 #{s.slot_number}：{formatBoardSegment(s.start_date)} →{' '}
                {formatBoardSegment(s.expires_at)}
              </div>
            ))}
          </div>
        ) : member.board_slot_number?.trim() || member.board_expiry_date ? (
          <div style={{ marginTop: '8px', fontSize: '15px', color: '#333', fontWeight: 500, lineHeight: 1.5 }}>
            <div>位子：{member.board_slot_number?.trim() || '—'}</div>
            <div style={{ marginTop: '6px' }}>到期：{formatDateWithYear(member.board_expiry_date)}</div>
          </div>
        ) : (
          <div style={{ marginTop: '8px', fontSize: '16px', color: '#333', fontWeight: 500 }}>—</div>
        )}
      </div>

      <div
        style={{
          marginTop: '16px',
          padding: '10px 12px',
          background: '#fafafa',
          borderRadius: '8px',
          fontSize: '12px',
          color: '#999',
          lineHeight: 1.5
        }}
      >
        若資料有誤，請私訊官方帳號協助更新。
      </div>
    </div>
  )
}
