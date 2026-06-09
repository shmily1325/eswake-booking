import { infoBox, warnBox } from './bookStyles'
import type { LiffBookingFormState, TimePreference } from './types'
import { BEGINNER_LESSON_NOTE } from './liffBookingConfig'
import { describeBoatForBooking, wbNeedsLargeGroupBoatChoice } from './liffBookingBoats'
import {
  STEP2_FOLLOW_BOAT_NOTE,
  STEP3_SCHEDULE_NOTE,
} from './liffBookingContent'
import { BOAT_COMFORT_NOTE, BOOKING_REMINDERS } from './liffBookingReminders'

interface BookContextTipsProps {
  step: 2 | 3 | 4
  form: LiffBookingFormState
  pickTimePref: TimePreference
  pickDate?: string
}

/** 依目前步驟與選項，只顯示「此刻相關」的短提醒 */
export function BookContextTips({ step, form, pickTimePref, pickDate }: BookContextTipsProps) {
  const items: { text: string; tone: 'info' | 'warn' }[] = []

  if (step === 2 && form.activity && form.headcount >= 1) {
    if (form.activity === 'WB' && wbNeedsLargeGroupBoatChoice(form.activity, form.headcount) && !form.boatPreference) {
      items.push({ text: '7 人以上可選 2 艘小船或 1 艘大船', tone: 'info' })
    }
    items.push({
      text: describeBoatForBooking(form.activity, form.headcount, form.boatPreference),
      tone: 'info',
    })
    if (form.headcount > 8) {
      items.push({ text: BOAT_COMFORT_NOTE, tone: 'info' })
    }
    if (form.beginnerCount != null) {
      if (form.beginnerCount === form.headcount) {
        items.push({ text: `初學：${BEGINNER_LESSON_NOTE}，不分會員`, tone: 'info' })
      } else if (form.beginnerCount === 0) {
        items.push({ text: '非初學依 20 分鐘計價，實際時數小編確認', tone: 'info' })
      } else {
        items.push({ text: '混合初學＋非初學，費用分別計算', tone: 'info' })
      }
    }
    items.push({ text: STEP2_FOLLOW_BOAT_NOTE, tone: 'info' })
  }

  if (step === 3) {
    items.push({ text: STEP3_SCHEDULE_NOTE, tone: 'info' })
    if (pickDate) {
      items.push({
        text: BOOKING_REMINDERS.find(r => r.id === 'weather')!.text,
        tone: 'info',
      })
    }
    if (pickTimePref === 'morning' || form.coachChoice === 'designated') {
      items.push({
        text: BOOKING_REMINDERS.find(r => r.id === 'early-coach')!.text,
        tone: 'warn',
      })
    }
  }

  if (step === 4) {
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
      {items.map((item, i) => (
        <div
          key={item.text}
          style={{
            ...(item.tone === 'info' ? infoBox : warnBox),
            marginTop: i === 0 ? 0 : 8,
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
