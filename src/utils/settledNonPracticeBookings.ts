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

/**
 * 已結帳且符合營運條件之參與者（每人一列）。
 * 時數以 booking_participants.duration_min 為準（與教練回報一致）。
 */
export type PaidOperationalParticipant = {
  participantId: number
  bookingId: number
  start_at: string
  /** 參與者回報／帳務拆分分鐘 */
  participantMinutes: number
  /** 預約表 duration_min（筆數語意用，每筆預約一筆） */
  bookingDurationMin: number
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
  participant_duration_min: number
  bookings: BookingJoin
}

async function loadPaidOperationalRows(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string
): Promise<PRow[]> {
  const startIso = `${startDate}T00:00:00`
  const endIso = `${endDate}T23:59:59`

  const { data: participants, error: partErr } = await supabase
    .from('booking_participants')
    .select(`
      id,
      member_id,
      notes,
      duration_min,
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
        participant_duration_min: Number(raw.duration_min) || 0,
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

  return operationalCandidates.filter((r) => {
    const paid =
      Boolean(r.member_id) ||
      consumePid.has(r.id) ||
      isDirectSettlementParticipantNotes(r.notes)
    return paid
  })
}

/**
 * 已結帳參與者列（每人一列），分鐘為回報值。
 */
export async function loadPaidOperationalParticipantsForRange(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string
): Promise<PaidOperationalParticipant[]> {
  const paidRows = await loadPaidOperationalRows(supabase, startDate, endDate)
  return paidRows.map((r) => {
    const b = r.bookings
    const boatId = b.boats?.id ?? b.boat_id ?? 0
    const boatName = b.boats?.name || '未知'
    return {
      participantId: r.id,
      bookingId: b.id,
      start_at: b.start_at,
      participantMinutes: r.participant_duration_min,
      bookingDurationMin: b.duration_min || 0,
      boatId,
      boatName
    }
  })
}

/**
 * 區間內：每筆已結帳一般預約一列（筆數用）；duration_min 為預約表欄位。
 * 各船／總分鐘請用 loadPaidOperationalParticipantsForRange 加總 participantMinutes。
 */
export async function loadSettledNonPracticeBookingsForRange(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string
): Promise<SettledNonPracticeBooking[]> {
  const paidRows = await loadPaidOperationalRows(supabase, startDate, endDate)
  const byBookingId = new Map<number, SettledNonPracticeBooking>()

  for (const r of paidRows) {
    const b = r.bookings
    const boatId = b.boats?.id ?? b.boat_id ?? 0
    const boatName = b.boats?.name || '未知'
    const bookingDurationMin = b.duration_min || 0
    if (!byBookingId.has(b.id)) {
      byBookingId.set(b.id, {
        bookingId: b.id,
        start_at: b.start_at,
        duration_min: bookingDurationMin,
        boatId,
        boatName
      })
    }
  }

  return Array.from(byBookingId.values())
}
