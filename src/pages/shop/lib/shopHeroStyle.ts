/** 全店 hero 共用：對比、飽和、微壓暗，風格一致 */
export const SHOP_HERO_IMG_FILTER = 'contrast-[1.06] saturate-[1.04] brightness-[0.98]'

/** 掛在 <picture> 外層 */
export const SHOP_HERO_PICTURE_WRAP = 'absolute inset-0 block size-full'

/** 掛在 <img>：裁切與 filter（含 object-position / scale） */
export const SHOP_HERO_IMG_FILL = 'block size-full object-cover'

export const SHOP_HERO_IMG_VISUAL = `${SHOP_HERO_IMG_FILL} ${SHOP_HERO_IMG_FILTER}`

/** @deprecated 等同 SHOP_HERO_IMG_VISUAL，供 ShopListHero 組 class */
export const SHOP_HERO_IMG_BASE = SHOP_HERO_IMG_VISUAL
