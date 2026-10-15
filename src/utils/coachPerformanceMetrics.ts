import { supabase } from '../lib/supabase'
import { fetchCoachDesignatedCreditReport } from '../pages/coach/designatedHours/api'
import type { CoachDesignatedCreditReportEntry } from '../pages/coach/designatedHours/types'
import { fetchProductSalesGroups } from './productSalesData'
import { fetchAllPaginated } from './supabasePaginate'

export type CoachPerformanceMetric = 'designated_lesson' | 'designated_credit' | 'product'

export interface CoachPerformanceMetricRow {
  id: string
  name: string
  value: number
  count: number
}

interface DesignatedLessonMetricRecord {
  coach_id: string | null
  duration_min: number | null
  coaches: { name: string } | null
}

export function aggregateDesignatedLessonMetrics(
  records: DesignatedLessonMetricRecord[],
): CoachPerformanceMetricRow[] {
  const rows = new Map<string, CoachPerformanceMetricRow>()
  records.forEach((record) => {
    if (!record.coach_id) return
    const row = rows.get(record.coach_id) ?? {
      id: record.coach_id,
      name: record.coaches?.name || '未知',
      value: 0,
      count: 0,
    }
    row.value += Number(record.duration_min || 0)
    row.count += 1
    rows.set(row.id, row)
  })
  return [...rows.values()].sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
}

export function aggregateDesignatedCreditMetrics(
  entries: CoachDesignatedCreditReportEntry[],
): CoachPerformanceMetricRow[] {
  const rows = new Map<string, CoachPerformanceMetricRow>()
  entries.forEach((entry) => {
    const soldMinutes = Number(entry.regular_minutes || 0)
    if (soldMinutes <= 0) return
    const row = rows.get(entry.coach_id) ?? {
      id: entry.coach_id,
      name: entry.coach_name,
      value: 0,
      count: 0,
    }
    row.value += soldMinutes
    row.count += 1
    rows.set(row.id, row)
  })
  return [...rows.values()].sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
}

export async function loadCoachPerformanceMetric({
  metric,
  startDate,
  endDate,
}: {
  metric: CoachPerformanceMetric
  startDate: string
  endDate: string
}): Promise<CoachPerformanceMetricRow[]> {
  if (metric === 'designated_lesson') {
    const records = await fetchAllPaginated<DesignatedLessonMetricRecord>(async (from, to) => {
      const { data, error } = await supabase
        .from('booking_participants')
        .select('coach_id, duration_min, coaches:coach_id(name), bookings!inner(start_at)')
        .eq('status', 'processed')
        .eq('is_teaching', true)
        .eq('is_deleted', false)
        .eq('lesson_type', 'designated_paid')
        .gte('bookings.start_at', `${startDate}T00:00:00`)
        .lte('bookings.start_at', `${endDate}T23:59:59`)
        .order('id', { ascending: true })
        .range(from, to)
      return {
        data: data as unknown as DesignatedLessonMetricRecord[] | null,
        error,
      }
    })
    return aggregateDesignatedLessonMetrics(records)
  }

  if (metric === 'designated_credit') {
    const entries = await fetchCoachDesignatedCreditReport({
      startAt: `${startDate}T00:00:00+08:00`,
      endAt: `${endDate}T23:59:59+08:00`,
    })
    return aggregateDesignatedCreditMetrics(entries)
  }

  const groups = await fetchProductSalesGroups({ startDate, endDate })
  return groups
    .filter((group) => group.id !== 'unassigned' && group.total > 0)
    .map((group) => ({
      id: group.id,
      name: group.name,
      value: group.total,
      count: group.qty,
    }))
}
