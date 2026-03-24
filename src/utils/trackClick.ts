/**
 * 點擊追蹤（非阻塞、失敗不影響操作）
 * 僅 insert，查詢請從 Supabase 後台執行
 */
import { supabase } from '../lib/supabase'

const TRACK_EXCLUDE_EMAILS = ['minlin1325@gmail.com']

export function trackClick(iconId: string, userEmail: string | undefined) {
  if (!userEmail || TRACK_EXCLUDE_EMAILS.includes(userEmail)) return
  setTimeout(() => {
    void (async () => {
      try {
        await supabase.from('user_click_events').insert({
          user_email: userEmail,
          icon_id: iconId,
        })
      } catch {
        /* 靜默失敗 */
      }
    })()
  }, 0)
}
