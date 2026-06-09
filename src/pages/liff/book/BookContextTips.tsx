import { useBookLocale } from './BookLocaleContext'
import { infoBox, warnBox } from './bookStyles'
import type { LiffBookingFormState, TimePreference } from './types'
import { BOAT_BIG_DUAL_MIN, BOAT_SMALL_DUAL_MIN, onBoatTotal, usesBigBoat } from './liffBookingBoats'

interface BookContextTipsProps {
  step: 2 | 3 | 4
  form: LiffBookingFormState
  pickTimePref: TimePreference
}

export function BookContextTips({ step, form, pickTimePref }: BookContextTipsProps) {
  const { s } = useBookLocale()
  const tip = resolveContextTip(step, form, pickTimePref, s)
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
  s: ReturnType<typeof useBookLocale>['s'],
): { text: string; tone: 'info' | 'warn' } | null {
  if (
    step === 2
    && form.beginnerCount != null
    && form.beginnerCount > 0
    && form.beginnerCount < form.headcount
  ) {
    return { text: s.step2.mixedSkillHint, tone: 'info' }
  }

  if (step === 2 && form.activity) {
    const aboard = onBoatTotal(form.headcount, form.followBoatCount)

    if (
      form.activity === 'WB'
      && form.boatPreference === 'small'
      && aboard >= BOAT_SMALL_DUAL_MIN
    ) {
      return { text: s.reminders.dualSmall, tone: 'info' }
    }

    if (aboard >= BOAT_BIG_DUAL_MIN && usesBigBoat(form.activity, form.boatPreference)) {
      return { text: s.reminders.dualBig, tone: 'info' }
    }

    if (aboard > 8 && usesBigBoat(form.activity, form.boatPreference)) {
      return { text: s.reminders.comfort, tone: 'info' }
    }
  }

  if ((step === 3 || step === 4) && (pickTimePref === 'morning' || form.coachChoice === 'designated')) {
    return { text: s.reminders.earlyCoach, tone: 'warn' }
  }

  return null
}
