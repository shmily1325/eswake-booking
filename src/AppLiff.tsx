import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Routes, Route, useLocation } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { LiffBootScreen } from './pages/liff/LiffBootScreen'
import { buildLiffShareUrl, getCurrentLiffDeepLinkSuffix } from './pages/liff/liffUrl'

const LiffMyBookings = lazy(() =>
  import('./pages/LiffMyBookings').then(m => ({ default: m.LiffMyBookings })),
)
const LiffBook = lazy(() =>
  import('./pages/liff/book/LiffBook').then(m => ({ default: m.LiffBook })),
)
const LiffShopOrdersPreview = lazy(() =>
  import('./pages/liff/dev/LiffShopOrdersPreview').then(m => ({ default: m.LiffShopOrdersPreview })),
)

function LiffFallbackRedirect() {
  const location = useLocation()
  return (
    <Navigate
      to={{ pathname: '/liff', search: location.search, hash: location.hash }}
      state={location.state}
      replace
    />
  )
}

/** LIFF 專用入口：不載入 Admin / Shop 路由表 */
export default function AppLiff() {
  const memberLiffId = import.meta.env.VITE_LIFF_ID as string | undefined
  const memberLiffOpenUrl = memberLiffId
    ? buildLiffShareUrl(memberLiffId, getCurrentLiffDeepLinkSuffix())
    : null

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route
            path="/liff/book"
            element={
              <Suspense fallback={<LiffBootScreen label="載入預約表單…" />}>
                <LiffBook />
              </Suspense>
            }
          />
          <Route
            path="/liff"
            element={
              <Suspense fallback={<LiffBootScreen label="載入會員專區…" liffOpenUrl={memberLiffOpenUrl} />}>
                <LiffMyBookings />
              </Suspense>
            }
          />
          {import.meta.env.DEV && (
            <Route
              path="/dev/liff-shop-preview"
              element={
                <Suspense fallback={<LiffBootScreen label="載入預覽…" />}>
                  <LiffShopOrdersPreview />
                </Suspense>
              }
            />
          )}
          <Route path="*" element={<LiffFallbackRedirect />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
