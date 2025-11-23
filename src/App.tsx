import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useOnlineStatus } from './hooks/useOnlineStatus'
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
import { UnauthorizedPage } from './pages/UnauthorizedPage'
import { LiffMyBookings } from './pages/LiffMyBookings'
import { LoginPage } from './components/LoginPage'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const isOnline = useOnlineStatus()

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

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '18px',
        color: '#666',
      }}>
        載入中...
      </div>
    )
  }

  if (!user) {
    return <LoginPage onLoginSuccess={setUser} />
  }

  return (
    <ErrorBoundary>
      {/* 離線狀態提示 */}
      {!isOnline && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            background: '#ff9800',
            color: 'white',
            padding: '12px 20px',
            textAlign: 'center',
            zIndex: 9999,
            fontSize: '16px',
            fontWeight: '600',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
          }}
        >
          ⚠️ 網路連線已中斷，請檢查您的網路設定
        </div>
      )}

      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage user={user} />} />
          <Route path="/day" element={<DayView user={user} />} />
          <Route path="/search" element={<SearchPage user={user} />} />
          <Route path="/search-bookings" element={<SearchBookings user={user} />} />
          {/* <Route path="/coach-check" element={<CoachCheck user={user} />} /> */}
          <Route path="/coach-report" element={<CoachReport user={user} />} />
          <Route path="/coach-admin" element={<CoachAdmin user={user} />} />
          <Route path="/coach-assignment" element={<CoachAssignment user={user} />} />
          <Route path="/member-import" element={<MemberImport user={user} />} />
          <Route path="/audit-log" element={<AuditLog user={user} />} />
          <Route path="/tomorrow" element={<TomorrowReminder user={user} />} />
          <Route path="/backup" element={<BackupPage user={user} />} />
          <Route path="/quick-transaction" element={<QuickTransaction user={user} />} />
          <Route path="/member-transaction" element={<MemberTransaction user={user} />} />
          <Route path="/bao" element={<BaoHub user={user} />} />
          <Route path="/members" element={<MemberManagement user={user} />} />
          <Route path="/boards" element={<BoardManagement user={user} />} />
          <Route path="/staff" element={<StaffManagement user={user} />} />
          <Route path="/announcements" element={<AnnouncementManagement user={user} />} />
          <Route path="/line-settings" element={<LineSettings user={user} />} />
          <Route path="/coach-daily" element={<CoachDailyView user={user} />} />
          <Route path="/permissions" element={<PermissionManagement user={user} />} />
          <Route path="/boats" element={<BoatManagement user={user} />} />
          <Route path="/unauthorized" element={<UnauthorizedPage user={user} />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
