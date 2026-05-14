import { getFacilityMessageLabel } from './facility'

/** 明日提醒頁「教練提醒訊息」區塊要列出的教練（依 booking_coaches 姓名完全比對，姓名 trim 後比對） */
export const TOMORROW_COACH_REMINDER_TARGET_COACHES = ['火隆', '侑曄'] as const

export type CoachTomorrowReminderBooking = {
  /** 去重：同一 id 只列一次 */
  id?: number
  start_at: string
  contact_name?: string | null
  duration_min?: number
  boats?: { name: string } | null
  coaches?: { name: string }[]
}

/** 供測試與重用：拆預約人字串，略過空白片段 */
export function parseContactNames(contact: string | null | undefined): string[] {
  if (contact == null || typeof contact !== 'string') return []
  return contact
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean)
}

function formatTimeNoColon(dateString: string): string {
  if (!dateString || typeof dateString !== 'string') return '----'
  const datetime = dateString.substring(0, 16)
  const parts = datetime.split('T')
  if (parts.length < 2) return '----'
  const timeStr = parts[1]
  const hm = timeStr.split(':')
  if (hm.length < 2 || hm[0] == null || hm[1] == null) return '----'
  const [hours, minutes] = hm
  return `${hours}${minutes}`
}

function timeSegmentForBooking(booking: CoachTomorrowReminderBooking): string {
  const t = formatTimeNoColon(booking.start_at)
  const boatName = booking.boats?.name || ''
  const facilityLabel = getFacilityMessageLabel(boatName)
  if (facilityLabel === '陸上課程') return `${t}陸上訓練`
  if (facilityLabel === '彈簧床') return `${t}彈簧床`
  return `${t}下水(${boatName || '—'})`
}

function bookingHasCoach(booking: CoachTomorrowReminderBooking, coachName: string): boolean {
  const target = coachName.trim()
  return booking.coaches?.some((c) => c.name.trim() === target) ?? false
}

function dedupeBookingsByIdentity(bookings: CoachTomorrowReminderBooking[]): CoachTomorrowReminderBooking[] {
  const seen = new Set<string>()
  const out: CoachTomorrowReminderBooking[] = []
  for (const b of bookings) {
    const key =
      b.id != null
        ? `id:${b.id}`
        : `t:${b.start_at}\x1f${b.boats?.name ?? ''}\x1f${b.duration_min ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(b)
  }
  return out
}

const EMPTY_CONTACT_LABEL = '（未填預約人）'

/**
 * 某位教練當日提醒：**一筆預約一行**。該筆所有預約人以逗號接在開頭，例如
 * `Dexter, Fish 1000下水(黑豹)`；下一筆再一行 `Dexter 1100下水(G23)`。
 * 無預約人亦一筆一行：`（未填預約人） 0900下水(黑豹)`。
 */
export function getCoachTomorrowReminderLines(
  coachName: string,
  bookings: CoachTomorrowReminderBooking[]
): string[] {
  const rawCoachBookings = bookings
    .filter((b) => bookingHasCoach(b, coachName))
    .sort((a, b) => a.start_at.localeCompare(b.start_at))

  const coachBookings = dedupeBookingsByIdentity(rawCoachBookings)

  return coachBookings.map((b) => {
    const names = parseContactNames(b.contact_name)
    const namePart = names.length > 0 ? names.join(', ') : EMPTY_CONTACT_LABEL
    return `${namePart} ${timeSegmentForBooking(b)}`
  })
}
