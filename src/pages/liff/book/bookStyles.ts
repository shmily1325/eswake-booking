import type { CSSProperties } from 'react'
import { ES_BRAND } from '../../../lib/esBrandTokens'
import { BOOK_THEME as T, BOOK_TYPE as ty } from './bookTheme'

export const bookPage: CSSProperties = {
  minHeight: '100vh',
  background: T.pageBg,
  paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
}

export const bookHeader: CSSProperties = {
  background: T.headerBg,
  color: 'white',
  padding: '18px 16px 14px',
  paddingTop: 'calc(18px + env(safe-area-inset-top, 0px))',
  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
}

export const bookCard: CSSProperties = {
  background: T.cardBg,
  borderRadius: T.cardRadius,
  padding: '16px',
  marginBottom: '12px',
  border: T.cardBorder,
  boxShadow: T.cardShadow,
}

export const bookSectionTitle: CSSProperties = {
  fontSize: ty.title,
  fontWeight: 700,
  color: T.ink,
  margin: '0 0 4px',
}

export const bookSectionSub: CSSProperties = {
  fontSize: ty.caption,
  color: T.muted,
  margin: '0 0 16px',
  lineHeight: 1.5,
}

export const choiceBtn = (selected: boolean): CSSProperties => ({
  width: '100%',
  padding: '16px',
  border: selected ? `2px solid ${T.accent}` : '2px solid #e8e8e8',
  borderRadius: '14px',
  background: selected ? T.surfaceMuted : 'white',
  textAlign: 'left' as const,
  cursor: 'pointer',
  marginBottom: '10px',
  boxShadow: selected ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
})

export const chipBtn = (selected: boolean): CSSProperties => ({
  padding: '10px 16px',
  border: selected ? `2px solid ${T.accent}` : '1px solid #ddd',
  borderRadius: '999px',
  background: selected ? T.accent : 'white',
  color: selected ? 'white' : T.inkSoft,
  fontSize: ty.body,
  fontWeight: selected ? 600 : 400,
  cursor: 'pointer',
})

/** 估價、提示等內容區塊（中性灰，與表單同層次） */
export const infoBox: CSSProperties = {
  background: T.surfaceMuted,
  border: `1px solid ${T.borderSubtle}`,
  borderRadius: '12px',
  padding: '12px 14px',
  fontSize: ty.body,
  color: T.inkSoft,
  lineHeight: 1.6,
  marginTop: '12px',
}

export const warnBox: CSSProperties = {
  background: '#fffbe6',
  border: '1px solid #ffe58f',
  borderRadius: '12px',
  padding: '12px 14px',
  fontSize: ty.body,
  color: '#614700',
  lineHeight: 1.5,
  marginTop: '12px',
}

export const stickyFooter: CSSProperties = {
  position: 'sticky',
  bottom: 0,
  background: 'rgba(255,255,255,0.96)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  borderTop: '1px solid #eee',
  padding: '12px 16px',
  paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
  display: 'flex',
  gap: '10px',
  zIndex: 20,
  boxShadow: '0 -4px 16px rgba(0,0,0,0.04)',
}

export const primaryBtn: CSSProperties = {
  flex: 1,
  padding: '14px',
  background: T.ctaBg,
  color: 'white',
  border: 'none',
  borderRadius: '12px',
  fontSize: ty.title,
  fontWeight: 600,
  cursor: 'pointer',
}

export const linePrimaryBtn: CSSProperties = {
  ...primaryBtn,
  background: `linear-gradient(135deg, #06c506 0%, ${T.lineGreen} 100%)`,
  boxShadow: '0 2px 10px rgba(0,185,0,0.25)',
}

export const secondaryBtn: CSSProperties = {
  padding: '14px 20px',
  background: 'white',
  color: '#555',
  border: '1px solid #ddd',
  borderRadius: '12px',
  fontSize: ty.body,
  cursor: 'pointer',
}

export const progressBar: CSSProperties = {
  height: '4px',
  background: 'rgba(255,255,255,0.2)',
  borderRadius: '2px',
  overflow: 'hidden',
  marginTop: '12px',
}

export const progressFill = (pct: number): CSSProperties => ({
  height: '100%',
  width: `${pct}%`,
  background: ES_BRAND.progressFill,
  transition: 'width 0.25s ease',
})

export const bigActivityBtn = (selected: boolean): CSSProperties => ({
  flex: 1,
  minWidth: 0,
  padding: '12px 10px',
  border: selected ? `3px solid ${T.accent}` : '2px solid #e0e0e0',
  borderRadius: 16,
  background: selected ? T.surfaceMuted : 'white',
  textAlign: 'center' as const,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  boxShadow: selected ? '0 2px 10px rgba(0,0,0,0.08)' : 'none',
})

export const fieldLabel: CSSProperties = {
  fontSize: ty.body,
  fontWeight: 600,
  color: T.inkSoft,
  marginBottom: 10,
  letterSpacing: '0.02em',
}

/** 各步必填表單分組 */
export const bookFieldGroup: CSSProperties = {
  padding: '14px 14px 4px',
  borderRadius: 12,
  background: T.cardBg,
  border: `1px solid ${T.borderSubtle}`,
  marginBottom: 16,
}

export const optionalSectionLabel: CSSProperties = {
  fontSize: ty.caption,
  fontWeight: 600,
  color: T.muted,
  letterSpacing: '0.05em',
  marginBottom: 8,
}

export const listItemRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: '10px 12px',
  background: T.surfaceMuted,
  borderRadius: 10,
  fontSize: ty.body,
}

/** Step 4 確認摘要卡 */
export const bookConfirmCard: CSSProperties = {
  ...bookCard,
  border: `2px solid ${T.accent}`,
}

export const footerBlockHint: CSSProperties = {
  width: '100%',
  fontSize: ty.caption,
  color: '#b45309',
  textAlign: 'center',
  lineHeight: 1.45,
  marginBottom: 10,
  padding: '8px 10px',
  borderRadius: 8,
  background: '#fffbeb',
  border: '1px solid #fde68a',
}

export const fieldHint: CSSProperties = {
  fontSize: ty.caption,
  color: T.mutedLight,
  marginTop: 6,
  lineHeight: 1.45,
}

export const bookInput: CSSProperties = {
  width: '100%',
  padding: 14,
  border: '1px solid #e0e0e0',
  borderRadius: 12,
  fontSize: ty.title,
  boxSizing: 'border-box',
  background: T.surfaceMuted,
  outline: 'none',
}

export const dateScrollRow: CSSProperties = {
  display: 'flex',
  gap: 8,
  overflowX: 'auto',
  paddingBottom: 4,
  WebkitOverflowScrolling: 'touch',
}

export const dateChip = (selected: boolean, disabled: boolean): CSSProperties => ({
  flexShrink: 0,
  width: 56,
  padding: '10px 6px',
  border: selected ? `2px solid ${T.accent}` : '1px solid #ddd',
  borderRadius: 12,
  background: selected ? T.accent : 'white',
  color: selected ? 'white' : disabled ? '#ccc' : T.inkSoft,
  cursor: disabled ? 'not-allowed' : 'pointer',
  textAlign: 'center' as const,
  opacity: disabled ? 0.5 : 1,
  boxShadow: selected ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
})

/** Step 1 價格區塊 banner */
export const priceBanner: CSSProperties = {
  fontSize: ty.caption,
  color: T.muted,
  lineHeight: 1.5,
  marginBottom: 14,
  textAlign: 'center',
  padding: '8px 10px',
  borderRadius: 10,
  background: T.surfaceMuted,
  border: `1px solid ${T.borderSubtle}`,
}

/** Step 1 三選一 segment */
export const segmentRow: CSSProperties = {
  display: 'flex',
  gap: 8,
  marginBottom: 14,
}

export const segmentBtn = (selected: boolean): CSSProperties => ({
  flex: 1,
  minWidth: 0,
  padding: '12px 8px',
  border: selected ? `2px solid ${T.accent}` : '1px solid #e8e8e8',
  borderRadius: 14,
  background: selected ? T.surfaceMuted : '#fff',
  cursor: 'pointer',
  textAlign: 'center',
  lineHeight: 1.35,
  boxShadow: selected ? '0 3px 12px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.03)',
})

export const segmentZh: CSSProperties = {
  fontSize: ty.body,
  fontWeight: 700,
  color: T.ink,
  wordBreak: 'keep-all',
}

export const segmentEn: CSSProperties = {
  fontSize: ty.caption,
  fontWeight: 500,
  color: T.muted,
  marginTop: 4,
  wordBreak: 'break-word',
}

/** Step 1 選中後的詳情區 */
export const detailPanel = (active: boolean): CSSProperties => ({
  padding: '14px 14px 12px',
  borderRadius: 14,
  border: active ? `1px solid #e0e0e0` : '1px dashed #ddd',
  background: active ? '#fff' : T.surfaceMuted,
  borderLeft: active ? `3px solid ${T.accent}` : undefined,
})

export const metaChip: CSSProperties = {
  display: 'inline-block',
  marginTop: 8,
  padding: '4px 10px',
  borderRadius: 999,
  background: T.accentSoft,
  fontSize: ty.caption,
  fontWeight: 600,
  color: T.inkSoft,
  letterSpacing: '0.02em',
}

export const priceLine: CSSProperties = {
  marginTop: 10,
  fontSize: ty.title,
  fontWeight: 700,
  color: T.ink,
  lineHeight: 1.1,
  fontVariantNumeric: 'tabular-nums',
}
