import { describe, expect, it } from 'vitest'
import {
  ES_BRAND,
  esBrandCopyright,
  esBrandOfficialContact,
  esBrandPageTitle,
  esBrandServiceCopyright,
} from '../esBrandTokens'

describe('esBrandTokens', () => {
  it('uses ES Wake capitalization', () => {
    expect(ES_BRAND.name).toBe('ES Wake')
    expect(esBrandPageTitle(ES_BRAND.memberAreaLabel)).toBe('ES Wake 會員專區')
    expect(esBrandPageTitle(ES_BRAND.bookingAreaLabel)).toBe('ES Wake 線上預約')
  })

  it('builds consistent copyright lines', () => {
    expect(esBrandCopyright(2026)).toBe('© 2026 ES Wake. All Rights Reserved.')
    expect(esBrandServiceCopyright(undefined, 2026)).toBe('© 2026 ES Wake Booking. All Rights Reserved.')
    expect(esBrandOfficialContact()).toBe('ES Wake 官方')
  })
})
