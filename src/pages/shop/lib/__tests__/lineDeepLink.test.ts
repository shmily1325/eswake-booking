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
        cartItemId: 'v1',
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

  it('includes customization snapshots without depending on current product config', () => {
    const payload = buildSingleInquiry({
      productId: 'p1',
      productName: 'VIBES AVIATOR',
      categoryId: 'ws_board',
      attributes: { size: "4'8", finish: '客製色' },
      selectedOptions: {
        pantone: { label: 'Pantone 色號', value: '與客服洽詢顏色' },
      },
      quantity: 1,
      unitPrice: 70000,
      isPreOrder: true,
    })
    expect(payload.message).toContain('Pantone 色號：與客服洽詢顏色')
  })

  it('uses made-to-order wording for a single custom order', () => {
    const payload = buildSingleInquiry({
      productId: 'p-custom',
      productName: 'Custom Board',
      categoryId: 'ws_board',
      attributes: {},
      selectedOptions: {
        build_option: { label: 'Build Option', value: 'Custom Color' },
        spray_color: { label: 'Color', value: '待與客服確認' },
      },
      quantity: 1,
      unitPrice: 70000,
      isCustomOrder: true,
    })
    expect(payload.message).toContain('我想客訂以下商品：')
    expect(payload.message).toContain('製作方式：Custom Color')
    expect(payload.message).toContain('顏色：待與客服確認')
    expect(payload.message).not.toContain('類型：客訂')
    expect(payload.message).not.toContain('預計到貨')
  })

  it('marks custom-order lines in a mixed cart inquiry', () => {
    const custom: CartItem = {
      cartItemId: 'custom',
      variantId: 'custom',
      productId: 'p-custom',
      productName: 'Custom Board',
      categoryId: 'ws_board',
      attributes: {},
      imageUrl: null,
      unitPrice: 70000,
      quantity: 1,
      maxQuantity: 99,
      addedAt: 1,
      availability: 'custom_order',
    }
    const stock: CartItem = {
      ...custom,
      cartItemId: 'stock',
      variantId: 'stock',
      productId: 'p-stock',
      productName: 'Stock Vest',
      availability: 'in_stock',
    }
    const payload = buildCartInquiry([custom, stock])
    expect(payload.message).toContain('我想詢問以下商品（含客訂，共 2 件）：')
    expect(payload.message).toContain('Custom Board（客訂／Made to Order）')
  })
})
