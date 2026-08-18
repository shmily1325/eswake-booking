/**
 * 預約互換（船隻／時段）
 * 驗證與寫入獨立於 EditBookingDialog，避免誤清排班／回報。
 */

import { supabase } from '../lib/supabase'
import {
  calculateTimeSlot,
  checkTimeSlotConflict,
  timeToMinutes,
} from './bookingConflict'
import { isFacility, isOverlapAllowed } from './facility'
import { EARLY_BOOKING_HOUR_LIMIT } from '../constants/booking'

/** 互換＝兩筆整組對調（船＋時間都換，時長各自保留） */
export type SwapMode = 'swap'

export interface SwapBookingLike {
  id: number
  boat_id: number
  start_at: string
  duration_min: number
  cleanup_minutes?: number | null
  contact_name: string
  status?: string | null
  boats?: { id?: number; name: string; is_active?: boolean | null } | null
  coaches?: { id: string; name: string }[]
  drivers?: { id: string; name: string }[]
}

export interface SwapValidationResult {
  ok: boolean
  reason?: string
}

export interface SwapAvailability {
  modes: SwapMode[]
  reason?: string
}

interface DayBookingRow {
  id: number
  boat_id: number
  start_at: string
  duration_min: number
  cleanup_minutes: number | null
  contact_name: string
  status: string | null
  boat_name: string
  boat_active: boolean
  coachIds: string[]
  driverIds: string[]
  coachNames: string[]
  driverNames: string[]
}

interface UnavailableRecord {
  boat_id: number
  start_date: string
  end_date: string
  start_time: string | null
  end_time: string | null
  reason?: string | null
}

interface RestrictionRecord {
  start_date: string
  end_date: string
  start_time: string | null
  end_time: string | null
  content?: string | null
}

/**
 * 一次載入當天所需的全部資料（預約、維修、全站限制），
 * 之後所有互換驗證都在記憶體計算，避免逐筆打 DB。
 */
export interface SwapContext {
  dateStr: string
  dayBookings: DayBookingRow[]
  unavailable: UnavailableRecord[]
  restrictions: RestrictionRecord[]
}

function dateOf(startAt: string): string {
  return startAt.substring(0, 10)
}

function timeOf(startAt: string): string {
  return startAt.substring(11, 16)
}

function replaceStartTime(startAt: string, newTime: string): string {
  return `${startAt.substring(0, 11)}${newTime}:00`
}

function cleanupForBoatName(boatName: string | undefined | null): number {
  return isFacility(boatName) ? 0 : 15
}

function isCancelled(status: string | null | undefined): boolean {
  return status === 'cancelled'
}

function personIdsOf(booking: SwapBookingLike | DayBookingRow): string[] {
  return peopleOf(booking).map(p => p.id)
}

function peopleOf(
  booking: SwapBookingLike | DayBookingRow
): { id: string; name: string; role: '教練' | '駕駛' }[] {
  const out: { id: string; name: string; role: '教練' | '駕駛' }[] = []
  const seen = new Set<string>()

  if ('coachIds' in booking) {
    for (let i = 0; i < (booking.coachIds || []).length; i++) {
      const id = booking.coachIds[i]
      if (!id || seen.has(id)) continue
      seen.add(id)
      out.push({
        id,
        name: booking.coachNames?.[i] || '未知',
        role: '教練',
      })
    }
    for (let i = 0; i < (booking.driverIds || []).length; i++) {
      const id = booking.driverIds[i]
      if (!id || seen.has(id)) continue
      seen.add(id)
      out.push({
        id,
        name: booking.driverNames?.[i] || '未知',
        role: '駕駛',
      })
    }
    return out
  }

  for (const c of booking.coaches || []) {
    if (!c?.id || seen.has(c.id)) continue
    seen.add(c.id)
    out.push({ id: c.id, name: c.name || '未知', role: '教練' })
  }
  for (const d of booking.drivers || []) {
    if (!d?.id || seen.has(d.id)) continue
    seen.add(d.id)
    out.push({ id: d.id, name: d.name || '未知', role: '駕駛' })
  }
  return out
}

function formatPeopleLabel(people: { name: string; role: '教練' | '駕駛' }[]): string {
  return people.map(p => `${p.role} ${p.name}`).join('、')
}

function boatNameOf(b: SwapBookingLike): string {
  return b.boats?.name || ''
}

/**
 * 套用互換後的假設預約：整組對調——換到對方的船＋對方的開始時間，
 * 時長與教練／駕駛各自保留。
 */
export function applySwapHypothetical(
  self: SwapBookingLike,
  other: SwapBookingLike,
  _mode: SwapMode = 'swap'
): SwapBookingLike {
  const name = boatNameOf(other)
  return {
    ...self,
    boat_id: other.boat_id,
    boats: other.boats,
    start_at: replaceStartTime(self.start_at, timeOf(other.start_at)),
    cleanup_minutes: cleanupForBoatName(name),
  }
}

function checkBoatConflictLocal(
  boatId: number,
  dateStr: string,
  startTime: string,
  durationMin: number,
  cleanupMinutes: number,
  boatName: string,
  dayBookings: DayBookingRow[],
  excludeIds: Set<number>
): SwapValidationResult {
  if (isOverlapAllowed(boatName)) {
    return { ok: true }
  }

  const newSlot = calculateTimeSlot(startTime, durationMin, cleanupMinutes)

  for (const existing of dayBookings) {
    if (existing.boat_id !== boatId) continue
    if (excludeIds.has(existing.id)) continue
    if (!existing.start_at.startsWith(dateStr)) continue
    if (isCancelled(existing.status)) continue

    const existingTime = timeOf(existing.start_at)
    const existingCleanup = existing.cleanup_minutes ?? 15
    const existingSlot = calculateTimeSlot(existingTime, existing.duration_min, existingCleanup)

    if (checkTimeSlotConflict(newSlot, existingSlot)) {
      return {
        ok: false,
        reason: `${boatName || '船隻'} 與 ${existing.contact_name}（${existingTime}）衝突`,
      }
    }
  }

  return { ok: true }
}

/**
 * 互換後兩筆是否自己撞自己（預檢必須做：validateOneSide 會把兩筆都 exclude，
 * 漏掉這段會變成「按鈕可按、執行才失敗」）。
 */
export function checkSwapPairMutualConflict(
  a: SwapBookingLike,
  b: SwapBookingLike
): SwapValidationResult {
  const nameA = boatNameOf(a)
  const nameB = boatNameOf(b)
  const cleanupA = a.cleanup_minutes ?? cleanupForBoatName(nameA)
  const cleanupB = b.cleanup_minutes ?? cleanupForBoatName(nameB)

  if (a.boat_id === b.boat_id && !isOverlapAllowed(nameA) && !isOverlapAllowed(nameB)) {
    const slotA = calculateTimeSlot(timeOf(a.start_at), a.duration_min, cleanupA)
    const slotB = calculateTimeSlot(timeOf(b.start_at), b.duration_min, cleanupB)
    if (checkTimeSlotConflict(slotA, slotB)) {
      return {
        ok: false,
        reason: `互換後兩筆在 ${nameA || '同船'} 時段重疊`,
      }
    }
  }

  const peopleA = peopleOf(a)
  const peopleB = peopleOf(b)
  const shared = peopleA.filter(p => peopleB.some(o => o.id === p.id))
  // 同船豁免（與教練排班一致）
  if (shared.length > 0 && a.boat_id !== b.boat_id) {
    const slotA = calculateTimeSlot(timeOf(a.start_at), a.duration_min)
    const slotB = calculateTimeSlot(timeOf(b.start_at), b.duration_min)
    if (checkTimeSlotConflict(slotA, slotB)) {
      return {
        ok: false,
        reason: `互換後 ${formatPeopleLabel(shared)} 時段衝突`,
      }
    }
  }

  return { ok: true }
}

/** 教練／駕駛時段衝突（含預設 15 分緩衝）；同船豁免 */
function checkPeopleConflictLocal(
  people: { id: string; name: string; role: '教練' | '駕駛' }[],
  hypoBoatId: number,
  dateStr: string,
  startTime: string,
  durationMin: number,
  dayBookings: DayBookingRow[],
  excludeIds: Set<number>
): SwapValidationResult {
  if (people.length === 0) return { ok: true }

  const personSet = new Set(people.map(p => p.id))
  const newSlot = calculateTimeSlot(startTime, durationMin) // 預設含 15 分緩衝

  for (const existing of dayBookings) {
    if (excludeIds.has(existing.id)) continue
    if (!existing.start_at.startsWith(dateStr)) continue
    if (isCancelled(existing.status)) continue
    // 同船豁免（與教練排班一致）
    if (existing.boat_id === hypoBoatId) continue

    const overlapping = people.filter(p =>
      personIdsOf(existing).includes(p.id) && personSet.has(p.id)
    )
    if (overlapping.length === 0) continue

    const existingTime = timeOf(existing.start_at)
    const existingSlot = calculateTimeSlot(existingTime, existing.duration_min)

    if (checkTimeSlotConflict(newSlot, existingSlot)) {
      return {
        ok: false,
        reason: `${formatPeopleLabel(overlapping)} 與 ${existing.contact_name}（${existingTime}）時段衝突`,
      }
    }
  }

  return { ok: true }
}

/** 記憶體版：船隻維修/停用（資料由 SwapContext 一次載入） */
function checkBoatUnavailableLocal(
  boatId: number,
  dateStr: string,
  startTime: string,
  durationMin: number,
  records: UnavailableRecord[]
): SwapValidationResult {
  const [sh, sm] = startTime.split(':').map(Number)
  const startMinutes = sh * 60 + sm
  const endMinutes = startMinutes + durationMin

  for (const record of records) {
    if (record.boat_id !== boatId) continue
    if (!(record.start_date <= dateStr && record.end_date >= dateStr)) continue

    // 全天停用
    if (!record.start_time && !record.end_time) {
      return { ok: false, reason: record.reason || '船隻此時段不可用' }
    }

    let rStart = 0
    let rEnd = 24 * 60
    if (record.start_date === dateStr && record.start_time) {
      const [h, m] = record.start_time.split(':').map(Number)
      rStart = h * 60 + m
    }
    if (record.end_date === dateStr && record.end_time) {
      const [h, m] = record.end_time.split(':').map(Number)
      rEnd = h * 60 + m
    }

    if (!(endMinutes <= rStart || startMinutes >= rEnd)) {
      return { ok: false, reason: record.reason || '船隻此時段不可用' }
    }
  }

  return { ok: true }
}

/** 記憶體版：全站預約限制（資料由 SwapContext 一次載入） */
function checkRestrictionLocal(
  dateStr: string,
  startTime: string,
  durationMin: number,
  records: RestrictionRecord[]
): SwapValidationResult {
  const [sh, sm] = startTime.split(':').map(Number)
  const startMinutes = sh * 60 + sm
  const endMinutes = startMinutes + durationMin

  for (const record of records) {
    if (!(record.start_date <= dateStr && record.end_date >= dateStr)) continue

    let rStart = 0
    let rEnd = 24 * 60
    if (record.start_date === dateStr && record.start_time) {
      const [h, m] = String(record.start_time).split(':').map(Number)
      rStart = h * 60 + m
    }
    if (record.end_date === dateStr && record.end_time) {
      const [h, m] = String(record.end_time).split(':').map(Number)
      rEnd = h * 60 + m
    }

    if (!(endMinutes <= rStart || startMinutes >= rEnd)) {
      return { ok: false, reason: record.content || '此時段有全站預約限制' }
    }
  }

  return { ok: true }
}

function checkEarlyCoachRule(hypo: SwapBookingLike): SwapValidationResult {
  const boatName = boatNameOf(hypo)
  const hour = timeToMinutes(timeOf(hypo.start_at)) / 60
  const needsCoach = isFacility(boatName) || hour < EARLY_BOOKING_HOUR_LIMIT
  const hasCoach = (hypo.coaches?.length || 0) > 0
  if (needsCoach && !hasCoach) {
    return {
      ok: false,
      reason: isFacility(boatName)
        ? '設施預約必須指定教練'
        : `${EARLY_BOOKING_HOUR_LIMIT}:00 前必須指定教練`,
    }
  }
  return { ok: true }
}

function validateOneSide(
  hypo: SwapBookingLike,
  ctx: SwapContext,
  excludeIds: Set<number>,
  options: { checkPeople: boolean }
): SwapValidationResult {
  if (isCancelled(hypo.status)) {
    return { ok: false, reason: '已取消的預約無法互換' }
  }

  const boatName = boatNameOf(hypo)
  if (hypo.boats && hypo.boats.is_active === false) {
    return { ok: false, reason: `${boatName || '船隻'} 已停用` }
  }

  const dateStr = ctx.dateStr
  const startTime = timeOf(hypo.start_at)
  const cleanup = hypo.cleanup_minutes ?? cleanupForBoatName(boatName)

  const boatConflict = checkBoatConflictLocal(
    hypo.boat_id,
    dateStr,
    startTime,
    hypo.duration_min,
    cleanup,
    boatName,
    ctx.dayBookings,
    excludeIds
  )
  if (!boatConflict.ok) return boatConflict

  const unavailable = checkBoatUnavailableLocal(
    hypo.boat_id,
    dateStr,
    startTime,
    hypo.duration_min,
    ctx.unavailable
  )
  if (!unavailable.ok) return unavailable

  const restriction = checkRestrictionLocal(
    dateStr,
    startTime,
    hypo.duration_min,
    ctx.restrictions
  )
  if (!restriction.ok) return restriction

  const early = checkEarlyCoachRule(hypo)
  if (!early.ok) return early

  if (options.checkPeople) {
    const people = checkPeopleConflictLocal(
      peopleOf(hypo),
      hypo.boat_id,
      dateStr,
      startTime,
      hypo.duration_min,
      ctx.dayBookings,
      excludeIds
    )
    if (!people.ok) return people
  }

  return { ok: true }
}

export async function loadSwapDayBookings(dateStr: string): Promise<DayBookingRow[]> {
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, boat_id, start_at, duration_min, cleanup_minutes, contact_name, status, boats:boat_id(id, name, is_active)')
    .gte('start_at', `${dateStr}T00:00:00`)
    .lte('start_at', `${dateStr}T23:59:59`)

  if (error) {
    throw new Error('載入當日預約失敗：' + error.message)
  }

  const rows = (bookings || []).filter(b => b && b.id) as any[]
  if (rows.length === 0) return []

  const ids = rows.map(b => b.id)
  const [coachesRes, driversRes] = await Promise.all([
    supabase
      .from('booking_coaches')
      .select('booking_id, coach_id, coaches:coach_id(id, name)')
      .in('booking_id', ids),
    supabase
      .from('booking_drivers')
      .select('booking_id, driver_id, coaches:driver_id(id, name)')
      .in('booking_id', ids),
  ])

  const coachMap = new Map<number, { id: string; name: string }[]>()
  for (const item of coachesRes.data || []) {
    const coach = (item as any).coaches
    if (!coach?.id) continue
    const list = coachMap.get(item.booking_id) || []
    list.push({ id: coach.id, name: coach.name })
    coachMap.set(item.booking_id, list)
  }

  const driverMap = new Map<number, { id: string; name: string }[]>()
  for (const item of driversRes.data || []) {
    const driver = (item as any).coaches
    if (!driver?.id) continue
    const list = driverMap.get(item.booking_id) || []
    list.push({ id: driver.id, name: driver.name })
    driverMap.set(item.booking_id, list)
  }

  return rows.map(b => {
    const coaches = coachMap.get(b.id) || []
    const drivers = driverMap.get(b.id) || []
    return {
      id: b.id,
      boat_id: b.boat_id,
      start_at: b.start_at,
      duration_min: b.duration_min,
      cleanup_minutes: b.cleanup_minutes ?? null,
      contact_name: b.contact_name,
      status: b.status ?? null,
      boat_name: b.boats?.name || '',
      boat_active: b.boats?.is_active !== false,
      coachIds: coaches.map(c => c.id),
      driverIds: drivers.map(d => d.id),
      coachNames: coaches.map(c => c.name),
      driverNames: drivers.map(d => d.name),
    }
  })
}

export async function loadSwapContext(dateStr: string): Promise<SwapContext> {
  const [dayBookings, unavailRes, restrictRes] = await Promise.all([
    loadSwapDayBookings(dateStr),
    supabase
      .from('boat_unavailable_dates')
      .select('boat_id, start_date, end_date, start_time, end_time, reason')
      .eq('is_active', true)
      .lte('start_date', dateStr)
      .gte('end_date', dateStr),
    (supabase as any)
      .from('reservation_restrictions_with_announcement_view')
      .select('*')
      .eq('is_active', true)
      .lte('start_date', dateStr)
      .gte('end_date', dateStr),
  ])

  return {
    dateStr,
    dayBookings,
    unavailable: (unavailRes.data || []) as UnavailableRecord[],
    restrictions: (restrictRes.data || []) as RestrictionRecord[],
  }
}

export function canConsiderPair(a: SwapBookingLike, b: SwapBookingLike): SwapValidationResult {
  if (a.id === b.id) return { ok: false, reason: '請選擇兩筆不同預約' }
  if (isCancelled(a.status) || isCancelled(b.status)) {
    return { ok: false, reason: '已取消的預約無法互換' }
  }
  if (dateOf(a.start_at) !== dateOf(b.start_at)) {
    return { ok: false, reason: '僅支援同一天互換' }
  }
  if (
    a.boat_id === b.boat_id &&
    timeOf(a.start_at) === timeOf(b.start_at) &&
    a.duration_min === b.duration_min
  ) {
    return { ok: false, reason: '兩筆預約船隻與時段相同，無需互換' }
  }
  return { ok: true }
}

export async function validateBookingSwap(
  a: SwapBookingLike,
  b: SwapBookingLike,
  _mode: SwapMode = 'swap',
  context?: SwapContext
): Promise<SwapValidationResult> {
  const base = canConsiderPair(a, b)
  if (!base.ok) return base

  const dateStr = dateOf(a.start_at)
  const ctx = context || (await loadSwapContext(dateStr))
  const excludeIds = new Set([a.id, b.id])

  // 整組對調：兩邊都換船＋換時間，因此都要重驗教練／駕駛時段
  const hypoA = applySwapHypothetical(a, b)
  const hypoB = applySwapHypothetical(b, a)

  const mutual = checkSwapPairMutualConflict(hypoA, hypoB)
  if (!mutual.ok) return mutual

  const resA = validateOneSide(hypoA, ctx, excludeIds, { checkPeople: true })
  const resB = validateOneSide(hypoB, ctx, excludeIds, { checkPeople: true })

  if (!resA.ok) {
    return { ok: false, reason: `${a.contact_name}：${resA.reason}` }
  }
  if (!resB.ok) {
    return { ok: false, reason: `${b.contact_name}：${resB.reason}` }
  }
  return { ok: true }
}

/** 兩筆是否可互換（整組對調後放得下）。不可行時帶 reason 供 UI 顯示。 */
export async function getAvailableSwapModes(
  a: SwapBookingLike,
  b: SwapBookingLike,
  context?: SwapContext
): Promise<SwapAvailability> {
  const base = canConsiderPair(a, b)
  if (!base.ok) return { modes: [], reason: base.reason || '無法互換' }

  const ctx = context || (await loadSwapContext(dateOf(a.start_at)))
  const result = await validateBookingSwap(a, b, 'swap', ctx)
  if (!result.ok) return { modes: [], reason: result.reason || '無法互換' }
  return { modes: ['swap'] }
}

export function swapModeLabel(_mode: SwapMode = 'swap'): string {
  return '互換'
}

function mapSwapRpcError(message: string): string {
  if (message.includes('stale') || message.includes('modified') || message.includes('已被')) {
    return '資料已被其他人修改，請重新整理後再試'
  }
  if (message.includes('cancelled') || message.includes('取消')) {
    return '已取消的預約無法互換'
  }
  if (message.includes('not found') || message.includes('找不到')) {
    return '找不到其中一筆預約，請重新整理'
  }
  if (message.includes('Not authenticated') || message.includes('登入')) {
    return '請重新登入後再試'
  }
  return message || '互換失敗'
}

export async function executeBookingSwap(params: {
  a: SwapBookingLike
  b: SwapBookingLike
  mode?: SwapMode
}): Promise<void> {
  const { a, b } = params

  // 寫入前再載一次當日資料，縮小競態窗
  const freshCtx = await loadSwapContext(dateOf(a.start_at))
  const validation = await validateBookingSwap(a, b, 'swap', freshCtx)
  if (!validation.ok) {
    throw new Error(validation.reason || '無法互換')
  }

  const hypoA = applySwapHypothetical(a, b)
  const hypoB = applySwapHypothetical(b, a)

  const { error } = await supabase.rpc('swap_bookings', {
    p_booking_a_id: a.id,
    p_booking_b_id: b.id,
    p_a_expected_boat_id: a.boat_id,
    p_a_expected_start_at: a.start_at,
    p_a_new_boat_id: hypoA.boat_id,
    p_a_new_start_at: hypoA.start_at,
    p_a_new_cleanup_minutes: hypoA.cleanup_minutes ?? cleanupForBoatName(boatNameOf(hypoA)),
    p_b_expected_boat_id: b.boat_id,
    p_b_expected_start_at: b.start_at,
    p_b_new_boat_id: hypoB.boat_id,
    p_b_new_start_at: hypoB.start_at,
    p_b_new_cleanup_minutes: hypoB.cleanup_minutes ?? cleanupForBoatName(boatNameOf(hypoB)),
  })

  if (error) {
    throw new Error(mapSwapRpcError(error.message))
  }
}
