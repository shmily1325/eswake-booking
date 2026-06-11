import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { PublicBootScreen } from './components/PublicBootScreen'

const PublicBook = lazy(() =>
  import('./pages/liff/book/PublicBook').then(m => ({ default: m.PublicBook })),
)

/** 公開預約專用入口：不載入 Admin / Shop / LIFF SDK */
export default function AppPublicBook() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route
            path="/*"
            element={
              <Suspense fallback={<PublicBootScreen label="載入預約表單…" />}>
                <PublicBook />
              </Suspense>
            }
          />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
