import type { SupabaseClient } from '@supabase/supabase-js'
import { sortBoatsByDisplayOrder } from './boatUtils'

export type BoatUsageRangeRow = {
  boatId: number
  boatName: string
  practiceMinutes: number
  operationalMinutes: number
  totalMinutes: number
}

export type BoatUsageRangeResult = {
  boats: BoatUsageRangeRow[]
}

/**
 * 維護用區間時數（分船加總）：
 * - 教練練習：納入，以預約表 duration_min 計（無回報亦計）。
 * - 其他預約：與 Dashboard「月報分析」會員統計一致——僅計「已處理」參與者且已扣款
 *   （會員直接計；非會員須有 consume 交易），每筆預約只加一次預約時數。
 */
export async function loadBoatUsageRangeStats(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string
): Promise<BoatUsageRangeResult> {
  const startIso = `${startDate}T00:00:00`
  const endIso = `${endDate}T23:59:59`

  const { data: practiceBookings, error: practiceErr } = await supabase
    .from('bookings')
    .select('id, duration_min, boat_id, boats(id, name)')
    .gte('start_at', startIso)
    .lte('start_at', endIso)
    .neq('status', 'cancelled')
    .eq('is_coach_practice', true)

  if (practiceErr) throw practiceErr

  const { data: participants, error: partErr } = await supabase
    .from('booking_participants')
    .select(`
      id,
      member_id,
      bookings!inner(
        id,
        duration_min,
        boat_id,
        start_at,
        status,
        is_coach_practice,
        boats(id, name)
      )
    `)
    .eq('status', 'processed')
    .eq('is_deleted', false)
    .gte('bookings.start_at', startIso)
    .lte('bookings.start_at', endIso)

  if (partErr) throw partErr

  type BookingJoin = {
    id: number
    duration_min: number | null
    boat_id: number
    start_at: string
    status: string | null
    is_coach_practice: boolean | null
    boats: { id: number; name: string } | null
  }

  type PRow = {
    id: number
    member_id: string | null
    bookings: BookingJoin
  }

  const normalizeBoats = (v: unknown): { id: number; name: string } | null => {
    if (!v) return null
    if (Array.isArray(v)) {
      const first = v[0] as { id?: number; name?: string } | undefined
      return first?.id != null && first?.name != null ? { id: first.id, name: first.name } : null
    }
    const o = v as { id?: number; name?: string }
    return o?.id != null && o?.name != null ? { id: o.id, name: o.name } : null
  }

  const rows: PRow[] = (participants || [])
    .map((raw: Record<string, unknown>) => {
      const b = raw.bookings
      const bookingRaw = (Array.isArray(b) ? b[0] : b) as Record<string, unknown> | undefined
      if (!bookingRaw) return null
      const boats = normalizeBoats(bookingRaw.boats)
      const boatId = (bookingRaw.boat_id as number) ?? boats?.id ?? 0
      const booking: BookingJoin = {
        id: bookingRaw.id as number,
        duration_min: (bookingRaw.duration_min as number | null) ?? null,
        boat_id: boatId,
        start_at: bookingRaw.start_at as string,
        status: (bookingRaw.status as string | null) ?? null,
        is_coach_practice: (bookingRaw.is_coach_practice as boolean | null) ?? null,
        boats
      }
      return {
        id: raw.id as number,
        member_id: (raw.member_id as string | null) ?? null,
        bookings: booking
      }
    })
    .filter((r): r is PRow => r != null)

  const operationalCandidates = rows.filter((r) => {
    const b = r.bookings
    if (!b || b.status === 'cancelled') return false
    if (b.is_coach_practice === true) return false
    return true
  })

  const nonMemberIds = operationalCandidates
    .filter((r) => !r.member_id)
    .map((r) => r.id)

  const consumePid = new Set<number>()
  const chunk = 500
  for (let i = 0; i < nonMemberIds.length; i += chunk) {
    const slice = nonMemberIds.slice(i, i + chunk)
    if (slice.length === 0) continue
    const { data: txs, error: txErr } = await supabase
      .from('transactions')
      .select('booking_participant_id')
      .eq('transaction_type', 'consume')
      .in('booking_participant_id', slice)
    if (txErr) throw txErr
    txs?.forEach((t: { booking_participant_id: number | null }) => {
      if (t.booking_participant_id != null) consumePid.add(t.booking_participant_id)
    })
  }

  type BookingMeta = { durationMin: number; boatId: number; boatName: string }
  const paidBookingMeta = new Map<number, BookingMeta>()

  for (const r of operationalCandidates) {
    const paid = Boolean(r.member_id) || consumePid.has(r.id)
    if (!paid) continue
    const b = r.bookings
    const durationMin = b.duration_min || 0
    const boatId = b.boats?.id ?? b.boat_id ?? 0
    const boatName = b.boats?.name || '未知'
    if (!paidBookingMeta.has(b.id)) {
      paidBookingMeta.set(b.id, { durationMin, boatId, boatName })
    }
  }

  type Cell = { boatName: string; practiceMinutes: number; operationalMinutes: number }
  const boatAccum = new Map<number, Cell>()

  const ensure = (boatId: number, boatName: string): Cell => {
    if (!boatAccum.has(boatId)) {
      boatAccum.set(boatId, { boatName, practiceMinutes: 0, operationalMinutes: 0 })
    }
    return boatAccum.get(boatId)!
  }

  for (const row of practiceBookings || []) {
    const raw = row as Record<string, unknown>
    const boats = normalizeBoats(raw.boats)
    const boatId = (raw.boat_id as number) ?? boats?.id ?? 0
    const boatName = boats?.name || '未知'
    const m = (raw.duration_min as number | null) || 0
    ensure(boatId, boatName).practiceMinutes += m
  }

  for (const meta of paidBookingMeta.values()) {
    ensure(meta.boatId, meta.boatName).operationalMinutes += meta.durationMin
  }

  const { data: allBoats } = await supabase.from('boats').select('id, name')
  const orderIds = sortBoatsByDisplayOrder(allBoats || []).map((b) => b.id)
  const orderIndex = new Map(orderIds.map((id, i) => [id, i]))

  const boats: BoatUsageRangeRow[] = Array.from(boatAccum.entries())
    .map(([boatId, v]) => ({
      boatId,
      boatName: v.boatName,
      practiceMinutes: v.practiceMinutes,
      operationalMinutes: v.operationalMinutes,
      totalMinutes: v.practiceMinutes + v.operationalMinutes
    }))
    .sort((a, b) => {
      const ia = orderIndex.get(a.boatId) ?? 999
      const ib = orderIndex.get(b.boatId) ?? 999
      if (ia !== ib) return ia - ib
      return a.boatId - b.boatId
    })

  return { boats }
}
