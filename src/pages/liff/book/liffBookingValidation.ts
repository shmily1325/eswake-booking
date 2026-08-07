import type { BookI18nStrings } from './liffBookingI18n'
import { canUseSmallBoat, onBoatTotal } from './liffBookingBoats'
import type { LiffBookingFormState } from './types'

export function getStepBlockReason(
  step: number,
  form: LiffBookingFormState,
  pickDate: string,
  v: BookI18nStrings['validation'],
  lineUserId?: string | null,
  options?: { requireLine?: boolean },
): string | null {
  const requireLine = options?.requireLine ?? true
  switch (step) {
    case 1:
      return form.activity == null ? v.pickActivity : null
    case 2:
      if (form.beginnerCount == null) return v.pickExperience
      if (form.activity === 'WB' && !form.boatPreference) return v.pickBoat
      if (
        form.activity === 'WB'
        && form.boatPreference === 'small'
        && !canUseSmallBoat(onBoatTotal(form.headcount, form.followBoatCount))
      ) {
        return v.smallBoatFull
      }
      return null
    case 3:
      if (!pickDate && form.preferredDates.length === 0) return v.pickDate
      if (form.coachChoice === 'designated' && !form.coachId) return v.pickCoach
      return null
    case 4:
      if (requireLine && !lineUserId) return v.connectingLine
      if (!form.contactName.trim()) return v.fillName
      if (form.contactPhone.replace(/\D/g, '').length < 8) return v.fillPhone
      return null
    default:
      return null
  }
}
