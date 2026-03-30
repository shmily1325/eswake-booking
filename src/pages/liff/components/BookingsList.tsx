// 預約列表組件

import type { CSSProperties } from 'react'
import type { Booking } from '../types'
import { BookingCard } from './BookingCard'
import { LiffPageHint } from './LiffPageHint'

const BOOKINGS_PAGE_HINT =
  '以下為即將到來的預約，若要更改請私訊官方帳號。'

/** 與 BalanceView / MemberProfileView 外層一致 */
const liffContentPanel: CSSProperties = {
  background: 'white',
  borderRadius: '12px',
  padding: '20px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
}

interface BookingsListProps {
  bookings: Booking[]
  formatDate: (dateString: string) => string
  getArrivalTime: (startAt: string) => string
  getStartTime: (startAt: string) => string
  getEndTime: (startAt: string, duration: number) => string
}

export function BookingsList({
  bookings,
  formatDate,
  getArrivalTime,
  getStartTime,
  getEndTime
}: BookingsListProps) {
  if (bookings.length === 0) {
    return (
      <div style={{
        ...liffContentPanel,
        padding: '20px 20px 60px',
        textAlign: 'center'
      }}>
        <LiffPageHint>{BOOKINGS_PAGE_HINT}</LiffPageHint>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>📅</div>
        <div style={{ fontSize: '18px', fontWeight: '600', color: '#333', marginBottom: '8px' }}>
          目前沒有預約
        </div>
        <div style={{ fontSize: '14px', color: '#999' }}>
          您目前沒有即將到來的預約
        </div>
      </div>
    )
  }

  // 追蹤每天的第一個預約
  const seenDates = new Set<string>()

  return (
    <div style={liffContentPanel}>
      <LiffPageHint>{BOOKINGS_PAGE_HINT}</LiffPageHint>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        {bookings.map((booking) => {
          const bookingDate = booking.start_at.split('T')[0]
          const isFirstOfDay = !seenDates.has(bookingDate)
          if (isFirstOfDay) {
            seenDates.add(bookingDate)
          }

          return (
            <BookingCard
              key={booking.id}
              booking={booking}
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

