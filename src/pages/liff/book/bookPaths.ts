import {
  isBookHostname,
  isGuideHostname,
  resolveBookHost,
  resolveGuideHost,
} from '../../../lib/bookHost'

const LEGACY_BOOK_PATH = '/book'
const LEGACY_GUIDE_PATH = '/book/guide'

function bookBaseUrlFromEnv(): string | undefined {
  return (import.meta.env.VITE_BOOK_BASE_URL as string | undefined)?.trim() || undefined
}

function guideBaseUrlFromEnv(): string | undefined {
  return (import.meta.env.VITE_GUIDE_BASE_URL as string | undefined)?.trim() || undefined
}

/** 是否在預約專用子網域（book.eswakeschool.com） */
export function isBookSubdomain(): boolean {
  if (typeof window === 'undefined') return false
  return isBookHostname(window.location.hostname, bookBaseUrlFromEnv())
}

/** 是否在行前須知專用子網域（guide.eswakeschool.com） */
export function isGuideSubdomain(): boolean {
  if (typeof window === 'undefined') return false
  return isGuideHostname(window.location.hostname, guideBaseUrlFromEnv())
}

/** 公開預約表 SPA 路徑：子網域為 /，其餘為 /book */
export function bookWizardPath(): string {
  return isBookSubdomain() ? '/' : LEGACY_BOOK_PATH
}

/** LIFF 或公開預約表返回路徑（不含 origin） */
export function bookWizardReturnPath(mode: 'liff' | 'public'): string {
  return mode === 'liff' ? '/liff/book' : bookWizardPath()
}

/** 對外預約表完整 URL */
export function resolveBookPublicUrl(): string {
  const fromEnv = bookBaseUrlFromEnv()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  if (typeof window !== 'undefined') {
    if (isBookSubdomain()) return window.location.origin
    return `${window.location.origin}${LEGACY_BOOK_PATH}`
  }
  return `https://${resolveBookHost()}`
}

/** 對外行前須知完整 URL */
export function resolveGuidePublicUrl(): string {
  const fromEnv = guideBaseUrlFromEnv()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  if (typeof window !== 'undefined') {
    if (isGuideSubdomain()) return window.location.origin
    return `${window.location.origin}${LEGACY_GUIDE_PATH}`
  }
  return `https://${resolveGuideHost()}`
}

/** guide 與目前站點同源（可走 SPA 連結與 router 返回） */
export function isSameOriginGuide(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return new URL(resolveGuidePublicUrl()).origin === window.location.origin
  } catch {
    return false
  }
}

/** 從預約表進 guide 時，返回預約表的完整 URL */
export function bookWizardReturnUrl(mode: 'liff' | 'public'): string {
  const path = bookWizardReturnPath(mode)
  if (path === '/') return resolveBookPublicUrl()
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${path}`
  }
  return resolveBookPublicUrl()
}

export { LEGACY_BOOK_PATH, LEGACY_GUIDE_PATH }
