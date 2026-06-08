import { describe, expect, it } from 'vitest'
import {
  isAllowedShopHostPath,
  isShopPublicStaticPath,
  resolveShopHost,
  shopLegacyRedirectResponse,
} from '../shopHost'

describe('shopHost', () => {
  it('resolves host from base URL', () => {
    expect(resolveShopHost('https://shop.eswakeschool.com')).toBe('shop.eswakeschool.com')
    expect(resolveShopHost()).toBe('shop.eswakeschool.com')
  })

  it('treats hero and build assets as public static paths', () => {
    expect(isShopPublicStaticPath('/shop/heroes/wakesurfing.webp')).toBe(true)
    expect(isShopPublicStaticPath('/shop/heroes/catalog.jpg')).toBe(true)
    expect(isShopPublicStaticPath('/assets/index-abc.js')).toBe(true)
    expect(isShopPublicStaticPath('/logo_circle (black).png')).toBe(true)
    expect(isShopPublicStaticPath('/cart')).toBe(false)
  })

  it('allows shop SPA routes and static files on shop host', () => {
    expect(isAllowedShopHostPath('/')).toBe(true)
    expect(isAllowedShopHostPath('/cart')).toBe(true)
    expect(isAllowedShopHostPath('/pre-order')).toBe(true)
    expect(isAllowedShopHostPath('/shop/heroes/catalog.jpg')).toBe(true)
    expect(isAllowedShopHostPath('/assets/index.js')).toBe(true)
    expect(isAllowedShopHostPath('/123e4567-e89b-12d3-a456-426614174000')).toBe(true)
  })

  it('blocks admin paths on shop host', () => {
    expect(isAllowedShopHostPath('/members')).toBe(false)
    expect(isAllowedShopHostPath('/liff/book')).toBe(false)
    expect(isAllowedShopHostPath('/heroes/wakesurfing.webp')).toBe(false)
  })

  it('redirects legacy /shop SPA paths only', () => {
    const cart = new URL('https://shop.eswakeschool.com/shop/cart?x=1')
    const res = shopLegacyRedirectResponse(cart)
    expect(res?.status).toBe(301)
    expect(res?.headers.get('location')).toBe('https://shop.eswakeschool.com/cart?x=1')

    const list = new URL('https://shop.eswakeschool.com/shop?group=Wakesurfing')
    const listRes = shopLegacyRedirectResponse(list)
    expect(listRes?.headers.get('location')).toBe('https://shop.eswakeschool.com/?group=Wakesurfing')
  })

  it('does not redirect static files under /shop/', () => {
    const hero = new URL('https://shop.eswakeschool.com/shop/heroes/wakesurfing.webp')
    expect(shopLegacyRedirectResponse(hero)).toBeNull()

    const future = new URL('https://shop.eswakeschool.com/shop/banners/promo.webp')
    expect(shopLegacyRedirectResponse(future)).toBeNull()
  })
})
