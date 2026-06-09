import { setupGlobalErrorHandler } from './utils/debugHelpers'
import { getLocalDateString } from './utils/date'

/** 所有入口（含 LIFF 輕量路徑）共用的啟動設定 */
export function runAppBootstrap() {
  setupGlobalErrorHandler()
  checkDailyRefresh()
}

/** 每日自動重新整理：確保用戶使用最新版本 */
function checkDailyRefresh() {
  try {
    const today = getLocalDateString()
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.has('_r')) {
      urlParams.delete('_r')
      const cleanUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '')
      window.history.replaceState({}, '', cleanUrl)
    }
    const attemptedDate = sessionStorage.getItem('app_refresh_attempted_date')
    if (attemptedDate === today) return
    const lastDate = localStorage.getItem('app_last_refresh_date')
    if (lastDate !== today) {
      sessionStorage.setItem('app_refresh_attempted_date', today)
      try { localStorage.setItem('app_last_refresh_date', today) } catch { /* ignore */ }
      if (lastDate) {
        window.location.href = window.location.pathname + '?_r=' + Date.now()
      }
    }
  } catch { /* ignore */ }
}

export function isLiffPathname(pathname: string): boolean {
  return pathname === '/liff' || pathname.startsWith('/liff/')
}
