import { useState, type CSSProperties } from 'react'
import {
  designSystem,
  getBookingChoiceStyle,
  getFontSize,
} from '../../styles/designSystem'
import {
  type AvailableSlotsStatus,
  buildAvailableHourRows,
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

  const hourRows = buildAvailableHourRows(allDayTimes)
  const title = getAvailableSlotsTitle(allDayTimes.length, status)
  const touchMinHeight = isMobile ? '48px' : '44px'
  const expandable = status === 'loading' || status === 'ready'

  const availableButtonStyle = (selected: boolean): CSSProperties => ({
    ...getBookingChoiceStyle(selected),
    minHeight: touchMinHeight,
    padding: `${designSystem.spacing.sm} ${designSystem.spacing.xs}`,
    border: selected
      ? `1.5px solid ${designSystem.colors.info[500]}`
      : `1px solid ${designSystem.colors.info[500]}`,
    background: designSystem.colors.info[50],
    color: designSystem.colors.info[700],
    fontSize: getFontSize('button', isMobile),
    fontWeight: selected ? '700' : '600',
    cursor: 'pointer',
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
  })

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
                display: 'flex',
                flexDirection: 'column',
                gap: designSystem.spacing.sm,
              }}
            >
              {hourRows.map((row) => (
                <div
                  key={row.hourLabel}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                    gap: designSystem.spacing.sm,
                  }}
                >
                  {row.slots.map((slot) => {
                    if (!slot.available) {
                      return (
                        <div
                          key={slot.time}
                          aria-hidden="true"
                          style={{ minHeight: touchMinHeight }}
                        />
                      )
                    }

                    const selected = slot.time === selectedTime
                    return (
                      <button
                        key={slot.time}
                        type="button"
                        aria-label={selected ? `目前 ${slot.time}` : `改為 ${slot.time}`}
                        aria-pressed={selected}
                        onClick={() => {
                          onSelectTime(slot.time)
                          setOpen(false)
                        }}
                        style={availableButtonStyle(selected)}
                      >
                        {slot.time}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
