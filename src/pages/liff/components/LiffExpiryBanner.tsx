// Tab 下方全域到期提醒（第一版）

import type { LiffExpiryBannerLine, LiffExpiryTone } from '../liffExpiryAlerts'

function toneStyle(tone: LiffExpiryTone): { bg: string; border: string; color: string } {
  switch (tone) {
    case 'danger':
      return { bg: '#ffebee', border: '#ef9a9a', color: '#b71c1c' }
    case 'warning':
      return { bg: '#fff8e1', border: '#ffcc80', color: '#e65100' }
    case 'info':
      return { bg: '#e3f2fd', border: '#90caf9', color: '#1565c0' }
  }
}

interface LiffExpiryBannerProps {
  lines: LiffExpiryBannerLine[]
  onOpenProfile: () => void
}

export function LiffExpiryBanner({ lines, onOpenProfile }: LiffExpiryBannerProps) {
  if (lines.length === 0) return null

  return (
    <div style={{ marginBottom: '12px' }}>
      <button
        type="button"
        onClick={onOpenProfile}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: 0,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          borderRadius: '10px',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
        }}
      >
        <div
          style={{
            background: 'white',
            borderRadius: '10px',
            border: '1px solid #e0e0e0',
            padding: '12px 14px'
          }}
        >
          {lines.map((line, i) => {
            const t = toneStyle(line.tone)
            return (
              <div
                key={line.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '8px 10px',
                  marginBottom: i < lines.length - 1 ? '6px' : 0,
                  borderRadius: '8px',
                  background: t.bg,
                  border: `1px solid ${t.border}`,
                  color: t.color,
                  fontSize: '13px',
                  lineHeight: 1.45,
                  fontWeight: 500
                }}
              >
                <span aria-hidden style={{ flexShrink: 0 }}>
                  {line.emoji}
                </span>
                <span>{line.text}</span>
              </div>
            )
          })}
          <div
            style={{
              marginTop: '8px',
              fontSize: '12px',
              color: '#757575',
              textAlign: 'center'
            }}
          >
            點此開啟「會員」查看明細
          </div>
        </div>
      </button>
    </div>
  )
}
