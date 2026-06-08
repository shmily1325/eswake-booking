import { describe, expect, it } from 'vitest'
import {
  isAllowedShopHostPath,
  resolveShopHost,
  shopLegacyRedirectResponse,
} from '../shopHost'

describe('shopHost', () => {
  it('resolves host from base URL', () => {
    expect(resolveShopHost('https://shop.eswakeschool.com')).toBe('shop.eswakeschool.com')
    expect(resolveShopHost()).toBe('shop.eswakeschool.com')
  })

  it('allows shop root routes and product UUID', () => {
    expect(isAllowedShopHostPath('/')).toBe(true)
    expect(isAllowedShopHostPath('/cart')).toBe(true)
    expect(isAllowedShopHostPath('/pre-order')).toBe(true)
    expect(isAllowedShopHostPath('/shop/heroes/catalog.jpg')).toBe(true)
    expect(isAllowedShopHostPath('/123e4567-e89b-12d3-a456-426614174000')).toBe(true)
  })

  it('blocks admin paths on shop host', () => {
    expect(isAllowedShopHostPath('/members')).toBe(false)
    expect(isAllowedShopHostPath('/liff/book')).toBe(false)
  })

  it('redirects legacy /shop paths', () => {
    const url = new URL('https://shop.eswakeschool.com/shop/cart?x=1')
    const res = shopLegacyRedirectResponse(url)
    expect(res?.status).toBe(301)
    expect(res?.headers.get('location')).toBe('https://shop.eswakeschool.com/cart?x=1')
  })

  it('does not redirect hero images under /shop/heroes/', () => {
    const url = new URL('https://shop.eswakeschool.com/shop/heroes/wakesurfing.webp')
    expect(shopLegacyRedirectResponse(url)).toBeNull()
  })
})
