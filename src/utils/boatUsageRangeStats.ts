import type { SupabaseClient } from '@supabase/supabase-js'

export type BoatUsageRangeResult = {
  /** 區間內合計分鐘（教練練習＋營運已結扣款，規則見函式註解） */
  totalMinutes: number
}

/**
 * 維護用區間時數合計：
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
    .select('id, duration_min')
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
        start_at,
        status,
        is_coach_practice
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
    start_at: string
    status: string | null
    is_coach_practice: boolean | null
  }

  type PRow = {
    id: number
    member_id: string | null
    bookings: BookingJoin
  }

  const rows: PRow[] = (participants || [])
    .map((raw: Record<string, unknown>) => {
      const b = raw.bookings
      const booking = (Array.isArray(b) ? b[0] : b) as BookingJoin | undefined
      if (!booking) return null
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

  const paidBookingDurations = new Map<number, number>()

  for (const r of operationalCandidates) {
    const paid = Boolean(r.member_id) || consumePid.has(r.id)
    if (!paid) continue
    const b = r.bookings
    const durationMin = b.duration_min || 0
    if (!paidBookingDurations.has(b.id)) {
      paidBookingDurations.set(b.id, durationMin)
    }
  }

  let totalPracticeMinutes = 0
  for (const row of practiceBookings || []) {
    const b = row as { duration_min: number | null }
    totalPracticeMinutes += b.duration_min || 0
  }

  let totalOperationalMinutes = 0
  for (const d of paidBookingDurations.values()) {
    totalOperationalMinutes += d
  }

  return {
    totalMinutes: totalPracticeMinutes + totalOperationalMinutes
  }
}
