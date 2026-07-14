/** 對外 LIFF／Shop 共用的品牌視覺 token（簡潔、無照片） */
export const ES_BRAND = {
  name: 'ES Wake',
  shopTitle: 'ES Wake Shop',
  shopAreaLabel: 'Shop',
  schoolTitle: 'ES Wake School',
  schoolName: 'ES Wake 滑水學校',
  bookingSystemTitle: 'ES Wake Booking System',
  adminSystemLabel: '滑水預約管理系統',
  memberAreaLabel: '會員專區',
  bookingAreaLabel: '線上預約',
  guideAreaLabel: '行前須知',
  privacyServiceName: 'ES Wake Booking',
  privacySystemName: 'ES Wake 預約系統',
  logoWhite: '/logo_circle (white).png',
  logoBlack: '/logo_circle (black).png',
  headerBg: '#000000',
  headerBorderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  /** 預約／會員內容區底色 */
  pageBg: '#f4f5f7',
  progressFill: '#ffffff',
  /** 主 CTA：對齊 designSystem primary[500] */
  ctaBg: '#1d1d1f',
} as const

/** 頁面標題：ES Wake {區域}（OG / document.title 共用） */
export function esBrandPageTitle(areaLabel: string): string {
  return `${ES_BRAND.name} ${areaLabel}`
}

/** 聯絡官方文案 */
export function esBrandOfficialContact(): string {
  return `${ES_BRAND.name} 官方`
}

/** 統一版權行：© YYYY ES Wake. All Rights Reserved. */
export function esBrandCopyright(year = new Date().getFullYear()): string {
  return `© ${year} ${ES_BRAND.name}. All Rights Reserved.`
}

/** 含服務名稱的版權行（隱私權政策等） */
export function esBrandServiceCopyright(
  serviceName: string = ES_BRAND.privacyServiceName,
  year = new Date().getFullYear(),
): string {
  return `© ${year} ${serviceName}. All Rights Reserved.`
}
