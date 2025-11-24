import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AuthProvider, useAuth, useAuthUser } from '../AuthContext'
import { supabase } from '../../lib/supabase'

// Mock Supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn()
    }
  }
}))

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useAuth', () => {
    it('應該在 AuthProvider 外使用時拋出錯誤', () => {
      // Suppress console.error for this test
      const originalError = console.error
      console.error = vi.fn()

      expect(() => {
        renderHook(() => useAuth())
      }).toThrow('useAuth must be used within an AuthProvider')

      console.error = originalError
    })

    it('應該在初始時返回 loading: true, user: null', async () => {
      const mockSubscription = { unsubscribe: vi.fn() }
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null
      })
      vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
        data: { subscription: mockSubscription }
      } as any)

      const wrapper = ({ children }: { children: ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      )

      const { result } = renderHook(() => useAuth(), { wrapper })

      // Initially loading
      expect(result.current.loading).toBe(true)
      expect(result.current.user).toBe(null)

      // Wait for auth check to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.user).toBe(null)
    })

    it('應該在有 session 時返回 user', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        aud: 'authenticated',
        role: 'authenticated',
        created_at: new Date().toISOString()
      }

      const mockSubscription = { unsubscribe: vi.fn() }
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { user: mockUser } as any },
        error: null
      })
      vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
        data: { subscription: mockSubscription }
      } as any)

      const wrapper = ({ children }: { children: ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      )

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.user).toBeTruthy()
      expect(result.current.user?.email).toBe('test@example.com')
    })

    it('應該在 unmount 時取消訂閱', () => {
      const mockUnsubscribe = vi.fn()
      const mockSubscription = { unsubscribe: mockUnsubscribe }
      
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null
      })
      vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
        data: { subscription: mockSubscription }
      } as any)

      const wrapper = ({ children }: { children: ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      )

      const { unmount } = renderHook(() => useAuth(), { wrapper })

      unmount()

      expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
    })
  })

  describe('useAuthUser', () => {
    it('應該在 user 為 null 時拋出錯誤', async () => {
      const mockSubscription = { unsubscribe: vi.fn() }
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null
      })
      vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
        data: { subscription: mockSubscription }
      } as any)

      const wrapper = ({ children }: { children: ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      )

      // Suppress console.error for this test
      const originalError = console.error
      console.error = vi.fn()

      let thrownError: Error | null = null
      
      try {
        const { result } = renderHook(() => useAuthUser(), { wrapper })
        await waitFor(() => {
          // This should throw before we get here
          expect(result.current).toBeDefined()
        })
      } catch (error) {
        thrownError = error as Error
      }

      expect(thrownError).toBeTruthy()
      expect(thrownError?.message).toContain('useAuthUser can only be used in authenticated pages')

      console.error = originalError
    })

    it('應該在 user 存在時返回 user（保證非 null）', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        aud: 'authenticated',
        role: 'authenticated',
        created_at: new Date().toISOString()
      }

      const mockSubscription = { unsubscribe: vi.fn() }
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { user: mockUser } as any },
        error: null
      })
      vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
        data: { subscription: mockSubscription }
      } as any)

      const wrapper = ({ children }: { children: ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      )

      // Use a combined hook that waits for auth then calls useAuthUser
      const { result } = renderHook(() => {
        const auth = useAuth()
        // Only call useAuthUser after user is loaded
        if (auth.loading) {
          return { loading: true, user: null }
        }
        if (!auth.user) {
          return { loading: false, user: null }
        }
        const user = useAuthUser()
        return { loading: false, user }
      }, { wrapper })

      // Wait for loading to finish
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Verify user is set
      expect(result.current.user).toBeTruthy()
      expect(result.current.user?.email).toBe('test@example.com')
      expect(result.current.user?.id).toBe('test-user-id')
    })
  })
})

