import { describe, expect, it } from 'vitest'
import { buildBookingPartyLine, formatBookingDate } from '../bookingLineContext'
import type { LiffBookingFormState } from '../types'

const form: LiffBookingFormState = {
  activity: 'WB',
  headcount: 3,
  beginnerCount: 2,
  boatPreference: 'small',
  followBoatCount: 1,
  coachChoice: 'none',
  coachId: null,
  preferredDates: [],
  contactName: '',
  contactPhone: '',
  notes: '',
}

describe('bookingLineContext', () => {
  it('formats dates with weekday in zh', () => {
    expect(formatBookingDate('2026-06-15', 'zh')).toBe('6/15（一）')
  })

  it('builds party line with boat layout and follow boat', () => {
    expect(buildBookingPartyLine(form, 'zh')).toBe(
      '寬板滑水 · 3 人 · 2 位體驗 · 1 位已滑過 · 小船 · 跟船 1 位',
    )
  })
})
