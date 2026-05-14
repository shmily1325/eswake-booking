import type { SupabaseClient } from '@supabase/supabase-js'
import { sortBoatsByDisplayOrder } from './boatUtils'
import { isFacility } from './facility'
import { loadPaidOperationalParticipantsForRange } from './settledNonPracticeBookings'

export type BoatUsageRangeRow = {
  boatId: number
  boatName: string
  /**
   * 營運（已結帳）：已結帳參與者之回報分鐘加總（booking_participants.duration_min），
   * 與 Dashboard「歷史趨勢」各船欄相同口徑。
   */
  generalMinutes: number
  /** 教練練習：未取消、is_coach_practice = true，預約表 duration_min（內部用船，不以此欄看收錢） */
  practiceMinutes: number
  /** 各船總和（已扣款 + 教練練習） */
  totalMinutes: number
}

/** 區間內單筆教練練習預約（不含彈簧床／陸上課程） */
export type CoachPracticeSessionRow = {
  bookingId: number
  startAt: string
  boatName: string
  /** 預約表聯絡／預約人（contact_name） */
  contactName: string
  durationMin: number
}

export type BoatUsageRangeResult = {
  boats: BoatUsageRangeRow[]
  practiceSessions: CoachPracticeSessionRow[]
}

const practiceBookingSelect = 'id, start_at, duration_min, boat_id, contact_name, boats(id, name)'

function normalizeBoats(v: unknown): { id: number; name: string } | null {
  if (!v) return null
  if (Array.isArray(v)) {
    const first = v[0] as { id?: number; name?: string } | undefined
    return first?.id != null && first?.name != null ? { id: first.id, name: first.name } : null
  }
  const o = v as { id?: number; name?: string }
  return o?.id != null && o?.name != null ? { id: o.id, name: o.name } : null
}

function addByBoat(
  map: Map<number, { boatName: string; minutes: number }>,
  boatId: number,
  boatName: string,
  delta: number
) {
  const cur = map.get(boatId)
  if (cur) cur.minutes += delta
  else map.set(boatId, { boatName, minutes: delta })
}

async function loadPracticeSessionsAndByBoat(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string
): Promise<{
  practiceSessions: CoachPracticeSessionRow[]
  practiceByBoat: Map<number, { boatName: string; minutes: number }>
}> {
  const startIso = `${startDate}T00:00:00`
  const endIso = `${endDate}T23:59:59`

  const { data: practiceBookings, error: practiceErr } = await supabase
    .from('bookings')
    .select(practiceBookingSelect)
    .gte('start_at', startIso)
    .lte('start_at', endIso)
    .neq('status', 'cancelled')
    .eq('is_coach_practice', true)
    .order('start_at', { ascending: true })

  if (practiceErr) throw practiceErr

  const practiceByBoat = new Map<number, { boatName: string; minutes: number }>()
  const practiceSessions: CoachPracticeSessionRow[] = []

  for (const row of practiceBookings || []) {
    const raw = row as Record<string, unknown>
    const boats = normalizeBoats(raw.boats)
    const boatId = (raw.boat_id as number) ?? boats?.id ?? 0
    const boatName = boats?.name || '未知'
    if (isFacility(boatName)) continue
    const m = Math.max(0, Math.floor((raw.duration_min as number | null) || 0))
    addByBoat(practiceByBoat, boatId, boatName, m)

    const contactRaw = raw.contact_name
    const contactName =
      typeof contactRaw === 'string' && contactRaw.trim() ? contactRaw.trim() : '—'

    practiceSessions.push({
      bookingId: (raw.id as number) ?? 0,
      startAt: String(raw.start_at ?? ''),
      boatName,
      contactName,
      durationMin: m
    })
  }

  return { practiceSessions, practiceByBoat }
}

/** 僅教練練習逐筆列表（不查結帳／各船營運），供 Dashboard 月報等使用。 */
export async function loadCoachPracticeSessionsForRange(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string
): Promise<CoachPracticeSessionRow[]> {
  const { practiceSessions } = await loadPracticeSessionsAndByBoat(supabase, startDate, endDate)
  return practiceSessions
}

/**
 * 各船區間時數（實際船隻，不含彈簧床／陸上課程）：
 * - generalMinutes：已結帳／已扣款之一般預約時數（見型別註解）。
 * - practiceMinutes：教練練習預約表時數。
 * - totalMinutes：兩者相加。
 */
export async function loadBoatUsageRangeStats(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string
): Promise<BoatUsageRangeResult> {
  const { practiceSessions, practiceByBoat } = await loadPracticeSessionsAndByBoat(
    supabase,
    startDate,
    endDate
  )

  const settledParts = await loadPaidOperationalParticipantsForRange(supabase, startDate, endDate)
  const settledByBoat = new Map<number, { boatName: string; minutes: number }>()
  for (const row of settledParts) {
    if (isFacility(row.boatName)) continue
    addByBoat(settledByBoat, row.boatId, row.boatName, row.participantMinutes)
  }

  const { data: allBoats, error: boatsErr } = await supabase.from('boats').select('id, name')
  if (boatsErr) throw boatsErr

  const sorted = sortBoatsByDisplayOrder(allBoats || []).filter((b) => !isFacility(b.name))
  const boats: BoatUsageRangeRow[] = sorted.map((b) => {
    const g = settledByBoat.get(b.id)?.minutes ?? 0
    const p = practiceByBoat.get(b.id)?.minutes ?? 0
    return {
      boatId: b.id,
      boatName: b.name,
      generalMinutes: g,
      practiceMinutes: p,
      totalMinutes: g + p
    }
  })

  return { boats, practiceSessions }
}
