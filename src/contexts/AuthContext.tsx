import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthContextType {
  user: User | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes with detailed event handling
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event) // Debug log
      
      switch (event) {
        case 'SIGNED_IN':
          setUser(session?.user ?? null)
          break
        case 'SIGNED_OUT':
          setUser(null)
          break
        case 'TOKEN_REFRESHED':
          // Token 成功刷新
          setUser(session?.user ?? null)
          console.log('Token refreshed successfully')
          break
        case 'USER_UPDATED':
          setUser(session?.user ?? null)
          break
        default:
          setUser(session?.user ?? null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Helper hook that guarantees user is not null (for pages behind auth)
export function useAuthUser(): User {
  const { user } = useAuth()
  if (!user) {
    throw new Error('useAuthUser can only be used in authenticated pages')
  }
  return user
}

