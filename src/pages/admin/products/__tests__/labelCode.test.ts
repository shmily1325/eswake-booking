import { describe, expect, it } from 'vitest'
import {
  findDuplicateLabelCodes,
  isLabelCodeDirty,
  LABEL_CODE_MAX_LEN,
  normalizeLabelCode,
  sanitizeLabelCodeInput,
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

  it('rejects over max length', () => {
    expect(validateLabelCodeFormat('A'.repeat(LABEL_CODE_MAX_LEN + 1))).toMatch(/最多/)
  })
})

describe('sanitizeLabelCodeInput', () => {
  it('uppercases, strips invalid chars, and caps length', () => {
    expect(sanitizeLabelCodeInput('  es-follow-2026  ')).toBe('ESFOLLOW2026')
    expect(sanitizeLabelCodeInput('ABCDEFGHIJKLMNOPQRST')).toHaveLength(LABEL_CODE_MAX_LEN)
  })
})

describe('isLabelCodeDirty', () => {
  it('detects changes vs saved value', () => {
    expect(isLabelCodeDirty('abc', 'abc')).toBe(false)
    expect(isLabelCodeDirty('ABC', 'abc')).toBe(false)
    expect(isLabelCodeDirty('NEW', 'OLD')).toBe(true)
    expect(isLabelCodeDirty('', 'OLD')).toBe(true)
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
