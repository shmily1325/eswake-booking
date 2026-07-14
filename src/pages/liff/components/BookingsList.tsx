// 預約列表組件

import type { Booking } from '../types'
import { liffContentPanel } from '../liffUiStyles'
import { BookingCard } from './BookingCard'
import { BookingsListSkeleton } from './BookingsListSkeleton'
import { LiffEmptyState } from './LiffEmptyState'
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
          padding: '32px 20px 36px',
        }}
      >
        <LiffEmptyState
          kind="bookings"
          title="目前沒有預約"
          detail="您目前沒有即將到來的預約"
          hint={BOOKINGS_PAGE_HINT}
        />
      </div>
    )
  }

  const seenDates = new Set<string>()

  return (
    <div style={liffContentPanel}>
      <div>
        {bookings.map((booking, index) => {
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
              isLast={index === bookings.length - 1}
              formatDate={formatDate}
              getArrivalTime={getArrivalTime}
              getStartTime={getStartTime}
              getEndTime={getEndTime}
            />
          )
        })}
      </div>
      <LiffPageHint>{BOOKINGS_PAGE_HINT}</LiffPageHint>
    </div>
  )
}
