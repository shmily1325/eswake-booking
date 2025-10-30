import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { HomePage } from './pages/HomePage'
import { DayView } from './pages/DayView'
import { SearchPage } from './pages/SearchPage'
import { StudentHistory } from './pages/StudentHistory'
import { CoachSchedule } from './pages/CoachSchedule'
import { AuditLog } from './pages/AuditLog'
import { LoginPage } from './components/LoginPage'
import './App.css'

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
        <Route path="/student-history" element={<StudentHistory user={user} />} />
        <Route path="/coach-schedule" element={<CoachSchedule user={user} />} />
        <Route path="/audit-log" element={<AuditLog user={user} />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
