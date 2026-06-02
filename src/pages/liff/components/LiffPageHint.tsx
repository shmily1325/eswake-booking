import type { ReactNode } from 'react'

/** 全站共用一句（非預約分頁頂部） */
export const LIFF_CONTACT_LINE = '需協助請私訊官方'

export function LiffContactBar() {
  return (
    <div
      style={{
        fontSize: '12px',
        color: '#999',
        textAlign: 'center',
        marginBottom: '12px',
        lineHeight: 1.4,
      }}
    >
      {LIFF_CONTACT_LINE}
    </div>
  )
}

/** 分頁頂部說明（預約等） */
export function LiffPageHint({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        background: '#f0f7ff',
        borderRadius: '6px',
        marginBottom: '12px',
        fontSize: '13px',
        color: '#666',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '6px',
        lineHeight: 1.5,
      }}
    >
      <span aria-hidden style={{ flexShrink: 0, lineHeight: 1.45 }}>
        💡
      </span>
      <span>{children}</span>
    </div>
  )
}
