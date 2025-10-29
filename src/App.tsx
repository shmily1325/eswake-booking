import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { DayView } from './pages/DayView'
import { StudentHistory } from './pages/StudentHistory'
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

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0]

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to={`/day?date=${today}`} replace />} />
        <Route path="/day" element={<DayView user={user} />} />
        <Route path="/student-history" element={<StudentHistory user={user} />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
