/**
 * 點擊追蹤：監聽 data-track 屬性，非阻塞、失敗不影響操作
 */
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { trackClick } from '../utils/trackClick'

export function ClickTrackProvider({
  children,
  user,
}: {
  children: ReactNode
  user: User | null
}) {
  useEffect(() => {
    if (!user?.email) return
    // 設為 false 可暫時關閉追蹤以排查效能
    if (import.meta.env.VITE_TRACK_DISABLED === 'true') return
    const handler = (e: MouseEvent) => {
      const el = (e.target as Element).closest('[data-track]')
      if (!el) return
      const id = (el as HTMLElement).getAttribute('data-track')
      if (id) trackClick(id, user.email ?? undefined)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [user?.email])
  return <>{children}</>
}
