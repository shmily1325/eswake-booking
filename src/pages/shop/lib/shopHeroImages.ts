import type { ShopGroup } from '../../admin/products/schema'
import { ALL_GROUPS, ALL_SUBCATS, type ShopFilterState, type TopLevel } from './shopFilters'

export type ShopHeroKey = 'catalog' | ShopGroup

export type ShopHeroImageConfig = {
  src: string
  objectPosition: string
  objectPositionClass: string
  collectionObjectPosition?: string
  collectionObjectPositionClass?: string
  collectionAspectClass?: string
  tallCollectionBand?: boolean
}

export const SHOP_HERO_IMAGES: Record<ShopHeroKey, ShopHeroImageConfig> = {
  catalog: {
    src: '/shop/heroes/catalog.jpg',
    objectPosition: 'center 42%',
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

/** 子分類專用 hero（選 Boards / Boots 等時覆蓋上層 group 圖） */
export const SHOP_SUBCATEGORY_HERO_IMAGES: Record<string, ShopHeroImageConfig> = {
  wb_boots: {
    src: '/shop/heroes/wb-boots.jpg',
    objectPosition: 'center 58%',
    objectPositionClass:
      'object-[center_60%] sm:object-[50%_58%] md:object-[48%_55%]',
    collectionObjectPosition: 'center 62%',
    collectionObjectPositionClass:
      'object-[center_65%] max-sm:object-[center_68%] sm:object-[50%_60%] md:object-[48%_58%]',
    collectionAspectClass:
      'sm:min-h-[220px] md:min-h-[260px] lg:aspect-[2.45/1] lg:max-h-[300px] lg:min-h-0',
    tallCollectionBand: true,
  },
}

export function getShopHeroPositionClass(
  cfg: ShopHeroImageConfig,
  isCatalog: boolean,
): string {
  if (!isCatalog && cfg.collectionObjectPositionClass) {
    return cfg.collectionObjectPositionClass
  }
  return cfg.objectPositionClass
}

/** 依目前篩選回傳 hero 設定；無圖時 null */
export function getShopHeroForFilters(
  filters: ShopFilterState,
  isCatalogHome: boolean,
): ShopHeroImageConfig | null {
  if (isCatalogHome) return SHOP_HERO_IMAGES.catalog

  if (filters.subCat !== ALL_SUBCATS) {
    const sub = SHOP_SUBCATEGORY_HERO_IMAGES[filters.subCat]
    if (sub) return sub
  }

  if (filters.topLevel !== ALL_GROUPS) {
    return SHOP_HERO_IMAGES[filters.topLevel]
  }

  return null
}

/** @deprecated 使用 getShopHeroForFilters */
export function resolveShopHeroKey(
  isCatalogHome: boolean,
  topLevel: TopLevel,
): ShopHeroKey | null {
  if (isCatalogHome) return 'catalog'
  if (topLevel !== ALL_GROUPS) return topLevel
  return null
}
