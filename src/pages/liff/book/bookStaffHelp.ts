import { getOaId, isMobileDevice } from '../../shop/lib/lineDeepLink'
import { renderBookingLineMessage } from './bookingLineContext'
import { BOOK_I18N, type BookLocale } from './liffBookingI18n'
import type { CoachOption, LiffBookingFormState, TimePreference } from './types'

export function buildStaffHelpMessage(
  step: number,
  form: LiffBookingFormState,
  coaches: CoachOption[],
  locale: BookLocale = 'zh',
  pending?: { date?: string; timePreference?: TimePreference },
  presetQuestion?: string,
): string {
  const s = BOOK_I18N[locale]
  return renderBookingLineMessage(form, coaches, locale, {
    opener: s.staff.helpOpener,
    closing: `${s.staff.helpPrompt}${presetQuestion ?? ''}`,
    includeParty: step >= 2,
    includeDates: step >= 3,
    includeCoach: step >= 3,
    includeContact: false,
    includeEstimate: false,
    includeNotes: false,
    pending,
  })
}

export function openStaffHelp(message: string): void {
  const url = `https://line.me/R/oaMessage/${encodeURIComponent(getOaId())}/?${encodeURIComponent(message)}`
  if (isMobileDevice()) {
    window.location.href = url
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}
