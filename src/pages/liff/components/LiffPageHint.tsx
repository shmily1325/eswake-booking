// LIFF 分頁頂部說明（與儲值頁同一視覺）

import type { ReactNode } from 'react'

interface LiffPageHintProps {
  children: ReactNode
}

export function LiffPageHint({ children }: LiffPageHintProps) {
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
        lineHeight: 1.5
      }}
    >
      <span aria-hidden style={{ flexShrink: 0, lineHeight: 1.45 }}>
        💡
      </span>
      <span>{children}</span>
    </div>
  )
}
