import { useEffect } from 'react'
import {
  preloadAllShopHeroImages,
  preloadShopHeroConfig,
} from '../lib/shopHeroPreload'
import type { ShopHeroImageConfig } from '../lib/shopHeroImages'

/** 進店立即預載全部 hero（並行 decode） */
export function useShopHeroPreload(current: ShopHeroImageConfig | null): void {
  useEffect(() => {
    void preloadAllShopHeroImages()
  }, [])

  useEffect(() => {
    void preloadShopHeroConfig(current)
  }, [current])
}
