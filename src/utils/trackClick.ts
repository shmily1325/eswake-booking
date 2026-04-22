/**
 * 點擊追蹤（非阻塞、失敗不影響操作）
 * 僅 insert，查詢請從 Supabase 後台執行
 * 時間戳與系統一致：使用 getLocalTimestamp()（瀏覽器本地時間）
 */
import { supabase } from '../lib/supabase'
import { getLocalTimestamp } from './date'

const TRACK_EXCLUDE_EMAILS = ['minlin1325@gmail.com']

export function trackClick(iconId: string, userEmail: string | undefined) {
  if (!userEmail || TRACK_EXCLUDE_EMAILS.includes(userEmail)) return
  setTimeout(() => {
    void (async () => {
      try {
        await supabase.from('user_click_events').insert({
          user_email: userEmail,
          icon_id: iconId,
          clicked_at: getLocalTimestamp(),
        })
      } catch {
        /* 靜默失敗 */
      }
    })()
  }, 0)
}

let lastDedupeKey = ''
let lastDedupeAt = 0

/**
 * 同一 user、同一 icon_id 在 windowMs 內只寫入一次（仍呼叫 trackClick）。
 * 用於 useEffect 進頁等，減輕 React 18 Strict Mode（dev）連續掛載造成的雙筆；
 * 亦可用於短時間內可能重複觸發的同一事件（例如日期 onChange）。
 */
export function trackClickDedupedWithin(
  iconId: string,
  userEmail: string | undefined,
  windowMs = 200
) {
  if (!userEmail || TRACK_EXCLUDE_EMAILS.includes(userEmail)) return
  const key = `${userEmail}\0${iconId}`
  const now = Date.now()
  if (key === lastDedupeKey && now - lastDedupeAt < windowMs) return
  lastDedupeKey = key
  lastDedupeAt = now
  trackClick(iconId, userEmail)
}
