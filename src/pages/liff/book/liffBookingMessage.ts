import { getOaId, isMobileDevice } from '../../shop/lib/lineDeepLink'
import type { CoachOption, LiffBookingFormState } from './types'
import type { Member } from '../types'
import {
  formatTimePreference,
  activityDisplayName,
  formatBeginnerCount,
} from './liffBookingConfig'
import { boatLayoutLabel } from './liffBookingBoats'
import {
  computePriceEstimate,
  skillLabel,
  type PriceEstimate,
} from './liffBookingPricing'

const URL_BUDGET = 1900

export interface BookingInquiryPayload {
  url: string
  message: string
  stillTooLong: boolean
}

function formatDateFriendly(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00`)
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  return `${d.getMonth() + 1}/${d.getDate()}（${weekdays[d.getDay()]}）`
}

function buildOaMessageUrl(message: string): string {
  const oaId = getOaId()
  return `https://line.me/R/oaMessage/${encodeURIComponent(oaId)}/?${encodeURIComponent(message)}`
}

export function renderBookingInquiryMessage(
  state: LiffBookingFormState,
  coaches: CoachOption[],
  estimate: PriceEstimate | null,
): string {
  const coach =
    state.coachChoice === 'designated' && state.coachId
      ? coaches.find(c => c.id === state.coachId)
      : null

  const lines: string[] = ['🏄 預約需求', '']

  lines.push(`預約人數：${state.headcount} 人`)
  if (state.beginnerCount != null) {
    lines.push(`幾位體驗：${formatBeginnerCount(state.beginnerCount)}`)
  }
  lines.push(`預約項目：${state.activity ? activityDisplayName(state.activity) : '—'}`)
  if (state.activity) {
    lines.push(`船型：${boatLayoutLabel(state.activity, state.headcount, state.boatPreference)}`)
  }
  lines.push(`是否是第一次滑：${skillLabel(state.skillLevel)}`)

  lines.push('希望預約的日期及時間：')
  if (state.preferredDates.length === 0) {
    lines.push('  （尚未選擇）')
  } else {
    for (const pd of state.preferredDates) {
      lines.push(`  - ${formatDateFriendly(pd.date)} ${formatTimePreference(pd.timePreference)}`)
    }
  }

  if (coach) {
    lines.push(`是否指定教練：希望指定 ${coach.name}`)
  } else if (state.coachChoice === 'designated') {
    lines.push('是否指定教練：希望指定（未選教練）')
  } else {
    lines.push('是否指定教練：不指定，依排班')
  }

  lines.push('')
  lines.push(`姓名：${state.contactName.trim() || '—'}`)
  lines.push(`電話：${state.contactPhone.trim() || '—'}`)

  if (estimate) {
    lines.push('')
    lines.push(`費用估算：${estimate.totalLabel}（${estimate.tierLabel}，僅供參考）`)
    lines.push(`${estimate.durationLabel}`)
  }

  if (state.notes.trim()) {
    lines.push('')
    lines.push(`備註：${state.notes.trim()}`)
  }

  lines.push('')
  lines.push('（此訊息由 ES WAKE 預約表單產生）')

  return lines.join('\n')
}

export function buildBookingInquiry(
  state: LiffBookingFormState,
  coaches: CoachOption[],
  member: Member | null,
): BookingInquiryPayload {
  const estimate = computePriceEstimate(state, coaches, member)
  const message = renderBookingInquiryMessage(state, coaches, estimate)
  const url = buildOaMessageUrl(message)
  return {
    url,
    message,
    stillTooLong: url.length > URL_BUDGET,
  }
}

export type BookingInquiryResult =
  | { mode: 'mobile-deeplink' }
  | { mode: 'desktop-fallback'; message: string }

export function launchBookingInquiry(payload: BookingInquiryPayload): BookingInquiryResult {
  if (isMobileDevice()) {
    window.location.href = payload.url
    return { mode: 'mobile-deeplink' }
  }
  return { mode: 'desktop-fallback', message: payload.message }
}

export function activityLabelForMessage(code: LiffBookingFormState['activity']): string {
  if (!code) return '—'
  return activityDisplayName(code)
}
