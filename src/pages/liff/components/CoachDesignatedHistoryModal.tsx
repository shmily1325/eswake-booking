import { designSystem, getFontSizePx } from '../../../styles/designSystem'
import { getVenueDateString } from '../../../utils/date'
import { LIFF_THEME } from '../liffUiStyles'
import type { LiffCoachDesignatedEntry } from '../liffMemberShared'

interface Props {
  show: boolean
  coachName: string
  entries: LiffCoachDesignatedEntry[]
  total: number
  regularBalance?: number
  giftBalance?: number
  hasGiftEntries?: boolean
  regularExpiresOn?: string | null
  giftExpiresOn?: string | null
  loading: boolean
  onClose: () => void
  onLoadAll: () => void
}

export function CoachDesignatedHistoryModal({
  show,
  coachName,
  entries,
  total,
  regularBalance = 0,
  giftBalance = 0,
  hasGiftEntries = false,
  regularExpiresOn = null,
  giftExpiresOn = null,
  loading,
  onClose,
  onLoadAll,
}: Props) {
  if (!show) return null
  const today = getVenueDateString()
  const hasSplitSummary = regularBalance !== 0 || giftBalance !== 0 || hasGiftEntries

  const balanceRow = (
    label: string,
    balance: number,
    expiresOn: string | null,
    tone: 'regular' | 'gift',
  ) => {
    const expired = !!expiresOn && expiresOn < today
    return (
      <div
        style={{
          padding: '12px 14px',
          borderRadius: 12,
          borderLeft: `4px solid ${
            tone === 'gift'
              ? designSystem.colors.warning[500]
              : designSystem.colors.info[500]
          }`,
          background: tone === 'gift'
            ? designSystem.colors.warning[50]
            : designSystem.colors.info[50],
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ color: LIFF_THEME.inkSoft, fontWeight: 600 }}>{label}</span>
          <strong style={{ color: balance < 0 ? LIFF_THEME.dangerText : LIFF_THEME.inkSoft }}>
            {balance} 分
          </strong>
        </div>
        {expiresOn && (
          <div
            style={{
              marginTop: 5,
              color: expired ? LIFF_THEME.dangerText : LIFF_THEME.muted,
              fontSize: getFontSizePx('caption', true),
              fontWeight: expired ? 700 : 500,
            }}
          >
            最近一筆｜{expired ? '已逾使用期限' : '使用期限'} {expiresOn.replaceAll('-', '/')}
          </div>
        )}
      </div>
    )
  }

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
          <>
          {hasSplitSummary && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {balanceRow('一般指定課', regularBalance, regularExpiresOn, 'regular')}
              {(hasGiftEntries || giftBalance !== 0 || giftExpiresOn) && balanceRow(
                '贈送指定課',
                giftBalance,
                giftExpiresOn,
                'gift',
              )}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {entries.map((entry) => {
              const positive = entry.delta_minutes >= 0
              const regular = entry.regular_minutes ?? entry.minutes
              const gift = entry.gift_minutes ?? 0
              const source = regular > 0 && gift > 0
                ? `一般 ${regular}・贈送 ${gift}`
                : gift > 0
                  ? '贈送'
                  : '一般'
              const occurredAt = entry.booking_start_at || entry.occurred_at
              const displayDate = entry.entry_type === 'credit'
                ? entry.occurred_at.slice(0, 10).replaceAll('-', '/')
                : occurredAt.slice(0, 16).replace('T', ' ')
              const expired = !!entry.expires_on && entry.expires_on < today
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
                      {displayDate}
                    </span>
                    <strong
                      style={{
                        color: positive
                          ? designSystem.colors.success[700]
                          : designSystem.colors.danger[700],
                      }}
                    >
                      {positive ? '+' : '−'}{Math.abs(entry.delta_minutes)}分
                    </strong>
                  </div>
                  <div style={{ marginTop: 5, color: LIFF_THEME.inkSoft }}>
                    {entry.entry_type === 'credit'
                      ? (entry.note || '新增指定課')
                      : (entry.boat_name || '未指定船')}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      color: gift > 0
                        ? designSystem.colors.warning[700]
                        : designSystem.colors.info[700],
                      fontSize: getFontSizePx('caption', true),
                    }}
                  >
                    {source}
                  </div>
                  {entry.entry_type === 'credit' && entry.expires_on && (
                    <div
                      style={{
                        marginTop: 4,
                        color: expired ? LIFF_THEME.dangerText : LIFF_THEME.muted,
                        fontSize: getFontSizePx('caption', true),
                        fontWeight: expired ? 700 : 500,
                      }}
                    >
                      {expired ? '已逾使用期限' : '使用期限'} {entry.expires_on.replaceAll('-', '/')}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          </>
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
