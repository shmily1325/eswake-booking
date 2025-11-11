import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface LoginPageProps {
  onLoginSuccess: (user: User) => void
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isInLineApp, setIsInLineApp] = useState(false)

  useEffect(() => {
    // 檢測是否在 LINE 內建瀏覽器中
    const userAgent = navigator.userAgent || navigator.vendor
    const isLine = /Line/i.test(userAgent)
    setIsInLineApp(isLine)
  }, [])

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        onLoginSuccess(user)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        onLoginSuccess(session.user)
      }
    })

    return () => subscription.unsubscribe()
  }, [onLoginSuccess])

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f5f5f5',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* 浮水印背景 */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '100px',
        padding: '50px',
        pointerEvents: 'none',
        opacity: 0.06,
        userSelect: 'none',
      }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <img
            key={i}
            src="/logo black.png"
            alt="ESWake"
            style={{
              width: '200px',
              height: 'auto',
              transform: 'rotate(-25deg)',
            }}
          />
        ))}
      </div>
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        maxWidth: '400px',
        width: '100%',
        textAlign: 'center',
      }}>
        <h1 style={{ 
          marginTop: 0, 
          marginBottom: '10px',
          color: '#000',
          fontSize: '28px',
        }}>
          ESWake Booking System
        </h1>
        <p style={{ 
          color: '#666', 
          marginBottom: '30px',
          fontSize: '14px',
        }}>
          請使用 Google 帳號登入
        </p>

        {isInLineApp && (
          <div style={{
            padding: '16px',
            backgroundColor: '#fff3cd',
            color: '#856404',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '14px',
            lineHeight: '1.6',
            textAlign: 'left',
            border: '1px solid #ffeaa7',
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
              ⚠️ 在 LINE 中無法登入
            </div>
            <div>
              請點擊右下角「⋯」→「在瀏覽器中開啟」
            </div>
          </div>
        )}

        {error && (
          <div style={{
            padding: '12px',
            backgroundColor: '#fee',
            color: '#c00',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '14px',
          }}>
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '8px',
            border: '1px solid #ddd',
            backgroundColor: 'white',
            color: '#000',
            fontSize: '16px',
            fontWeight: '500',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            transition: 'all 0.2s',
            opacity: loading ? 0.6 : 1,
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.currentTarget.style.backgroundColor = '#f8f9fa'
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'white'
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {loading ? '登入中...' : '使用 Google 登入'}
        </button>

        <p style={{
          marginTop: '20px',
          fontSize: '12px',
          color: '#999',
        }}>
          登入即表示您同意我們的服務條款
        </p>
      </div>
    </div>
  )
}

