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
): ProductWithVariants {
  return {
    id,
    category: 'lifejacket',
    brand: 'Follow',
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
    product('stock-photo', 'in_stock', 'https://img/a.jpg'),
    product('stock-blank', 'in_stock', null),
    product('pre-photo', 'pre_order', 'https://img/b.jpg', 0),
    product('pre-blank', 'pre_order', null, 0),
  ]

  it('keeps in-stock products that have a cover', () => {
    expect(collectHomeGalleryPool(products, 'in-stock').map((p) => p.productId)).toEqual([
      'stock-photo',
    ])
  })

  it('keeps pre-order products that have a cover', () => {
    expect(collectHomeGalleryPool(products, 'pre-order').map((p) => p.productId)).toEqual([
      'pre-photo',
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
    expect(
      collectHomeGalleryPool([...products, tagged], 'sale', [red]).map((p) => p.productId),
    ).toEqual(['red-tag'])
  })
})

describe('pickHomeGalleryItems', () => {
  const pool = 'abcdefghijklmnopqr'.split('').map((id) => ({
    productId: id,
    brand: 'Follow',
    title: id,
    imageUrl: `https://img/${id}.jpg`,
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
