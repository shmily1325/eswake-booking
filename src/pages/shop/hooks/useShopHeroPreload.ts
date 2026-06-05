import { useEffect } from 'react'
import {
  getAllShopHeroImageUrls,
  preloadShopHeroImage,
  urlsFromShopHeroConfig,
} from '../lib/shopHeroPreload'
import type { ShopHeroImageConfig } from '../lib/shopHeroImages'

/** 先預載目前 hero，其餘 idle 後背景載（不跟首屏搶主執行緒） */
export function useShopHeroPreload(current: ShopHeroImageConfig | null): void {
  useEffect(() => {
    const currentUrls = current ? urlsFromShopHeroConfig(current) : []
    void Promise.all(currentUrls.map(preloadShopHeroImage))

    const runRest = () => {
      const skip = new Set(currentUrls)
      const rest = getAllShopHeroImageUrls().filter((u) => !skip.has(u))
      void Promise.all(rest.map(preloadShopHeroImage))
    }
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(runRest, { timeout: 800 })
      return () => cancelIdleCallback(id)
    }
    const t = window.setTimeout(runRest, 400)
    return () => window.clearTimeout(t)
  }, [current])
}
