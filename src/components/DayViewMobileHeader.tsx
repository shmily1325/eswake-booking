import { BookingDateNav } from './BookingDateNav'

interface DayViewMobileHeaderProps {
  date: string
  onDateChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onPrevDate: () => void
  onNextDate: () => void
  onGoToToday: () => void
  /** 小編才可排班；非小編不顯示第二列（列表／排班） */
  showCoachAssignment: boolean
}

/** DayView 手機版日期導覽（共用 BookingDateNav） */
export function DayViewMobileHeader({
  date,
  onDateChange,
  onPrevDate,
  onNextDate,
  onGoToToday,
  showCoachAssignment,
}: DayViewMobileHeaderProps) {
  return (
    <BookingDateNav
      date={date}
      onDateChange={onDateChange}
      onPrevDate={onPrevDate}
      onNextDate={onNextDate}
      onGoToToday={onGoToToday}
      isMobile
      showMobileScheduleTabs={showCoachAssignment}
      scheduleLinkTo={`/coach-assignment?date=${date}`}
    />
  )
}
