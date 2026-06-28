import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { PublicBook } from './pages/liff/book/PublicBook'

/** 公開預約專用入口：不載入 Admin / Shop / LIFF SDK */
export default function AppPublicBook() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/*" element={<PublicBook />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
