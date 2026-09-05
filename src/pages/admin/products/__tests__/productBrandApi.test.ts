import { describe, expect, it } from 'vitest'
import { normalizeProductBrandName } from '../productBrandApi'

describe('normalizeProductBrandName', () => {
  it('normalizes case and repeated whitespace', () => {
    expect(normalizeProductBrandName('  Liquid   Force  ')).toBe('LIQUID FORCE')
  })

  it('normalizes full-width latin characters', () => {
    expect(normalizeProductBrandName('ｆｏｌｌｏｗ')).toBe('FOLLOW')
  })

  it('keeps an empty input empty for validation', () => {
    expect(normalizeProductBrandName('   ')).toBe('')
  })
})
