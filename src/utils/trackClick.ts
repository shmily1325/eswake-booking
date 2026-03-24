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
