// Tab 下方到期提醒：一條 compact 提示，詳情在「會員」

import type { LiffExpiryBannerLine } from '../liffExpiryAlerts'
import { LIFF_THEME, LIFF_TYPE, liffAlertTone } from '../liffUiStyles'

interface LiffExpiryBannerProps {
  lines: LiffExpiryBannerLine[]
  onOpenProfile: () => void
}

function summarizeExpiryLines(lines: LiffExpiryBannerLine[]): {
  text: string
  tone: LiffExpiryBannerLine['tone']
} {
  const hasDanger = lines.some((l) => l.tone === 'danger')
  const tone = hasDanger ? 'danger' : lines.some((l) => l.tone === 'warning') ? 'warning' : 'info'

  if (lines.length === 1) {
    return { text: lines[0].text, tone }
  }

  if (hasDanger) {
    return { text: `有 ${lines.length} 項需處理，點開「會員」查看`, tone }
  }

  return { text: `有 ${lines.length} 項即將到期，點開「會員」查看`, tone }
}

export function LiffExpiryBanner({ lines, onOpenProfile }: LiffExpiryBannerProps) {
  if (lines.length === 0) return null

  const { text, tone } = summarizeExpiryLines(lines)
  const colors = liffAlertTone(tone)

  return (
    <div style={{ marginBottom: 12 }}>
      <button
        type="button"
        onClick={onOpenProfile}
        aria-label={`${text}，前往會員資料`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          width: '100%',
          minHeight: 44,
          padding: '10px 14px',
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
          background: colors.bg,
          color: colors.color,
          cursor: 'pointer',
          textAlign: 'left',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <span
          style={{
            fontSize: LIFF_TYPE.caption + 1,
            lineHeight: 1.45,
            fontWeight: 500,
            flex: 1,
            minWidth: 0,
          }}
        >
          {text}
        </span>
        <span
          aria-hidden
          style={{
            fontSize: 18,
            lineHeight: 1,
            color: LIFF_THEME.muted,
            fontWeight: 300,
            flexShrink: 0,
          }}
        >
          ›
        </span>
      </button>
    </div>
  )
}
