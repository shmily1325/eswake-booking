// 預約列（分組列表內，時間為主視覺）

import { isFacility } from '../../../utils/facility'
import { displayCoachNameForTomorrowReminder } from '../../../utils/tomorrowReminderDisplay'
import { LIFF_THEME, LIFF_TYPE } from '../liffUiStyles'
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

  return (
    <div
      style={{
        padding: '16px 0',
        borderBottom: isLast ? 'none' : `1px solid ${LIFF_THEME.rowDivider}`,
      }}
    >
      <div
        style={{
          fontSize: LIFF_TYPE.body,
          fontWeight: 600,
          color: LIFF_THEME.inkSoft,
          marginBottom: 12,
          letterSpacing: '0.01em',
        }}
      >
        {formatDate(booking.start_at)}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 20,
          marginBottom: 14,
        }}
      >
        {isFirstOfDay && (
          <div>
            <div
              style={{
                fontSize: LIFF_TYPE.caption,
                color: LIFF_THEME.muted,
                marginBottom: 4,
              }}
            >
              抵達時間
            </div>
            <div
              style={{
                fontSize: LIFF_TYPE.display,
                fontWeight: 700,
                color: LIFF_THEME.ink,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.02em',
              }}
            >
              {getArrivalTime(booking.start_at)}
            </div>
          </div>
        )}
        <div>
          <div
            style={{
              fontSize: LIFF_TYPE.caption,
              color: LIFF_THEME.muted,
              marginBottom: 4,
            }}
          >
            {isFacilityBooking ? '開始時間' : '下水時間'}
          </div>
          <div
            style={{
              fontSize: LIFF_TYPE.display,
              fontWeight: 700,
              color: LIFF_THEME.ink,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.02em',
            }}
          >
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
            width: 10,
            height: 10,
            borderRadius: 3,
            background: boatColor,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: LIFF_TYPE.body + 1,
            fontWeight: 600,
            color: LIFF_THEME.inkSoft,
          }}
        >
          {booking.boats?.name || '未指定'}
        </span>
      </div>

      <div
        style={{
          fontSize: LIFF_TYPE.body,
          color: LIFF_THEME.muted,
          marginBottom: coachNames || activityLine || booking.notes ? 6 : 0,
        }}
      >
        {booking.duration_min} 分鐘
        <span style={{ color: LIFF_THEME.mutedLight, marginLeft: 8 }}>
          結束 {getEndTime(booking.start_at, booking.duration_min)}
        </span>
      </div>

      {coachNames && (
        <div
          style={{
            fontSize: LIFF_TYPE.body,
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
            fontSize: LIFF_TYPE.caption + 1,
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
            fontSize: LIFF_TYPE.caption + 1,
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
