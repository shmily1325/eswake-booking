import type { ShopGroup } from '../../admin/products/schema'
import { ALL_GROUPS, type TopLevel } from './shopFilters'

export type ShopHeroKey = 'catalog' | ShopGroup

export type ShopHeroImageConfig = {
  src: string
  /** 全幅 Catalog 或較高 hero */
  objectPosition: string
  /** 分類頁矮橫幅；直向素材需把焦點下移才看得到身體／板子 */
  collectionObjectPosition?: string
  /** 直向照片在 collection 模式略增高，減少只裁到頭部 */
  tallCollectionBand?: boolean
}

export const SHOP_HERO_IMAGES: Record<ShopHeroKey, ShopHeroImageConfig> = {
  catalog: {
    src: '/shop/heroes/catalog.jpg',
    objectPosition: 'center 32%',
  },
  Wakeboarding: {
    src: '/shop/heroes/wakeboarding.jpg',
    objectPosition: 'center 42%',
    collectionObjectPosition: 'center 50%',
  },
  Wakesurfing: {
    src: '/shop/heroes/wakesurfing.jpg',
    objectPosition: 'center 42%',
    collectionObjectPosition: 'center 48%',
  },
  Essentials: {
    src: '/shop/heroes/essentials.jpg',
    objectPosition: 'center 40%',
    collectionObjectPosition: 'center 22%',
    tallCollectionBand: true,
  },
}

export function getShopHeroObjectPosition(
  heroKey: ShopHeroKey,
  isCatalog: boolean,
): string {
  const cfg = SHOP_HERO_IMAGES[heroKey]
  if (!isCatalog && cfg.collectionObjectPosition) {
    return cfg.collectionObjectPosition
  }
  return cfg.objectPosition
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
