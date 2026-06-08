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

/** 程式觸發時開新分頁；不 replace 目前頁面，避免離開後台 */
export function openExternalUrl(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function openPublicShopInBrowser(): void {
  openExternalUrl(getPublicShopHomeUrl())
}
