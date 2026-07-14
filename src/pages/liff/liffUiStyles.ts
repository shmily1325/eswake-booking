import type { CSSProperties } from 'react'
import { ES_BRAND } from '../../lib/esBrandTokens'
import { designSystem, getFontSizePx } from '../../styles/designSystem'

const c = designSystem.colors

/** LIFF 共用字級（對齊 designSystem mobile scale） */
export const LIFF_TYPE = {
  display: getFontSizePx('h2', true),
  title: getFontSizePx('h3', true),
  body: getFontSizePx('body', true),
  caption: getFontSizePx('bodySmall', true),
} as const

/**
 * LIFF 視覺 token — 對齊 `designSystem`／`ES_BRAND`。
 * LINE 官方綠保留為平台色，不進 designSystem。
 */
export const LIFF_THEME = {
  ink: c.text.primary,
  inkSoft: c.secondary[800],
  muted: c.text.secondary,
  mutedLight: c.text.disabled,
  pageBg: c.background.main,
  cardBg: c.background.card,
  cardBorder: `1px solid ${c.border.light}`,
  cardRadius: designSystem.borderRadius.lg,
  cardShadow: designSystem.shadows.elevation[2],
  controlRadius: designSystem.borderRadius.md,
  borderSubtle: c.border.main,
  rowDivider: c.border.light,
  tabActive: ES_BRAND.headerBg,
  tabInactive: c.text.disabled,
  /** LINE 品牌綠（平台色） */
  lineGreen: '#00b900',
  inputBorder: c.border.main,
  surfaceInset: c.primary[50],
  ctaBg: c.primary[500],
  ctaDisabled: c.secondary[300],
  dangerText: c.danger[700],
  dangerBorder: c.danger[500],
} as const

export const liffPage: CSSProperties = {
  minHeight: '100vh',
  background: LIFF_THEME.pageBg,
}

export const liffContentPanel: CSSProperties = {
  background: LIFF_THEME.cardBg,
  borderRadius: LIFF_THEME.cardRadius,
  padding: '22px 20px',
  border: LIFF_THEME.cardBorder,
  boxShadow: `inset 0 1px 0 rgba(29, 29, 31, 0.06), ${LIFF_THEME.cardShadow}`,
}

/** 產品感大數字（時間／餘額） */
export const liffMetricValue = (size = LIFF_TYPE.display + 2): CSSProperties => ({
  fontSize: size,
  fontWeight: 700,
  color: LIFF_THEME.ink,
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: '-0.03em',
  lineHeight: 1.1,
})

export const liffMetricUnit: CSSProperties = {
  fontSize: LIFF_TYPE.caption,
  fontWeight: 500,
  color: LIFF_THEME.mutedLight,
  letterSpacing: '0',
  marginLeft: 3,
}

export const liffCard: CSSProperties = {
  background: LIFF_THEME.cardBg,
  borderRadius: LIFF_THEME.cardRadius,
  border: LIFF_THEME.cardBorder,
  boxShadow: LIFF_THEME.cardShadow,
}

export const liffPrimaryBtn = (enabled = true): CSSProperties => ({
  width: '100%',
  padding: '14px',
  background: enabled ? LIFF_THEME.ctaBg : LIFF_THEME.ctaDisabled,
  color: 'white',
  border: 'none',
  borderRadius: LIFF_THEME.controlRadius,
  fontSize: LIFF_TYPE.title,
  fontWeight: 600,
  cursor: enabled ? 'pointer' : 'not-allowed',
})

export const liffLineBtn: CSSProperties = {
  width: '100%',
  padding: '12px',
  background: LIFF_THEME.lineGreen,
  color: 'white',
  border: 'none',
  borderRadius: LIFF_THEME.controlRadius,
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
}

export const liffSecondaryBtn: CSSProperties = {
  width: '100%',
  padding: '12px',
  background: LIFF_THEME.cardBg,
  color: LIFF_THEME.inkSoft,
  border: `1px solid ${LIFF_THEME.inputBorder}`,
  borderRadius: LIFF_THEME.controlRadius,
  fontSize: LIFF_TYPE.body,
  fontWeight: 500,
  cursor: 'pointer',
}

export const liffGhostBtn: CSSProperties = {
  width: '100%',
  padding: '12px',
  background: 'transparent',
  color: LIFF_THEME.muted,
  border: 'none',
  fontSize: LIFF_TYPE.body,
  cursor: 'pointer',
}

export const liffLabel: CSSProperties = {
  display: 'block',
  fontSize: LIFF_TYPE.body,
  fontWeight: 600,
  color: LIFF_THEME.inkSoft,
  marginBottom: '8px',
}

export const liffInput = (hasError = false): CSSProperties => ({
  width: '100%',
  padding: '14px',
  border: hasError
    ? `2px solid ${LIFF_THEME.dangerBorder}`
    : `2px solid ${LIFF_THEME.inputBorder}`,
  borderRadius: LIFF_THEME.controlRadius,
  fontSize: LIFF_TYPE.title,
  boxSizing: 'border-box',
  outline: 'none',
})

export const liffSelect: CSSProperties = {
  flex: 1,
  padding: '14px 8px',
  border: `2px solid ${LIFF_THEME.inputBorder}`,
  borderRadius: LIFF_THEME.controlRadius,
  fontSize: LIFF_TYPE.title,
  boxSizing: 'border-box',
  outline: 'none',
  background: LIFF_THEME.cardBg,
}

export const liffHintBox: CSSProperties = {
  padding: '10px 12px',
  background: LIFF_THEME.surfaceInset,
  borderRadius: LIFF_THEME.controlRadius,
  border: LIFF_THEME.cardBorder,
  marginBottom: '12px',
  fontSize: 13,
  color: LIFF_THEME.muted,
  lineHeight: 1.5,
}

export const liffBindingShell: CSSProperties = {
  ...liffPage,
  padding: '20px',
  paddingTop: 'calc(20px + env(safe-area-inset-top, 0px))',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

export const liffBindingCard: CSSProperties = {
  ...liffCard,
  padding: '32px 24px',
  maxWidth: '400px',
  width: '100%',
}

export type LiffAlertTone = 'danger' | 'warning' | 'info'

export function liffAlertTone(tone: LiffAlertTone): { bg: string; border: string; color: string } {
  switch (tone) {
    case 'danger':
      return { bg: c.danger[50], border: c.danger[500], color: c.danger[700] }
    case 'warning':
      return { bg: c.warning[50], border: c.warning[500], color: c.warning[700] }
    case 'info':
      return { bg: LIFF_THEME.surfaceInset, border: c.border.light, color: LIFF_THEME.inkSoft }
  }
}

export const liffAlertRow = (tone: LiffAlertTone): CSSProperties => {
  const t = liffAlertTone(tone)
  return {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '10px 12px',
    borderRadius: LIFF_THEME.controlRadius,
    background: t.bg,
    border: `1px solid ${t.border}`,
    color: t.color,
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 500,
  }
}
