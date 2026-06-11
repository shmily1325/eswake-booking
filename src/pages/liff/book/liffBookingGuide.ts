import { LEGACY_GUIDE_PATH, resolveGuidePublicUrl } from './bookPaths'

/** @deprecated 請用 LEGACY_GUIDE_PATH；主網域下路徑仍為 /book/guide */
export const VISIT_GUIDE_PATH = LEGACY_GUIDE_PATH

export type BookGuideLocationState = {
  fromBook?: boolean
  /** 返回預約表路徑（/、/book 或 /liff/book） */
  bookReturnPath?: string
}

export function bookGuideEntryState(bookReturnPath: string): BookGuideLocationState {
  return { fromBook: true, bookReturnPath }
}

export { isSameOriginGuide, resolveGuidePublicUrl } from './bookPaths'

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
