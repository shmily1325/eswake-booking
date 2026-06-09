import { useBookLocale } from './BookLocaleContext'
import { infoBox, warnBox } from './bookStyles'
import type { LiffBookingFormState, TimePreference } from './types'
import { BOAT_BIG_DUAL_MIN, BOAT_SMALL_DUAL_MIN, onBoatTotal, usesBigBoat } from './liffBookingBoats'
import type { BookI18nStrings } from './liffBookingI18n'

interface BookContextTipsProps {
  step: 2 | 3 | 4
  form: LiffBookingFormState
  pickTimePref: TimePreference
}

type Tip = { text: string; tone: 'info' | 'warn' }

export function BookContextTips({ step, form, pickTimePref }: BookContextTipsProps) {
  const { s } = useBookLocale()
  const tips = resolveContextTips(step, form, pickTimePref, s)
  if (!tips.length) return null

  const hasWarn = tips.some(t => t.tone === 'warn')
  const boxStyle = hasWarn ? warnBox : infoBox

  return (
    <div
      style={{
        ...boxStyle,
        marginTop: 12,
        marginBottom: 0,
        fontSize: 13,
        lineHeight: 1.55,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: tips.length > 1 ? 8 : 0, opacity: 0.9 }}>
        {s.reminders.title}
      </div>
      {tips.length === 1 ? (
        <div>{tips[0].text}</div>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {tips.map(tip => (
            <li key={tip.text} style={{ marginBottom: 4 }}>{tip.text}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function resolveContextTips(
  step: 2 | 3 | 4,
  form: LiffBookingFormState,
  pickTimePref: TimePreference,
  s: BookI18nStrings,
): Tip[] {
  const tips: Tip[] = []

  if (
    step === 2
    && form.beginnerCount != null
    && form.beginnerCount > 0
    && form.beginnerCount < form.headcount
  ) {
    tips.push({ text: s.step2.mixedSkillHint, tone: 'info' })
  }

  if (step === 2 && form.activity) {
    const aboard = onBoatTotal(form.headcount, form.followBoatCount)

    if (
      form.activity === 'WB'
      && form.boatPreference === 'small'
      && aboard >= BOAT_SMALL_DUAL_MIN
    ) {
      tips.push({ text: s.reminders.dualSmall, tone: 'info' })
    }

    if (aboard >= BOAT_BIG_DUAL_MIN && usesBigBoat(form.activity, form.boatPreference)) {
      tips.push({ text: s.reminders.dualBig, tone: 'info' })
    }

    if (aboard > 8 && usesBigBoat(form.activity, form.boatPreference)) {
      tips.push({ text: s.reminders.comfort, tone: 'info' })
    }
  }

  if ((step === 3 || step === 4) && (pickTimePref === 'morning' || form.coachChoice === 'designated')) {
    tips.push({ text: s.reminders.earlyCoach, tone: 'warn' })
  }

  return tips
}
