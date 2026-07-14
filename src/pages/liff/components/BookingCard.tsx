// 預約列（分組列表內；時間焦點塊＋船色點綴；同日後續較緊）

import { getFontSizePx } from '../../../styles/designSystem'
import { isFacility } from '../../../utils/facility'
import { displayCoachNameForTomorrowReminder } from '../../../utils/tomorrowReminderDisplay'
import { LIFF_THEME, liffMetricUnit, liffMetricValue } from '../liffUiStyles'
import type { Booking } from '../types'

interface BookingCardProps {
  booking: Booking
  /** 目前 LIFF 綁定會員顯示名（暱稱優先）；供「EHA綺／ED→Eb」與明日提醒相同規則 */
  viewerMemberName: string
  isFirstOfDay: boolean
  isLast?: boolean
  formatDate: (dateString: string) => string
  getArrivalTime: (startAt: string) => string
  getStartTime: (startAt: string) => string
  getEndTime: (startAt: string, duration: number) => string
}

export function BookingCard({
  booking,
  viewerMemberName,
  isFirstOfDay,
  isLast = false,
  formatDate,
  getArrivalTime,
  getStartTime,
  getEndTime,
}: BookingCardProps) {
  const coachNames = booking.coaches
    .map((c) => displayCoachNameForTomorrowReminder(viewerMemberName, c.name))
    .join('、')
  const isFacilityBooking = isFacility(booking.boats?.name)
  const boatColor = booking.boats?.color || LIFF_THEME.inkSoft
  const activityLine =
    booking.activity_types && booking.activity_types.length > 0
      ? booking.activity_types.join(' · ')
      : null
  const timeSize = isFirstOfDay ? getFontSizePx('h1', true) : getFontSizePx('h2', true)

  return (
    <div
      style={{
        padding: isFirstOfDay ? '18px 0' : '10px 0',
        borderBottom: isLast ? 'none' : `1px solid ${LIFF_THEME.rowDivider}`,
      }}
    >
      {isFirstOfDay && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 14,
            paddingBottom: 2,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 3,
              height: 18,
              borderRadius: 2,
              background: boatColor,
              flexShrink: 0,
            }}
          />
          <div
            style={{
              fontSize: getFontSizePx('bodyLarge', false),
              fontWeight: 700,
              color: LIFF_THEME.ink,
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}
          >
            {formatDate(booking.start_at)}
          </div>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: isFirstOfDay ? 20 : 16,
          marginBottom: isFirstOfDay ? 14 : 10,
          padding: isFirstOfDay ? '14px 14px' : '10px 12px',
          background: LIFF_THEME.surfaceInset,
          borderRadius: LIFF_THEME.controlRadius,
          borderLeft: isFirstOfDay ? undefined : `2px solid ${boatColor}`,
        }}
      >
        {isFirstOfDay && (
          <div>
            <div
              style={{
                fontSize: getFontSizePx('bodySmall', true),
                color: LIFF_THEME.muted,
                marginBottom: 4,
              }}
            >
              抵達時間
            </div>
            <div style={{ ...liffMetricValue(timeSize), display: 'flex', alignItems: 'baseline' }}>
              {getArrivalTime(booking.start_at)}
            </div>
          </div>
        )}
        <div>
          <div
            style={{
              fontSize: getFontSizePx('bodySmall', true),
              color: LIFF_THEME.muted,
              marginBottom: 4,
            }}
          >
            {isFacilityBooking ? '開始時間' : '下水時間'}
          </div>
          <div style={{ ...liffMetricValue(timeSize), display: 'flex', alignItems: 'baseline' }}>
            {getStartTime(booking.start_at)}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 6,
        }}
      >
        <div
          aria-hidden
          style={{
            width: 12,
            height: 12,
            borderRadius: 3,
            background: boatColor,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: getFontSizePx('body', false),
            fontWeight: 600,
            color: LIFF_THEME.inkSoft,
          }}
        >
          {booking.boats?.name || '未指定'}
        </span>
      </div>

      <div
        style={{
          fontSize: getFontSizePx('body', true),
          color: LIFF_THEME.muted,
          marginBottom: coachNames || activityLine || booking.notes ? 6 : 0,
          display: 'flex',
          alignItems: 'baseline',
          gap: 6,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'baseline' }}>
          <span
            style={{
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: LIFF_THEME.inkSoft,
            }}
          >
            {booking.duration_min}
          </span>
          <span style={liffMetricUnit}>分</span>
        </span>
        <span style={{ color: LIFF_THEME.mutedLight }}>
          結束 {getEndTime(booking.start_at, booking.duration_min)}
        </span>
      </div>

      {coachNames && (
        <div
          style={{
            fontSize: getFontSizePx('body', true),
            color: LIFF_THEME.muted,
            marginBottom: activityLine || booking.notes ? 6 : 0,
          }}
        >
          指定教練 {coachNames}
        </div>
      )}

      {activityLine && (
        <div
          style={{
            fontSize: getFontSizePx('button', true),
            color: LIFF_THEME.mutedLight,
            marginBottom: booking.notes ? 6 : 0,
            lineHeight: 1.45,
          }}
        >
          {activityLine}
        </div>
      )}

      {booking.notes && (
        <div
          style={{
            marginTop: 4,
            fontSize: getFontSizePx('button', true),
            color: LIFF_THEME.muted,
            lineHeight: 1.5,
          }}
        >
          <span style={{ color: LIFF_THEME.mutedLight }}>備註 </span>
          {booking.notes}
        </div>
      )}
    </div>
  )
}
