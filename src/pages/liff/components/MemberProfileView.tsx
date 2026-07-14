// 會員基本資料（LIFF）

import type { ReactNode } from 'react'
import { getMembershipTypeLabel, type Member } from '../types'
import {
  getBoardExpiryRowStatus,
  getMembershipExpiryRowStatus,
  type LiffExpiryRowStatus
} from '../liffExpiryAlerts'
import { liffAlertTone, liffContentPanel, LIFF_THEME, LIFF_TYPE } from '../liffUiStyles'

interface MemberProfileViewProps {
  member: Member
}

function parseYmd(iso: string | null | undefined): { y: number; m: number; d: number } | null {
  if (!iso) return null
  const part = iso.trim().split('T')[0]
  const [y, m, d] = part.split('-').map(Number)
  if (!y || !m || !d) return null
  return { y, m, d }
}

/** 完整日期：2026/06/04 */
function formatDateSlash(iso: string | null | undefined): string {
  const p = parseYmd(iso)
  if (!p) return '—'
  return `${p.y}/${String(p.m).padStart(2, '0')}/${String(p.d).padStart(2, '0')}`
}

/** 生日（不含年）：06/19 */
function formatMonthDaySlash(iso: string | null | undefined): string {
  const p = parseYmd(iso)
  if (!p) return '—'
  return `${String(p.m).padStart(2, '0')}/${String(p.d).padStart(2, '0')}`
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

function ExpiryBadge({ status }: { status: LiffExpiryRowStatus }) {
  if (status === 'none') return null
  const tone = liffAlertTone(status === 'expired' ? 'danger' : 'warning')
  return (
    <span
      style={{
        flexShrink: 0,
        fontSize: '11px',
        fontWeight: 700,
        color: tone.color,
        background: tone.bg,
        padding: '2px 8px',
        borderRadius: '999px',
        border: `1px solid ${tone.border}`,
      }}
    >
      {status === 'expired' ? '已過期' : '即將到期'}
    </span>
  )
}

function Row({ label, value, badge }: { label: string; value: string; badge?: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        padding: '11px 0',
        borderBottom: `1px solid ${LIFF_THEME.rowDivider}`,
      }}
    >
      <span style={{ fontSize: LIFF_TYPE.caption + 1, color: LIFF_THEME.muted, flexShrink: 0 }}>{label}</span>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '6px',
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontSize: LIFF_TYPE.body + 1,
            color: LIFF_THEME.inkSoft,
            fontWeight: 500,
            textAlign: 'right',
            wordBreak: 'break-all',
          }}
        >
          {value || '—'}
        </span>
        {badge}
      </div>
    </div>
  )
}

function BoardSlotCard({ slotNumber, expiresAt }: { slotNumber: string | number; expiresAt: string | null | undefined }) {
  const expiryLabel = formatDateSlash(expiresAt)
  const boardStatus = getBoardExpiryRowStatus(expiresAt)
  const tone =
    boardStatus === 'expired'
      ? liffAlertTone('danger')
      : boardStatus === 'soon'
        ? liffAlertTone('warning')
        : null

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        padding: '10px 12px',
        background: LIFF_THEME.surfaceInset,
        borderRadius: LIFF_THEME.controlRadius,
        border: `1px solid ${LIFF_THEME.borderSubtle}`,
        borderLeft: tone ? `3px solid ${tone.border}` : `3px solid transparent`,
      }}
    >
      <span style={{ fontSize: LIFF_TYPE.body + 1, fontWeight: 700, color: LIFF_THEME.inkSoft }}>
        #{slotNumber}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        <ExpiryBadge status={boardStatus} />
        <span style={{ fontSize: LIFF_TYPE.body, fontWeight: 600, color: LIFF_THEME.ink }}>
          {expiryLabel}
        </span>
      </div>
    </div>
  )
}

export function MemberProfileView({ member }: MemberProfileViewProps) {
  return (
    <div style={liffContentPanel}>
      <Row label="會員類型" value={membershipTypeLine(member)} />
      <Row label="手機號碼" value={member.phone?.trim() || '—'} />
      <Row label="生日" value={formatMonthDaySlash(member.birthday)} />
      <Row
        label="會籍到期日"
        value={formatDateSlash(member.membership_end_date)}
        badge={
          <ExpiryBadge status={getMembershipExpiryRowStatus(member.membership_end_date)} />
        }
      />

      <div
        style={{
          padding: '14px 0 0 0',
          borderBottom: `1px solid ${LIFF_THEME.rowDivider}`,
          paddingBottom: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <span style={{ fontSize: LIFF_TYPE.caption + 1, color: LIFF_THEME.muted, fontWeight: 600 }}>
            置板
          </span>
          {member.board_slots && member.board_slots.length > 1 && (
            <span
              style={{
                marginLeft: '4px',
                fontSize: '11px',
                fontWeight: 600,
                color: LIFF_THEME.muted,
                background: LIFF_THEME.surfaceInset,
                padding: '2px 8px',
                borderRadius: '999px',
              }}
            >
              {member.board_slots.length} 格
            </span>
          )}
        </div>
        {member.board_slots && member.board_slots.length > 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            {[...member.board_slots]
              .sort((a, b) => a.slot_number - b.slot_number)
              .map(s => (
                <BoardSlotCard key={s.id} slotNumber={s.slot_number} expiresAt={s.expires_at} />
              ))}
          </div>
        ) : member.board_slot_number?.trim() || member.board_expiry_date ? (
          <BoardSlotCard
            slotNumber={member.board_slot_number?.trim() || '—'}
            expiresAt={member.board_expiry_date}
          />
        ) : (
          <div
            style={{
              padding: '14px',
              textAlign: 'center',
              color: '#94a3b8',
              fontSize: '14px',
              background: '#f8fafc',
              borderRadius: '10px',
              border: '1px dashed #e2e8f0'
            }}
          >
            尚無置板資料
          </div>
        )}
      </div>
    </div>
  )
}
