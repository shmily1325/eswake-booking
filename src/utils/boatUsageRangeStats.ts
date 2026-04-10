import type { SupabaseClient } from '@supabase/supabase-js'
import { sortBoatsByDisplayOrder } from './boatUtils'

export type BoatUsageRangeRow = {
  boatId: number
  boatName: string
  /** 與 Dashboard「歷史趨勢 → 月份數據明細」相同：預約表 duration_min 加總，未取消、排除教練練習 */
  minutes: number
}

export type BoatUsageRangeResult = {
  boats: BoatUsageRangeRow[]
}

/**
 * 各船區間時數——邏輯與 Statistics `loadMonthlyTrend` 一致：
 * - `bookings`：`start_at` 在區間內、`status` 非 cancelled、`is_coach_practice` 為 null 或 false
 * - 每筆預約加一次 `duration_min`，依船加總
 */
export async function loadBoatUsageRangeStats(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string
): Promise<BoatUsageRangeResult> {
  const startIso = `${startDate}T00:00:00`
  const endIso = `${endDate}T23:59:59`

  const { data: bookingsData, error: bookingsErr } = await supabase
    .from('bookings')
    .select('id, duration_min, boat_id, boats(id, name)')
    .gte('start_at', startIso)
    .lte('start_at', endIso)
    .neq('status', 'cancelled')
    .or('is_coach_practice.is.null,is_coach_practice.eq.false')

  if (bookingsErr) throw bookingsErr

  const normalizeBoats = (v: unknown): { id: number; name: string } | null => {
    if (!v) return null
    if (Array.isArray(v)) {
      const first = v[0] as { id?: number; name?: string } | undefined
      return first?.id != null && first?.name != null ? { id: first.id, name: first.name } : null
    }
    const o = v as { id?: number; name?: string }
    return o?.id != null && o?.name != null ? { id: o.id, name: o.name } : null
  }

  const minutesByBoatId = new Map<number, { boatName: string; minutes: number }>()

  for (const row of bookingsData || []) {
    const raw = row as Record<string, unknown>
    const boats = normalizeBoats(raw.boats)
    const boatId = (raw.boat_id as number) ?? boats?.id ?? 0
    const boatName = boats?.name || '未知'
    const m = (raw.duration_min as number | null) || 0
    const cur = minutesByBoatId.get(boatId)
    if (cur) {
      cur.minutes += m
    } else {
      minutesByBoatId.set(boatId, { boatName, minutes: m })
    }
  }

  const { data: allBoats, error: boatsErr } = await supabase.from('boats').select('id, name')
  if (boatsErr) throw boatsErr

  const sorted = sortBoatsByDisplayOrder(allBoats || [])
  const boats: BoatUsageRangeRow[] = sorted.map((b) => {
    const hit = minutesByBoatId.get(b.id)
    return {
      boatId: b.id,
      boatName: b.name,
      minutes: hit?.minutes ?? 0
    }
  })

  return { boats }
}
