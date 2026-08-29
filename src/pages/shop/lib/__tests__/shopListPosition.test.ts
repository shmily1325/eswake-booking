import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearShopListPosition,
  readShopListPosition,
  saveShopListPosition,
} from '../shopListPosition'

describe('shopListPosition', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-29T12:00:00Z'))
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 420,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('stores vertical and horizontal positions independently by return path', () => {
    saveShopListPosition('/shop?brand=Follow', { key: 'sale', left: 180 })
    saveShopListPosition('/shop/cart')

    expect(readShopListPosition('/shop?brand=Follow')).toMatchObject({
      y: 420,
      horizontal: { sale: 180 },
    })
    expect(readShopListPosition('/shop/cart')).toMatchObject({
      y: 420,
      horizontal: {},
    })
  })

  it('merges positions from multiple home gallery rows', () => {
    saveShopListPosition('/shop', { key: 'pre-order', left: 120 })
    saveShopListPosition('/shop', { key: 'sale', left: 360 })

    expect(readShopListPosition('/shop')?.horizontal).toEqual({
      'pre-order': 120,
      sale: 360,
    })
  })

  it('expires a saved position after thirty minutes', () => {
    saveShopListPosition('/shop')
    vi.advanceTimersByTime(30 * 60 * 1000 + 1)

    expect(readShopListPosition('/shop')).toBeNull()
  })

  it('clears a restored position', () => {
    saveShopListPosition('/shop/cart')
    clearShopListPosition('/shop/cart')
    expect(readShopListPosition('/shop/cart')).toBeNull()
  })
})
