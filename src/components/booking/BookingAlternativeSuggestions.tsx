import { designSystem, getFontSize } from '../../styles/designSystem'
import type { AlternativeBoat, BookingAlternatives } from '../../utils/bookingAlternatives'

interface BookingAlternativeSuggestionsProps extends BookingAlternatives {
  status: 'idle' | 'loading' | 'ready' | 'error'
  originalTime: string
  hasSelectedCoach: boolean
  isMobile: boolean
  onSelectTime: (time: string) => void
  onSelectBoat: (boat: AlternativeBoat) => void
}

export function BookingAlternativeSuggestions({
  status,
  nearbyTimes,
  nearbyTimeGap,
  otherBoats,
  originalTime,
  hasSelectedCoach,
  isMobile,
  onSelectTime,
  onSelectBoat,
}: BookingAlternativeSuggestionsProps) {
  if (status === 'idle' || status === 'error') return null

  const buttonStyle = {
    minHeight: isMobile ? '48px' : '44px',
    padding: `${designSystem.spacing.sm} ${designSystem.spacing.md}`,
    borderRadius: designSystem.borderRadius.lg,
    border: `1px solid ${designSystem.colors.info[500]}`,
    background: designSystem.colors.info[50],
    color: designSystem.colors.info[700],
    fontSize: getFontSize('button', isMobile),
    fontWeight: '600',
    cursor: 'pointer',
    touchAction: 'manipulation' as const,
    WebkitTapHighlightColor: 'transparent',
  }

  return (
    <div
      aria-live="polite"
      style={{
        marginBottom: designSystem.spacing.lg,
        padding: designSystem.spacing.md,
        borderRadius: designSystem.borderRadius.lg,
        border: `1px solid ${designSystem.colors.border.light}`,
        background: designSystem.colors.background.main,
      }}
    >
      <div
        style={{
          marginBottom: designSystem.spacing.sm,
          color: designSystem.colors.text.primary,
          fontSize: getFontSize('body', isMobile),
          fontWeight: '600',
        }}
      >
        可直接改選
      </div>

      {status === 'loading' ? (
        <div
          style={{
            color: designSystem.colors.text.secondary,
            fontSize: getFontSize('bodySmall', isMobile),
          }}
        >
          正在尋找可用時段…
        </div>
      ) : (
        <>
          {nearbyTimes.length > 0 && (
            <div style={{ marginBottom: otherBoats.length > 0 ? designSystem.spacing.md : 0 }}>
              <div
                style={{
                  marginBottom: designSystem.spacing.sm,
                  color: designSystem.colors.text.secondary,
                  fontSize: getFontSize('bodySmall', isMobile),
                }}
              >
                同船靠近時段
                {nearbyTimeGap === 30
                  ? ' · 前後保留 30 分鐘'
                  : ' · 附近無 30 分鐘間隔，顯示可安排時段'}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(76px, 1fr))',
                  gap: designSystem.spacing.sm,
                }}
              >
                {nearbyTimes.map((time) => (
                  <button
                    key={time}
                    type="button"
                    aria-label={`改為 ${time}`}
                    onClick={() => onSelectTime(time)}
                    style={buttonStyle}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>
          )}

          {otherBoats.length > 0 && (
            <div>
              <div
                style={{
                  marginBottom: designSystem.spacing.sm,
                  color: designSystem.colors.text.secondary,
                  fontSize: getFontSize('bodySmall', isMobile),
                }}
              >
                {originalTime} 同時段其他船
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))',
                  gap: designSystem.spacing.sm,
                }}
              >
                {otherBoats.map((boat) => (
                  <button
                    key={boat.id}
                    type="button"
                    aria-label={`改為 ${boat.name}，時間維持 ${originalTime}`}
                    onClick={() => onSelectBoat(boat)}
                    style={buttonStyle}
                  >
                    {boat.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {nearbyTimes.length === 0 && otherBoats.length === 0 && (
            <div
              style={{
                color: designSystem.colors.text.secondary,
                fontSize: getFontSize('bodySmall', isMobile),
                lineHeight: 1.5,
              }}
            >
              {hasSelectedCoach
                ? '附近暫無船與教練皆可的時段'
                : '附近暫無可用船隻或時段'}
            </div>
          )}
        </>
      )}
    </div>
  )
}
