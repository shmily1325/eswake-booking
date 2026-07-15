import { describe, expect, it } from 'vitest'
import {
  findExactProductIdentityMatch,
  findProductIdentityCandidates,
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

  it('lists models under the same category and brand', () => {
    expect(findProductIdentityCandidates(products, 'lifejacket', 'FOLLOW').map(p => p.id)).toEqual([
      'follow-signal',
      'follow-primary',
    ])
    expect(findProductIdentityCandidates(products, 'wetsuit', 'FOLLOW')).toEqual([])
  })
})
