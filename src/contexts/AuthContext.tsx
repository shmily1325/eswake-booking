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
    // 只有當「使用者真的換了」（id 不同）才更新 state；
    // 否則 Supabase 在切換分頁回來時會自動刷新 session 並丟出 TOKEN_REFRESHED，
    // 即使是同一個使用者也會給出新的 user 物件 reference，造成下游 Context 全部 re-render，
    // 進而讓開啟中的對話框 / 表單 unmount（看起來像「表單跳掉」）。
    const setUserIfChanged = (next: User | null) => {
      setUser((prev) => {
        if (prev?.id === next?.id) {
          return prev
        }
        return next
      })
    }

    // Check current session with error handling
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) {
        console.error('Error getting session:', error)
        // 如果 session 損壞或過期，清除它並強制重新登入
        if (import.meta.env.DEV) {
          console.log('🔴 Session error detected, clearing auth data...')
        }
        await supabase.auth.signOut()
        setUserIfChanged(null)
      } else {
        setUserIfChanged(session?.user ?? null)
        if (import.meta.env.DEV && session) {
          console.log('Session loaded:', {
            user: session.user.email,
            expires_at: new Date(session.expires_at! * 1000).toLocaleString(),
            expires_in: Math.round((session.expires_at! * 1000 - Date.now()) / 1000 / 60) + ' minutes'
          })
        }
      }
      setLoading(false)
    })

    // Listen for auth changes with detailed event handling
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (import.meta.env.DEV) {
        console.log('Auth state changed:', event, session ? {
          user: session.user.email,
          expires_at: new Date(session.expires_at! * 1000).toLocaleString()
        } : 'No session')
      }

      switch (event) {
        case 'INITIAL_SESSION':
          // 初始 session 载入
          setUserIfChanged(session?.user ?? null)
          break
        case 'SIGNED_IN':
          setUserIfChanged(session?.user ?? null)
          if (import.meta.env.DEV) {
            console.log('✅ User signed in successfully')
          }
          break
        case 'SIGNED_OUT':
          setUserIfChanged(null)
          if (import.meta.env.DEV) {
            console.log('👋 User signed out')
          }
          break
        case 'TOKEN_REFRESHED':
          // Token 成功刷新；只在使用者真的換了才更新（通常不會換，所以多半 no-op）
          setUserIfChanged(session?.user ?? null)
          if (import.meta.env.DEV) {
            console.log('🔄 Token refreshed successfully')
          }
          break
        case 'USER_UPDATED':
          // USER_UPDATED 代表 user metadata 變了，這時要強制覆蓋以拿到最新內容
          setUser(session?.user ?? null)
          break
        default:
          setUserIfChanged(session?.user ?? null)
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

