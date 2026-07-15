import { useEffect } from 'react'
import {
  preloadShopHeroImage,
  urlsFromShopHeroConfig,
} from '../lib/shopHeroPreload'
import type { ShopHeroImageConfig } from '../lib/shopHeroImages'

/**
 * 只預載目前 hero。其他分類由 category chip hover/focus 時按需預載，
 * 避免首屏商品圖片仍在下載時，同時搶載整組 hero。
 */
export function useShopHeroPreload(current: ShopHeroImageConfig | null): void {
  useEffect(() => {
    const currentUrls = current ? urlsFromShopHeroConfig(current) : []
    void Promise.all(currentUrls.map(preloadShopHeroImage))
  }, [current])
}
