import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { PublicBootScreen } from './components/PublicBootScreen'

const PublicBookGuide = lazy(() =>
  import('./pages/liff/book/BookGuide').then(m => ({ default: m.PublicBookGuide })),
)

/** 行前須知專用入口：最小 bundle，無 Supabase / LIFF */
export default function AppPublicGuide() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route
            path="/*"
            element={
              <Suspense fallback={<PublicBootScreen label="載入行前須知…" />}>
                <PublicBookGuide />
              </Suspense>
            }
          />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
