import { useEffect, useRef, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { LoginPage } from './components/LoginPage'
import { HomePage } from './pages/HomePage'
import { DayView } from './pages/DayView'
import { SearchPage } from './pages/SearchPage'
import { SearchBookings } from './pages/SearchBookings'
import { CoachReport } from './pages/coach/CoachReport'
import { MyReport } from './pages/coach/MyReport'
import { CoachAdmin } from './pages/coach/CoachAdmin'
import { CoachAssignment } from './pages/coach/CoachAssignment'
import { MemberImport } from './pages/member/MemberImport'
import { AuditLog } from './pages/admin/AuditLog'
import { TomorrowReminder } from './pages/TomorrowReminder'
import { BackupPage } from './pages/admin/BackupPage'
import { MemberManagement } from './pages/member/MemberManagement'
import { MemberPhoneEditPage } from './pages/member/MemberPhoneEditPage'
import { BoardManagement } from './pages/admin/BoardManagement'
import { BaoHub } from './pages/BaoHub'
import { StaffManagement } from './pages/admin/StaffManagement'
import { BoatManagement } from './pages/admin/BoatManagement'
import { ProductHub } from './pages/admin/products/ProductHub'
import { OrderSettlePage } from './pages/admin/orders/OrderSettlePage'
import { QuickTransaction } from './pages/QuickTransaction'
import { MemberTransaction } from './pages/member/MemberTransaction'
import { AnnouncementManagement } from './pages/admin/AnnouncementManagement'
import { LineBindingStatus } from './pages/admin/LineBindingStatus'
import { LineSettings } from './pages/admin/LineSettings'
import { Statistics } from './pages/admin/Statistics'
import { BoatUsageHoursPage } from './pages/admin/BoatUsageHoursPage'
import { CoachDailyView } from './pages/coach/CoachDailyView'
import { UnauthorizedPage } from './pages/UnauthorizedPage'
import { LoginAccessDeniedPage } from './pages/LoginAccessDeniedPage'
import { ClickTrackProvider } from './components/ClickTrackProvider'
import { isAllowedUser } from './utils/auth'

function AdminAppContent() {
  const { user, loading } = useAuth()
  const isOnline = useOnlineStatus()
  const [loginAllowanceResolved, setLoginAllowanceResolved] = useState(false)
  const [loginAllowanceOk, setLoginAllowanceOk] = useState(false)
  const lastCheckedUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (loading) return
    if (!user) {
      lastCheckedUserIdRef.current = null
      setLoginAllowanceResolved(true)
      setLoginAllowanceOk(true)
      return
    }
    if (lastCheckedUserIdRef.current === user.id) return
    let cancelled = false
    isAllowedUser(user)
      .then(ok => {
        if (!cancelled) {
          setLoginAllowanceOk(ok)
          setLoginAllowanceResolved(true)
          lastCheckedUserIdRef.current = user.id
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoginAllowanceOk(false)
          setLoginAllowanceResolved(true)
          lastCheckedUserIdRef.current = user.id
        }
      })
    return () => { cancelled = true }
  }, [user, loading])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-lg text-gray-600">
        載入中...
      </div>
    )
  }

  if (!user) return <LoginPage />

  if (!loginAllowanceResolved) {
    return (
      <div className="min-h-screen flex items-center justify-center text-lg text-gray-600">
        載入中...
      </div>
    )
  }

  if (!loginAllowanceOk) return <LoginAccessDeniedPage />

  return (
    <ClickTrackProvider user={user}>
      <ErrorBoundary>
        {!isOnline && (
          <div className="fixed top-0 left-0 right-0 bg-orange-500 text-white py-3 px-5 text-center z-9999 text-base font-semibold shadow-md">
            ⚠️ 網路連線已中斷，請檢查您的網路設定
          </div>
        )}
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/day" element={<DayView />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/search-bookings" element={<SearchBookings />} />
          <Route path="/coach-report" element={<CoachReport />} />
          <Route path="/my-report" element={<MyReport />} />
          <Route path="/my-report-detail" element={<CoachReport autoFilterByUser={true} />} />
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
          <Route path="/member-phone-edit" element={<MemberPhoneEditPage />} />
          <Route path="/boards" element={<BoardManagement />} />
          <Route path="/staff" element={<StaffManagement />} />
          <Route path="/announcements" element={<AnnouncementManagement />} />
          <Route path="/line-binding" element={<LineBindingStatus />} />
          <Route path="/line-settings" element={<LineSettings />} />
          <Route path="/coach-daily" element={<CoachDailyView />} />
          <Route path="/boats" element={<BoatManagement />} />
          <Route path="/products/*" element={<ProductHub />} />
          <Route path="/order-settle" element={<OrderSettlePage />} />
          <Route path="/statistics" element={<Statistics />} />
          <Route path="/boat-usage-hours" element={<BoatUsageHoursPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
        </Routes>
      </ErrorBoundary>
    </ClickTrackProvider>
  )
}

/** 後台路由（lazy，LIFF／商城不會載入） */
export default function AdminApp() {
  return (
    <AuthProvider>
      <AdminAppContent />
    </AuthProvider>
  )
}
