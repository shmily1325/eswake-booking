import type { ShopGroup } from '../../admin/products/schema'
import { ALL_GROUPS, type TopLevel } from './shopFilters'

export type ShopHeroKey = 'catalog' | ShopGroup

export type ShopHeroImageConfig = {
  src: string
  /** 手機預設 object-position（inline fallback） */
  objectPosition: string
  /** Tailwind responsive object-position；寬螢幕與直向素材必備 */
  objectPositionClass: string
  collectionObjectPosition?: string
  collectionObjectPositionClass?: string
  tallCollectionBand?: boolean
}

export const SHOP_HERO_IMAGES: Record<ShopHeroKey, ShopHeroImageConfig> = {
  catalog: {
    src: '/shop/heroes/catalog.jpg',
    objectPosition: 'center 30%',
    // 直向照：手機置中，桌機焦點右移，人物在右、左側留給 CATALOG 字
    objectPositionClass:
      'object-[center_30%] sm:object-[58%_28%] md:object-[68%_26%] lg:object-[78%_24%] xl:object-[86%_22%]',
  },
  Wakeboarding: {
    src: '/shop/heroes/wakeboarding.jpg',
    objectPosition: 'center 42%',
    objectPositionClass:
      'object-[center_42%] sm:object-[52%_44%] md:object-[55%_48%] lg:object-[58%_50%]',
    collectionObjectPosition: 'center 50%',
    collectionObjectPositionClass:
      'object-[center_48%] sm:object-[52%_50%] md:object-[55%_52%]',
  },
  Wakesurfing: {
    src: '/shop/heroes/wakesurfing.jpg',
    objectPosition: 'center 42%',
    objectPositionClass:
      'object-[center_40%] sm:object-[50%_42%] md:object-[55%_45%] lg:object-[60%_48%]',
    collectionObjectPosition: 'center 48%',
    collectionObjectPositionClass:
      'object-[center_45%] sm:object-[52%_46%] md:object-[58%_48%]',
  },
  Essentials: {
    src: '/shop/heroes/essentials.jpg',
    objectPosition: 'center 40%',
    objectPositionClass:
      'object-[center_35%] sm:object-[45%_32%] md:object-[50%_30%]',
    collectionObjectPosition: 'center 22%',
    collectionObjectPositionClass:
      'object-[center_20%] sm:object-[42%_22%] md:object-[48%_24%]',
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

export function getShopHeroObjectPositionClass(
  heroKey: ShopHeroKey,
  isCatalog: boolean,
): string {
  const cfg = SHOP_HERO_IMAGES[heroKey]
  if (!isCatalog && cfg.collectionObjectPositionClass) {
    return cfg.collectionObjectPositionClass
  }
  return cfg.objectPositionClass
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
