// 預約列表組件

import type { CSSProperties } from 'react'
import type { Booking } from '../types'
import { BookingCard } from './BookingCard'

/** 與 BalanceView / MemberProfileView 外層一致 */
const liffContentPanel: CSSProperties = {
  background: 'white',
  borderRadius: '12px',
  padding: '20px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
}

interface BookingsListProps {
  bookings: Booking[]
  /** 與明日提醒相同：僅 SH綺綺 + 教練 ED 時顯示為 Eb */
  viewerMemberName: string
  formatDate: (dateString: string) => string
  getArrivalTime: (startAt: string) => string
  getStartTime: (startAt: string) => string
  getEndTime: (startAt: string, duration: number) => string
}

export function BookingsList({
  bookings,
  viewerMemberName,
  formatDate,
  getArrivalTime,
  getStartTime,
  getEndTime,
}: BookingsListProps) {
  if (bookings.length === 0) {
    return (
      <div
        style={{
          ...liffContentPanel,
          padding: '48px 20px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '40px', marginBottom: '12px' }} aria-hidden>
          📅
        </div>
        <div style={{ fontSize: '16px', fontWeight: 600, color: '#666' }}>目前沒有預約</div>
      </div>
    )
  }

  const seenDates = new Set<string>()

  return (
    <div style={liffContentPanel}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {bookings.map((booking) => {
          const bookingDate = booking.start_at.split('T')[0]
          const isFirstOfDay = !seenDates.has(bookingDate)
          if (isFirstOfDay) seenDates.add(bookingDate)

          return (
            <BookingCard
              key={booking.id}
              booking={booking}
              viewerMemberName={viewerMemberName}
              isFirstOfDay={isFirstOfDay}
              formatDate={formatDate}
              getArrivalTime={getArrivalTime}
              getStartTime={getStartTime}
              getEndTime={getEndTime}
            />
          )
        })}
      </div>
    </div>
  )
}
