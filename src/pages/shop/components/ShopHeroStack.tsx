import { SHOP_HERO_IMG_BASE } from '../lib/shopHeroStyle'

type ShopHeroStackProps = {
  activeSrc: string
  activeClassName: string
}

/**
 * 單張 <img> 顯示目前 hero（最穩定）。
 * 預載由 useShopHeroPreload 處理；切換分類靠 key 換圖。
 */
export function ShopHeroStack({ activeSrc, activeClassName }: ShopHeroStackProps) {
  const className =
    activeClassName.trim() || SHOP_HERO_IMG_BASE

  return (
    <img
      key={activeSrc}
      src={activeSrc}
      alt=""
      className={className}
      loading="eager"
      decoding="async"
      fetchPriority="high"
    />
  )
}

type ShopHeroPanelStackProps = {
  visibleSrc: string
  visibleClassName: string
}

export function ShopHeroPanelStack({
  visibleSrc,
  visibleClassName,
}: ShopHeroPanelStackProps) {
  return (
    <ShopHeroStack activeSrc={visibleSrc} activeClassName={visibleClassName} />
  )
}
