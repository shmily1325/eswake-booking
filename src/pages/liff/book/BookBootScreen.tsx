import { useEffect, useState } from 'react'
import { EsBrandLockup } from '../../../components/EsBrandLockup'
import { ES_BRAND } from '../../../lib/esBrandTokens'
import { liffPrimaryBtn, LIFF_TYPE } from '../liffUiStyles'
import { useBookLocale } from './BookLocaleContext'
import { bookPage } from './bookStyles'
import { BOOK_THEME as T, BOOK_TYPE as ty } from './bookTheme'

export type BookBootPhase = 'chunk' | 'init' | 'login'

interface BookBootScreenProps {
  phase?: BookBootPhase
  onRetry?: () => void
  liffOpenUrl?: string | null
}

export function BookBootScreen({ phase = 'init', onRetry, liffOpenUrl }: BookBootScreenProps) {
  const { s } = useBookLocale()
  const [slow, setSlow] = useState(false)
  const [stuck, setStuck] = useState(false)

  const phaseLabel = phase === 'login' ? s.boot.login : s.boot.init

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
      <EsBrandLockup
        brand={s.header.brand}
        subtitle={s.header.title}
        variant="onLight"
        align="center"
        logoSize={48}
        style={{ marginBottom: 20, justifyContent: 'center' }}
      />
      <div style={{
        width: 28,
        height: 28,
        border: `3px solid ${T.surfaceInset}`,
        borderTopColor: ES_BRAND.headerBg,
        borderRadius: '50%',
        animation: 'book-boot-spin 0.8s linear infinite',
        marginBottom: 14,
      }} />
      <div style={{ fontSize: LIFF_TYPE.body, color: T.muted, lineHeight: 1.5 }}>
        {phaseLabel}
      </div>
      {slow && !stuck && (
        <div style={{ fontSize: ty.caption, color: T.mutedLight, marginTop: 10, lineHeight: 1.5 }}>
          {s.boot.slow}
        </div>
      )}
      {stuck && liffOpenUrl && (
        <div style={{ marginTop: 16, maxWidth: 280 }}>
          <div style={{ fontSize: ty.caption, color: T.muted, marginBottom: 12, lineHeight: 1.55 }}>
            {s.boot.loginFallback}
          </div>
          <a
            href={liffOpenUrl}
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              borderRadius: T.controlRadius,
              background: T.lineGreen,
              color: 'white',
              fontSize: ty.body,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            {s.boot.openInLine}
          </a>
        </div>
      )}
      {stuck && (
        <div style={{ marginTop: 16, maxWidth: 280 }}>
          <div style={{ fontSize: ty.caption, color: T.muted, marginBottom: 12, lineHeight: 1.55 }}>
            {s.boot.stuck}
          </div>
          <button
            type="button"
            onClick={() => (onRetry ? onRetry() : window.location.reload())}
            style={{ ...liffPrimaryBtn(true), width: 'auto', padding: '12px 24px' }}
          >
            {s.boot.retry}
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
