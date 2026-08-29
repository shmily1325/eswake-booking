import { describe, expect, it } from 'vitest'
import {
  getShopReturnTo,
  shopListPathFromLocation,
  SHOP_RETURN_TO_KEY,
} from '../shopReturnTo'
import { shopSearchPath, shopTo } from '../shopPaths'

describe('shopReturnTo', () => {
  it('captures list path with query', () => {
    expect(
      shopListPathFromLocation('/shop', '?group=Wakeboarding&cat=wb_board'),
    ).toBe('/shop?group=Wakeboarding&cat=wb_board')
  })

  it('reads return path from navigation state', () => {
    expect(
      getShopReturnTo({
        [SHOP_RETURN_TO_KEY]: '/shop?group=Wakeboarding',
      }),
    ).toBe('/shop?group=Wakeboarding')
  })

  it('falls back to /shop', () => {
    expect(getShopReturnTo(null)).toBe('/shop')
  })
})

describe('shopTo', () => {
  it('clears search so the same pathname can return home', () => {
    expect(shopTo('/shop')).toEqual({ pathname: '/shop', search: '' })
  })

  it('keeps collection query when going back to a list', () => {
    expect(shopTo('/shop?preorder=1')).toEqual({
      pathname: '/shop',
      search: '?preorder=1',
    })
  })
})

describe('shopSearchPath', () => {
  it('preserves collection and availability filters when searching', () => {
    expect(
      shopSearchPath('?group=Wakeboarding&stock=1&sort=price-asc', 'board'),
    ).toBe('/shop?group=Wakeboarding&stock=1&sort=price-asc&q=board')
  })

  it('only removes q when clearing a search', () => {
    expect(shopSearchPath('?preorder=1&q=board&brand=Follow', '')).toBe(
      '/shop?preorder=1&brand=Follow',
    )
  })
})
