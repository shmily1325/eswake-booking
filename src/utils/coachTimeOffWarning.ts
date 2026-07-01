import { supabase } from '../lib/supabase'
import { toast } from './toast'
import {
  type CoachTimeOffRow,
  isTimeOffOverlappingBooking,
} from './coachTimeOff'

export type CoachTimeOffCheckOptions = {
  startTime?: string
  durationMin?: number
}

/**
 * 依 coach_time_off 查詢：指定日期有哪些教練在休假（僅限傳入的 coachIds）。
 * 若提供 startTime + durationMin，僅回傳與預約時段重疊者。
 */
export async function fetchCoachNamesOnTimeOffForDate(
  coachIds: string[],
  dateYmd: string,
  options?: CoachTimeOffCheckOptions
): Promise<string[]> {
  if (!dateYmd || coachIds.length === 0) return []

  const { data: rows, error } = await supabase
    .from('coach_time_off')
    .select('coach_id, start_date, end_date, start_time, end_time')
    .in('coach_id', coachIds)
    .lte('start_date', dateYmd)
    .gte('end_date', dateYmd)

  if (error) {
    console.warn('[coachTimeOffWarning] 查詢休假失敗', error)
    return []
  }

  const onLeaveIds = new Set<string>()
  const rowsByCoach = new Map<string, CoachTimeOffRow[]>()

  for (const row of (rows || []) as CoachTimeOffRow[]) {
    const list = rowsByCoach.get(row.coach_id) ?? []
    list.push(row)
    rowsByCoach.set(row.coach_id, list)
  }

  for (const coachId of coachIds) {
    const coachRows = rowsByCoach.get(coachId) ?? []
    if (coachRows.length === 0) continue

    const shouldWarn = options?.startTime && options.durationMin != null
      ? isTimeOffOverlappingBooking(coachRows, dateYmd, options.startTime, options.durationMin)
      : true

    if (shouldWarn) onLeaveIds.add(coachId)
  }

  if (onLeaveIds.size === 0) return []

  const { data: coaches, error: coachesError } = await supabase
    .from('coaches')
    .select('id, name')
    .in('id', [...onLeaveIds])

  if (coachesError || !coaches?.length) return []

  const nameById = new Map(coaches.map(c => [c.id, c.name as string]))
  return coachIds
    .filter(id => onLeaveIds.has(id))
    .map(id => nameById.get(id))
    .filter((n): n is string => Boolean(n))
}

export function formatCoachTimeOffReminderMessage(
  names: string[],
  dateYmd: string,
  options?: CoachTimeOffCheckOptions
): string {
  if (names.length === 0) return ''
  const scope = options?.startTime && options.durationMin != null ? '此時段' : '當日'
  return `${names.join('、')} 於 ${dateYmd} ${scope}休假，請確認是否可排此預約。`
}

/**
 * 預約已成功寫入後呼叫：若有教練當日休假則以 toast 提示（不傳 duration，與其他 toast 同為預設約 2s）。
 * 需頁面有訂閱 {@link toast} 的 ToastContainer 才會顯示。
 */
export function scheduleCoachTimeOffReminderToast(
  coachIds: string[],
  dateYmd: string,
  heading: string = '預約已建立。',
  options?: CoachTimeOffCheckOptions
): void {
  if (!dateYmd || coachIds.length === 0) return
  void (async () => {
    const names = await fetchCoachNamesOnTimeOffForDate(coachIds, dateYmd, options)
    if (names.length === 0) return
    toast.warning(`${heading}\n\n${formatCoachTimeOffReminderMessage(names, dateYmd, options)}`)
  })()
}

/**
 * 多筆預約各帶「該筆最終教練」與日期，依 (日期+教練組合) 去重後查休假，回傳提示文字列。
 * 用於批次修改等情境，避免同一組合重複打 DB。
 */
export async function collectCoachTimeOffReminderLines(
  items: { coachIds: string[]; dateYmd: string; startTime?: string; durationMin?: number }[]
): Promise<string[]> {
  const seenKeys = new Set<string>()
  const lines: string[] = []
  for (const { coachIds, dateYmd, startTime, durationMin } of items) {
    if (!dateYmd || coachIds.length === 0) continue
    const key = `${dateYmd}\u0000${[...coachIds].sort().join('\u0000')}\u0000${startTime ?? ''}\u0000${durationMin ?? ''}`
    if (seenKeys.has(key)) continue
    seenKeys.add(key)
    const names = await fetchCoachNamesOnTimeOffForDate(coachIds, dateYmd, { startTime, durationMin })
    if (names.length > 0) {
      lines.push(formatCoachTimeOffReminderMessage(names, dateYmd, { startTime, durationMin }))
    }
  }
  return lines
}

/** 已彙整好的休假提示列：以 toast 顯示（與其他 warning 相同預設時長）。 */
export function scheduleCoachTimeOffLinesToast(lines: string[], heading: string): void {
  if (lines.length === 0) return
  const text = `${heading}\n\n休假提醒：\n${lines.join('\n')}`
  toast.warning(text)
}
