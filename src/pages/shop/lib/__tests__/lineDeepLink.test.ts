import { describe, expect, it } from 'vitest'
import { buildCartInquiry, buildSingleInquiry } from '../lineDeepLink'
import type { CartItem } from '../../types'

describe('LINE inquiry prices', () => {
  it('writes sale price with original for a pre-order SKU', () => {
    const payload = buildSingleInquiry({
      productId: 'p1',
      productName: 'Follow ANTHEM',
      categoryId: 'lifejacket',
      attributes: {},
      quantity: 1,
      unitPrice: 8100,
      originalPrice: 10125,
      discountCaption: '預購 8折',
      isPreOrder: true,
    })
    expect(payload.message).toContain('我想預購以下商品：')
    expect(payload.message).toContain(
      '單價：NT$ 8,100（預購 8折，原價 NT$ 10,125）',
    )
  })

  it('writes fold caption for leftover stock', () => {
    const payload = buildSingleInquiry({
      productId: 'p1',
      productName: 'Follow ANTHEM',
      categoryId: 'lifejacket',
      attributes: {},
      quantity: 1,
      unitPrice: 6075,
      originalPrice: 10125,
      discountCaption: '6折',
      isPreOrder: false,
    })
    expect(payload.message).toContain(
      '單價：NT$ 6,075（6折，原價 NT$ 10,125）',
    )
  })

  it('uses sale snapshots in cart inquiry totals', () => {
    const items: CartItem[] = [
      {
        variantId: 'v1',
        productId: 'p1',
        productName: 'Follow ANTHEM',
        categoryId: 'lifejacket',
        attributes: {},
        imageUrl: null,
        unitPrice: 8100,
        originalPrice: 10125,
        discountCaption: '預購 8折',
        quantity: 2,
        addedAt: 1,
        availability: 'pre_order',
        preOrderEta: 'Oct',
      },
    ]
    const payload = buildCartInquiry(items)
    expect(payload.message).toContain(
      '單價：NT$ 8,100（預購 8折，原價 NT$ 10,125）',
    )
    expect(payload.message).toContain('預估金額：NT$ 16,200')
  })
})
