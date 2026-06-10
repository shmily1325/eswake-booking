import { describe, expect, it } from 'vitest'
import { BOOK_I18N, getStepNextLabel } from '../liffBookingI18n'

describe('getStepNextLabel', () => {
  it('returns guided labels for steps 1–3', () => {
    const { footer } = BOOK_I18N.zh
    expect(getStepNextLabel(1, footer)).toBe('填人數')
    expect(getStepNextLabel(2, footer)).toBe('選時間')
    expect(getStepNextLabel(3, footer)).toBe('看摘要')
  })

  it('falls back to generic next for other steps', () => {
    const { footer } = BOOK_I18N.en
    expect(getStepNextLabel(4, footer)).toBe('Next')
  })
})
