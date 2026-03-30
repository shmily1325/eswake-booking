// 會員基本資料（LIFF）

import type { ReactNode } from 'react'
import { getMembershipTypeLabel, type Member } from '../types'
import { LiffPageHint } from './LiffPageHint'
import {
  getBoardExpiryRowStatus,
  getMembershipExpiryRowStatus,
  type LiffExpiryRowStatus
} from '../liffExpiryAlerts'

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

function ExpiryBadge({
  status,
  variant
}: {
  status: LiffExpiryRowStatus
  variant: 'membership' | 'board'
}) {
  if (status === 'none') return null
  if (status === 'expired') {
    return (
      <span
        style={{
          flexShrink: 0,
          fontSize: '11px',
          fontWeight: 700,
          color: '#b71c1c',
          background: '#ffebee',
          padding: '2px 8px',
          borderRadius: '999px',
          border: '1px solid #ef9a9a'
        }}
      >
        已過期
      </span>
    )
  }
  const board = variant === 'board'
  return (
    <span
      style={{
        flexShrink: 0,
        fontSize: '11px',
        fontWeight: 700,
        color: board ? '#1565c0' : '#e65100',
        background: board ? '#e3f2fd' : '#fff8e1',
        padding: '2px 8px',
        borderRadius: '999px',
        border: `1px solid ${board ? '#90caf9' : '#ffcc80'}`
      }}
    >
      即將到期
    </span>
  )
}

function Row({ label, value, badge }: { label: string; value: string; badge?: ReactNode }) {
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <span style={{ fontSize: '13px', color: '#888' }}>{label}</span>
        {badge}
      </div>
      <span style={{ fontSize: '16px', color: '#333', fontWeight: 500, wordBreak: 'break-all' }}>
        {value || '—'}
      </span>
    </div>
  )
}

function BoardSlotCard({ slotNumber, expiresAt }: { slotNumber: string | number; expiresAt: string | null | undefined }) {
  const expiryLabel = formatDateSlash(expiresAt)
  const boardStatus = getBoardExpiryRowStatus(expiresAt)
  const accent =
    boardStatus === 'expired'
      ? '4px solid #c62828'
      : boardStatus === 'soon'
        ? '4px solid #1976d2'
        : '4px solid transparent'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '12px 14px',
        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
        borderRadius: '10px',
        border: '1px solid #e2e8f0',
        borderLeft: accent
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
        <span style={{ fontSize: '12px', color: '#64748b', letterSpacing: '0.02em' }}>位子</span>
        <span style={{ fontSize: '17px', fontWeight: 700, color: '#334155', fontVariantNumeric: 'tabular-nums' }}>
          #{slotNumber}
        </span>
      </div>
      <div
        style={{
          flex: 1,
          textAlign: 'right',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          justifyContent: 'center',
          minWidth: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: '#64748b' }}>到期</span>
          <ExpiryBadge status={boardStatus} variant="board" />
        </div>
        <span style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b', lineHeight: 1.35 }}>
          {expiryLabel}
        </span>
      </div>
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
      <LiffPageHint>
        以下為綁定此 LINE 帳號的會員資料，若資料有誤，請私訊官方協助更新。
      </LiffPageHint>

      <Row label="會員類型" value={membershipTypeLine(member)} />
      <Row label="手機號碼" value={member.phone?.trim() || '—'} />
      <Row label="生日" value={formatMonthDaySlash(member.birthday)} />
      <Row
        label="會員到期日"
        value={formatDateSlash(member.membership_end_date)}
        badge={
          <ExpiryBadge
            status={getMembershipExpiryRowStatus(member.membership_end_date)}
            variant="membership"
          />
        }
      />

      <div
        style={{
          padding: '14px 0 0 0',
          borderBottom: '1px solid #f0f0f0',
          paddingBottom: '14px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
          <span style={{ fontSize: '18px' }} aria-hidden>🏄</span>
          <span style={{ fontSize: '13px', color: '#888', fontWeight: 600 }}>置板</span>
          {member.board_slots && member.board_slots.length > 1 && (
            <span
              style={{
                marginLeft: '4px',
                fontSize: '11px',
                fontWeight: 600,
                color: '#64748b',
                background: '#e2e8f0',
                padding: '2px 8px',
                borderRadius: '999px'
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
