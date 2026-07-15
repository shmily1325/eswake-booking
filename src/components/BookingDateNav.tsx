import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { designSystem, getButtonStyle } from '../styles/designSystem'
import { getWeekdayText } from '../utils/date'

export interface BookingDateNavProps {
  date: string
  onDateChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onPrevDate: () => void
  onNextDate: () => void
  onGoToToday: () => void
  isMobile?: boolean
  todayDisabled?: boolean
  showScheduleLink?: boolean
  scheduleLinkTo?: string
  showMobileScheduleTabs?: boolean
  prevTrackId?: string
  nextTrackId?: string
  todayTrackId?: string
  dateTrackId?: string
  scheduleTrackId?: string
  trailing?: ReactNode
  marginBottom?: string
}

const navArrowStyle = (isMobile: boolean): CSSProperties => ({
  background: 'transparent',
  border: `1px solid ${designSystem.colors.border.main}`,
  borderRadius: designSystem.borderRadius.lg,
  width: isMobile ? '44px' : undefined,
  height: isMobile ? '44px' : undefined,
  minWidth: isMobile ? undefined : '40px',
  padding: isMobile ? 0 : '8px 12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '18px',
  color: designSystem.colors.text.primary,
  cursor: 'pointer',
  flexShrink: 0,
})

const dateInputStyle = (isMobile: boolean): CSSProperties => ({
  width: isMobile ? '100%' : undefined,
  height: isMobile ? '44px' : undefined,
  padding: isMobile ? '0 12px' : '8px 14px',
  borderRadius: designSystem.borderRadius.lg,
  border: `1px solid ${designSystem.colors.border.main}`,
  fontSize: '16px',
  textAlign: isMobile ? 'center' : 'left',
  backgroundColor: designSystem.colors.background.card,
  color: designSystem.colors.text.primary,
  outline: 'none',
  boxSizing: 'border-box',
  boxShadow: designSystem.shadows.xs,
})

export function BookingDateNav({
  date,
  onDateChange,
  onPrevDate,
  onNextDate,
  onGoToToday,
  isMobile = false,
  todayDisabled = false,
  showScheduleLink = false,
  scheduleLinkTo,
  showMobileScheduleTabs = false,
  prevTrackId = 'day_prev',
  nextTrackId = 'day_next',
  todayTrackId = 'day_today',
  dateTrackId,
  scheduleTrackId = 'day_to_assignment',
  trailing,
  marginBottom = designSystem.spacing.lg,
}: BookingDateNavProps) {
  const weekdayBadge = (
    <span
      style={{
        padding: isMobile ? undefined : '8px 12px',
        fontSize: isMobile ? '11px' : '13px',
        color: designSystem.colors.text.secondary,
        fontWeight: 600,
        background: designSystem.colors.secondary[100],
        border: `1px solid ${designSystem.colors.border.light}`,
        borderRadius: designSystem.borderRadius.full,
        whiteSpace: 'nowrap',
        ...(isMobile
          ? {
              position: 'absolute' as const,
              top: '-8px',
              right: '8px',
              pointerEvents: 'none' as const,
            }
          : {}),
      }}
    >
      {getWeekdayText(date)}
    </span>
  )

  const dateRow = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? designSystem.spacing.sm : '10px',
        flexWrap: isMobile ? undefined : 'wrap',
        backgroundColor: isMobile ? designSystem.colors.background.card : undefined,
        padding: isMobile ? designSystem.spacing.sm : undefined,
        borderRadius: isMobile ? designSystem.borderRadius.lg : undefined,
        boxShadow: isMobile ? designSystem.shadows.sm : undefined,
      }}
    >
      <button
        type="button"
        data-track={prevTrackId}
        onClick={onPrevDate}
        style={navArrowStyle(isMobile)}
        aria-label="前一天"
      >
        ←
      </button>

      <div style={{ flex: isMobile ? 1 : undefined, position: 'relative', minWidth: isMobile ? 0 : undefined }}>
        <input
          type="date"
          data-track={dateTrackId}
          value={date}
          onChange={onDateChange}
          style={dateInputStyle(isMobile)}
        />
        {isMobile && weekdayBadge}
      </div>

      {!isMobile && weekdayBadge}

      <button
        type="button"
        data-track={nextTrackId}
        onClick={onNextDate}
        style={navArrowStyle(isMobile)}
        aria-label="後一天"
      >
        →
      </button>

      <button
        type="button"
        data-track={todayTrackId}
        onClick={onGoToToday}
        disabled={todayDisabled}
        style={{
          ...(isMobile
            ? {
                background: designSystem.colors.secondary[100],
                border: `1px solid ${designSystem.colors.secondary[300]}`,
                borderRadius: designSystem.borderRadius.lg,
                height: '44px',
                padding: '0 12px',
                fontSize: '14px',
                fontWeight: 500,
                color: designSystem.colors.text.secondary,
                whiteSpace: 'nowrap',
                cursor: todayDisabled ? 'default' : 'pointer',
                opacity: todayDisabled ? 0.55 : 1,
              }
            : getButtonStyle('secondary', 'medium', todayDisabled)),
          flexShrink: 0,
          minWidth: isMobile ? undefined : '100px',
        }}
      >
        今天
      </button>

      {!isMobile && showScheduleLink && scheduleLinkTo && (
        <Link
          data-track={scheduleTrackId}
          to={scheduleLinkTo}
          style={{
            ...getButtonStyle('secondary', 'medium', false),
            textDecoration: 'none',
            minWidth: '100px',
            boxSizing: 'border-box',
          }}
        >
          排班
        </Link>
      )}

      {!isMobile && trailing}
    </div>
  )

  return (
    <div style={{ marginBottom }}>
      {dateRow}

      {isMobile && showMobileScheduleTabs && scheduleLinkTo && (
        <div
          style={{
            display: 'flex',
            gap: designSystem.spacing.sm,
            marginTop: designSystem.spacing.md,
          }}
        >
          <div
            style={{
              flex: 1,
              height: '48px',
              padding: '0 16px',
              backgroundColor: designSystem.colors.background.card,
              border: `1px solid ${designSystem.colors.border.main}`,
              borderRadius: designSystem.borderRadius.lg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: designSystem.colors.text.primary,
              fontSize: '14px',
              fontWeight: 600,
              boxShadow: designSystem.shadows.xs,
              whiteSpace: 'nowrap',
              boxSizing: 'border-box',
            }}
            aria-current="page"
          >
            列表
          </div>

          <Link
            data-track={scheduleTrackId}
            to={scheduleLinkTo}
            style={{
              flex: 1,
              textDecoration: 'none',
              height: '48px',
              padding: '0 16px',
              backgroundColor: designSystem.colors.background.card,
              border: `1px solid ${designSystem.colors.border.main}`,
              borderRadius: designSystem.borderRadius.lg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: designSystem.colors.text.secondary,
              fontSize: '14px',
              fontWeight: 500,
              boxShadow: designSystem.shadows.xs,
              whiteSpace: 'nowrap',
              boxSizing: 'border-box',
              minWidth: 0,
            }}
          >
            排班
          </Link>
        </div>
      )}
    </div>
  )
}
