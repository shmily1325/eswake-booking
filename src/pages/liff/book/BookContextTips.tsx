import { infoBox, warnBox } from './bookStyles'
import type { LiffBookingFormState, TimePreference } from './types'
import { BOAT_COMFORT_NOTE, BOOKING_REMINDERS } from './liffBookingReminders'

interface BookContextTipsProps {
  step: 2 | 3 | 4
  form: LiffBookingFormState
  pickTimePref: TimePreference
}

/** 每步最多一條補充說明；其餘靠選項與 chip 傳達 */
export function BookContextTips({ step, form, pickTimePref }: BookContextTipsProps) {
  const tip = resolveContextTip(step, form, pickTimePref)
  if (!tip) return null

  return (
    <div
      style={{
        ...(tip.tone === 'info' ? infoBox : warnBox),
        marginTop: 12,
        marginBottom: 0,
        fontSize: 13,
        lineHeight: 1.55,
      }}
    >
      {tip.text}
    </div>
  )
}

function resolveContextTip(
  step: 2 | 3 | 4,
  form: LiffBookingFormState,
  pickTimePref: TimePreference,
): { text: string; tone: 'info' | 'warn' } | null {
  const earlyCoach = BOOKING_REMINDERS.find(r => r.id === 'early-coach')!.text

  if (step === 2 && form.headcount > 8) {
    return { text: BOAT_COMFORT_NOTE, tone: 'info' }
  }

  if ((step === 3 || step === 4) && (pickTimePref === 'morning' || form.coachChoice === 'designated')) {
    return { text: earlyCoach, tone: 'warn' }
  }

  return null
}
