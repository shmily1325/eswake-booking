// Tab 下方到期提醒（會員 tab 改由資料列 badge 顯示，此處不重複）

import type { LiffExpiryBannerLine } from '../liffExpiryAlerts'
import { liffAlertRow, LIFF_THEME } from '../liffUiStyles'

interface LiffExpiryBannerProps {
  lines: LiffExpiryBannerLine[]
  onOpenProfile: () => void
}

export function LiffExpiryBanner({ lines, onOpenProfile }: LiffExpiryBannerProps) {
  if (lines.length === 0) return null

  const inner = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {lines.map((line) => (
        <div key={line.id} style={liffAlertRow(line.tone)}>
          <span aria-hidden style={{ flexShrink: 0 }}>
            {line.emoji}
          </span>
          <span>{line.text}</span>
        </div>
      ))}
      <div
        style={{
          fontSize: 12,
          color: LIFF_THEME.muted,
          textAlign: 'center',
          paddingTop: 2,
        }}
      >
        點開「會員」查看
      </div>
    </div>
  )

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
        }}
      >
        {inner}
      </button>
    </div>
  )
}
