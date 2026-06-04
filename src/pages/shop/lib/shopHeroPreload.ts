import { ALL_SUBCATS, type TopLevel } from './shopFilters'
import {
  getShopHeroConfigForCategory,
  SHOP_HERO_IMAGES,
  SHOP_SUBCATEGORY_HERO_IMAGES,
  type ShopHeroImageConfig,
} from './shopHeroImages'

const loaded = new Set<string>()
const inflight = new Map<string, Promise<void>>()
let linkPreloadInstalled = false

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

function installLinkPreloads(urls: string[]): void {
  if (typeof document === 'undefined') return
  for (const url of urls) {
    const id = `shop-hero-preload-${url.replace(/\W/g, '-')}`
    if (document.getElementById(id)) continue
    const link = document.createElement('link')
    link.id = id
    link.rel = 'preload'
    link.as = 'image'
    link.href = url
    document.head.appendChild(link)
  }
}

/** 預載 + decode，切換分類時可即時顯示 */
export function preloadShopHeroImage(url: string): Promise<void> {
  if (loaded.has(url)) return Promise.resolve()
  const pending = inflight.get(url)
  if (pending) return pending

  const promise = new Promise<void>((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      void (async () => {
        try {
          if ('decode' in img) await img.decode()
        } catch {
          /* decode 失敗仍視為已載入 */
        }
        loaded.add(url)
        inflight.delete(url)
        resolve()
      })()
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
  const urls = getAllShopHeroImageUrls()
  if (!linkPreloadInstalled) {
    installLinkPreloads(urls)
    linkPreloadInstalled = true
  }
  return Promise.all(urls.map(preloadShopHeroImage))
}

export function preloadShopHeroForCategory(
  topLevel: TopLevel,
  subCat: string = ALL_SUBCATS,
): Promise<void[]> {
  return preloadShopHeroConfig(getShopHeroConfigForCategory(topLevel, subCat))
}
