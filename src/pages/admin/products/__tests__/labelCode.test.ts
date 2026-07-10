import { describe, expect, it } from 'vitest'
import {
  buildLabelPrefix,
  composeLabelCode,
  findDuplicateLabelCodes,
  isLabelCodeDirty,
  isMissingLabelCode,
  LABEL_CODE_MAX_LEN,
  maxLabelSeq,
  normalizeLabelCode,
  sanitizeBrandForLabel,
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

describe('isMissingLabelCode', () => {
  it('treats null, empty, and whitespace as missing', () => {
    expect(isMissingLabelCode(null)).toBe(true)
    expect(isMissingLabelCode(undefined)).toBe(true)
    expect(isMissingLabelCode('')).toBe(true)
    expect(isMissingLabelCode('   ')).toBe(true)
  })

  it('treats saved codes as present', () => {
    expect(isMissingLabelCode('ESWB001')).toBe(false)
    expect(isMissingLabelCode('  eswb001  ')).toBe(false)
  })
})

describe('sanitizeBrandForLabel', () => {
  it('uppercases and strips non-alphanumeric', () => {
    expect(sanitizeBrandForLabel('Follow')).toBe('FOLLOW')
    expect(sanitizeBrandForLabel("O'Brien")).toBe('OBRIEN')
    expect(sanitizeBrandForLabel('Liquid Force')).toBe('LIQUIDFORCE')
  })
})

describe('buildLabelPrefix', () => {
  it('composes ES + brand + category', () => {
    expect(buildLabelPrefix('Follow', 'VEST')).toBe('ESFOLLOWVEST')
  })

  it('truncates long brand so prefix + 3-digit seq fits max length', () => {
    const prefix = buildLabelPrefix('Hyperlite', 'WSBOARD')
    // ES(2) + brand + WSBOARD(7) + 001(3) <= 20 → brand capped at 8
    expect(prefix).toBe('ESHYPERLITWSBOARD')
    expect(composeLabelCode(prefix, 1)).toHaveLength(LABEL_CODE_MAX_LEN)
  })
})

describe('maxLabelSeq / composeLabelCode', () => {
  it('finds the max numeric suffix for the prefix', () => {
    const codes = ['ESFOLLOWVEST001', 'ESFOLLOWVEST007', 'ESFOLLOWVEST003', null]
    expect(maxLabelSeq(codes, 'ESFOLLOWVEST')).toBe(7)
  })

  it('ignores other prefixes and non-numeric suffixes', () => {
    const codes = ['ESRONIXWBBOARD010', 'ESFOLLOWVESTX', 'ESFOLLOWVEST2026']
    expect(maxLabelSeq(codes, 'ESFOLLOWVEST')).toBe(2026)
  })

  it('returns 0 when nothing matches', () => {
    expect(maxLabelSeq([], 'ESFOLLOWVEST')).toBe(0)
    expect(maxLabelSeq(['ESRONIXWBFIN001'], 'ESFOLLOWVEST')).toBe(0)
  })

  it('pads sequence to 3 digits', () => {
    expect(composeLabelCode('ESFOLLOWVEST', 1)).toBe('ESFOLLOWVEST001')
    expect(composeLabelCode('ESFOLLOWVEST', 42)).toBe('ESFOLLOWVEST042')
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
