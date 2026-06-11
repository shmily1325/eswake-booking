/** 行前須知頁路徑（App 內預覽；上線後可改指 guide.eswakeschool.com） */
export const VISIT_GUIDE_PATH = '/book/guide'

/** React Router location.state：從預約表進入行前須知 */
export const BOOK_GUIDE_FROM_BOOK_STATE = { fromBook: true } as const

export type BookGuideLocationState = { fromBook?: boolean }

const DEFAULT_GUIDE_ORIGIN = 'https://guide.eswakeschool.com'

/** guide 是否與目前頁面同源（同源才用 SPA 連結與「返回」） */
export function isSameOriginGuide(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return new URL(resolveVisitGuideUrl()).origin === window.location.origin
  } catch {
    return false
  }
}

/** 對外 guide URL：優先 env，否則同源 /book/guide */
export function resolveVisitGuideUrl(): string {
  const fromEnv = import.meta.env.VITE_GUIDE_BASE_URL as string | undefined
  if (fromEnv?.trim()) return fromEnv.trim().replace(/\/$/, '')
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${VISIT_GUIDE_PATH}`
  }
  return DEFAULT_GUIDE_ORIGIN
}

export const DIRECTIONS_VIDEO_ID = 'n-tpn2uI_44'
export const BUS_DIRECTIONS_VIDEO_ID = 'fwbeCE554Mw'

export const VISIT_ADDRESS_ZH = '新北市八里區龍米路一段170號之1'

export function visitMapUrl(query: string): string {
  return `https://maps.google.com/?q=${encodeURIComponent(query)}`
}
