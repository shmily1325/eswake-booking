import { useEffect, useState } from 'react'

interface LiffBootScreenProps {
  label?: string
  onRetry?: () => void
  /** 登入異常時，改從 LINE 開啟的 LIFF 連結 */
  liffOpenUrl?: string | null
}

/** LIFF chunk 下載中（輕量，不拉預約樣式進主 bundle） */
export function LiffBootScreen({ label = '載入中…', onRetry, liffOpenUrl }: LiffBootScreenProps) {
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
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #e8eaed 0%, #f4f5f7 10%, #f4f5f7 100%)',
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
      <div style={{
        width: 28,
        height: 28,
        border: '3px solid #ececec',
        borderTopColor: '#00b900',
        borderRadius: '50%',
        animation: 'liff-boot-spin 0.8s linear infinite',
        marginBottom: 14,
      }} />
      <div style={{ fontSize: 14, color: '#888', lineHeight: 1.5 }}>{label}</div>
      {slow && !stuck && (
        <div style={{ fontSize: 12, color: '#aaa', marginTop: 10 }}>網路較慢，請稍候…</div>
      )}
      {stuck && liffOpenUrl && (
        <div style={{ marginTop: 16, maxWidth: 300 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 12, lineHeight: 1.55 }}>
            若登入畫面出現錯誤，請改從 LINE 重新開啟：
          </div>
          <a
            href={liffOpenUrl}
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              borderRadius: 12,
              background: '#00b900',
              color: 'white',
              fontSize: 15,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            在 LINE 中開啟
          </a>
        </div>
      )}
      {stuck && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 12, lineHeight: 1.55 }}>
            載入時間較久，請重新整理或再開一次連結。
          </div>
          <button
            type="button"
            onClick={() => (onRetry ? onRetry() : window.location.reload())}
            style={{
              padding: '12px 24px',
              border: 'none',
              borderRadius: 12,
              background: '#4a4a4a',
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
          @keyframes liff-boot-spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  )
}
