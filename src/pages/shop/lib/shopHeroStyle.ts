/** 全店 hero 共用：對比、飽和、微壓暗，風格一致 */
export const SHOP_HERO_IMG_FILTER = 'contrast-[1.06] saturate-[1.04] brightness-[0.98]'

/** 單張 hero <img>（勿用 block 在 picture 內，易黑屏） */
export const SHOP_HERO_LAYER = 'absolute inset-0 h-full w-full object-cover'

export const SHOP_HERO_IMG_BASE = `${SHOP_HERO_LAYER} ${SHOP_HERO_IMG_FILTER}`
