import { setupGlobalErrorHandler } from './utils/debugHelpers'
import { getLocalDateString } from './utils/date'
import { isPublicBookOrGuideEntry, resolveAppEntry } from './lib/appEntry'

const DAILY_REFRESH_CHECK_INTERVAL_MS = 5 * 60 * 1000
let dailyRefreshInstalled = false

/** 所有入口共用的啟動設定 */
export function runAppBootstrap() {
  setupGlobalErrorHandler()
  setupDailyRefresh()
}

/** 每日自動重新整理：跨日、喚醒或回到分頁時都會檢查；LIFF／公開頁略過。 */
function setupDailyRefresh() {
  if (dailyRefreshInstalled) return

  try {
    const entry = resolveAppEntry()
    if (isPublicBookOrGuideEntry(entry) || entry === 'liff') return

    dailyRefreshInstalled = true
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.has('_r')) {
      urlParams.delete('_r')
      const cleanUrl =
        window.location.pathname +
        (urlParams.toString() ? '?' + urlParams.toString() : '') +
        window.location.hash
      window.history.replaceState({}, '', cleanUrl)
    }

    const check = () => {
      try {
        const today = getLocalDateString()
        const attemptedDate = sessionStorage.getItem('app_refresh_attempted_date')
        if (attemptedDate === today) return

        const lastDate = localStorage.getItem('app_last_refresh_date')
        if (lastDate === today) return

        sessionStorage.setItem('app_refresh_attempted_date', today)
        try { localStorage.setItem('app_last_refresh_date', today) } catch { /* ignore */ }
        if (lastDate) {
          const refreshUrl = new URL(window.location.href)
          refreshUrl.searchParams.set('_r', String(Date.now()))
          window.location.href = refreshUrl.toString()
        }
      } catch { /* ignore */ }
    }

    check()
    window.setInterval(check, DAILY_REFRESH_CHECK_INTERVAL_MS)
    window.addEventListener('focus', check)
    window.addEventListener('pageshow', check)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        check()
      }
    })
  } catch { /* ignore */ }
}
