import { LEGACY_GUIDE_PATH, resolveGuidePublicUrl } from './bookPaths'

/** @deprecated 主網域下路徑仍為 /book/guide */
export const VISIT_GUIDE_PATH = LEGACY_GUIDE_PATH

export { resolveGuidePublicUrl } from './bookPaths'

/** 對外 guide URL（別名） */
export function resolveVisitGuideUrl(): string {
  return resolveGuidePublicUrl()
}

export const DIRECTIONS_VIDEO_ID = 'n-tpn2uI_44'
export const BUS_DIRECTIONS_VIDEO_ID = 'fwbeCE554Mw'

export const VISIT_ADDRESS_ZH = '新北市八里區龍米路一段170號之1'

export function visitMapUrl(query: string): string {
  return `https://maps.google.com/?q=${encodeURIComponent(query)}`
}
