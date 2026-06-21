import { describe, expect, it } from 'vitest'
import {
  findDuplicateLabelCodes,
  normalizeLabelCode,
  validateLabelCodeFormat,
} from '../labelCode'

describe('normalizeLabelCode', () => {
  it('trims and uppercases', () => {
    expect(normalizeLabelCode('  esfollowvest2026  ')).toBe('ESFOLLOWVEST2026')
  })

  it('returns null for empty', () => {
    expect(normalizeLabelCode('')).toBeNull()
    expect(normalizeLabelCode('   ')).toBeNull()
  })
})

describe('validateLabelCodeFormat', () => {
  it('accepts alphanumeric', () => {
    expect(validateLabelCodeFormat('ESFOLLOWVEST2026')).toBeNull()
  })

  it('rejects special characters', () => {
    expect(validateLabelCodeFormat('ES-2026')).toMatch(/英文與數字/)
  })

  it('allows empty', () => {
    expect(validateLabelCodeFormat('')).toBeNull()
  })
})

describe('findDuplicateLabelCodes', () => {
  it('detects duplicate within product', () => {
    expect(
      findDuplicateLabelCodes([
        { label_code: 'AAA' },
        { label_code: 'aaa' },
      ]),
    ).toBe('AAA')
  })

  it('ignores pending delete', () => {
    expect(
      findDuplicateLabelCodes([
        { label_code: 'AAA', pendingDelete: true },
        { label_code: 'AAA' },
      ]),
    ).toBeNull()
  })
})
