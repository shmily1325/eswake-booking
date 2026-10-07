import { getFontSizePx } from '../../../styles/designSystem'
import { LIFF_THEME } from '../liffUiStyles'
import type { LiffCoachDesignatedEntry } from '../liffMemberShared'

interface Props {
  show: boolean
  coachName: string
  entries: LiffCoachDesignatedEntry[]
  total: number
  loading: boolean
  onClose: () => void
  onLoadAll: () => void
}

export function CoachDesignatedHistoryModal({
  show,
  coachName,
  entries,
  total,
  loading,
  onClose,
  onLoadAll,
}: Props) {
  if (!show) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'flex-end',
        zIndex: 9999,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: '100%',
          maxHeight: '70dvh',
          overflowY: 'auto',
          padding: 20,
          paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
          borderRadius: `${LIFF_THEME.cardRadius}px ${LIFF_THEME.cardRadius}px 0 0`,
          background: LIFF_THEME.cardBg,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingBottom: 12,
            marginBottom: 16,
            borderBottom: LIFF_THEME.cardBorder,
          }}
        >
          <h3 style={{ margin: 0, fontSize: getFontSizePx('bodyLarge', false), color: LIFF_THEME.inkSoft }}>
            {coachName} 指定課明細
          </h3>
          <button
            type="button"
            aria-label="關閉"
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              border: 0,
              borderRadius: '50%',
              background: LIFF_THEME.surfaceInset,
              color: LIFF_THEME.muted,
              fontSize: getFontSizePx('h3', false),
            }}
          >
            ×
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: LIFF_THEME.muted }}>載入中...</div>
        ) : entries.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: LIFF_THEME.muted }}>尚無時數紀錄</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {entries.map((entry) => {
              const positive = entry.delta_minutes >= 0
              return (
                <div
                  key={entry.id}
                  style={{
                    padding: 14,
                    border: LIFF_THEME.cardBorder,
                    borderRadius: 12,
                    background: LIFF_THEME.surfaceInset,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ color: LIFF_THEME.muted, fontSize: getFontSizePx('body', true) }}>
                      {entry.occurred_at.slice(0, 16).replace('T', ' ')}
                    </span>
                    <strong style={{ color: positive ? '#2e7d32' : '#c62828' }}>
                      {positive ? '+' : '−'}{Math.abs(entry.delta_minutes)}分
                    </strong>
                  </div>
                  <div style={{ marginTop: 5, color: LIFF_THEME.inkSoft }}>
                    {entry.entry_type === 'credit'
                      ? (entry.note || '增加時數')
                      : (entry.boat_name || '上課')}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {!loading && entries.length < total && (
          <button
            type="button"
            onClick={onLoadAll}
            style={{
              width: '100%',
              minHeight: 44,
              marginTop: 12,
              border: LIFF_THEME.cardBorder,
              borderRadius: LIFF_THEME.controlRadius,
              background: LIFF_THEME.cardBg,
              color: LIFF_THEME.inkSoft,
              fontWeight: 600,
            }}
          >
            查看全部紀錄
          </button>
        )}
      </div>
    </div>
  )
}
