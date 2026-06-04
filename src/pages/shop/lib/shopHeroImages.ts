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
    objectPosition: '38% 48%',
    // 船在中左：焦點偏左，桌機勿往右移到僅剩人物
    objectPositionClass:
      'object-[38%_52%] sm:object-[34%_48%] md:object-[32%_46%] lg:object-[30%_44%]',
  },
  Wakeboarding: {
    src: '/shop/heroes/wakeboarding.jpg',
    objectPosition: 'center 32%',
    objectPositionClass:
      'object-[center_30%] sm:object-[58%_28%] md:object-[68%_26%] lg:object-[78%_24%]',
    collectionObjectPosition: '55% 32%',
    collectionObjectPositionClass:
      'object-[center_34%] max-sm:object-[center_36%] sm:object-[58%_32%] md:object-[62%_30%] lg:object-[68%_28%]',
  },
  Wakesurfing: {
    src: '/shop/heroes/wakesurfing.jpg',
    objectPosition: 'center 55%',
    objectPositionClass:
      'object-[center_58%] sm:object-[50%_55%] md:object-[48%_52%] lg:object-[46%_50%]',
    collectionObjectPosition: 'center 58%',
    collectionObjectPositionClass:
      'object-[center_62%] max-sm:object-[center_65%] sm:object-[50%_58%] md:object-[48%_55%] lg:object-[46%_52%]',
    collectionAspectClass:
      'sm:min-h-[220px] md:min-h-[248px] lg:aspect-[2.4/1] lg:max-h-[320px] lg:min-h-0',
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
  wb_board: {
    src: '/shop/heroes/wb-board.jpg',
    objectPosition: 'center 50%',
    objectPositionClass:
      'object-[center_52%] sm:object-[50%_50%] md:object-[48%_52%] lg:object-[46%_54%]',
    collectionObjectPosition: '50% 56%',
    collectionObjectPositionClass:
      'object-[50%_58%] max-sm:object-[52%_60%] sm:object-[50%_56%] md:object-[48%_54%] lg:object-[46%_52%]',
    collectionAspectClass:
      'sm:min-h-[220px] md:min-h-[248px] lg:aspect-[2.35/1] lg:max-h-[320px] lg:min-h-0',
  },
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
  lifejacket: {
    src: '/shop/heroes/lifejacket.jpg',
    objectPosition: 'center 45%',
    objectPositionClass:
      'object-[center_48%] sm:object-[42%_45%] md:object-[38%_42%] lg:object-[35%_40%]',
    collectionObjectPosition: 'center 46%',
    collectionObjectPositionClass:
      'object-[center_50%] max-sm:object-[center_48%] sm:object-[40%_46%] md:object-[38%_44%]',
    collectionAspectClass:
      'sm:min-h-[220px] md:min-h-[248px] lg:aspect-[2.55/1] lg:max-h-[300px] lg:min-h-0',
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
