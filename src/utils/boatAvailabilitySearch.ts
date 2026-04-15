import { calculateTimeSlot, checkTimeSlotConflict, timeToMinutes, minutesToTime } from './bookingConflict'
import {
  AVAILABILITY_SEARCH_CLIP_LAST_START_MINUTES,
  AVAILABILITY_SEARCH_CLIP_START_MINUTES,
} from '../constants/booking'

export type BoatAvailabilityDayFilter = 'all' | 'weekday' | 'weekend'

export interface BoatAvailabilityBookingRow {
  boat_id: number
  start_at: string
  duration_min: number
  cleanup_minutes?: number | null
}

export interface BoatAvailabilityUnavailableRow {
  boat_id: number
  start_date: string
  end_date: string
  start_time?: string | null
  end_time?: string | null
  is_active?: boolean | null
}

export interface BoatAvailabilitySlot {
  dateYmd: string
  boatName: string
  startHm: string
  endHm: string
}

const DEFAULT_EXISTING_CLEANUP = 15

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function toHmCompact(timeHHMM: string): string {
  const [h, m] = timeHHMM.split(':').map(Number)
  return `${pad2(h)}${pad2(m)}`
}

/** 本地 YYYY-MM-DD 逐日列舉（含首尾） */
export function enumerateDatesInclusive(fromYmd: string, toYmd: string): string[] {
  if (!fromYmd || !toYmd) return []
  const out: string[] = []
  const d0 = new Date(`${fromYmd}T12:00:00`)
  const d1 = new Date(`${toYmd}T12:00:00`)
  if (Number.isNaN(d0.getTime()) || Number.isNaN(d1.getTime()) || d1 < d0) return []
  for (let d = new Date(d0); d <= d1; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear()
    const mo = d.getMonth() + 1
    const day = d.getDate()
    out.push(`${y}-${pad2(mo)}-${pad2(day)}`)
  }
  return out
}

export function dayMatchesBoatAvailabilityFilter(ymd: string, filter: BoatAvailabilityDayFilter): boolean {
  const d = new Date(`${ymd}T12:00:00`)
  if (Number.isNaN(d.getTime())) return false
  const w = d.getDay()
  if (filter === 'all') return true
  if (filter === 'weekend') return w === 0 || w === 6
  return w >= 1 && w <= 5
}

function slotOverlapsUnavailable(
  boatId: number,
  date: string,
  startTime: string,
  durationMin: number,
  records: BoatAvailabilityUnavailableRow[]
): boolean {
  const startMinutes = timeToMinutes(startTime)
  const endMinutes = startMinutes + durationMin

  const relevant = records.filter(
    r =>
      r.boat_id === boatId &&
      r.start_date <= date &&
      r.end_date >= date &&
      r.is_active !== false
  )

        for (const record of relevant) {
    if (!record.start_time && !record.end_time) {
      return true
    }

    let recordStartMinutes = 0
    let recordEndMinutes = 24 * 60

    if (record.start_date === date && record.start_time) {
      const [h, m] = record.start_time.split(':').map(Number)
      recordStartMinutes = h * 60 + m
    }

    if (record.end_date === date && record.end_time) {
      const [h, m] = record.end_time.split(':').map(Number)
      recordEndMinutes = h * 60 + m
    }

    if (recordEndMinutes <= recordStartMinutes) {
      continue
    }

    if (!(endMinutes <= recordStartMinutes || startMinutes >= recordEndMinutes)) {
      return true
    }
  }

  return false
}

export interface BuildBoatAvailabilityLinesInput {
  dates: string[]
  dayFilter: BoatAvailabilityDayFilter
  timeFrom: string
  timeTo: string
  durationMin: number
  /** 搜尋用：假設新預約的接船／清理分鐘數 */
  searchBufferMinutes: 15 | 30
  stepMinutes: number
  boats: { id: number; name: string }[]
  bookings: BoatAvailabilityBookingRow[]
  unavailable: BoatAvailabilityUnavailableRow[]
}

/**
 * 僅查船（不含設施、不含教練），回傳 LINE 風格文字行：M/D HHmm-HHmm 船名，同日多筆以 or 連接。
 */
export function buildBoatAvailabilityLines(input: BuildBoatAvailabilityLinesInput): string[] {
  const {
    dates,
    dayFilter,
    timeFrom,
    timeTo,
    durationMin,
    searchBufferMinutes,
    stepMinutes,
    boats,
    bookings,
    unavailable,
  } = input

  const windowStart = timeToMinutes(timeFrom)
  const windowEnd = timeToMinutes(timeTo)
  if (
    !Number.isFinite(windowStart) ||
    !Number.isFinite(windowEnd) ||
    windowEnd < windowStart ||
    durationMin <= 0 ||
    stepMinutes <= 0 ||
    boats.length === 0
  ) {
    return ['（請檢查日期、船隻、時段與時長設定）']
  }

  // 開始時間裁剪：即使用戶選 00:00–24:00，也只列約 06:00–17:00 起點，並與「到」時邊界取交集
  const effStart = Math.max(windowStart, AVAILABILITY_SEARCH_CLIP_START_MINUTES)
  const lastStartFromWindow = windowEnd - durationMin
  const effLastStart = Math.min(lastStartFromWindow, AVAILABILITY_SEARCH_CLIP_LAST_START_MINUTES)
  if (!Number.isFinite(lastStartFromWindow) || effLastStart < effStart) {
    return ['（可排時段與合理開始時間（約 06:00–17:00）無交集，請調整每日可排時段或時長）']
  }

  const slots: BoatAvailabilitySlot[] = []

  for (const dateYmd of dates) {
    if (!dayMatchesBoatAvailabilityFilter(dateYmd, dayFilter)) continue

    for (const boat of boats) {
      const dayBookings = bookings.filter(
        b => b.boat_id === boat.id && b.start_at.startsWith(dateYmd)
      )

      for (let sm = effStart; sm <= effLastStart; sm += stepMinutes) {
        const startTime = minutesToTime(sm)
        if (slotOverlapsUnavailable(boat.id, dateYmd, startTime, durationMin, unavailable)) {
          continue
        }

        const newSlot = calculateTimeSlot(startTime, durationMin, searchBufferMinutes)
        let conflict = false

        for (const ex of dayBookings) {
          const existingTime = ex.start_at.substring(11, 16)
          if (!/^\d{2}:\d{2}$/.test(existingTime)) continue
          const dur = Number(ex.duration_min)
          if (!Number.isFinite(dur) || dur <= 0) continue
          const rawCleanup = ex.cleanup_minutes
          const existingCleanup =
            rawCleanup == null || !Number.isFinite(Number(rawCleanup))
              ? DEFAULT_EXISTING_CLEANUP
              : Math.max(0, Number(rawCleanup))
          const existingSlot = calculateTimeSlot(existingTime, dur, existingCleanup)

          if (checkTimeSlotConflict(newSlot, existingSlot)) {
            conflict = true
            break
          }
        }

        if (!conflict) {
          const endLesson = sm + durationMin
          slots.push({
            dateYmd,
            boatName: boat.name,
            startHm: toHmCompact(startTime),
            endHm: toHmCompact(minutesToTime(endLesson)),
          })
        }
      }
    }
  }

  slots.sort((a, b) => {
    const c = a.dateYmd.localeCompare(b.dateYmd)
    if (c !== 0) return c
    const ta = a.startHm.localeCompare(b.startHm)
    if (ta !== 0) return ta
    return a.boatName.localeCompare(b.boatName, 'zh-Hant')
  })

  if (slots.length === 0) {
    return ['（此條件下沒有可預約的船隻空檔）']
  }

  const linesByYmd = new Map<string, string[]>()
  for (const s of slots) {
    const piece = `${s.startHm}-${s.endHm} ${s.boatName}`
    const arr = linesByYmd.get(s.dateYmd) || []
    arr.push(piece)
    linesByYmd.set(s.dateYmd, arr)
  }

  return [...linesByYmd.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ymd, parts]) => {
      const [, m, d] = ymd.split('-').map(Number)
      return `${m}/${d} ${parts.join(' or ')}`
    })
}
