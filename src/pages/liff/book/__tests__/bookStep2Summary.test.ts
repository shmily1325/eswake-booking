import { describe, expect, it } from 'vitest'
import { BOOK_I18N } from '../liffBookingI18n'
import { buildStep2SummaryLine } from '../BookStep2Summary'

const s = BOOK_I18N.zh

describe('buildStep2SummaryLine', () => {
  it('returns null until experience is chosen', () => {
    expect(
      buildStep2SummaryLine(
        { activity: 'WS', headcount: 3, beginnerCount: null, boatPreference: null, followBoatCount: 0 },
        s,
        '$5,100',
      ),
    ).toBeNull()
  })

  it('returns null for WB until boat is chosen', () => {
    expect(
      buildStep2SummaryLine(
        { activity: 'WB', headcount: 3, beginnerCount: 3, boatPreference: null, followBoatCount: 0 },
        s,
        '$5,100',
      ),
    ).toBeNull()
  })

  it('builds mixed experience summary with boat and estimate', () => {
    expect(
      buildStep2SummaryLine(
        { activity: 'WB', headcount: 3, beginnerCount: 2, boatPreference: 'small', followBoatCount: 0 },
        s,
        '$5,100',
      ),
    ).toBe('3 人（體驗 2、已滑過 1） · 小船 · 約 $5,100')
  })

  it('includes follow boat in summary without changing main flow copy', () => {
    expect(
      buildStep2SummaryLine(
        { activity: 'WB', headcount: 3, beginnerCount: 2, boatPreference: 'small', followBoatCount: 1 },
        s,
        null,
      ),
    ).toBe('滑水 3 人（體驗 2、已滑過 1） · 跟船 1 人 · 小船')
  })
})
