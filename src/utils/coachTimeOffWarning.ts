import { supabase } from '../lib/supabase'
import { toast } from './toast'

/** 先讓成功 toast／關閉 dialog 有機會渲染，再顯示休假提醒（非阻塞）。 */
const REMINDER_DEFER_MS = 420
const REMINDER_TOAST_DURATION_MS = 12000

function runAfterFrameAndDelay(fn: () => void): void {
  requestAnimationFrame(() => {
    setTimeout(fn, REMINDER_DEFER_MS)
  })
}

/**
 * 依 coach_time_off 查詢：指定日期有哪些教練在休假（僅限傳入的 coachIds）。
 * 回傳名稱順序與 coachIds 相同（略過不在休假名單者）。
 */
export async function fetchCoachNamesOnTimeOffForDate(
  coachIds: string[],
  dateYmd: string
): Promise<string[]> {
  if (!dateYmd || coachIds.length === 0) return []

  const { data: rows, error } = await supabase
    .from('coach_time_off')
    .select('coach_id')
    .in('coach_id', coachIds)
    .lte('start_date', dateYmd)
    .gte('end_date', dateYmd)

  if (error) {
    console.warn('[coachTimeOffWarning] 查詢休假失敗', error)
    return []
  }

  const onLeaveIds = new Set((rows || []).map(r => r.coach_id))
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

export function formatCoachTimeOffReminderMessage(names: string[], dateYmd: string): string {
  if (names.length === 0) return ''
  return `${names.join('、')} 於 ${dateYmd} 當日休假，請確認是否可排此預約。`
}

/**
 * 預約已成功寫入後呼叫：若有教練當日休假，於短暫延遲後以 toast 提示（不阻塞關閉／成功訊息）。
 * 需頁面有訂閱 {@link toast} 的 ToastContainer 才會顯示。
 */
export function scheduleCoachTimeOffReminderToast(
  coachIds: string[],
  dateYmd: string,
  heading: string = '預約已建立。'
): void {
  if (!dateYmd || coachIds.length === 0) return
  runAfterFrameAndDelay(() => {
    void (async () => {
      const names = await fetchCoachNamesOnTimeOffForDate(coachIds, dateYmd)
      if (names.length === 0) return
      toast.warning(
        `${heading}\n\n${formatCoachTimeOffReminderMessage(names, dateYmd)}`,
        REMINDER_TOAST_DURATION_MS
      )
    })()
  })
}

/**
 * 多筆預約各帶「該筆最終教練」與日期，依 (日期+教練組合) 去重後查休假，回傳提示文字列。
 * 用於批次修改等情境，避免同一組合重複打 DB。
 */
export async function collectCoachTimeOffReminderLines(
  items: { coachIds: string[]; dateYmd: string }[]
): Promise<string[]> {
  const seenKeys = new Set<string>()
  const lines: string[] = []
  for (const { coachIds, dateYmd } of items) {
    if (!dateYmd || coachIds.length === 0) continue
    const key = `${dateYmd}\u0000${[...coachIds].sort().join('\u0000')}`
    if (seenKeys.has(key)) continue
    seenKeys.add(key)
    const names = await fetchCoachNamesOnTimeOffForDate(coachIds, dateYmd)
    if (names.length > 0) {
      lines.push(formatCoachTimeOffReminderMessage(names, dateYmd))
    }
  }
  return lines
}

/** 已彙整好的休假提示列：延遲後以 toast 顯示（與 scheduleCoachTimeOffReminderToast 相同 UX）。 */
export function scheduleCoachTimeOffLinesToast(lines: string[], heading: string): void {
  if (lines.length === 0) return
  const text = `${heading}\n\n休假提醒：\n${lines.join('\n')}`
  runAfterFrameAndDelay(() => {
    toast.warning(text, REMINDER_TOAST_DURATION_MS)
  })
}
