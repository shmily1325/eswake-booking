import type { CSSProperties } from 'react'

export const bookPage: CSSProperties = {
  minHeight: '100vh',
  background: '#f5f5f5',
  paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
}

export const bookHeader: CSSProperties = {
  background: 'linear-gradient(135deg, #4a4a4a 0%, #3a3a3a 100%)',
  color: 'white',
  padding: '20px 16px 16px',
  paddingTop: 'calc(20px + env(safe-area-inset-top, 0px))',
}

export const bookCard: CSSProperties = {
  background: 'white',
  borderRadius: '12px',
  padding: '16px',
  marginBottom: '12px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
}

export const bookSectionTitle: CSSProperties = {
  fontSize: '17px',
  fontWeight: 700,
  color: '#222',
  margin: '0 0 4px',
}

export const bookSectionSub: CSSProperties = {
  fontSize: '13px',
  color: '#888',
  margin: '0 0 16px',
  lineHeight: 1.5,
}

export const choiceBtn = (selected: boolean): CSSProperties => ({
  width: '100%',
  padding: '16px',
  border: selected ? '2px solid #4a4a4a' : '2px solid #e8e8e8',
  borderRadius: '12px',
  background: selected ? '#fafafa' : 'white',
  textAlign: 'left' as const,
  cursor: 'pointer',
  marginBottom: '10px',
  transition: 'border-color 0.15s',
})

export const chipBtn = (selected: boolean): CSSProperties => ({
  padding: '10px 16px',
  border: selected ? '2px solid #4a4a4a' : '1px solid #ddd',
  borderRadius: '999px',
  background: selected ? '#4a4a4a' : 'white',
  color: selected ? 'white' : '#333',
  fontSize: '14px',
  fontWeight: selected ? 600 : 400,
  cursor: 'pointer',
})

export const infoBox: CSSProperties = {
  background: '#f0f7ff',
  border: '1px solid #bae0ff',
  borderRadius: '10px',
  padding: '12px 14px',
  fontSize: '13px',
  color: '#444',
  lineHeight: 1.6,
  marginTop: '12px',
}

export const warnBox: CSSProperties = {
  background: '#fffbe6',
  border: '1px solid #ffe58f',
  borderRadius: '10px',
  padding: '12px 14px',
  fontSize: '13px',
  color: '#614700',
  lineHeight: 1.5,
  marginTop: '12px',
}

export const stickyFooter: CSSProperties = {
  position: 'sticky',
  bottom: 0,
  background: 'white',
  borderTop: '1px solid #eee',
  padding: '12px 16px',
  paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
  display: 'flex',
  gap: '10px',
  zIndex: 20,
}

export const primaryBtn: CSSProperties = {
  flex: 1,
  padding: '14px',
  background: 'linear-gradient(135deg, #5a5a5a 0%, #4a4a4a 100%)',
  color: 'white',
  border: 'none',
  borderRadius: '10px',
  fontSize: '16px',
  fontWeight: 600,
  cursor: 'pointer',
}

export const secondaryBtn: CSSProperties = {
  padding: '14px 20px',
  background: 'white',
  color: '#555',
  border: '1px solid #ddd',
  borderRadius: '10px',
  fontSize: '15px',
  cursor: 'pointer',
}

export const progressBar: CSSProperties = {
  height: '4px',
  background: '#e0e0e0',
  borderRadius: '2px',
  overflow: 'hidden',
  marginTop: '12px',
}

export const progressFill = (pct: number): CSSProperties => ({
  height: '100%',
  width: `${pct}%`,
  background: '#00b900',
  transition: 'width 0.25s ease',
})

export const bigActivityBtn = (selected: boolean): CSSProperties => ({
  flex: 1,
  minWidth: 0,
  padding: '12px 10px',
  border: selected ? '3px solid #4a4a4a' : '2px solid #e0e0e0',
  borderRadius: 16,
  background: selected ? '#f5f5f5' : 'white',
  textAlign: 'center' as const,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
})

export const fieldLabel: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: '#888',
  marginBottom: 10,
  letterSpacing: '0.02em',
}

export const fieldHint: CSSProperties = {
  fontSize: 11,
  color: '#aaa',
  marginTop: 6,
  lineHeight: 1.45,
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
  border: selected ? '2px solid #4a4a4a' : '1px solid #ddd',
  borderRadius: 12,
  background: selected ? '#4a4a4a' : 'white',
  color: selected ? 'white' : disabled ? '#ccc' : '#333',
  cursor: disabled ? 'not-allowed' : 'pointer',
  textAlign: 'center' as const,
  opacity: disabled ? 0.5 : 1,
})
