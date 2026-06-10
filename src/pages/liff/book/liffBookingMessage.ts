import { getOaId, isMobileDevice } from '../../shop/lib/lineDeepLink'
import { renderBookingLineMessage } from './bookingLineContext'
import type { CoachOption, LiffBookingFormState } from './types'
import type { Member } from '../types'
import { BOOK_I18N, type BookLocale } from './liffBookingI18n'
import {
  computePriceEstimate,
  type PriceEstimate,
} from './liffBookingPricing'

const URL_BUDGET = 1900

export interface BookingInquiryPayload {
  url: string
  message: string
  stillTooLong: boolean
}

function buildOaMessageUrl(message: string): string {
  const oaId = getOaId()
  return `https://line.me/R/oaMessage/${encodeURIComponent(oaId)}/?${encodeURIComponent(message)}`
}

export function renderBookingInquiryMessage(
  state: LiffBookingFormState,
  coaches: CoachOption[],
  estimate: PriceEstimate | null,
  locale: BookLocale = 'zh',
): string {
  const m = BOOK_I18N[locale].lineMessage
  return renderBookingLineMessage(state, coaches, locale, {
    opener: m.submitTitle,
    includeParty: true,
    includeDates: true,
    includeCoach: true,
    includeContact: true,
    includeEstimate: Boolean(estimate),
    includeNotes: true,
    estimate,
  })
}

export function buildBookingInquiry(
  state: LiffBookingFormState,
  coaches: CoachOption[],
  member: Member | null,
  locale: BookLocale = 'zh',
): BookingInquiryPayload {
  const estimate = computePriceEstimate(state, coaches, member, locale)
  const message = renderBookingInquiryMessage(state, coaches, estimate, locale)
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
