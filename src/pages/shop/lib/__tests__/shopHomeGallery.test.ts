import { describe, expect, it } from 'vitest'
import type { ProductWithVariants } from '../../../admin/products/types'
import {
  collectHomeGalleryPool,
  pickHomeGalleryItems,
} from '../shopHomeGallery'

function product(
  id: string,
  availability: 'in_stock' | 'pre_order',
  image: string | null,
  stock = 1,
  discountPresetId: string | null = null,
  category = 'lifejacket',
  brand = 'Follow',
): ProductWithVariants {
  return {
    id,
    category,
    brand,
    model: id,
    color: 'red',
    is_public: true,
    variants: [
      {
        id: `${id}-v`,
        product_id: id,
        stock,
        reserved_qty: 0,
        availability,
        price: 10000,
        discount_preset_id: discountPresetId,
        cover_image_url: image,
        cover_images: image ? [{ url: image, path: '' }] : [],
        image_url: null,
      },
    ],
  } as ProductWithVariants
}

describe('collectHomeGalleryPool', () => {
  const products = [
    product('es-photo', 'in_stock', 'https://img/es.jpg', 1, null, 'es_series'),
    product('es-pre', 'pre_order', 'https://img/es-pre.jpg', 0, null, 'es_series'),
    product('es-blank', 'in_stock', null),
    product('stock-photo', 'in_stock', 'https://img/a.jpg', 1, null, 'wb_board'),
    product('stock-blank', 'in_stock', null, 1, null, 'wb_board'),
    product('pre-photo', 'pre_order', 'https://img/b.jpg', 0),
    product('pre-blank', 'pre_order', null, 0),
  ]

    it('keeps every listed ES SERIES product in the ES Series pool', () => {
    expect(collectHomeGalleryPool(products, 'es-series').map((p) => p.productId)).toEqual([
      'es-photo',
      'es-pre',
    ])
  })

  it('keeps ES SERIES out of In-Stock, Pre-Order, and Sale', () => {
    expect(collectHomeGalleryPool(products, 'in-stock').map((p) => p.productId)).toEqual([
      'stock-photo',
    ])
    expect(collectHomeGalleryPool(products, 'pre-order').map((p) => p.productId)).toEqual([
      'pre-photo',
    ])
    expect(collectHomeGalleryPool(products, 'sale').map((p) => p.productId)).toEqual([])
  })

  it('keeps pre-order products that have a cover', () => {
    expect(collectHomeGalleryPool(products, 'pre-order').map((p) => p.productId)).toEqual([
      'pre-photo',
    ])
  })

  it('shows pre-order fold and sale price when a campaign is on', () => {
    const preorder = {
      id: 'pre',
      kind: 'preorder' as const,
      name: '預購全館',
      label: '8折',
      percent: 80,
      is_active: true,
      sort_order: 0,
    }
    expect(collectHomeGalleryPool(products, 'pre-order', [preorder])).toEqual([
      expect.objectContaining({
        productId: 'pre-photo',
        saleText: 'NT$ 8,000',
        originalText: 'NT$ 10,000',
        offerFold: '8折',
      }),
    ])
  })

  it('keeps tagged leftovers in the sale pool and skips untagged stock', () => {
    const red = {
      id: 'red',
      kind: 'tag' as const,
      name: '紅標',
      label: '紅標',
      percent: 60,
      is_active: true,
      sort_order: 1,
    }
    const tagged = product('red-tag', 'in_stock', 'https://img/c.jpg', 1, 'red')
    const withTagged = [...products, tagged]
    const sale = collectHomeGalleryPool(withTagged, 'sale', [red])
    expect(sale).toEqual([
      expect.objectContaining({
        productId: 'red-tag',
        saleText: 'NT$ 6,000',
        originalText: 'NT$ 10,000',
        offerFold: '6折',
      }),
    ])
    expect(
      collectHomeGalleryPool(withTagged, 'in-stock', [red]).map((p) => p.productId),
    ).toEqual(['stock-photo'])
    expect(
      collectHomeGalleryPool(withTagged, 'es-series', [red]).map((p) => p.productId),
    ).toEqual(['es-photo', 'es-pre'])
  })

  it('keeps tagged ES SERIES leftovers in ES Series, not Sale', () => {
    const red = {
      id: 'red',
      kind: 'tag' as const,
      name: '紅標',
      label: '紅標',
      percent: 60,
      is_active: true,
      sort_order: 1,
    }
    const taggedEs = product(
      'es-sale',
      'in_stock',
      'https://img/es-sale.jpg',
      1,
      'red',
      'es_series',
    )
    expect(
      collectHomeGalleryPool([taggedEs], 'sale', [red]).map((p) => p.productId),
    ).toEqual([])
    expect(
      collectHomeGalleryPool([taggedEs], 'es-series', [red]).map((p) => p.productId),
    ).toEqual(['es-sale'])
  })

  it('keeps tagged pre-order out of the sale pool', () => {
    const red = {
      id: 'red',
      kind: 'tag' as const,
      name: '紅標',
      label: '紅標',
      percent: 60,
      is_active: true,
      sort_order: 1,
    }
    const taggedPre = product('pre-red', 'pre_order', 'https://img/d.jpg', 0, 'red')
    expect(
      collectHomeGalleryPool([taggedPre], 'sale', [red]).map((p) => p.productId),
    ).toEqual([])
  })
})

describe('pickHomeGalleryItems', () => {
  const pool = 'abcdefghijklmnopqr'.split('').map((id) => ({
    productId: id,
    brand: 'Follow',
    title: id,
    subtitle: '',
    imageUrl: `https://img/${id}.jpg`,
    saleText: null,
    originalText: null,
    offerFold: null,
    memberText: null,
  }))

  it('is stable for the same seed', () => {
    expect(pickHomeGalleryItems(pool, 42).map((p) => p.productId)).toEqual(
      pickHomeGalleryItems(pool, 42).map((p) => p.productId),
    )
  })

  it('caps at the limit', () => {
    expect(pickHomeGalleryItems(pool, 1, 4)).toHaveLength(4)
  })

  it('defaults to eight homepage slides', () => {
    expect(pickHomeGalleryItems(pool, 1)).toHaveLength(8)
  })

  it('returns a different order for a different seed', () => {
    expect(pickHomeGalleryItems(pool, 1).map((p) => p.productId)).not.toEqual(
      pickHomeGalleryItems(pool, 99).map((p) => p.productId),
    )
  })
})
