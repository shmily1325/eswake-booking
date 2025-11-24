import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { LoginPage } from './components/LoginPage'
import { HomePage } from './pages/HomePage'
import { DayView } from './pages/DayView'
import { SearchPage } from './pages/SearchPage'
import { SearchBookings } from './pages/SearchBookings'
// import { CoachCheck } from './pages/CoachCheck'
import { CoachReport } from './pages/coach/CoachReport'
import { CoachAdmin } from './pages/coach/CoachAdmin'
import { CoachAssignment } from './pages/coach/CoachAssignment'
import { MemberImport } from './pages/member/MemberImport'
import { AuditLog } from './pages/admin/AuditLog'
import { TomorrowReminder } from './pages/TomorrowReminder'
import { BackupPage } from './pages/admin/BackupPage'
import { MemberManagement } from './pages/member/MemberManagement'
import { BoardManagement } from './pages/admin/BoardManagement'
import { BaoHub } from './pages/BaoHub'
import { StaffManagement } from './pages/admin/StaffManagement'
import { BoatManagement } from './pages/admin/BoatManagement'
import { QuickTransaction } from './pages/QuickTransaction'
import { MemberTransaction } from './pages/member/MemberTransaction'
import { AnnouncementManagement } from './pages/admin/AnnouncementManagement'
import { LineSettings } from './pages/admin/LineSettings'
import { CoachDailyView } from './pages/coach/CoachDailyView'
import { PermissionManagement } from './pages/admin/PermissionManagement'
import { VersionHistory } from './pages/admin/VersionHistory'
import { UnauthorizedPage } from './pages/UnauthorizedPage'
import { LiffMyBookings } from './pages/LiffMyBookings'

function AppContent() {
  const { user, loading } = useAuth()
  const isOnline = useOnlineStatus()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-lg text-gray-600">
        載入中...
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  return (
    <ErrorBoundary>
      {/* 離線狀態提示 */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 bg-orange-500 text-white py-3 px-5 text-center z-[9999] text-base font-semibold shadow-md">
          ⚠️ 網路連線已中斷，請檢查您的網路設定
        </div>
      )}

      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/day" element={<DayView />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/search-bookings" element={<SearchBookings />} />
          {/* <Route path="/coach-check" element={<CoachCheck />} /> */}
          <Route path="/coach-report" element={<CoachReport />} />
          <Route path="/coach-admin" element={<CoachAdmin />} />
          <Route path="/coach-assignment" element={<CoachAssignment />} />
          <Route path="/member-import" element={<MemberImport />} />
          <Route path="/audit-log" element={<AuditLog />} />
          <Route path="/tomorrow" element={<TomorrowReminder />} />
          <Route path="/backup" element={<BackupPage />} />
          <Route path="/quick-transaction" element={<QuickTransaction />} />
          <Route path="/member-transaction" element={<MemberTransaction />} />
          <Route path="/bao" element={<BaoHub />} />
          <Route path="/members" element={<MemberManagement />} />
          <Route path="/boards" element={<BoardManagement />} />
          <Route path="/staff" element={<StaffManagement />} />
          <Route path="/announcements" element={<AnnouncementManagement />} />
          <Route path="/line-settings" element={<LineSettings />} />
          <Route path="/coach-daily" element={<CoachDailyView />} />
          <Route path="/permissions" element={<PermissionManagement />} />
          <Route path="/boats" element={<BoatManagement />} />
          <Route path="/version-history" element={<VersionHistory />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

function App() {
  // LIFF 頁面不需要系統登入驗證
  if (window.location.pathname === '/liff') {
    return (
      <ErrorBoundary>
        <BrowserRouter>
          <Routes>
            <Route path="/liff" element={<LiffMyBookings />} />
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    )
  }

  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
