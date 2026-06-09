import { useEffect, useState } from 'react'
import { bookPage } from './bookStyles'
import { BOOK_THEME as T } from './bookTheme'

export type BookBootPhase = 'chunk' | 'init' | 'login'

const PHASE_LABEL: Record<BookBootPhase, string> = {
  chunk: '載入預約表單…',
  init: '正在啟動…',
  login: '正在連接 LINE…',
}

interface BookBootScreenProps {
  phase?: BookBootPhase
  onRetry?: () => void
}

export function BookBootScreen({ phase = 'init', onRetry }: BookBootScreenProps) {
  const [slow, setSlow] = useState(false)
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    const slowTimer = window.setTimeout(() => setSlow(true), 5000)
    const stuckTimer = window.setTimeout(() => setStuck(true), 12000)
    return () => {
      window.clearTimeout(slowTimer)
      window.clearTimeout(stuckTimer)
    }
  }, [])

  return (
    <div style={{
      ...bookPage,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 20px',
      textAlign: 'center',
    }}>
      <img
        src="/logo_circle (black).png"
        alt=""
        width={56}
        height={56}
        style={{ objectFit: 'contain', marginBottom: 20, opacity: 0.9 }}
      />
      <div style={{ fontSize: 17, fontWeight: 700, color: T.ink, marginBottom: 8 }}>
        ES WAKE 線上預約
      </div>
      <div style={{
        width: 28,
        height: 28,
        border: `3px solid ${T.surfaceInset}`,
        borderTopColor: T.lineGreen,
        borderRadius: '50%',
        animation: 'book-boot-spin 0.8s linear infinite',
        marginBottom: 14,
      }} />
      <div style={{ fontSize: 14, color: T.muted, lineHeight: 1.5 }}>
        {PHASE_LABEL[phase]}
      </div>
      {slow && !stuck && (
        <div style={{ fontSize: 12, color: T.mutedLight, marginTop: 10, lineHeight: 1.5 }}>
          網路較慢，請稍候…
        </div>
      )}
      {stuck && (
        <div style={{ marginTop: 16, maxWidth: 280 }}>
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 12, lineHeight: 1.55 }}>
            載入時間較久。請重新整理，或關閉後再點一次連結。
          </div>
          <button
            type="button"
            onClick={() => (onRetry ? onRetry() : window.location.reload())}
            style={{
              padding: '12px 24px',
              border: 'none',
              borderRadius: 12,
              background: T.accent,
              color: 'white',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            重新整理
          </button>
        </div>
      )}
      <style>
        {`
          @keyframes book-boot-spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  )
}
