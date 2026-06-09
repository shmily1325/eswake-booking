import { getOaId, isMobileDevice } from '../../shop/lib/lineDeepLink'
import type { CoachOption, LiffBookingFormState, TimePreference } from './types'
import { BOOKING_WIZARD_STEPS } from './liffBookingSteps'
import {
  activityDisplayName,
  formatBeginnerCount,
  formatTimePreference,
} from './liffBookingConfig'
import { boatLayoutLabel } from './liffBookingBoats'

export function buildStaffHelpMessage(
  step: number,
  form: LiffBookingFormState,
  coaches: CoachOption[],
  pending?: { date?: string; timePreference?: TimePreference },
): string {
  const stepMeta = BOOKING_WIZARD_STEPS.find(s => s.id === step)
  const lines: string[] = ['你好，我在填預約表單，想請小編協助：', '']

  lines.push(`進度：Step ${step}／${BOOKING_WIZARD_STEPS.length}（${stepMeta?.title ?? '—'}）`)

  if (form.activity) {
    lines.push(`項目：${activityDisplayName(form.activity)}`)
    lines.push(`船型：${boatLayoutLabel(form.activity, form.headcount, form.boatPreference)}`)
  }
  if (step >= 2) {
    lines.push(`人數：${form.headcount} 人`)
    if (form.beginnerCount != null) {
      lines.push(`初學：${formatBeginnerCount(form.beginnerCount)}`)
    }
  }
  if (step >= 3) {
    if (form.preferredDates.length > 0) {
      const dates = form.preferredDates
        .map(p => `${p.date.slice(5).replace('-', '/')} ${formatTimePreference(p.timePreference)}`)
        .join('、')
      lines.push(`日期：${dates}`)
    } else if (pending?.date) {
      const pref = pending.timePreference ? formatTimePreference(pending.timePreference) : '—'
      lines.push(`日期：${pending.date.slice(5).replace('-', '/')} ${pref}`)
    }
  }
  if (form.coachChoice === 'designated' && form.coachId) {
    const coach = coaches.find(c => c.id === form.coachId)
    if (coach) lines.push(`教練：${coach.name}`)
  }

  lines.push('')
  lines.push('想請教：')
  return lines.join('\n')
}

export function openStaffHelp(message: string): void {
  const url = `https://line.me/R/oaMessage/${encodeURIComponent(getOaId())}/?${encodeURIComponent(message)}`
  if (isMobileDevice()) {
    window.location.href = url
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}
