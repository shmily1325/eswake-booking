import { resolveShopHost } from './shopHost'

/** 後台「對外商城」捷徑圖示 */
export const SHOP_NAV_LOGO_SRC = '/logo_circle (black).png'

/** 後台捷徑用：對外商城首頁（優先 env，否則正式子網域） */
export function getPublicShopHomeUrl(): string {
  const fromEnv = import.meta.env.VITE_SHOP_BASE_URL as string | undefined
  if (fromEnv?.trim()) return fromEnv.trim().replace(/\/$/, '')
  return `https://${resolveShopHost()}`
}

export function isExternalNavLink(link: string): boolean {
  return /^https?:\/\//i.test(link)
}

/** iPhone「加入主畫面」後的 standalone 模式 */
export function isIosStandaloneWebApp(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  const nav = navigator as Navigator & { standalone?: boolean }
  return (
    nav.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  )
}

/**
 * 開外部網址。iOS 主畫面捷徑內跨網域導向，系統通常會改用 Safari 開啟。
 * 一般瀏覽器則開新分頁，避免離開後台。
 */
export function openExternalUrl(url: string): void {
  const isIosDevice = /iPhone|iPad|iPod/i.test(navigator.userAgent)
  if (isIosDevice && isIosStandaloneWebApp()) {
    window.location.assign(url)
    return
  }
  const opened = window.open(url, '_blank', 'noopener,noreferrer')
  if (!opened) window.location.assign(url)
}

export function openPublicShopInBrowser(): void {
  openExternalUrl(getPublicShopHomeUrl())
}
