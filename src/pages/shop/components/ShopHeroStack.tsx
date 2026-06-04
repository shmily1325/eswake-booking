import { getAllShopHeroImageUrls } from '../lib/shopHeroPreload'
import { SHOP_HERO_IMG_BASE } from '../lib/shopHeroStyle'

const ALL_HERO_URLS = getAllShopHeroImageUrls()

const HIDDEN_LAYER = SHOP_HERO_IMG_BASE + ' opacity-0 pointer-events-none'

type ShopHeroStackProps = {
  activeSrc: string
  activeClassName: string
}

/** 所有 hero 常駐 DOM，切換只改 opacity，避免換 src 重解碼 */
export function ShopHeroStack({ activeSrc, activeClassName }: ShopHeroStackProps) {
  return (
    <>
      {ALL_HERO_URLS.map((url) => (
        <img
          key={url}
          src={url}
          alt=""
          aria-hidden={url !== activeSrc}
          className={
            url === activeSrc
              ? activeClassName + ' opacity-100 will-change-[opacity]'
              : HIDDEN_LAYER
          }
          decoding="async"
          loading="eager"
          fetchPriority={url === activeSrc ? 'high' : 'low'}
        />
      ))}
    </>
  )
}

type ShopHeroPanelStackProps = {
  visibleSrc: string
  visibleClassName: string
}

/** 拼貼單欄：只顯示指定 src */
export function ShopHeroPanelStack({
  visibleSrc,
  visibleClassName,
}: ShopHeroPanelStackProps) {
  return (
    <>
      {ALL_HERO_URLS.map((url) => (
        <img
          key={url}
          src={url}
          alt=""
          aria-hidden={url !== visibleSrc}
          className={
            url === visibleSrc
              ? visibleClassName + ' opacity-100 will-change-[opacity]'
              : HIDDEN_LAYER
          }
          decoding="async"
          loading="eager"
          fetchPriority={url === visibleSrc ? 'high' : 'low'}
        />
      ))}
    </>
  )
}
