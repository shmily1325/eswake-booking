import { infoBox, warnBox } from './bookStyles'
import type { LiffBookingFormState, TimePreference } from './types'
import { describeBoatForBooking, wbBoatForcedBig } from './liffBookingBoats'
import { BOAT_COMFORT_NOTE, BOOKING_REMINDERS } from './liffBookingReminders'

interface BookContextTipsProps {
  step: 2 | 3 | 4
  form: LiffBookingFormState
  pickTimePref: TimePreference
}

/** 依目前步驟與選項，只顯示「此刻相關」的短提醒 */
export function BookContextTips({ step, form, pickTimePref }: BookContextTipsProps) {
  const items: { text: string; tone: 'info' | 'warn' }[] = []

  if (step === 2 && form.activity && form.headcount >= 1) {
    items.push({
      text: describeBoatForBooking(form.activity, form.headcount, form.boatPreference),
      tone: 'info',
    })
    if (wbBoatForcedBig(form.headcount, form.boatPreference)) {
      items.push({ text: '7 人以上需大船，已改依大船計價', tone: 'warn' })
    }
    if (form.headcount > 8) {
      items.push({ text: BOAT_COMFORT_NOTE, tone: 'info' })
    }
  }

  if (step === 3 || step === 4) {
    if (pickTimePref === 'morning' || form.coachChoice === 'designated') {
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
