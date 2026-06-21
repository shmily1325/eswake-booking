import { describe, expect, it } from 'vitest'
import {
  formatAttributes,
  formatGenderDisplay,
  genderSearchTokens,
  getAllCategories,
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

describe('year field (all SKUs)', () => {
  it('prepends optional year to every category', () => {
    for (const cat of getAllCategories()) {
      const fields = getSkuFields(cat.id)
      expect(fields[0]?.key).toBe('year')
      expect(fields[0]?.required).toBe(false)
    }
  })

  it('formatAttributes includes year when set', () => {
    expect(formatAttributes('wb_board', { year: '2025', size: '142' })).toBe(
      '2025 / 142',
    )
  })

  it('validateAttributes does not require year', () => {
    expect(validateAttributes('wb_board', { size: '142' })).toEqual([])
  })
})
