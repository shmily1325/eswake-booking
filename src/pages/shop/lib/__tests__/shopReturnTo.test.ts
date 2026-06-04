import { describe, expect, it } from 'vitest'
import {
  getShopReturnTo,
  shopListPathFromLocation,
  SHOP_RETURN_TO_KEY,
} from '../shopReturnTo'

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
