import { ES_BRAND } from '../../../lib/esBrandTokens'

/** 預約表單字級（4 級，最低 12px） */
export const BOOK_TYPE = {
  /** 步驟標題、大價格 */
  display: 20,
  /** 卡片標題、活動/船型主標 */
  title: 16,
  /** 正文、chip、欄位 label、輸入 */
  body: 14,
  /** 提示、副標、pill、metadata */
  caption: 12,
} as const

/** 預約表單視覺 token（與會員專區同色系，略加層次） */
export const BOOK_THEME = {
  ink: '#1a1a1a',
  inkSoft: '#333',
  muted: '#888',
  mutedLight: '#aaa',
  headerBg: ES_BRAND.headerBg,
  pageBg: ES_BRAND.pageBg,
  cardBg: '#fff',
  cardBorder: '1px solid rgba(0,0,0,0.06)',
  cardShadow: '0 2px 14px rgba(0,0,0,0.07)',
  cardRadius: 16,
  surfaceMuted: '#f8f9fb',
  surfaceInset: '#f3f4f6',
  lineGreen: '#00b900',
  lineGreenSoft: 'rgba(0,185,0,0.14)',
  accent: '#4a4a4a',
  accentSoft: 'rgba(74,74,74,0.08)',
  /** 主按鈕（比 header 純黑略輕，減少上下夾擠感） */
  ctaBg: ES_BRAND.ctaBg,
  borderSubtle: '#e4e6ea',
  /** 估價卡：淡海藍底，與表單灰白區隔 */
  estimateBg: '#f0f6fa',
  estimateBorder: '#c5dce8',
  estimateAccent: '#2b6b8a',
  estimateDetailInk: '#3d5566',
} as const
