import { useEffect, useState } from 'react'
import { getAllShopHeroImageUrls } from '../lib/shopHeroPreload'
import { SHOP_HERO_IMG_BASE } from '../lib/shopHeroStyle'
import { ShopHeroPicture } from './ShopHeroPicture'

const ALL_HERO_URLS = getAllShopHeroImageUrls()

const HIDDEN_LAYER = SHOP_HERO_IMG_BASE + ' opacity-0 pointer-events-none'

type ShopHeroStackProps = {
  activeSrc: string
  activeClassName: string
}

/**
 * 首屏只載入 active 圖，避免 10+ 張 hero 同時解碼卡住分類列文字繪製。
 * idle 後再掛齊圖層，切換分類仍可即時 opacity 切換。
 */
export function ShopHeroStack({ activeSrc, activeClassName }: ShopHeroStackProps) {
  const [stackReady, setStackReady] = useState(false)
  const [fadeIn, setFadeIn] = useState(true)

  useEffect(() => {
    const enable = () => setStackReady(true)
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(enable, { timeout: 500 })
      return () => cancelIdleCallback(id)
    }
    const t = window.setTimeout(enable, 200)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    setFadeIn(false)
    const t = window.setTimeout(() => setFadeIn(true), 40)
    return () => window.clearTimeout(t)
  }, [activeSrc])

  const urls = stackReady ? ALL_HERO_URLS : [activeSrc]
  const activeOpacity =
    ' transition-opacity duration-200 ease-out ' + (fadeIn ? 'opacity-100' : 'opacity-0')

  return (
    <>
      {urls.map((url) => (
        <ShopHeroPicture
          key={url}
          jpgSrc={url}
          className={
            url === activeSrc
              ? activeClassName + activeOpacity
              : HIDDEN_LAYER
          }
          loading={url === activeSrc && !stackReady ? 'eager' : 'lazy'}
          fetchPriority={url === activeSrc ? 'high' : 'low'}
          hidden={url !== activeSrc}
        />
      ))}
    </>
  )
}

type ShopHeroPanelStackProps = {
  visibleSrc: string
  visibleClassName: string
}

/** 拼貼單欄：首屏只顯示一張，idle 後再掛齊圖層 */
export function ShopHeroPanelStack({
  visibleSrc,
  visibleClassName,
}: ShopHeroPanelStackProps) {
  const [stackReady, setStackReady] = useState(false)

  useEffect(() => {
    const enable = () => setStackReady(true)
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(enable, { timeout: 500 })
      return () => cancelIdleCallback(id)
    }
    const t = window.setTimeout(enable, 200)
    return () => window.clearTimeout(t)
  }, [])

  const urls = stackReady ? ALL_HERO_URLS : [visibleSrc]

  return (
    <>
      {urls.map((url) => (
        <ShopHeroPicture
          key={url}
          jpgSrc={url}
          className={
            url === visibleSrc
              ? visibleClassName + ' opacity-100'
              : HIDDEN_LAYER
          }
          loading={url === visibleSrc && !stackReady ? 'eager' : 'lazy'}
          hidden={url !== visibleSrc}
        />
      ))}
    </>
  )
}
