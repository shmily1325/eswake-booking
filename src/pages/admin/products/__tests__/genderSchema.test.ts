import { describe, expect, it } from 'vitest'
import {
  formatAttributes,
  formatGenderDisplay,
  genderSearchTokens,
  getSkuFields,
  normalizeGenderValue,
  normalizeVariantAttributes,
  validateAttributes,
} from '../schema'

describe('gender schema', () => {
  it('normalizes legacy M/F to Male/Female', () => {
    expect(normalizeGenderValue('M')).toBe('Male')
    expect(normalizeGenderValue('f')).toBe('Female')
    expect(normalizeGenderValue('Male')).toBe('Male')
  })

  it('formatAttributes shows Male not M', () => {
    expect(
      formatAttributes('lifejacket', { gender: 'M', size: 'S' }),
    ).toBe('Male / S')
  })

  it('genderSearchTokens include male and m', () => {
    expect(genderSearchTokens('Female')).toEqual(['female', 'f'])
  })

  it('normalizeVariantAttributes writes canonical values', () => {
    expect(normalizeVariantAttributes({ gender: 'M', size: 'L' })).toEqual({
      gender: 'Male',
      size: 'L',
    })
  })

  it('formatGenderDisplay returns null for empty', () => {
    expect(formatGenderDisplay('')).toBeNull()
  })
})

describe('product-level year', () => {
  it('does not expose year as an SKU field', () => {
    expect(getSkuFields('wb_board').some((field) => field.key === 'year')).toBe(false)
  })

  it('ignores a legacy year attribute when formatting SKU specifications', () => {
    expect(formatAttributes('wb_board', { year: '2025', size: '142' })).toBe('142')
  })

  it('does not require year when validating SKU attributes', () => {
    expect(validateAttributes('wb_board', { size: '142' })).toEqual([])
  })
})
