import type { CSSProperties } from 'react'
import { ES_BRAND } from '../../lib/esBrandTokens'

/** LIFF 共用字級（與預約 bookTheme 對齊） */
export const LIFF_TYPE = {
  display: 20,
  title: 16,
  body: 14,
  caption: 12,
} as const

export const LIFF_THEME = {
  ink: '#1a1a1a',
  inkSoft: '#333',
  muted: '#888',
  mutedLight: '#aaa',
  pageBg: ES_BRAND.pageBg,
  cardBg: '#fff',
  cardBorder: '1px solid rgba(0,0,0,0.06)',
  cardRadius: 16,
  cardShadow: '0 2px 14px rgba(0,0,0,0.07)',
  tabActive: ES_BRAND.headerBg,
  tabInactive: '#9e9e9e',
  lineGreen: '#00b900',
  inputBorder: '#e0e0e0',
  surfaceInset: '#f3f4f6',
} as const

export const liffPage: CSSProperties = {
  minHeight: '100vh',
  background: LIFF_THEME.pageBg,
}

export const liffContentPanel: CSSProperties = {
  background: LIFF_THEME.cardBg,
  borderRadius: LIFF_THEME.cardRadius,
  padding: '20px',
  border: LIFF_THEME.cardBorder,
  boxShadow: LIFF_THEME.cardShadow,
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
  background: enabled ? ES_BRAND.headerBg : '#ccc',
  color: 'white',
  border: 'none',
  borderRadius: '12px',
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
  borderRadius: '12px',
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
}

export const liffSecondaryBtn: CSSProperties = {
  width: '100%',
  padding: '12px',
  background: 'white',
  color: LIFF_THEME.inkSoft,
  border: `1px solid ${LIFF_THEME.inputBorder}`,
  borderRadius: '12px',
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
  border: hasError ? '2px solid #ff4d4f' : `2px solid ${LIFF_THEME.inputBorder}`,
  borderRadius: '12px',
  fontSize: LIFF_TYPE.title,
  boxSizing: 'border-box',
  outline: 'none',
})

export const liffSelect: CSSProperties = {
  flex: 1,
  padding: '14px 8px',
  border: `2px solid ${LIFF_THEME.inputBorder}`,
  borderRadius: '12px',
  fontSize: LIFF_TYPE.title,
  boxSizing: 'border-box',
  outline: 'none',
  background: 'white',
}

export const liffHintBox: CSSProperties = {
  padding: '10px 12px',
  background: LIFF_THEME.surfaceInset,
  borderRadius: '12px',
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
      return { bg: '#ffebee', border: '#ef9a9a', color: '#b71c1c' }
    case 'warning':
      return { bg: '#fffbe6', border: '#ffe58f', color: '#614700' }
    case 'info':
      return { bg: LIFF_THEME.surfaceInset, border: 'rgba(0,0,0,0.08)', color: LIFF_THEME.inkSoft }
  }
}

export const liffAlertRow = (tone: LiffAlertTone): CSSProperties => {
  const t = liffAlertTone(tone)
  return {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '10px 12px',
    borderRadius: '12px',
    background: t.bg,
    border: `1px solid ${t.border}`,
    color: t.color,
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 500,
  }
}
