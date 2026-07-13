import type { Booking } from '../types/booking'
import { isFacility } from '../utils/facility'

export type UsageStatEntry = [string, { count: number; totalMinutes: number }]

export interface TodayOverviewStats {
  totalBookings: number
  totalDurationMinutes: number
  sortedCoaches: UsageStatEntry[]
  sortedDrivers: UsageStatEntry[]
  sortedCombined: UsageStatEntry[]
  sortedBoats: UsageStatEntry[]
}

function sortStats(entries: UsageStatEntry[]): UsageStatEntry[] {
  return entries.sort(
    (a, b) =>
      b[1].totalMinutes - a[1].totalMinutes ||
      a[0].localeCompare(b[0], 'zh-Hant'),
  )
}

/** 從預約列表計算今日總覽統計（DayView / 今日預約用） */
export function computeTodayOverviewStats(bookings: Booking[]): TodayOverviewStats {
  const safeBookings = bookings || []
  const totalBookings = safeBookings.length
  const totalDurationMinutes = safeBookings.reduce((sum, b) => sum + (b.duration_min || 0), 0)

  const coachStats = new Map<string, { count: number; totalMinutes: number }>()
  safeBookings.forEach((booking) => {
    booking.coaches?.forEach((coach) => {
      if (!coach?.name) return
      const current = coachStats.get(coach.name) || { count: 0, totalMinutes: 0 }
      coachStats.set(coach.name, {
        count: current.count + 1,
        totalMinutes: current.totalMinutes + booking.duration_min,
      })
    })
  })

  const driverStats = new Map<string, { count: number; totalMinutes: number }>()
  safeBookings.forEach((booking) => {
    if (isFacility(booking.boats?.name)) return
    booking.drivers?.forEach((driver) => {
      if (!driver?.name) return
      const current = driverStats.get(driver.name) || { count: 0, totalMinutes: 0 }
      driverStats.set(driver.name, {
        count: current.count + 1,
        totalMinutes: current.totalMinutes + booking.duration_min,
      })
    })
  })

  const combinedStats = new Map<string, { count: number; totalMinutes: number }>()
  for (const booking of safeBookings) {
    const uniquePeople = new Set<string>()
    booking.coaches?.forEach((c) => {
      if (c?.name) uniquePeople.add(c.name)
    })
    if (!isFacility(booking.boats?.name)) {
      booking.drivers?.forEach((d) => {
        if (d?.name) uniquePeople.add(d.name)
      })
    }
    for (const name of uniquePeople) {
      const current = combinedStats.get(name) || { count: 0, totalMinutes: 0 }
      combinedStats.set(name, {
        count: current.count + 1,
        totalMinutes: current.totalMinutes + booking.duration_min,
      })
    }
  }

  const boatStats = new Map<string, { count: number; totalMinutes: number }>()
  safeBookings.forEach((booking) => {
    if (!booking.boats?.name) return
    const current = boatStats.get(booking.boats.name) || { count: 0, totalMinutes: 0 }
    boatStats.set(booking.boats.name, {
      count: current.count + 1,
      totalMinutes: current.totalMinutes + booking.duration_min,
    })
  })

  return {
    totalBookings,
    totalDurationMinutes,
    sortedCoaches: sortStats(Array.from(coachStats.entries())),
    sortedDrivers: sortStats(Array.from(driverStats.entries())),
    sortedCombined: sortStats(Array.from(combinedStats.entries())),
    sortedBoats: sortStats(Array.from(boatStats.entries())),
  }
}

/** 排班頁：依當前 assignments 狀態計算統計（非 DB 已儲存教練） */
export function computeAssignmentOverviewStats(
  bookings: Array<{ id: number; duration_min: number; boats?: { name: string } | null; requires_driver?: boolean }>,
  assignments: Record<number, { coachIds: string[]; driverIds: string[] }>,
  staff: Array<{ id: string; name: string }>,
): TodayOverviewStats {
  const totalBookings = bookings.length
  const totalDurationMinutes = bookings.reduce((t, b) => t + (b.duration_min || 0), 0)

  const coachStats = new Map<string, { count: number; totalMinutes: number }>()
  const driverStats = new Map<string, { count: number; totalMinutes: number }>()
  const combinedStats = new Map<string, { count: number; totalMinutes: number }>()
  const boatStats = new Map<string, { count: number; totalMinutes: number }>()

  for (const booking of bookings) {
    const assignment = assignments[booking.id]
    if (booking.boats?.name) {
      const current = boatStats.get(booking.boats.name) || { count: 0, totalMinutes: 0 }
      boatStats.set(booking.boats.name, {
        count: current.count + 1,
        totalMinutes: current.totalMinutes + booking.duration_min,
      })
    }
    if (!assignment) continue

    assignment.coachIds.forEach((coachId) => {
      const coach = staff.find((c) => c.id === coachId)
      if (!coach) return
      const current = coachStats.get(coach.name) || { count: 0, totalMinutes: 0 }
      coachStats.set(coach.name, {
        count: current.count + 1,
        totalMinutes: current.totalMinutes + booking.duration_min,
      })
    })

    if (!isFacility(booking.boats?.name)) {
      assignment.driverIds.forEach((driverId) => {
        const driver = staff.find((c) => c.id === driverId)
        if (!driver) return
        const current = driverStats.get(driver.name) || { count: 0, totalMinutes: 0 }
        driverStats.set(driver.name, {
          count: current.count + 1,
          totalMinutes: current.totalMinutes + booking.duration_min,
        })
      })
    }

    const uniquePeople = new Set<string>([...assignment.coachIds])
    if (!isFacility(booking.boats?.name)) {
      assignment.driverIds.forEach((id) => uniquePeople.add(id))
    }
    for (const id of uniquePeople) {
      const person = staff.find((c) => c.id === id)
      if (!person) continue
      const current = combinedStats.get(person.name) || { count: 0, totalMinutes: 0 }
      combinedStats.set(person.name, {
        count: current.count + 1,
        totalMinutes: current.totalMinutes + booking.duration_min,
      })
    }
  }

  return {
    totalBookings,
    totalDurationMinutes,
    sortedCoaches: sortStats(Array.from(coachStats.entries())),
    sortedDrivers: sortStats(Array.from(driverStats.entries())),
    sortedCombined: sortStats(Array.from(combinedStats.entries())),
    sortedBoats: sortStats(Array.from(boatStats.entries())),
  }
}
