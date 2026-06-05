import { useEffect, useState } from 'react'
import { getAllShopHeroImageUrls } from '../lib/shopHeroPreload'
import { SHOP_HERO_IMG_VISUAL } from '../lib/shopHeroStyle'
import { ShopHeroPicture } from './ShopHeroPicture'

const ALL_HERO_URLS = getAllShopHeroImageUrls()

const HIDDEN_LAYER = 'opacity-0 pointer-events-none'
const VISIBLE_LAYER = 'opacity-100'

type ShopHeroStackProps = {
  activeSrc: string
  activeClassName: string
}

/** 首屏只載入 active 圖；idle 後掛齊圖層以便切換分類。 */
export function ShopHeroStack({ activeSrc, activeClassName }: ShopHeroStackProps) {
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

  const urls = stackReady ? ALL_HERO_URLS : [activeSrc]

  return (
    <>
      {urls.map((url) => {
        const isActive = url === activeSrc
        return (
          <ShopHeroPicture
            key={url}
            jpgSrc={url}
            layerClassName={isActive ? VISIBLE_LAYER : HIDDEN_LAYER}
            imgClassName={isActive ? activeClassName : SHOP_HERO_IMG_VISUAL}
            loading={isActive && !stackReady ? 'eager' : 'lazy'}
            fetchPriority={isActive ? 'high' : 'low'}
            hidden={!isActive}
          />
        )
      })}
    </>
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
      {urls.map((url) => {
        const isVisible = url === visibleSrc
        return (
          <ShopHeroPicture
            key={url}
            jpgSrc={url}
            layerClassName={isVisible ? VISIBLE_LAYER : HIDDEN_LAYER}
            imgClassName={isVisible ? visibleClassName : SHOP_HERO_IMG_VISUAL}
            loading={isVisible && !stackReady ? 'eager' : 'lazy'}
            hidden={!isVisible}
          />
        )
      })}
    </>
  )
}
