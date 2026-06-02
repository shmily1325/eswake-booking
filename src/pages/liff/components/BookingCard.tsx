// 預約卡片組件

import { isFacility } from '../../../utils/facility'
import { displayCoachNameForTomorrowReminder } from '../../../utils/tomorrowReminderDisplay'
import type { Booking } from '../types'

interface BookingCardProps {
  booking: Booking
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
  const startLabel = isFacilityBooking ? '開始' : '下水'

  return (
    <div
      style={{
        background: 'white',
        borderRadius: '12px',
        padding: '14px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        borderLeft: `4px solid ${booking.boats?.color || '#1976d2'}`,
      }}
    >
      <div
        style={{
          fontSize: '15px',
          fontWeight: '600',
          color: '#333',
          marginBottom: '10px',
        }}
      >
        📅 {formatDate(booking.start_at)}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '10px',
          padding: '10px 12px',
          background: '#f0f5ff',
          borderRadius: '8px',
          fontSize: '18px',
          fontWeight: '700',
        }}
      >
        {isFirstOfDay && (
          <span style={{ color: '#1976d2' }}>
            🚗 {getArrivalTime(booking.start_at)}
          </span>
        )}
        <span style={{ color: '#333' }}>
          🏄 {startLabel} {getStartTime(booking.start_at)}
        </span>
      </div>

      <div
        style={{
          fontSize: '14px',
          color: '#555',
          marginBottom: coachNames || booking.activity_types?.length ? 8 : 0,
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px 12px',
          alignItems: 'center',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: booking.boats?.color || '#1976d2',
              flexShrink: 0,
            }}
          />
          {booking.boats?.name || '未指定'}
        </span>
        <span style={{ color: '#999' }}>
          {booking.duration_min} 分 · 至 {getEndTime(booking.start_at, booking.duration_min)}
        </span>
      </div>

      {coachNames && (
        <div style={{ fontSize: '13px', color: '#666', marginBottom: 8 }}>👤 {coachNames}</div>
      )}

      {booking.activity_types && booking.activity_types.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {booking.activity_types.map((type, idx) => (
            <span
              key={idx}
              style={{
                padding: '3px 8px',
                background: '#e8f4fd',
                color: '#1976d2',
                borderRadius: '10px',
                fontSize: '11px',
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
            marginTop: '10px',
            padding: '8px 10px',
            background: '#f8f9fa',
            borderRadius: '6px',
            fontSize: '12px',
            color: '#666',
            lineHeight: 1.45,
          }}
        >
          {booking.notes}
        </div>
      )}
    </div>
  )
}
