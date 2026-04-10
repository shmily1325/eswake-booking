import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 已結帳且非教練練習之預約（每筆最多一列）。
 * 會員：已處理即視為已結帳；非會員：有 consume，或備註為現金／匯款／直接結清（與 PendingDeductionItem 一致）。
 */
export type SettledNonPracticeBooking = {
  bookingId: number
  start_at: string
  duration_min: number
  boatId: number
  boatName: string
}

function normalizeBoats(v: unknown): { id: number; name: string } | null {
  if (!v) return null
  if (Array.isArray(v)) {
    const first = v[0] as { id?: number; name?: string } | undefined
    return first?.id != null && first?.name != null ? { id: first.id, name: first.name } : null
  }
  const o = v as { id?: number; name?: string }
  return o?.id != null && o?.name != null ? { id: o.id, name: o.name } : null
}

/** 與 handleSettlement 寫入的 notes 後綴一致（無 consume 之現金／匯款等結清） */
export function isDirectSettlementParticipantNotes(notes: string | null | undefined): boolean {
  if (!notes) return false
  return (
    notes.includes('[現金結清]') ||
    notes.includes('[匯款結清]') ||
    notes.includes('[指定課不收費]') ||
    notes.includes('[結清]')
  )
}

/**
 * 區間內：參與者已處理、已結帳（會員／非會員 consume／非會員直接結清備註）、預約未取消且非教練練習。
 * 每筆預約回傳一次，時長為預約表 duration_min。
 */
export async function loadSettledNonPracticeBookingsForRange(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string
): Promise<SettledNonPracticeBooking[]> {
  const startIso = `${startDate}T00:00:00`
  const endIso = `${endDate}T23:59:59`

  const { data: participants, error: partErr } = await supabase
    .from('booking_participants')
    .select(`
      id,
      member_id,
      notes,
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
    notes: string | null
    bookings: BookingJoin
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
        notes: (raw.notes as string | null) ?? null,
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

  type Meta = {
    duration_min: number
    boatId: number
    boatName: string
    start_at: string
  }
  const byBookingId = new Map<number, Meta>()

  for (const r of operationalCandidates) {
    const paid =
      Boolean(r.member_id) ||
      consumePid.has(r.id) ||
      isDirectSettlementParticipantNotes(r.notes)
    if (!paid) continue
    const b = r.bookings
    const durationMin = b.duration_min || 0
    const boatId = b.boats?.id ?? b.boat_id ?? 0
    const boatName = b.boats?.name || '未知'
    if (!byBookingId.has(b.id)) {
      byBookingId.set(b.id, {
        duration_min: durationMin,
        boatId,
        boatName,
        start_at: b.start_at
      })
    }
  }

  return Array.from(byBookingId.entries()).map(([bookingId, m]) => ({
    bookingId,
    start_at: m.start_at,
    duration_min: m.duration_min,
    boatId: m.boatId,
    boatName: m.boatName
  }))
}
