import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { HomePage } from './pages/HomePage'
import { DayView } from './pages/DayView'
import { SearchPage } from './pages/SearchPage'
import { SearchBookings } from './pages/SearchBookings'
// import { CoachCheck } from './pages/CoachCheck'
import { CoachReport } from './pages/CoachReport'
import { CoachAssignment } from './pages/CoachAssignment'
import { CoachOverview } from './pages/CoachOverview'
import { MemberImport } from './pages/MemberImport'
import { AuditLog } from './pages/AuditLog'
import { TomorrowReminder } from './pages/TomorrowReminder'
import { BackupPage } from './pages/BackupPage'
import { MemberManagement } from './pages/MemberManagement'
import { BoardManagement } from './pages/BoardManagement'
import { BaoHub } from './pages/BaoHub'
import { StaffManagement } from './pages/StaffManagement'
import { QuickTransaction } from './pages/QuickTransaction'
import { AnnouncementManagement } from './pages/AnnouncementManagement'
import { LineSettings } from './pages/LineSettings'
import { LoginPage } from './components/LoginPage'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

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
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage user={user} />} />
        <Route path="/day" element={<DayView user={user} />} />
        <Route path="/search" element={<SearchPage user={user} />} />
        <Route path="/search-bookings" element={<SearchBookings user={user} />} />
        {/* <Route path="/coach-check" element={<CoachCheck user={user} />} /> */}
        <Route path="/coach-report" element={<CoachReport user={user} />} />
        <Route path="/coach-assignment" element={<CoachAssignment user={user} />} />
        <Route path="/coach-overview" element={<CoachOverview user={user} />} />
          <Route path="/member-import" element={<MemberImport user={user} />} />
        <Route path="/audit-log" element={<AuditLog user={user} />} />
              <Route path="/tomorrow" element={<TomorrowReminder user={user} />} />
        <Route path="/backup" element={<BackupPage user={user} />} />
        <Route path="/quick-transaction" element={<QuickTransaction user={user} />} />
        <Route path="/bao" element={<BaoHub user={user} />} />
        <Route path="/members" element={<MemberManagement user={user} />} />
        <Route path="/boards" element={<BoardManagement user={user} />} />
        <Route path="/staff" element={<StaffManagement user={user} />} />
        <Route path="/announcements" element={<AnnouncementManagement user={user} />} />
        <Route path="/line-settings" element={<LineSettings user={user} />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
