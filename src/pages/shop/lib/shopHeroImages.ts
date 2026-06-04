import type { ShopGroup } from '../../admin/products/schema'
import { ALL_GROUPS, type TopLevel } from './shopFilters'

export type ShopHeroKey = 'catalog' | ShopGroup

export type ShopHeroImageConfig = {
  src: string
  objectPosition: string
  objectPositionClass: string
  collectionObjectPosition?: string
  collectionObjectPositionClass?: string
  /** 分類頁桌機橫幅比例（方形／直向素材需較高，避免裁成模糊水花） */
  collectionAspectClass?: string
  tallCollectionBand?: boolean
}

export const SHOP_HERO_IMAGES: Record<ShopHeroKey, ShopHeroImageConfig> = {
  catalog: {
    src: '/shop/heroes/catalog.jpg',
    objectPosition: 'center 42%',
    // 橫向船照：置中偏下，左側留給 CATALOG 字
    objectPositionClass:
      'object-[center_45%] sm:object-[52%_42%] md:object-[55%_40%] lg:object-[58%_38%]',
  },
  Wakeboarding: {
    src: '/shop/heroes/wakeboarding.jpg',
    objectPosition: 'center 42%',
    objectPositionClass:
      'object-[center_42%] sm:object-[52%_44%] md:object-[55%_48%] lg:object-[58%_50%]',
    collectionObjectPosition: '50% 58%',
    collectionObjectPositionClass:
      'object-[50%_58%] max-sm:object-[52%_60%] sm:object-[50%_58%] md:object-[48%_56%] lg:object-[46%_54%]',
    collectionAspectClass:
      'sm:min-h-[220px] md:min-h-[248px] lg:aspect-[2.35/1] lg:max-h-[320px] lg:min-h-0',
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
      'object-[center_20%] max-sm:object-[48%_24%] sm:object-[42%_22%] md:object-[48%_24%]',
    collectionAspectClass:
      'sm:min-h-[220px] md:min-h-[260px] lg:aspect-[2.5/1] lg:max-h-[300px] lg:min-h-0',
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
