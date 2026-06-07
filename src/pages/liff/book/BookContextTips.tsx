import { infoBox, warnBox } from './bookStyles'
import type { ActivityCode, LiffBookingFormState, TimePreference } from './types'
import { describeBoatForBooking } from './liffBookingBoats'
import { BOAT_COMFORT_NOTE, BOOKING_REMINDERS } from './liffBookingReminders'

interface BookContextTipsProps {
  step: 2 | 3 | 4
  form: LiffBookingFormState
  pickTimePref: TimePreference
  showCoachSection: boolean
}

/** 依目前步驟與選項，只顯示「此刻相關」的短提醒 */
export function BookContextTips({ step, form, pickTimePref, showCoachSection }: BookContextTipsProps) {
  const items: { text: string; tone: 'info' | 'warn' }[] = []

  if (step === 2 && form.activity && form.headcount >= 1) {
    items.push({ text: describeBoatForBooking(form.activity, form.headcount), tone: 'info' })
    if (form.headcount > 8) {
      items.push({ text: BOAT_COMFORT_NOTE, tone: 'info' })
    }
  }

  if (step === 3 || step === 4) {
    items.push({
      text: BOOKING_REMINDERS.find(r => r.id === 'weather')!.text,
      tone: 'warn',
    })
    if (pickTimePref === 'morning' || showCoachSection || form.coachChoice === 'designated') {
      items.push({
        text: BOOKING_REMINDERS.find(r => r.id === 'early-coach')!.text,
        tone: 'warn',
      })
    }
  }

  if (items.length === 0) return null

  return (
    <div style={{ marginTop: 12 }}>
      {items.map(item => (
        <div
          key={item.text}
          style={{
            ...(item.tone === 'info' ? infoBox : warnBox),
            marginTop: items.indexOf(item) === 0 ? 0 : 8,
            marginBottom: 0,
            fontSize: 13,
            lineHeight: 1.55,
          }}
        >
          {item.text}
        </div>
      ))}
    </div>
  )
}

/** Step 1 活動卡片上的船型一行說明 */
export function activityBoatLine(code: ActivityCode): string {
  if (code === 'WS') return '🛥 僅大船 · 最多 10 人'
  return '🚤 小船 ≤6 人 · 🛥 大船 ≤10 人'
}
