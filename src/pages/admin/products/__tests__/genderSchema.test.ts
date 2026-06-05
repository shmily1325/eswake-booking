import { describe, expect, it } from 'vitest'
import {
  formatAttributes,
  formatGenderDisplay,
  genderSearchTokens,
  normalizeGenderValue,
  normalizeVariantAttributes,
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
