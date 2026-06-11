/** 行前須知頁路徑（App 內預覽；上線後可改指 guide.eswakeschool.com） */
export const VISIT_GUIDE_PATH = '/book/guide'

const DEFAULT_GUIDE_ORIGIN = 'https://guide.eswakeschool.com'

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
