import type { SupabaseClient } from '@supabase/supabase-js'
import { sortBoatsByDisplayOrder } from './boatUtils'

export type BoatUsageRangeRow = {
  boatId: number
  boatName: string
  /** 與歷史趨勢相同：未取消、非教練練習，預約表 duration_min 加總 */
  generalMinutes: number
  /** 教練練習：未取消、is_coach_practice = true，預約表 duration_min 加總 */
  practiceMinutes: number
  /** 各船總和（一般 + 教練練習） */
  totalMinutes: number
}

export type BoatUsageRangeResult = {
  boats: BoatUsageRangeRow[]
}

const selectBookings =
  'id, duration_min, boat_id, boats(id, name)'

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

function aggregateBookings(
  rows: unknown[] | null
): Map<number, { boatName: string; minutes: number }> {
  const map = new Map<number, { boatName: string; minutes: number }>()
  for (const row of rows || []) {
    const raw = row as Record<string, unknown>
    const boats = normalizeBoats(raw.boats)
    const boatId = (raw.boat_id as number) ?? boats?.id ?? 0
    const boatName = boats?.name || '未知'
    const m = (raw.duration_min as number | null) || 0
    addByBoat(map, boatId, boatName, m)
  }
  return map
}

/**
 * 各船區間時數：
 * - 一般預約：與 Statistics `loadMonthlyTrend` 相同（未取消、排除教練練習）。
 * - 教練練習：未取消、is_coach_practice = true，預約表時數。
 * - 總和：兩者相加。
 */
export async function loadBoatUsageRangeStats(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string
): Promise<BoatUsageRangeResult> {
  const startIso = `${startDate}T00:00:00`
  const endIso = `${endDate}T23:59:59`

  const base = () =>
    supabase
      .from('bookings')
      .select(selectBookings)
      .gte('start_at', startIso)
      .lte('start_at', endIso)
      .neq('status', 'cancelled')

  const [generalRes, practiceRes] = await Promise.all([
    base().or('is_coach_practice.is.null,is_coach_practice.eq.false'),
    base().eq('is_coach_practice', true)
  ])

  if (generalRes.error) throw generalRes.error
  if (practiceRes.error) throw practiceRes.error

  const generalByBoat = aggregateBookings(generalRes.data)
  const practiceByBoat = aggregateBookings(practiceRes.data)

  const { data: allBoats, error: boatsErr } = await supabase.from('boats').select('id, name')
  if (boatsErr) throw boatsErr

  const sorted = sortBoatsByDisplayOrder(allBoats || [])
  const boats: BoatUsageRangeRow[] = sorted.map((b) => {
    const g = generalByBoat.get(b.id)?.minutes ?? 0
    const p = practiceByBoat.get(b.id)?.minutes ?? 0
    return {
      boatId: b.id,
      boatName: b.name,
      generalMinutes: g,
      practiceMinutes: p,
      totalMinutes: g + p
    }
  })

  return { boats }
}
