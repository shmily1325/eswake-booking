import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { LoginPage } from './components/LoginPage'
import { HomePage } from './pages/HomePage'
import { ClickTrackProvider } from './components/ClickTrackProvider'
import { isAllowedUser } from './utils/auth'

const DayView = lazy(() => import('./pages/DayView').then(module => ({ default: module.DayView })))
const SearchPage = lazy(() => import('./pages/SearchPage').then(module => ({ default: module.SearchPage })))
const SearchBookings = lazy(() => import('./pages/SearchBookings').then(module => ({ default: module.SearchBookings })))
const CoachReport = lazy(() => import('./pages/coach/CoachReport').then(module => ({ default: module.CoachReport })))
const MyReport = lazy(() => import('./pages/coach/MyReport').then(module => ({ default: module.MyReport })))
const CoachAdmin = lazy(() => import('./pages/coach/CoachAdmin').then(module => ({ default: module.CoachAdmin })))
const CoachAssignment = lazy(() => import('./pages/coach/CoachAssignment').then(module => ({ default: module.CoachAssignment })))
const AuditLog = lazy(() => import('./pages/admin/AuditLog').then(module => ({ default: module.AuditLog })))
const TomorrowReminder = lazy(() => import('./pages/TomorrowReminder').then(module => ({ default: module.TomorrowReminder })))
const MemberManagement = lazy(() => import('./pages/member/MemberManagement').then(module => ({ default: module.MemberManagement })))
const MemberPhoneEditPage = lazy(() => import('./pages/member/MemberPhoneEditPage').then(module => ({ default: module.MemberPhoneEditPage })))
const BoardManagement = lazy(() => import('./pages/admin/BoardManagement').then(module => ({ default: module.BoardManagement })))
const BaoHub = lazy(() => import('./pages/BaoHub').then(module => ({ default: module.BaoHub })))
const StaffManagement = lazy(() => import('./pages/admin/StaffManagement').then(module => ({ default: module.StaffManagement })))
const BoatManagement = lazy(() => import('./pages/admin/BoatManagement').then(module => ({ default: module.BoatManagement })))
const ProductHub = lazy(() => import('./pages/admin/products/ProductHub').then(module => ({ default: module.ProductHub })))
const OrderSettlePage = lazy(() => import('./pages/admin/orders/OrderSettlePage').then(module => ({ default: module.OrderSettlePage })))
const QuickTransaction = lazy(() => import('./pages/QuickTransaction').then(module => ({ default: module.QuickTransaction })))
const MemberTransaction = lazy(() => import('./pages/member/MemberTransaction').then(module => ({ default: module.MemberTransaction })))
const AnnouncementManagement = lazy(() => import('./pages/admin/AnnouncementManagement').then(module => ({ default: module.AnnouncementManagement })))
const BackupPage = lazy(() => import('./pages/admin/BackupPage').then(module => ({ default: module.BackupPage })))
const Statistics = lazy(() => import('./pages/admin/Statistics').then(module => ({ default: module.Statistics })))
const BoatUsageHoursPage = lazy(() => import('./pages/admin/BoatUsageHoursPage').then(module => ({ default: module.BoatUsageHoursPage })))
const CoachDailyView = lazy(() => import('./pages/coach/CoachDailyView').then(module => ({ default: module.CoachDailyView })))
const CoachTimeOffPage = lazy(() => import('./pages/CoachTimeOffPage').then(module => ({ default: module.CoachTimeOffPage })))
const UnauthorizedPage = lazy(() => import('./pages/UnauthorizedPage').then(module => ({ default: module.UnauthorizedPage })))
const LoginAccessDeniedPage = lazy(() => import('./pages/LoginAccessDeniedPage').then(module => ({ default: module.LoginAccessDeniedPage })))

function RouteLoadingFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-screen flex items-center justify-center text-base text-gray-600"
    >
      載入中...
    </div>
  )
}

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

  if (!loginAllowanceOk) {
    return (
      <Suspense fallback={<RouteLoadingFallback />}>
        <LoginAccessDeniedPage />
      </Suspense>
    )
  }

  return (
    <ClickTrackProvider user={user}>
      <ErrorBoundary>
        {!isOnline && (
          <div
            role="alert"
            className="fixed top-0 left-0 right-0 bg-gray-900 text-white py-2 px-4 text-center z-9999 text-sm font-medium shadow-sm"
          >
            網路連線已中斷，請檢查您的網路設定
          </div>
        )}
        <Suspense fallback={<RouteLoadingFallback />}>
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
            <Route path="/audit-log" element={<AuditLog />} />
            <Route path="/tomorrow" element={<TomorrowReminder />} />
            <Route path="/quick-transaction" element={<QuickTransaction />} />
            <Route path="/member-transaction" element={<MemberTransaction />} />
            <Route path="/bao" element={<BaoHub />} />
            <Route path="/members" element={<MemberManagement />} />
            <Route path="/member-phone-edit" element={<MemberPhoneEditPage />} />
            <Route path="/boards" element={<BoardManagement />} />
            <Route path="/staff" element={<StaffManagement />} />
            <Route path="/announcements" element={<AnnouncementManagement />} />
            <Route path="/backup" element={<BackupPage />} />
            <Route path="/coach-daily" element={<CoachDailyView />} />
            <Route path="/coach-time-off" element={<CoachTimeOffPage />} />
            <Route path="/boats" element={<BoatManagement />} />
            <Route path="/products/*" element={<ProductHub />} />
            <Route path="/order-settle" element={<OrderSettlePage />} />
            <Route path="/statistics" element={<Statistics />} />
            <Route path="/boat-usage-hours" element={<BoatUsageHoursPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
          </Routes>
        </Suspense>
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
