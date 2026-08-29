import { describe, expect, it } from 'vitest'
import type { ProductVariantRow } from '../../../admin/products/types'
import {
  collectSpecAxes,
  findVariantForAxisValue,
  formatCardSpecLine,
} from '../variantSpecAxes'

function v(
  id: string,
  attrs: Record<string, string>,
): ProductVariantRow {
  return { id, attributes: attrs } as ProductVariantRow
}

const vests = [
  v('s', { size: 'S' }),
  v('m', { size: 'M' }),
  v('l', { size: 'L' }),
]

describe('collectSpecAxes', () => {
  it('lists sizes when a vest has more than one', () => {
    expect(collectSpecAxes('lifejacket', vests)).toEqual([
      { key: 'size', label: '尺寸', values: ['S', 'M', 'L'] },
    ])
  })

  it('hides axes that do not vary', () => {
    expect(collectSpecAxes('lifejacket', [v('only', { size: 'M' })])).toEqual([])
  })

  it('shows gender even when every variant has the same value', () => {
    expect(
      collectSpecAxes('lifejacket', [
        v('s', { gender: 'Female', size: 'S' }),
        v('m', { gender: 'Female', size: 'M' }),
      ]),
    ).toEqual([
      { key: 'gender', label: '性別', values: ["WOMEN'S"] },
      { key: 'size', label: '尺寸', values: ['S', 'M'] },
    ])
  })
})

describe('formatCardSpecLine', () => {
  it('joins vest sizes in gray-line order', () => {
    expect(formatCardSpecLine('lifejacket', vests)).toBe('S · M · L')
  })

  it('still shows a single size on the card', () => {
    expect(formatCardSpecLine('lifejacket', [v('only', { size: 'M' })])).toBe('M')
  })

  it('shows gender before sizes on the card', () => {
    expect(
      formatCardSpecLine('lifejacket', [
        v('s', { gender: 'Male', size: 'S' }),
        v('m', { gender: 'Male', size: 'M' }),
      ]),
    ).toBe("MEN'S · S · M")
  })
})

describe('findVariantForAxisValue', () => {
  it('keeps gender when switching size', () => {
    const rows = [
      v('ms', { gender: 'Male', size: 'S' }),
      v('mm', { gender: 'Male', size: 'M' }),
      v('fs', { gender: 'Female', size: 'S' }),
    ]
    expect(findVariantForAxisValue(rows, 'ms', 'size', 'M')).toBe('mm')
  })
})
