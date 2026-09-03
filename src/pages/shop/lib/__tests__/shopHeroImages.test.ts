import { describe, expect, it } from 'vitest'
import {
  getShopHeroConfigForCategory,
  SHOP_HERO_IMAGES,
  SHOP_SUBCATEGORY_HERO_IMAGES,
} from '../shopHeroImages'
import { ALL_GROUPS } from '../shopFilters'

describe('getShopHeroConfigForCategory', () => {
  it('uses a dedicated hero when the subcategory has one', () => {
    expect(getShopHeroConfigForCategory(ALL_GROUPS, 'wb_board')).toBe(
      SHOP_SUBCATEGORY_HERO_IMAGES.wb_board,
    )
  })

  it('falls back to the subcategory group hero', () => {
    expect(getShopHeroConfigForCategory(ALL_GROUPS, 'wb_handle')).toBe(
      SHOP_HERO_IMAGES.Wakeboarding,
    )
    expect(getShopHeroConfigForCategory(ALL_GROUPS, 'ws_wax')).toBe(
      SHOP_HERO_IMAGES.Wakesurfing,
    )
    expect(getShopHeroConfigForCategory(ALL_GROUPS, 'es_series')).toBe(
      SHOP_HERO_IMAGES.ES,
    )
  })
})
