import { describe, expect, it } from 'vitest'
import {
  findExactProductIdentityMatch,
  findProductIdentityCandidates,
  findSameModelCandidates,
  getProductIdentityKey,
  normalizeProductIdentityPart,
  type ProductIdentityCandidate,
} from '../productIdentity'

const products: ProductIdentityCandidate[] = [
  {
    id: 'follow-signal',
    category: 'lifejacket',
    brand: 'Follow',
    model: 'Signal Ladies',
    variantCount: 4,
  },
  {
    id: 'follow-primary',
    category: 'lifejacket',
    brand: 'Follow',
    model: 'Primary',
    variantCount: 2,
  },
  {
    id: 'ronix-rxt-2022',
    category: 'wb_board',
    brand: 'Ronix',
    model: 'RXT',
    modelYear: 2022,
    variantCount: 3,
  },
  {
    id: 'ronix-rxt-2025',
    category: 'wb_board',
    brand: 'Ronix',
    model: 'RXT',
    modelYear: 2025,
    variantCount: 2,
  },
]

describe('normalizeProductIdentityPart', () => {
  it('normalizes case, surrounding whitespace and repeated whitespace', () => {
    expect(normalizeProductIdentityPart('  FOLLOW   Signal  ')).toBe('follow signal')
  })

  it('normalizes full-width latin characters', () => {
    expect(normalizeProductIdentityPart('ＦＯＬＬＯＷ')).toBe('follow')
  })
})

describe('product identity matching', () => {
  it('matches the same category, brand and model after normalization', () => {
    expect(
      findExactProductIdentityMatch(products, 'lifejacket', ' follow ', 'SIGNAL   LADIES')?.id,
    ).toBe('follow-signal')
  })

  it('does not match a different category or model', () => {
    expect(findExactProductIdentityMatch(products, 'wetsuit', 'Follow', 'Signal Ladies')).toBeNull()
    expect(findExactProductIdentityMatch(products, 'lifejacket', 'Follow', 'Unity')).toBeNull()
  })

  it('builds a stable identity key', () => {
    expect(getProductIdentityKey('lifejacket', 'ＦＯＬＬＯＷ', ' Signal Ladies ')).toBe(
      getProductIdentityKey('lifejacket', 'follow', 'signal ladies'),
    )
  })

  it('treats different model years as different product identities', () => {
    expect(findExactProductIdentityMatch(products, 'wb_board', 'Ronix', 'RXT', 2022)?.id)
      .toBe('ronix-rxt-2022')
    expect(findExactProductIdentityMatch(products, 'wb_board', 'Ronix', 'RXT', 2024))
      .toBeNull()
    expect(findSameModelCandidates(products, 'wb_board', 'Ronix', 'RXT').map(p => p.id))
      .toEqual(['ronix-rxt-2022', 'ronix-rxt-2025'])
  })

  it('treats different product colors as different identities', () => {
    const withColors: ProductIdentityCandidate[] = [
      {
        id: 'affix-silver',
        category: 'lifejacket',
        brand: 'Follow',
        model: 'AFFIX',
        modelYear: 2027,
        color: 'SILVER',
      },
      {
        id: 'affix-rust',
        category: 'lifejacket',
        brand: 'Follow',
        model: 'AFFIX',
        modelYear: 2027,
        color: 'RUST',
      },
    ]
    expect(
      findExactProductIdentityMatch(withColors, 'lifejacket', 'Follow', 'AFFIX', 2027, 'SILVER')?.id,
    ).toBe('affix-silver')
    expect(
      findExactProductIdentityMatch(withColors, 'lifejacket', 'Follow', 'AFFIX', 2027, 'RUST')?.id,
    ).toBe('affix-rust')
    expect(
      findExactProductIdentityMatch(withColors, 'lifejacket', 'Follow', 'AFFIX', 2027, 'BLACK'),
    ).toBeNull()
  })

  it('lists models under the same category and brand', () => {
    expect(findProductIdentityCandidates(products, 'lifejacket', 'FOLLOW').map(p => p.id)).toEqual([
      'follow-signal',
      'follow-primary',
    ])
    expect(findProductIdentityCandidates(products, 'wetsuit', 'FOLLOW')).toEqual([])
  })
})
