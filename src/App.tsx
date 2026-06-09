import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { setupGlobalErrorHandler } from './utils/debugHelpers'
import { getLocalDateString } from './utils/date'
import { LiffBootScreen } from './pages/liff/LiffBootScreen'
import { isShopSubdomain } from './pages/shop/lib/shopPaths'

setupGlobalErrorHandler()

// 每日自動重新整理：確保用戶使用最新版本
const checkDailyRefresh = () => {
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
checkDailyRefresh()

const AdminApp = lazy(() => import('./AdminApp'))
const LiffMyBookings = lazy(() =>
  import('./pages/LiffMyBookings').then(m => ({ default: m.LiffMyBookings })),
)
const LiffBook = lazy(() =>
  import('./pages/liff/book/LiffBook').then(m => ({ default: m.LiffBook })),
)
const ShopApp = lazy(() => import('./pages/shop/ShopApp'))

function RouteChunkFallback({ label = '載入中...' }: { label?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 text-sm text-gray-500">
      {label}
    </div>
  )
}

function App() {
  if (typeof window === 'undefined') return null

  const shopOnly = isShopSubdomain()

  return (
    <ErrorBoundary>
      <BrowserRouter>
        {shopOnly ? (
          <Routes>
            <Route
              path="/*"
              element={
                <Suspense fallback={<RouteChunkFallback />}>
                  <ShopApp />
                </Suspense>
              }
            />
          </Routes>
        ) : (
          <Routes>
            <Route
              path="/liff"
              element={
                <Suspense fallback={<LiffBootScreen label="載入會員專區…" />}>
                  <LiffMyBookings />
                </Suspense>
              }
            />
            <Route
              path="/liff/book"
              element={
                <Suspense fallback={<LiffBootScreen label="載入預約表單…" />}>
                  <LiffBook />
                </Suspense>
              }
            />
            <Route
              path="/shop/*"
              element={
                <Suspense fallback={<RouteChunkFallback />}>
                  <ShopApp />
                </Suspense>
              }
            />
            <Route
              path="*"
              element={
                <Suspense fallback={<RouteChunkFallback label="載入系統…" />}>
                  <AdminApp />
                </Suspense>
              }
            />
          </Routes>
        )}
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
