import {
  DEFAULT_BOOK_HOST,
  DEFAULT_GUIDE_HOST,
  isBookHostname,
  isGuideHostname,
} from './bookHost'

export type AppEntry = 'liff' | 'public-book' | 'public-guide' | 'full'

function bookHostFromEnv(): string | undefined {
  return (import.meta.env.VITE_BOOK_BASE_URL as string | undefined)?.trim() || undefined
}

function guideHostFromEnv(): string | undefined {
  return (import.meta.env.VITE_GUIDE_BASE_URL as string | undefined)?.trim() || undefined
}

/** 決定載入哪個 App 入口（LIFF 輕量 / 公開預約 / 行前須知 / 完整後台） */
export function resolveAppEntry(pathname?: string, hostname?: string): AppEntry {
  const path = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '/')
  const host = (hostname ?? (typeof window !== 'undefined' ? window.location.hostname : '')).toLowerCase()

  if (path === '/liff' || path.startsWith('/liff/')) return 'liff'

  if (isBookHostname(host, bookHostFromEnv()) || host === DEFAULT_BOOK_HOST) return 'public-book'
  if (isGuideHostname(host, guideHostFromEnv()) || host === DEFAULT_GUIDE_HOST) return 'public-guide'

  const normalized = path.replace(/\/$/, '') || '/'
  if (normalized === '/book/guide') return 'public-guide'
  if (normalized === '/book') return 'public-book'

  return 'full'
}

export function isPublicBookOrGuideEntry(entry?: AppEntry): boolean {
  const e = entry ?? resolveAppEntry()
  return e === 'public-book' || e === 'public-guide'
}

export function isLiffPathname(pathname: string): boolean {
  return pathname === '/liff' || pathname.startsWith('/liff/')
}
