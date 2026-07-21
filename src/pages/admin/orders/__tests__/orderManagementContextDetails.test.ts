import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), 'src/pages/admin/orders/OrderManagement.tsx'),
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
})
