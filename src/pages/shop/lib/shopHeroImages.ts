import type { ShopGroup } from '../../admin/products/schema'
import { ALL_GROUPS, type TopLevel } from './shopFilters'

export type ShopHeroKey = 'catalog' | ShopGroup

export const SHOP_HERO_IMAGES: Record<
  ShopHeroKey,
  { src: string; objectPosition: string }
> = {
  catalog: { src: '/shop/heroes/catalog.jpg', objectPosition: 'center 45%' },
  Wakeboarding: {
    src: '/shop/heroes/wakeboarding.jpg',
    objectPosition: 'center 35%',
  },
  Wakesurfing: {
    src: '/shop/heroes/wakesurfing.jpg',
    objectPosition: 'center 30%',
  },
  Essentials: {
    src: '/shop/heroes/essentials.jpg',
    objectPosition: 'center 40%',
  },
}

/** Catalog 首頁或已選 shop group 時回傳 hero 圖 key；預購/搜尋/全部分類則無背景圖 */
export function resolveShopHeroKey(
  isCatalogHome: boolean,
  topLevel: TopLevel,
): ShopHeroKey | null {
  if (isCatalogHome) return 'catalog'
  if (topLevel !== ALL_GROUPS) return topLevel
  return null
}
