// 預約列表組件

import type { Booking } from '../types'
import { liffContentPanel, LIFF_THEME, LIFF_TYPE } from '../liffUiStyles'
import { BookingCard } from './BookingCard'
import { BookingsListSkeleton } from './BookingsListSkeleton'
import { LiffPageHint } from './LiffPageHint'

const BOOKINGS_PAGE_HINT = '更改預約請私訊官方'

interface BookingsListProps {
  bookings: Booking[]
  viewerMemberName: string
  loading?: boolean
  formatDate: (dateString: string) => string
  getArrivalTime: (startAt: string) => string
  getStartTime: (startAt: string) => string
  getEndTime: (startAt: string, duration: number) => string
}

export function BookingsList({
  bookings,
  viewerMemberName,
  loading = false,
  formatDate,
  getArrivalTime,
  getStartTime,
  getEndTime,
}: BookingsListProps) {
  if (loading) {
    return <BookingsListSkeleton />
  }

  if (bookings.length === 0) {
    return (
      <div
        style={{
          ...liffContentPanel,
          padding: '20px 20px 60px',
          textAlign: 'center',
        }}
      >
        <LiffPageHint>{BOOKINGS_PAGE_HINT}</LiffPageHint>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>📅</div>
        <div style={{ fontSize: LIFF_TYPE.display - 2, fontWeight: 600, color: LIFF_THEME.inkSoft, marginBottom: '8px' }}>
          目前沒有預約
        </div>
        <div style={{ fontSize: LIFF_TYPE.body, color: LIFF_THEME.mutedLight }}>您目前沒有即將到來的預約</div>
      </div>
    )
  }

  const seenDates = new Set<string>()

  return (
    <div style={liffContentPanel}>
      <LiffPageHint>{BOOKINGS_PAGE_HINT}</LiffPageHint>
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
          if (isFirstOfDay) {
            seenDates.add(bookingDate)
          }

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
