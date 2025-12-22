// Statistics Dashboard 共用類型

export interface MonthlyStats {
  month: string
  label: string
  bookingCount: number
  totalMinutes: number
  totalHours: number
  boatMinutes: { boatId: number; boatName: string; minutes: number }[]
  // 新增：平日/假日分布
  weekdayCount?: number
  weekdayMinutes?: number
  weekendCount?: number
  weekendMinutes?: number
}

export interface CoachFutureBooking {
  coachId: string
  coachName: string
  bookings: {
    month: string
    label: string
    count: number
    minutes: number
    contactStats: {
      contactName: string
      minutes: number
      count: number
    }[]
  }[]
  contactStats: {
    contactName: string
    minutes: number
    count: number
  }[]
  totalCount: number
  totalMinutes: number
}

export interface CoachStats {
  coachId: string
  coachName: string
  teachingMinutes: number
  drivingMinutes: number
  designatedStudents: {
    memberId: string
    memberName: string
    minutes: number
    boatMinutes: { boatName: string; minutes: number }[]
  }[]
}

export interface MemberStats {
  memberId: string
  memberName: string
  totalMinutes: number
  designatedMinutes: number
  undesignatedMinutes: number
  bookingCount: number
  coaches: { coachName: string; minutes: number }[]
  boats: { boatName: string; minutes: number }[]
}

export interface FinanceStats {
  month: string
  balanceUsed: number
  vipUsed: number
  g23Used: number
  g21Used: number
}

export interface WeekdayStats {
  weekdayCount: number
  weekdayMinutes: number
  weekendCount: number
  weekendMinutes: number
}

export interface BoatData {
  boatId: number
  boatName: string
}

