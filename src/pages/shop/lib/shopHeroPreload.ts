import { ALL_SUBCATS, type TopLevel } from './shopFilters'
import {
  getShopHeroConfigForCategory,
  SHOP_HERO_IMAGES,
  SHOP_SUBCATEGORY_HERO_IMAGES,
  type ShopHeroImageConfig,
} from './shopHeroImages'

const loaded = new Set<string>()
const inflight = new Map<string, Promise<void>>()

export function urlsFromShopHeroConfig(cfg: ShopHeroImageConfig): string[] {
  const urls = [cfg.src]
  if (cfg.catalogCollageAccent) urls.push(cfg.catalogCollageAccent.src)
  return urls
}

export function getAllShopHeroImageUrls(): string[] {
  const set = new Set<string>()
  for (const cfg of Object.values(SHOP_HERO_IMAGES)) {
    for (const url of urlsFromShopHeroConfig(cfg)) set.add(url)
  }
  for (const cfg of Object.values(SHOP_SUBCATEGORY_HERO_IMAGES)) {
    for (const url of urlsFromShopHeroConfig(cfg)) set.add(url)
  }
  return [...set]
}

export function isShopHeroImageReady(url: string): boolean {
  return loaded.has(url)
}

/** 用 Image() 預載並解碼，切換分類時可即時顯示 */
export function preloadShopHeroImage(url: string): Promise<void> {
  if (loaded.has(url)) return Promise.resolve()
  const pending = inflight.get(url)
  if (pending) return pending

  const promise = new Promise<void>((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      loaded.add(url)
      inflight.delete(url)
      resolve()
    }
    img.onerror = () => {
      inflight.delete(url)
      reject(new Error(`Failed to preload shop hero: ${url}`))
    }
    img.src = url
  })

  inflight.set(url, promise)
  return promise
}

export function preloadShopHeroConfig(cfg: ShopHeroImageConfig | null): Promise<void[]> {
  if (!cfg) return Promise.resolve([])
  return Promise.all(urlsFromShopHeroConfig(cfg).map(preloadShopHeroImage))
}

export function preloadAllShopHeroImages(): Promise<void[]> {
  return Promise.all(getAllShopHeroImageUrls().map(preloadShopHeroImage))
}

/** 滑過分類 tab 時先載入對應 hero */
export function preloadShopHeroForCategory(
  topLevel: TopLevel,
  subCat: string = ALL_SUBCATS,
): Promise<void[]> {
  return preloadShopHeroConfig(getShopHeroConfigForCategory(topLevel, subCat))
}
