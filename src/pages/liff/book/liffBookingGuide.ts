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

/** 地址與交通：抵達路線圖（關渡橋 → 鐵門 → 廠房） */
export const DIRECTIONS_GUIDE_IMAGE = '/liff/book/directions-guide.webp'

/** 預約完成注意事項：現場小舖插圖（透明底線稿） */
export const ONSITE_SHOP_IMAGE = '/liff/book/onsite-shop.webp'

/** 服裝／隨身：建議與避免項目的小圖 */
export const GEAR_ICONS = {
  tank: '/liff/book/icons/gear-tank.webp',
  bikini: '/liff/book/icons/gear-bikini.webp',
  shorts: '/liff/book/icons/gear-shorts.webp',
  sunscreen: '/liff/book/icons/gear-sunscreen.webp',
  towel: '/liff/book/icons/gear-towel.webp',
  goggles: '/liff/book/icons/gear-goggles.webp',
  glasses: '/liff/book/icons/gear-glasses.webp',
  jewelry: '/liff/book/icons/gear-jewelry.webp',
  cotton: '/liff/book/icons/gear-cotton.webp',
  wetsuit: '/liff/book/icons/facility-wetsuit.webp',
  bodywash: '/liff/book/icons/facility-bodywash.webp',
  shampoo: '/liff/book/icons/facility-shampoo.webp',
  dryer: '/liff/book/icons/facility-dryer.webp',
  spindryer: '/liff/book/icons/facility-spindryer.webp',
} as const

export const FACILITY_ICONS = [
  GEAR_ICONS.wetsuit,
  GEAR_ICONS.bodywash,
  GEAR_ICONS.shampoo,
  GEAR_ICONS.dryer,
  GEAR_ICONS.spindryer,
] as const

/** 抵達三步驟小圖 */
export const ARRIVAL_ICONS = {
  gate: '/liff/book/icons/arrive-gate.webp',
  line: '/liff/book/icons/arrive-line.webp',
  park: '/liff/book/icons/arrive-park.webp',
} as const

export const VISIT_ADDRESS_ZH = '24946 新北市八里區龍米路一段170號（關渡大橋）'

export function visitMapUrl(query: string): string {
  return `https://maps.google.com/?q=${encodeURIComponent(query)}`
}

/**
 * Guide 內所有 <img> 用到的圖。段落預設收合、圖又是 lazy，
 * 展開時才開始下載會慢半拍；頁面載入後趁閒置先把這些抓進快取，
 * 使用者點開時就能立即顯示。
 */
export const GUIDE_PRELOAD_IMAGES: readonly string[] = [
  ONSITE_SHOP_IMAGE,
  DIRECTIONS_GUIDE_IMAGE,
  ...Object.values(GEAR_ICONS),
  ...Object.values(ARRIVAL_ICONS),
]

/** 趁瀏覽器閒置預抓 guide 圖片，回傳取消函式。SSR/無 window 時為 no-op。 */
export function preloadGuideImages(urls: readonly string[] = GUIDE_PRELOAD_IMAGES): () => void {
  if (typeof window === 'undefined') return () => {}

  const images: HTMLImageElement[] = []
  const run = () => {
    for (const url of urls) {
      const img = new Image()
      img.decoding = 'async'
      img.src = url
      images.push(img)
    }
  }

  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => number })
    .requestIdleCallback
  const cic = (window as unknown as { cancelIdleCallback?: (id: number) => void })
    .cancelIdleCallback
  let idleId: number | undefined
  let timerId: number | undefined
  if (typeof ric === 'function') {
    idleId = ric(run)
  } else {
    timerId = window.setTimeout(run, 300)
  }

  return () => {
    if (idleId !== undefined && typeof cic === 'function') cic(idleId)
    if (timerId !== undefined) window.clearTimeout(timerId)
    for (const img of images) img.src = ''
  }
}
