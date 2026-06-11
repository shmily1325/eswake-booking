import { LEGACY_GUIDE_PATH, resolveGuidePublicUrl } from './bookPaths'

/** @deprecated 主網域下路徑仍為 /book/guide */
export const VISIT_GUIDE_PATH = LEGACY_GUIDE_PATH

export { resolveGuidePublicUrl } from './bookPaths'

/** 對外 guide URL（別名） */
export function resolveVisitGuideUrl(): string {
  return resolveGuidePublicUrl()
}

/** 新分頁／外部瀏覽器開啟行前須知，保留目前預約頁 */
export function openVisitGuide(mode: 'liff' | 'public' = 'public'): void {
  const url = resolveGuidePublicUrl()

  if (mode === 'liff') {
    void import('@line/liff')
      .then(({ default: liff }) => {
        if (liff.isInClient()) {
          liff.openWindow({ url, external: true })
          return
        }
        openInNewTab(url)
      })
      .catch(() => openInNewTab(url))
    return
  }

  openInNewTab(url)
}

function openInNewTab(url: string): void {
  const opened = window.open(url, '_blank', 'noopener,noreferrer')
  if (!opened) window.location.href = url
}

export const DIRECTIONS_VIDEO_ID = 'n-tpn2uI_44'
export const BUS_DIRECTIONS_VIDEO_ID = 'fwbeCE554Mw'

export const VISIT_ADDRESS_ZH = '新北市八里區龍米路一段170號之1'

export function visitMapUrl(query: string): string {
  return `https://maps.google.com/?q=${encodeURIComponent(query)}`
}
