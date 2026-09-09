import { describe, expect, it } from 'vitest'
import type { ProductVariantRow } from '../../../admin/products/types'
import {
  collectSpecAxes,
  findVariantForAxisValue,
  formatCardGenderLabel,
  formatCardSpecLine,
  formatSpecAxisOptionLabel,
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

  it('uses configured axes and ignores detail fields', () => {
    const rows = [
      v('blank', { size: "4'8", finish: '空板', width: '19.5' }),
      v('carbon', { size: "4'8", finish: 'Full Carbon', width: '19.5' }),
    ]
    expect(collectSpecAxes('ws_board', rows, {
      version: 1,
      variantFields: {
        axis: [
          { key: 'size', label: '尺寸', inputType: 'select', values: ["4'8"] },
          { key: 'finish', label: '板面', inputType: 'select', values: ['空板', 'Full Carbon'] },
        ],
        detail: [{ key: 'width', label: '寬度', inputType: 'text' }],
      },
      customFields: [],
    })).toEqual([
      { key: 'finish', label: '板面', values: ['空板', 'Full Carbon'] },
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

  it('keeps gender out of the size line', () => {
    expect(
      formatCardSpecLine('lifejacket', [
        v('s', { gender: 'Male', size: 'S' }),
        v('m', { gender: 'Male', size: 'M' }),
      ]),
    ).toBe('S · M')
  })

})

describe('formatCardGenderLabel', () => {
  it('formats a single gender as a shop label', () => {
    expect(
      formatCardGenderLabel([
        v('s', { gender: 'Male', size: 'S' }),
        v('m', { gender: 'Male', size: 'M' }),
      ]),
    ).toBe("MEN'S")
  })

  it('returns nothing when gender is absent', () => {
    expect(formatCardGenderLabel(vests)).toBe('')
  })
})

describe('formatSpecAxisOptionLabel', () => {
  it('adds the editable VIBES rider weight to a size', () => {
    const variant = v('diamond-43', { size: "4'3", max_rider_weight_kg: '61' })
    expect(formatSpecAxisOptionLabel('size', "4'3", variant)).toBe("4'3 · Up to 61\u00a0kg")
  })

  it('keeps the original label when no valid weight exists', () => {
    expect(formatSpecAxisOptionLabel('size', "4'3", v('diamond-43', { size: "4'3" }))).toBe("4'3")
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

  it('keeps configured finish while allowing detail values to change', () => {
    const rows = [
      v('small-carbon', { size: 'S', finish: 'Carbon', width: '18' }),
      v('large-blank', { size: 'L', finish: 'Blank', width: '20' }),
      v('large-carbon', { size: 'L', finish: 'Carbon', width: '20' }),
    ]
    expect(findVariantForAxisValue(
      rows,
      'small-carbon',
      'size',
      'L',
      ['size', 'finish'],
    )).toBe('large-carbon')
  })
})
