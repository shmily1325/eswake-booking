import { describe, expect, it } from 'vitest'
import { formatSettlementLineDisplay } from '../settleUtils'

describe('formatSettlementLineDisplay', () => {
  it('shows brand model and spec with vendor code', () => {
    const line = {
      item_id: 'i1',
      variant_id: 'v1',
      qty: 1,
      unit_price: 6500,
      line_total: 6500,
    }
    const display = formatSettlementLineDisplay(line, {
      vendor_code: 'FE05104-C',
      attributes: { size: 'M' },
      product: { brand: 'Ronix', model: 'One Black', category: 'wetsuit' },
    })
    expect(display.title).toBe('Ronix One Black')
    expect(display.subtitle).toContain('#FE05104-C')
  })

  it('falls back to snapshot description when product missing', () => {
    const display = formatSettlementLineDisplay(
      {
        item_id: 'i1',
        variant_id: 'v1',
        qty: 1,
        unit_price: 100,
        line_total: 100,
        description: 'Ronix 外套 (SO-001)',
      },
      null,
    )
    expect(display.title).toBe('Ronix 外套 (SO-001)')
  })
})
