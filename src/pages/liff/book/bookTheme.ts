import { designSystem, getFontSizePx } from '../../../styles/designSystem'
import { ES_BRAND } from '../../../lib/esBrandTokens'
import { LIFF_THEME, LIFF_TYPE } from '../liffUiStyles'

const c = designSystem.colors

/** 預約表單字級（與 LIFF_TYPE／designSystem mobile 對齊） */
export const BOOK_TYPE = {
  /** 步驟標題、大價格 */
  display: LIFF_TYPE.display,
  /** 卡片標題、活動/船型主標 */
  title: LIFF_TYPE.title,
  /** 正文、chip、欄位 label、輸入 */
  body: LIFF_TYPE.body,
  /** 提示、副標、pill、metadata */
  caption: LIFF_TYPE.caption,
  /** 極小提示、badge、次要 metadata */
  micro: getFontSizePx('caption', true),
  /** 展開／導覽等功能 icon */
  icon: getFontSizePx('h2', true),
} as const

/** 預約表單視覺 token（繼承 LIFF_THEME，估價卡用 info 色階） */
export const BOOK_THEME = {
  ink: LIFF_THEME.ink,
  inkSoft: LIFF_THEME.inkSoft,
  muted: LIFF_THEME.muted,
  mutedLight: LIFF_THEME.mutedLight,
  headerBg: ES_BRAND.headerBg,
  pageBg: LIFF_THEME.pageBg,
  cardBg: LIFF_THEME.cardBg,
  cardBorder: LIFF_THEME.cardBorder,
  cardShadow: LIFF_THEME.cardShadow,
  cardRadius: LIFF_THEME.cardRadius,
  controlRadius: LIFF_THEME.controlRadius,
  smallRadius: designSystem.borderRadius.sm,
  surfaceMuted: c.secondary[50],
  surfaceInset: LIFF_THEME.surfaceInset,
  lineGreen: LIFF_THEME.lineGreen,
  lineGreenSoft: 'rgba(0,185,0,0.14)',
  accent: c.secondary[700],
  accentSoft: 'rgba(65,68,75,0.08)',
  ctaBg: LIFF_THEME.ctaBg,
  borderSubtle: LIFF_THEME.borderSubtle,
  /** 估價卡：info 色階，與表單灰白區隔 */
  estimateBg: c.info[50],
  estimateBorder: c.secondary[200],
  estimateAccent: c.info[700],
  estimateDetailInk: c.info[700],
  warningBg: c.warning[50],
  warningBorder: c.warning[500],
  warningText: c.warning[700],
} as const
