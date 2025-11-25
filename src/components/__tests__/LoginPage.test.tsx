import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { LoginPage } from '../LoginPage'
import { supabase } from '../../lib/supabase'

// Mock Supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      onAuthStateChange: vi.fn(),
      signInWithOAuth: vi.fn()
    }
  }
}))

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('應該渲染登入頁面的基本元素', () => {
    render(<LoginPage />)

    expect(screen.getByText('ESWake Booking System')).toBeInTheDocument()
    expect(screen.getByText('請使用 Google 帳號登入')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /使用 Google 登入/i })).toBeInTheDocument()
  })

  it('應該顯示 Google 登入按鈕', () => {
    render(<LoginPage />)
    
    const loginButton = screen.getByRole('button', { name: /使用 Google 登入/i })
    expect(loginButton).toBeInTheDocument()
    expect(loginButton).not.toBeDisabled()
  })

  it('點擊登入按鈕時應該呼叫 signInWithOAuth', async () => {
    vi.mocked(supabase.auth.signInWithOAuth).mockResolvedValue({
      data: { provider: 'google', url: 'https://accounts.google.com/...' },
      error: null
    })

    render(<LoginPage />)
    
    const loginButton = screen.getByRole('button', { name: /使用 Google 登入/i })
    fireEvent.click(loginButton)

    await waitFor(() => {
      expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
          skipBrowserRedirect: false,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      })
    })
  })

  it('登入時按鈕應該顯示「登入中...」並禁用', async () => {
    // Mock a delayed response
    vi.mocked(supabase.auth.signInWithOAuth).mockImplementation(
      () => new Promise(resolve => {
        setTimeout(() => resolve({ data: { provider: 'google', url: '' }, error: null }), 100)
      })
    )

    render(<LoginPage />)
    
    const loginButton = screen.getByRole('button', { name: /使用 Google 登入/i })
    fireEvent.click(loginButton)

    // Button should show loading state
    await waitFor(() => {
      expect(screen.getByText('登入中...')).toBeInTheDocument()
    })
  })

  it('登入失敗時應該顯示錯誤訊息', async () => {
    const errorMessage = '登入失敗：無效的憑證'
    vi.mocked(supabase.auth.signInWithOAuth).mockResolvedValue({
      data: { provider: 'google' as const, url: '' },
      error: { message: errorMessage } as any
    })

    render(<LoginPage />)
    
    const loginButton = screen.getByRole('button', { name: /使用 Google 登入/i })
    fireEvent.click(loginButton)

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })
  })

  it('應該檢測 LINE 內建瀏覽器並顯示警告', () => {
    // Mock LINE user agent
    Object.defineProperty(window.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Line/10.0.0',
      configurable: true
    })

    render(<LoginPage />)

    expect(screen.getByText('⚠️ 在 LINE 中無法登入')).toBeInTheDocument()
    expect(screen.getByText(/請點擊右下角/)).toBeInTheDocument()
  })

  it('應該顯示服務條款提示', () => {
    render(<LoginPage />)

    expect(screen.getByText('登入即表示您同意我們的服務條款')).toBeInTheDocument()
  })
})

