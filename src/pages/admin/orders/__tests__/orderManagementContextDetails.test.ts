import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), 'src/pages/admin/orders/OrderManagement.tsx'),
  'utf8',
)
const apiSource = readFileSync(
  resolve(process.cwd(), 'src/pages/admin/orders/api.ts'),
  'utf8',
)

describe('order management context details', () => {
  it('shows shipping information and both order notes on cards', () => {
    expect(source).toContain('<OrderContextDetails order={order} isMobile={isMobile} />')
    expect(source).toContain("order.shipping_info?.trim()")
    expect(source).toContain("order.customer_note?.trim()")
    expect(source).toContain("order.internal_notes?.trim()")
    expect(source).toContain('data-track="product_order_card_context_details"')
    expect(source).toContain('<strong>寄送資訊：</strong>')
    expect(source).toContain('<strong>客戶備註：</strong>')
    expect(source).toContain('<strong>內部備註：</strong>')
  })

  it('shows actual settlement totals on fully settled order cards', () => {
    expect(apiSource).toContain(
      'settlements:shop_order_settlements(id, amount_total, settled_at)',
    )
    expect(source).toContain(
      "statusKey === 'settled' ? settlementAmountTotal(order.settlements) : null",
    )
    expect(source).toContain('<span>結帳金額</span>')
  })
})
