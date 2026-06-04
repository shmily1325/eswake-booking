import { useEffect } from 'react'
import {
  getAllShopHeroImageUrls,
  preloadShopHeroImage,
  urlsFromShopHeroConfig,
} from '../lib/shopHeroPreload'
import type { ShopHeroImageConfig } from '../lib/shopHeroImages'

/** 進店先載目前 hero，其餘在 idle 時預載 */
export function useShopHeroPreload(current: ShopHeroImageConfig | null): void {
  useEffect(() => {
    const currentUrls = current ? urlsFromShopHeroConfig(current) : []
    void Promise.all(currentUrls.map(preloadShopHeroImage)).then(() => {
      const skip = new Set(currentUrls)
      const rest = getAllShopHeroImageUrls().filter((u) => !skip.has(u))
      const runRest = () => void Promise.all(rest.map(preloadShopHeroImage))
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(runRest)
      } else {
        setTimeout(runRest, 200)
      }
    })
  }, [current])
}
