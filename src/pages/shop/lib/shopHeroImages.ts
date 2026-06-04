import type { ShopGroup } from '../../admin/products/schema'
import { ALL_GROUPS, ALL_SUBCATS, type ShopFilterState, type TopLevel } from './shopFilters'

export type ShopHeroKey = 'catalog' | ShopGroup

/** action = 直向動作照加高；square = 近方形圖，置中、較少放大 */
export type ShopHeroFrame = 'action' | 'square'

export type ShopHeroImageConfig = {
  src: string
  objectPosition: string
  objectPositionClass: string
  collectionObjectPosition?: string
  collectionObjectPositionClass?: string
  collectionAspectClass?: string
  tallCollectionBand?: boolean
  heroFrame?: ShopHeroFrame
  /** 覆寫縮放；較小 scale = 露出更多畫面（動作照常用） */
  heroScaleClass?: string
}

export const SHOP_HERO_IMAGES: Record<ShopHeroKey, ShopHeroImageConfig> = {
  catalog: {
    src: '/shop/heroes/catalog.jpg',
    objectPosition: '38% 48%',
    // 意象照 #8：Nautique + 人物，焦點略左保留船名與人
    objectPositionClass:
      'object-[38%_52%] sm:object-[36%_50%] md:object-[34%_48%] lg:object-[32%_46%]',
  },
  Wakeboarding: {
    src: '/shop/heroes/wakeboarding.jpg',
    objectPosition: 'center 40%',
    // 意象照 #1：滑手置中、船與水花在下；略低 Y 保留跳躍＋船尾情境
    objectPositionClass:
      'object-[center_42%] sm:object-[center_40%] md:object-[center_38%]',
    collectionObjectPosition: 'center 36%',
    collectionObjectPositionClass:
      'object-[center_38%] max-sm:object-[center_36%] sm:object-[center_42%] md:object-[center_38%] lg:object-[center_34%]',
    heroFrame: 'action',
    // 手機略放大裁切；桌機維持較廣
    heroScaleClass: 'max-sm:scale-[1.12] sm:scale-[1.03]',
  },
  Wakesurfing: {
    src: '/shop/heroes/wakesurfing.jpg',
    objectPosition: 'center 28%',
    // 意象照 #5：直幅動作照，焦點在上段滑手與板
    objectPositionClass:
      'object-[center_30%] sm:object-[center_28%] md:object-[center_26%] lg:object-[center_24%]',
    collectionObjectPosition: 'center 26%',
    collectionObjectPositionClass:
      'object-[center_28%] max-sm:object-[center_28%] sm:object-[center_26%] md:object-[center_28%] lg:object-[center_24%]',
    heroFrame: 'action',
    heroScaleClass: 'scale-[1.04]',
    collectionAspectClass:
      'sm:min-h-[220px] md:min-h-[248px] lg:aspect-[2.4/1] lg:max-h-[320px] lg:min-h-0',
  },
  Essentials: {
    src: '/shop/heroes/essentials.jpg',
    objectPosition: 'center 42%',
    // 意象照 #17：背心特寫，人物置中
    objectPositionClass:
      'object-[center_44%] sm:object-[center_42%] md:object-[center_40%]',
    collectionObjectPosition: 'center 42%',
    collectionObjectPositionClass:
      'object-[center_44%] max-sm:object-[center_44%] sm:object-[center_42%] md:object-[center_40%] lg:object-[center_38%]',
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
      'object-[center_50%] sm:object-[center_50%] md:object-[center_50%]',
    collectionObjectPosition: '50% 50%',
    collectionObjectPositionClass: 'object-[50%_50%]',
    heroFrame: 'square',
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

/** 依大類／子分類回傳 hero（供預載、hover 用） */
export function getShopHeroConfigForCategory(
  topLevel: TopLevel,
  subCat: string = ALL_SUBCATS,
): ShopHeroImageConfig | null {
  const isCatalog = topLevel === ALL_GROUPS && subCat === ALL_SUBCATS
  if (isCatalog) return SHOP_HERO_IMAGES.catalog

  if (subCat !== ALL_SUBCATS) {
    const sub = SHOP_SUBCATEGORY_HERO_IMAGES[subCat]
    if (sub) return sub
  }

  if (topLevel !== ALL_GROUPS) {
    return SHOP_HERO_IMAGES[topLevel]
  }

  return null
}

/** 依目前篩選回傳 hero 設定；無圖時 null */
export function getShopHeroForFilters(
  filters: ShopFilterState,
  isCatalogHome: boolean,
): ShopHeroImageConfig | null {
  if (isCatalogHome) return SHOP_HERO_IMAGES.catalog
  return getShopHeroConfigForCategory(filters.topLevel, filters.subCat)
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
