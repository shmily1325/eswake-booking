import { supabase } from '../../lib/supabase'
import { getLocalTimestamp } from '../../utils/date'

type LiffTrackPayload = {
  icon_id: string
  line_user_id: string | null
  member_id?: string | null
  extras?: Record<string, unknown>
}

// 型別：對應 user_click_events 可插入欄位
type UserClickEventInsert = {
  user_email?: string | null
  icon_id: string
  clicked_at?: string | null
  source?: string | null
  line_user_id?: string | null
  member_id?: string | null
  extras?: string | null
}

const LOCAL_QUEUE_KEY = 'liff_click_queue_v1'

function parseIdList(envValue: string | undefined): Set<string> {
  if (!envValue) return new Set()
  return new Set(
    envValue
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
  )
}

// 以環境變數設定排除名單（逗號分隔）
const EXCLUDED_LINE_IDS = parseIdList(import.meta.env.VITE_TRACK_EXCLUDE_LINE_IDS)
const EXCLUDED_MEMBER_IDS = parseIdList(import.meta.env.VITE_TRACK_EXCLUDE_MEMBER_IDS)

// 內建固定排除（維運帳號等）
const DEFAULT_EXCLUDED_LINE_IDS = new Set<string>([
  'Uf0f65ceb2b67c999e33051ef57d9e589', // requested exclusion
])
const DEFAULT_EXCLUDED_MEMBER_IDS = new Set<string>([
  '3ba83648-1f69-418a-8939-76a83e7014cb', // requested exclusion
])

function isExcluded(lineUserId: string | null | undefined, memberId: string | null | undefined): boolean {
  if (lineUserId && (EXCLUDED_LINE_IDS.has(lineUserId) || DEFAULT_EXCLUDED_LINE_IDS.has(lineUserId))) return true
  if (memberId && (EXCLUDED_MEMBER_IDS.has(memberId) || DEFAULT_EXCLUDED_MEMBER_IDS.has(memberId))) return true
  return false
}

function enqueueLocal(payload: UserClickEventInsert) {
  try {
    const raw = localStorage.getItem(LOCAL_QUEUE_KEY)
    const arr: UserClickEventInsert[] = raw ? JSON.parse(raw) as UserClickEventInsert[] : []
    arr.push(payload)
    localStorage.setItem(LOCAL_QUEUE_KEY, JSON.stringify(arr))
  } catch {
    // ignore quota/JSON errors to stay non-blocking
  }
}

async function flushLocalQueue() {
  let items: UserClickEventInsert[] = []
  try {
    const raw = localStorage.getItem(LOCAL_QUEUE_KEY)
    items = raw ? JSON.parse(raw) as UserClickEventInsert[] : []
  } catch {
    return
  }
  if (!items.length) return
  try {
    await supabase.from('user_click_events').insert<UserClickEventInsert>(items)
    localStorage.removeItem(LOCAL_QUEUE_KEY)
  } catch {
    // keep queue for next time
  }
}

export function liffTrack(payload: LiffTrackPayload) {
  if (isExcluded(payload.line_user_id, payload.member_id)) {
    return
  }
  const row: UserClickEventInsert = {
    source: 'liff',
    icon_id: payload.icon_id,
    clicked_at: getLocalTimestamp(),
    user_email: null,
    line_user_id: payload.line_user_id,
    member_id: payload.member_id ?? null,
    extras: payload.extras ? JSON.stringify(payload.extras) : null
  }

  // fire-and-forget: never block UI
  // do not await; also try to flush any pending events opportunistically
  void (async () => {
    try {
      await supabase.from('user_click_events').insert<UserClickEventInsert>(row)
      // best-effort flush of previously queued events
      await flushLocalQueue()
    } catch {
      enqueueLocal(row)
    }
  })()
}

export async function liffTrackFlushQueueNow() {
  await flushLocalQueue()
}

