import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { LiffBootScreen } from './pages/liff/LiffBootScreen'

const LiffMyBookings = lazy(() =>
  import('./pages/LiffMyBookings').then(m => ({ default: m.LiffMyBookings })),
)
const LiffBook = lazy(() =>
  import('./pages/liff/book/LiffBook').then(m => ({ default: m.LiffBook })),
)

/** LIFF 專用入口：不載入 Admin / Shop 路由表 */
export default function AppLiff() {
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
              <Suspense fallback={<LiffBootScreen label="載入會員專區…" />}>
                <LiffMyBookings />
              </Suspense>
            }
          />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
