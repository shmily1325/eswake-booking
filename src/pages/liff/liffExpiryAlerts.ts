// LIFF 會籍／置板到期提醒（與後台「到期詳情」同一套天數與篩選）

import type { Member } from './types'
import {
  getLocalDateString,
  isDateExpired,
  isEndDateExpiringSoon,
  isEndDateInExpiryReminderWindow,
  normalizeDate
} from '../../utils/date'

export type LiffExpiryTone = 'danger' | 'warning' | 'info'

export interface LiffExpiryBannerLine {
  id: string
  emoji: string
  text: string
  tone: LiffExpiryTone
}

function daysUntilLocalEnd(dateStr: string): number | null {
  const n = normalizeDate(dateStr)
  if (!n) return null
  const [y, mo, d] = n.split('-').map(Number)
  const end = new Date(y, mo - 1, d)
  const [ty, tm, td] = getLocalDateString().split('-').map(Number)
  const start = new Date(ty, tm - 1, td)
  return Math.round((end.getTime() - start.getTime()) / 86400000)
}

/** 會籍到期列、置板卡片用 */
export type LiffExpiryRowStatus = 'none' | 'expired' | 'soon'

export function getMembershipExpiryRowStatus(
  membershipEndDate: string | null | undefined
): LiffExpiryRowStatus {
  if (!membershipEndDate || !isEndDateInExpiryReminderWindow(membershipEndDate)) return 'none'
  if (isDateExpired(membershipEndDate)) return 'expired'
  if (isEndDateExpiringSoon(membershipEndDate)) return 'soon'
  return 'none'
}

export function getBoardExpiryRowStatus(expiresAt: string | null | undefined): LiffExpiryRowStatus {
  if (!expiresAt || !isEndDateInExpiryReminderWindow(expiresAt)) return 'none'
  if (isDateExpired(expiresAt)) return 'expired'
  if (isEndDateExpiringSoon(expiresAt)) return 'soon'
  return 'none'
}

export function buildLiffExpiryBannerLines(member: Member | null): LiffExpiryBannerLine[] {
  if (!member) return []
  const lines: LiffExpiryBannerLine[] = []

  const med = member.membership_end_date
  if (med && isEndDateInExpiryReminderWindow(med)) {
    if (isDateExpired(med)) {
      lines.push({
        id: 'membership-expired',
        emoji: '⚠️',
        text: '會籍已過期，請私訊官方協助續約。',
        tone: 'danger'
      })
    } else if (isEndDateExpiringSoon(med)) {
      const days = daysUntilLocalEnd(med)
      const suffix = days != null && days >= 0 ? `（剩 ${days} 天）` : ''
      lines.push({
        id: 'membership-soon',
        emoji: '⏰',
        text: `會籍即將到期${suffix}，請留意續約。`,
        tone: 'warning'
      })
    }
  }

  const slotSources: { expires_at: string | null | undefined }[] =
    member.board_slots && member.board_slots.length > 0
      ? member.board_slots.map(s => ({ expires_at: s.expires_at }))
      : member.board_expiry_date
        ? [{ expires_at: member.board_expiry_date }]
        : []

  let anyBoardExpired = false
  let anyBoardSoon = false
  /** 多格時取剩餘天數最小者（最急），與會籍列同格式 */
  let boardSoonMinDays: number | null = null
  for (const s of slotSources) {
    const e = s.expires_at
    if (!e) continue
    if (!isEndDateInExpiryReminderWindow(e)) continue
    if (isDateExpired(e)) anyBoardExpired = true
    else if (isEndDateExpiringSoon(e)) {
      anyBoardSoon = true
      const d = daysUntilLocalEnd(e)
      if (d != null && d >= 0) {
        boardSoonMinDays = boardSoonMinDays === null ? d : Math.min(boardSoonMinDays, d)
      }
    }
  }

  if (anyBoardExpired) {
    lines.push({
      id: 'board-expired',
      emoji: '🏄',
      text: '置板已過期，請私訊官方協助續約。',
      tone: 'danger'
    })
  }
  if (anyBoardSoon) {
    const suffix =
      boardSoonMinDays != null && boardSoonMinDays >= 0 ? `（剩 ${boardSoonMinDays} 天）` : ''
    lines.push({
      id: 'board-soon',
      emoji: '🏄',
      text: `置板即將到期${suffix}，請留意續約。`,
      tone: 'warning'
    })
  }

  return lines
}
