// 預約卡片組件

import { isFacility } from '../../../utils/facility'
import { displayCoachNameForTomorrowReminder } from '../../../utils/tomorrowReminderDisplay'
import { liffCard, LIFF_THEME, LIFF_TYPE } from '../liffUiStyles'
import type { Booking } from '../types'

interface BookingCardProps {
  booking: Booking
  /** 目前 LIFF 綁定會員顯示名（暱稱優先）；供「EHA綺／ED→Eb」與明日提醒相同規則 */
  viewerMemberName: string
  isFirstOfDay: boolean
  formatDate: (dateString: string) => string
  getArrivalTime: (startAt: string) => string
  getStartTime: (startAt: string) => string
  getEndTime: (startAt: string, duration: number) => string
}

export function BookingCard({
  booking,
  viewerMemberName,
  isFirstOfDay,
  formatDate,
  getArrivalTime,
  getStartTime,
  getEndTime,
}: BookingCardProps) {
  const coachNames = booking.coaches
    .map((c) => displayCoachNameForTomorrowReminder(viewerMemberName, c.name))
    .join('、')
  const isFacilityBooking = isFacility(booking.boats?.name)

  return (
    <div
      style={{
        ...liffCard,
        padding: '16px',
        borderLeft: `4px solid ${booking.boats?.color || LIFF_THEME.inkSoft}`,
      }}
    >
      <div
        style={{
          fontSize: LIFF_TYPE.title,
          fontWeight: '600',
          color: LIFF_THEME.inkSoft,
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        📅 {formatDate(booking.start_at)}
      </div>

      <div
        style={{
          display: 'flex',
          gap: '16px',
          marginBottom: '12px',
          padding: '12px',
          background: LIFF_THEME.surfaceInset,
          borderRadius: '12px',
        }}
      >
        {isFirstOfDay && (
          <div>
            <div style={{ fontSize: LIFF_TYPE.caption, color: LIFF_THEME.muted, marginBottom: '4px' }}>抵達時間</div>
            <div style={{ fontSize: LIFF_TYPE.display, fontWeight: '700', color: LIFF_THEME.ink }}>
              {getArrivalTime(booking.start_at)}
            </div>
          </div>
        )}
        <div style={isFirstOfDay ? { borderLeft: `1px solid ${LIFF_THEME.inputBorder}`, paddingLeft: '16px' } : {}}>
          <div style={{ fontSize: LIFF_TYPE.caption, color: LIFF_THEME.muted, marginBottom: '4px' }}>
            {isFacilityBooking ? '開始時間' : '下水時間'}
          </div>
          <div style={{ fontSize: LIFF_TYPE.display, fontWeight: '700', color: LIFF_THEME.ink }}>
            {getStartTime(booking.start_at)}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px',
        }}
      >
        <div
          style={{
            width: '20px',
            height: '20px',
            borderRadius: '4px',
            background: booking.boats?.color || LIFF_THEME.inkSoft,
          }}
        />
        <span style={{ fontSize: LIFF_TYPE.body + 1, fontWeight: '600', color: LIFF_THEME.inkSoft }}>
          {booking.boats?.name || '未指定'}
        </span>
      </div>

      <div
        style={{
          fontSize: LIFF_TYPE.body,
          color: LIFF_THEME.muted,
          marginBottom: '8px',
        }}
      >
        {booking.duration_min} 分鐘
        <span style={{ color: LIFF_THEME.mutedLight, marginLeft: '8px' }}>
          (結束: {getEndTime(booking.start_at, booking.duration_min)})
        </span>
      </div>

      {coachNames && (
        <div
          style={{
            fontSize: LIFF_TYPE.body,
            color: LIFF_THEME.muted,
          }}
        >
          指定教練: {coachNames}
        </div>
      )}

      {booking.activity_types && booking.activity_types.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: '6px',
            flexWrap: 'wrap',
            marginTop: '12px',
          }}
        >
          {booking.activity_types.map((type, idx) => (
            <span
              key={idx}
              style={{
                padding: '4px 10px',
                background: LIFF_THEME.surfaceInset,
                color: LIFF_THEME.inkSoft,
                borderRadius: '12px',
                fontSize: LIFF_TYPE.caption,
                border: LIFF_THEME.cardBorder,
              }}
            >
              {type}
            </span>
          ))}
        </div>
      )}

      {booking.notes && (
        <div
          style={{
            marginTop: '12px',
            padding: '12px',
            background: LIFF_THEME.surfaceInset,
            borderRadius: '12px',
            fontSize: 13,
            color: LIFF_THEME.inkSoft,
            lineHeight: '1.5',
          }}
        >
          <div style={{ fontWeight: '600', marginBottom: '4px', color: LIFF_THEME.muted }}>備註</div>
          {booking.notes}
        </div>
      )}
    </div>
  )
}
