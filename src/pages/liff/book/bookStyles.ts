import type { CSSProperties } from 'react'
import { ES_BRAND } from '../../../lib/esBrandTokens'
import { BOOK_THEME as T, BOOK_TYPE as ty } from './bookTheme'

export const bookPage: CSSProperties = {
  minHeight: '100vh',
  background: T.pageBg,
  paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
}

export const bookHeader: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 30,
  background: T.headerBg,
  color: 'white',
  padding: '18px 16px 14px',
  paddingTop: 'calc(18px + env(safe-area-inset-top, 0px))',
  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
}

/** /book：步驟列 sticky 於 BookHeader 下方 */
export const bookHeaderBelowBrand: CSSProperties = {
  top: 'calc(56px + env(safe-area-inset-top, 0px))',
  paddingTop: 14,
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

/** Step 2 體驗／已滑過（方角、可放兩行說明） */
export const experienceChipBtn = (selected: boolean): CSSProperties => ({
  flex: 1,
  minWidth: 0,
  padding: '12px 8px',
  border: selected ? `2px solid ${T.accent}` : '1px solid #e8e8e8',
  borderRadius: 14,
  background: selected ? T.accent : '#fff',
  color: selected ? 'white' : T.inkSoft,
  textAlign: 'center',
  cursor: 'pointer',
  lineHeight: 1.35,
})

export const experienceChipTitle: CSSProperties = {
  fontSize: ty.body,
  fontWeight: 700,
}

export const experienceChipNote = (selected: boolean): CSSProperties => ({
  fontSize: 11,
  fontWeight: 400,
  marginTop: 6,
  lineHeight: 1.5,
  color: selected ? 'rgba(255,255,255,0.9)' : T.muted,
})

/** 一般提示區塊（中性灰） */
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

/** 本梯次提醒（參考資訊，與估價卡同色系） */
export const reminderBox: CSSProperties = {
  background: T.estimateBg,
  border: `1px solid ${T.estimateBorder}`,
  borderLeft: `3px solid ${T.estimateAccent}`,
  borderRadius: '12px',
  padding: '12px 14px',
  fontSize: ty.body,
  color: T.estimateDetailInk,
  lineHeight: 1.55,
  marginTop: '12px',
}

/** 估價卡（淡海藍，與表單區隔） */
export const estimateBox: CSSProperties = {
  background: T.estimateBg,
  border: `1px solid ${T.estimateBorder}`,
  borderLeft: `3px solid ${T.estimateAccent}`,
  borderRadius: '12px',
  padding: '12px 14px',
  fontSize: ty.body,
  color: T.estimateDetailInk,
  lineHeight: 1.55,
  marginTop: '12px',
}

export const estimateTierPill: CSSProperties = {
  fontSize: ty.caption,
  fontWeight: 600,
  color: T.estimateAccent,
  background: 'rgba(43,107,138,0.12)',
  padding: '3px 10px',
  borderRadius: 999,
  flexShrink: 0,
}

export const estimateDetailPanel: CSSProperties = {
  marginTop: 12,
  padding: '10px 12px',
  background: T.cardBg,
  borderRadius: 10,
  border: `1px solid ${T.estimateBorder}`,
}

/** 選填區塊（跟船等） */
export const optionalPanel: CSSProperties = {
  border: '1px dashed #ddd',
  borderRadius: 10,
  overflow: 'hidden',
  background: T.surfaceMuted,
}

export const estimateInsetHighlight: CSSProperties = {
  fontSize: ty.body,
  fontWeight: 600,
  color: T.estimateDetailInk,
  marginTop: 12,
  padding: '10px 12px',
  background: T.estimateBg,
  border: `1px solid ${T.estimateBorder}`,
  borderRadius: 8,
  lineHeight: 1.5,
}

export const warnBox: CSSProperties = {
  background: '#fffbe6',
  border: '1px solid #ffe58f',
  borderLeft: '3px solid #faad14',
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
  background: T.cardBg,
  borderTop: `1px solid ${T.borderSubtle}`,
  padding: '10px 16px',
  paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
  display: 'flex',
  gap: '10px',
  zIndex: 20,
}

export const primaryBtn: CSSProperties = {
  flex: 1,
  minHeight: 48,
  padding: '12px 16px',
  background: T.ctaBg,
  color: 'white',
  border: 'none',
  borderRadius: 999,
  fontSize: ty.body,
  fontWeight: 600,
  cursor: 'pointer',
  textAlign: 'center',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

export const linePrimaryBtn: CSSProperties = {
  ...primaryBtn,
  background: T.lineGreen,
}

export const secondaryBtn: CSSProperties = {
  flex: '0 0 auto',
  minHeight: 48,
  padding: '12px 18px',
  background: 'white',
  color: T.inkSoft,
  border: `1px solid ${T.borderSubtle}`,
  borderRadius: 999,
  fontSize: ty.body,
  fontWeight: 500,
  cursor: 'pointer',
  textAlign: 'center',
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

/** Step 2 第一個控制項：置中短問句（配合 stepper，非重複 header 副標） */
export const stepFieldPrompt: CSSProperties = {
  fontSize: ty.title,
  fontWeight: 700,
  color: T.ink,
  textAlign: 'center',
  marginBottom: 10,
  lineHeight: 1.35,
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
  position: 'relative',
  padding: '14px 10px 12px',
  border: selected ? `2px solid ${T.accent}` : '1px solid #e8e8e8',
  borderRadius: 14,
  background: selected ? T.surfaceMuted : '#fff',
  cursor: 'pointer',
  textAlign: 'center',
  lineHeight: 1.35,
  boxShadow: selected ? '0 3px 12px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.03)',
})

export const segmentCheck: CSSProperties = {
  position: 'absolute',
  top: 6,
  right: 6,
  width: 18,
  height: 18,
  borderRadius: 999,
  background: T.accent,
  color: '#fff',
  fontSize: 11,
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1,
}

export const segmentZh: CSSProperties = {
  fontSize: ty.body,
  fontWeight: 700,
  color: T.ink,
  lineHeight: 1.25,
}

export const segmentEn: CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: T.muted,
  marginTop: 4,
  lineHeight: 1.25,
  whiteSpace: 'nowrap',
  letterSpacing: '-0.02em',
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

export const summaryPriceLine: CSSProperties = {
  ...priceLine,
  marginTop: 0,
}

export const selectionDetail: CSSProperties = {
  fontSize: ty.caption,
  color: T.muted,
  textAlign: 'center',
  marginTop: 8,
  lineHeight: 1.5,
}

/** Step 2 體驗／已滑過計價說明 */
export const pricingNote: CSSProperties = {
  fontSize: ty.caption,
  color: T.muted,
  lineHeight: 1.55,
  marginTop: 12,
  marginBottom: 4,
  textAlign: 'center',
}

export const stepperRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 20,
  marginTop: 4,
}

export const stepperBtn: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 999,
  border: `1px solid ${T.borderSubtle}`,
  background: '#fff',
  fontSize: ty.title,
  fontWeight: 600,
  color: T.ink,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1,
}

export const stepperValue: CSSProperties = {
  fontSize: ty.display,
  fontWeight: 700,
  minWidth: 40,
  textAlign: 'center',
  fontVariantNumeric: 'tabular-nums',
  color: T.ink,
}

export const includesTrustLine: CSSProperties = {
  fontSize: ty.caption,
  color: T.muted,
  textAlign: 'center',
  lineHeight: 1.5,
  marginTop: 6,
}

/** Step 2 選完後的一行摘要 */
export const step2SummaryLine: CSSProperties = {
  marginTop: 14,
  padding: '10px 12px',
  background: T.estimateBg,
  border: `1px solid ${T.estimateBorder}`,
  borderRadius: 10,
  fontSize: ty.caption,
  fontWeight: 600,
  color: T.ink,
  textAlign: 'center',
  lineHeight: 1.5,
}

/** Step 1 選完後的價格＋已含說明 */
export const step1Summary: CSSProperties = {
  marginTop: 14,
  paddingTop: 14,
  borderTop: `1px solid ${T.borderSubtle}`,
  textAlign: 'center',
}

export const segmentMeta: CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: T.muted,
  marginTop: 5,
  lineHeight: 1.35,
}

export const segmentPrice: CSSProperties = {
  fontSize: ty.caption,
  fontWeight: 700,
  color: T.inkSoft,
  marginTop: 4,
  fontVariantNumeric: 'tabular-nums',
}

/** 選船按鈕內價格區（體驗／已滑過分行） */
export const segmentPriceBlock: CSSProperties = {
  marginTop: 10,
  paddingTop: 10,
  borderTop: `1px solid ${T.borderSubtle}`,
  textAlign: 'center',
}

export const segmentPriceFirst: CSSProperties = {
  fontSize: ty.caption,
  fontWeight: 600,
  color: T.ink,
  lineHeight: 1.35,
  fontVariantNumeric: 'tabular-nums',
}

export const segmentPriceReturningLine: CSSProperties = {
  fontSize: ty.caption,
  fontWeight: 600,
  color: T.inkSoft,
  marginTop: 5,
  lineHeight: 1.35,
  fontVariantNumeric: 'tabular-nums',
}

export const segmentPriceMemberNote: CSSProperties = {
  fontSize: 10,
  fontWeight: 500,
  color: T.muted,
  marginTop: 2,
  lineHeight: 1.3,
  fontVariantNumeric: 'tabular-nums',
}

export const bothSegmentBtn = (selected: boolean): CSSProperties => ({
  width: '100%',
  marginTop: 8,
  padding: '12px 14px',
  border: selected ? `2px solid ${T.accent}` : '1px solid #e8e8e8',
  borderRadius: 14,
  background: selected ? T.surfaceMuted : '#fff',
  cursor: 'pointer',
  textAlign: 'left',
  lineHeight: 1.35,
  boxShadow: selected ? '0 3px 12px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.03)',
})

export const selectedDatePill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  marginTop: 10,
  padding: '8px 12px',
  borderRadius: 999,
  background: T.estimateBg,
  border: `1px solid ${T.estimateBorder}`,
  fontSize: ty.body,
  fontWeight: 600,
  color: T.estimateDetailInk,
}

export const summaryRow: CSSProperties = {
  display: 'flex',
  gap: 10,
  fontSize: ty.body,
  lineHeight: 1.55,
  padding: '6px 0',
  borderBottom: `1px solid ${T.borderSubtle}`,
}

export const summaryLabel: CSSProperties = {
  flex: '0 0 52px',
  fontSize: ty.caption,
  fontWeight: 600,
  color: T.muted,
}

export const summaryValue: CSSProperties = {
  flex: 1,
  color: T.inkSoft,
  minWidth: 0,
}

export const guideAccordionHeader = (open: boolean): CSSProperties => ({
  width: '100%',
  padding: open ? '18px 16px 16px' : '18px 16px',
  border: 'none',
  background: open ? T.surfaceMuted : T.cardBg,
  textAlign: 'left',
  fontSize: ty.title,
  fontWeight: 700,
  lineHeight: 1.45,
  color: T.ink,
  cursor: 'pointer',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
})

export const guideAccordionBody: CSSProperties = {
  padding: '16px 16px 18px',
  borderTop: `1px solid ${T.borderSubtle}`,
  fontSize: ty.body,
  color: T.inkSoft,
  lineHeight: 1.65,
}

export const guideBulletList: CSSProperties = {
  margin: 0,
  paddingLeft: 18,
}

export const guideGroupHeading: CSSProperties = {
  fontSize: ty.body,
  fontWeight: 700,
  color: T.ink,
  marginBottom: 6,
}

export const guideNoteBox: CSSProperties = {
  background: T.estimateBg,
  border: `1px solid ${T.estimateBorder}`,
  borderRadius: 10,
  padding: '10px 12px',
  fontSize: ty.caption,
  color: T.estimateDetailInk,
  lineHeight: 1.55,
}

