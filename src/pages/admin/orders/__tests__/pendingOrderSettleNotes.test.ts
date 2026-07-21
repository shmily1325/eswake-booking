import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(
    process.cwd(),
    'src/pages/admin/orders/PendingOrderSettleItem.tsx',
  ),
  'utf8',
)

describe('pending order settlement context', () => {
  it('shows delivery details and order notes on the card and in final confirmation', () => {
    expect(source).toContain("order.shipping_info?.trim()")
    expect(source).toContain("order.customer_note?.trim()")
    expect(source).toContain("order.internal_notes?.trim()")
    expect(source).toContain('data-track="product_order_settle_delivery_details"')
    expect(source).toContain('data-track="product_order_settle_order_notes"')
    expect(source).toContain('`交付方式：${deliveryMethodLabel(order.delivery_method)}`')
    expect(source).toContain('`寄送資訊：${shippingInfo}`')
    expect(source).toContain('`客戶備註：${customerNote}`')
    expect(source).toContain('`內部備註：${internalNotes}`')
    expect(source.match(/<strong>客戶備註：<\/strong>/g)).toHaveLength(1)
    expect(source.match(/<strong>內部備註：<\/strong>/g)).toHaveLength(1)
  })
})
