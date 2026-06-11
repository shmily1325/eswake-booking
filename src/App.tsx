import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { LiffBootScreen } from './pages/liff/LiffBootScreen'
import { isShopSubdomain } from './pages/shop/lib/shopPaths'

const AdminApp = lazy(() => import('./AdminApp'))
const LiffMyBookings = lazy(() =>
  import('./pages/LiffMyBookings').then(m => ({ default: m.LiffMyBookings })),
)
const LiffBook = lazy(() =>
  import('./pages/liff/book/LiffBook').then(m => ({ default: m.LiffBook })),
)
const PublicBook = lazy(() =>
  import('./pages/liff/book/LiffBook').then(m => ({ default: m.PublicBook })),
)
const PublicBookGuide = lazy(() =>
  import('./pages/liff/book/BookGuide').then(m => ({ default: m.PublicBookGuide })),
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
              path="/book"
              element={
                <Suspense fallback={<RouteChunkFallback label="載入預約表單…" />}>
                  <PublicBook />
                </Suspense>
              }
            />
            <Route
              path="/book/guide"
              element={
                <Suspense fallback={<RouteChunkFallback label="載入行前須知…" />}>
                  <PublicBookGuide />
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
              path="/liff"
              element={
                <Suspense fallback={<LiffBootScreen label="載入會員專區…" />}>
                  <LiffMyBookings />
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
