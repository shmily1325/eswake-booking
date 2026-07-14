// LIFF 空狀態：單色線條圖＋標題／短句（無 emoji）

import type { ReactNode } from 'react'
import { getFontSizePx } from '../../../styles/designSystem'
import { LIFF_THEME } from '../liffUiStyles'

type EmptyKind = 'bookings' | 'orders'

function EmptyGlyph({ kind }: { kind: EmptyKind }) {
  const stroke = LIFF_THEME.mutedLight
  if (kind === 'orders') {
    return (
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden>
        <rect x="12" y="16" width="32" height="26" rx="4" stroke={stroke} strokeWidth="1.75" />
        <path d="M20 16V14a8 8 0 0 1 16 0v2" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
        <path d="M20 28h16M20 34h10" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden>
      <rect x="12" y="14" width="32" height="30" rx="4" stroke={stroke} strokeWidth="1.75" />
      <path d="M12 24h32" stroke={stroke} strokeWidth="1.75" />
      <path d="M20 10v8M36 10v8" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="22" cy="32" r="1.75" fill={stroke} />
      <circle cx="28" cy="32" r="1.75" fill={stroke} />
      <circle cx="34" cy="32" r="1.75" fill={stroke} />
    </svg>
  )
}

interface LiffEmptyStateProps {
  kind: EmptyKind
  title: string
  detail: string
  hint?: ReactNode
}

export function LiffEmptyState({ kind, title, detail, hint }: LiffEmptyStateProps) {
  return (
    <div style={{ textAlign: 'center', padding: '12px 0 8px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: 18,
          opacity: 0.85,
        }}
      >
        <EmptyGlyph kind={kind} />
      </div>
      <div
        style={{
          fontSize: getFontSizePx('bodyLarge', false),
          fontWeight: 600,
          color: LIFF_THEME.inkSoft,
          marginBottom: 8,
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: getFontSizePx('body', true),
          color: LIFF_THEME.mutedLight,
          lineHeight: 1.5,
          marginBottom: hint ? 20 : 0,
        }}
      >
        {detail}
      </div>
      {hint ? (
        <div
          style={{
            fontSize: getFontSizePx('bodySmall', true),
            color: LIFF_THEME.mutedLight,
            lineHeight: 1.45,
          }}
        >
          {hint}
        </div>
      ) : null}
    </div>
  )
}
