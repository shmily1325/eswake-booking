import { useState, type CSSProperties } from 'react'
import {
  designSystem,
  getBookingChoiceStyle,
  getFontSize,
} from '../../styles/designSystem'
import {
  type AvailableSlotsStatus,
  getAvailableSlotsTitle,
} from '../../utils/bookingAlternatives'

interface BookingAlternativeSuggestionsProps {
  status: AvailableSlotsStatus
  allDayTimes: string[]
  selectedTime: string
  isMobile: boolean
  onSelectTime: (time: string) => void
  onRetry?: () => void
}

export function BookingAlternativeSuggestions({
  status,
  allDayTimes,
  selectedTime,
  isMobile,
  onSelectTime,
  onRetry,
}: BookingAlternativeSuggestionsProps) {
  const [open, setOpen] = useState(false)

  if (status === 'idle') return null

  const morningTimes = allDayTimes.filter((time) => time < '12:00')
  const afternoonTimes = allDayTimes.filter((time) => time >= '12:00')
  const showPeriodDivider = morningTimes.length > 0 && afternoonTimes.length > 0
  const title = getAvailableSlotsTitle(allDayTimes.length, status)
  const touchMinHeight = isMobile ? '48px' : '44px'
  const expandable = status === 'loading' || status === 'ready'

  const availableButtonStyle = (selected: boolean): CSSProperties => ({
    ...getBookingChoiceStyle(selected),
    minHeight: touchMinHeight,
    padding: `${designSystem.spacing.sm} ${designSystem.spacing.xs}`,
    border: selected
      ? `2px solid ${designSystem.colors.info[700]}`
      : `1px solid ${designSystem.colors.info[500]}`,
    background: selected
      ? designSystem.colors.info[500]
      : designSystem.colors.info[50],
    color: selected ? '#ffffff' : designSystem.colors.info[700],
    fontSize: getFontSize('button', isMobile),
    fontWeight: selected ? '700' : '600',
    cursor: 'pointer',
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
  })

  const headerTrack =
    status === 'error'
      ? 'booking_slots_retry'
      : open
        ? 'booking_slots_close'
        : 'booking_slots_open'

  const renderTimeGrid = (times: string[]) => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: designSystem.spacing.sm,
      }}
    >
      {times.map((time) => {
        const selected = time === selectedTime
        return (
          <button
            key={time}
            type="button"
            data-track={`booking_slots_select:${time}`}
            aria-label={selected ? `目前 ${time}` : `改為 ${time}`}
            aria-pressed={selected}
            onClick={() => {
              onSelectTime(time)
              setOpen(false)
            }}
            style={availableButtonStyle(selected)}
          >
            {time}
          </button>
        )
      })}
    </div>
  )

  return (
    <div
      style={{
        marginBottom: designSystem.spacing.lg,
        borderRadius: designSystem.borderRadius.lg,
        border: `1px solid ${designSystem.colors.border.light}`,
        background: designSystem.colors.background.card,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        data-track={status === 'awaiting-duration' ? undefined : headerTrack}
        aria-expanded={expandable ? open : undefined}
        disabled={status === 'awaiting-duration'}
        onClick={() => {
          if (status === 'error') {
            onRetry?.()
            return
          }
          if (expandable) setOpen((value) => !value)
        }}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: designSystem.spacing.sm,
          minHeight: touchMinHeight,
          padding: designSystem.spacing.md,
          border: 'none',
          background: designSystem.colors.info[50],
          color: expandable
            ? designSystem.colors.text.primary
            : designSystem.colors.text.secondary,
          fontSize: getFontSize('body', isMobile),
          fontWeight: '600',
          cursor: status === 'awaiting-duration' ? 'default' : 'pointer',
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent',
          textAlign: 'left',
        }}
      >
        <span>{title}</span>
        <span aria-hidden="true" style={{ color: designSystem.colors.info[500] }}>
          {status === 'error' ? '↻' : expandable ? (open ? '▲' : '▼') : ''}
        </span>
      </button>

      {expandable && open && (
        <div
          aria-live="polite"
          style={{
            padding: `0 ${designSystem.spacing.md} ${designSystem.spacing.md}`,
          }}
        >
          {status === 'loading' ? (
            <div
              style={{
                paddingTop: designSystem.spacing.md,
                color: designSystem.colors.text.secondary,
                fontSize: getFontSize('bodySmall', isMobile),
              }}
            >
              正在尋找可預約時段…
            </div>
          ) : allDayTimes.length === 0 ? (
            <div
              style={{
                marginTop: designSystem.spacing.md,
                color: designSystem.colors.text.secondary,
                fontSize: getFontSize('bodySmall', isMobile),
                lineHeight: 1.5,
              }}
            >
              當天無可預約時段
            </div>
          ) : (
            <div
              style={{
                marginTop: designSystem.spacing.md,
                maxHeight: isMobile ? '240px' : '280px',
                overflowY: 'auto',
                paddingRight: designSystem.spacing.xs,
              }}
            >
              {renderTimeGrid(morningTimes)}
              {showPeriodDivider && (
                <div
                  role="separator"
                  aria-label="下午時段"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: designSystem.spacing.sm,
                    margin: `${designSystem.spacing.md} 0`,
                    color: designSystem.colors.text.secondary,
                    fontSize: getFontSize('caption', isMobile),
                  }}
                >
                  <span style={{ height: '1px', flex: 1, background: designSystem.colors.border.light }} />
                  <span>下午</span>
                  <span style={{ height: '1px', flex: 1, background: designSystem.colors.border.light }} />
                </div>
              )}
              {renderTimeGrid(afternoonTimes)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
