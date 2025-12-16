import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { type ReactNode } from 'react'
import { BrowserRouter } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import {
  SUPER_ADMINS,
  isAdmin,
  isAllowedUser,
  isAdminAsync,
  clearPermissionCache,
  hasPermission,
  useRequireAdmin,
  useCheckAllowedUser
} from '../auth'
import { supabase } from '../../lib/supabase'

// ============================================================================
// Mocks
// ============================================================================

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => Promise.resolve({ data: [], error: null }))
    }))
  }
}))

vi.mock('../logger', () => ({
  logger: { error: vi.fn() }
}))

const mockNavigate = vi.fn()
const mockToastError = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

vi.mock('../../components/ui', () => ({
  useToast: () => ({ error: mockToastError })
}))

// ============================================================================
// Helpers
// ============================================================================

const createMockUser = (email: string): User => ({
  id: 'test-id',
  email,
  aud: 'authenticated',
  role: 'authenticated',
  created_at: new Date().toISOString(),
  app_metadata: {},
  user_metadata: {}
} as User)

const mockSupabaseResponse = (data: { email: string }[] | null, error: { message: string } | null = null) => {
  vi.mocked(supabase.from).mockImplementation(vi.fn(() => ({
    select: vi.fn(() => Promise.resolve({ data, error }))
  })) as any)
}

const TestWrapper = ({ children }: { children: ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
)

// ============================================================================
// Tests
// ============================================================================

describe('auth.ts - 權限驗證', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearPermissionCache()
  })

  describe('SUPER_ADMINS', () => {
    it('應該包含超級管理員的電子郵件', () => {
      expect(SUPER_ADMINS).toContain('callumbao1122@gmail.com')
      expect(SUPER_ADMINS).toContain('pjpan0511@gmail.com')
      expect(SUPER_ADMINS).toContain('minlin1325@gmail.com')
    })
  })

  describe('isAdmin', () => {
    it('超級管理員應該是管理員', () => {
      const user = createMockUser('callumbao1122@gmail.com')
      expect(isAdmin(user)).toBe(true)
    })

    it('非超級管理員應該不是管理員', () => {
      const user = createMockUser('regular.user@example.com')
      expect(isAdmin(user)).toBe(false)
    })

    it('null 用戶應該不是管理員', () => {
      expect(isAdmin(null)).toBe(false)
    })

    it('沒有 email 的用戶應該不是管理員', () => {
      const user = { ...createMockUser('test@example.com'), email: undefined }
      expect(isAdmin(user as User)).toBe(false)
    })
  })

  describe('isAllowedUser', () => {
    it('超級管理員應該被允許', async () => {
      const user = createMockUser('callumbao1122@gmail.com')
      const result = await isAllowedUser(user)
      expect(result).toBe(true)
    })

    it('null 用戶應該不被允許', async () => {
      const result = await isAllowedUser(null)
      expect(result).toBe(false)
    })

    it('白名單中的用戶應該被允許', async () => {
      mockSupabaseResponse([{ email: 'allowed@example.com' }])

      const user = createMockUser('allowed@example.com')
      const result = await isAllowedUser(user)
      expect(result).toBe(true)
    })

    it('不在白名單中的用戶應該不被允許', async () => {
      mockSupabaseResponse([{ email: 'other@example.com' }])

      const user = createMockUser('notallowed@example.com')
      const result = await isAllowedUser(user)
      expect(result).toBe(false)
    })

    it('資料庫錯誤時應該只允許超級管理員', async () => {
      mockSupabaseResponse(null, { message: 'Database error' })

      const superAdmin = createMockUser('callumbao1122@gmail.com')
      expect(await isAllowedUser(superAdmin)).toBe(true)

      const regularUser = createMockUser('regular@example.com')
      expect(await isAllowedUser(regularUser)).toBe(false)
    })
  })

  describe('isAdminAsync', () => {
    it('超級管理員應該是管理員', async () => {
      const user = createMockUser('pjpan0511@gmail.com')
      const result = await isAdminAsync(user)
      expect(result).toBe(true)
    })

    it('資料庫中的管理員應該是管理員', async () => {
      mockSupabaseResponse([{ email: 'admin@example.com' }])

      const user = createMockUser('admin@example.com')
      const result = await isAdminAsync(user)
      expect(result).toBe(true)
    })

    it('非管理員應該不是管理員', async () => {
      mockSupabaseResponse([{ email: 'other@example.com' }])

      const user = createMockUser('notadmin@example.com')
      const result = await isAdminAsync(user)
      expect(result).toBe(false)
    })

    it('null 用戶應該不是管理員', async () => {
      const result = await isAdminAsync(null)
      expect(result).toBe(false)
    })
  })

  describe('clearPermissionCache', () => {
    it('應該清除緩存', async () => {
      mockSupabaseResponse([{ email: 'test@example.com' }])

      const user = createMockUser('test@example.com')

      // 第一次查詢
      await isAllowedUser(user)
      expect(supabase.from).toHaveBeenCalledTimes(1)

      // 清除緩存
      clearPermissionCache()

      // 再次查詢應該重新從資料庫載入
      await isAllowedUser(user)
      expect(supabase.from).toHaveBeenCalledTimes(2)
    })
  })

  describe('hasPermission', () => {
    it('管理員應該有 admin 權限', () => {
      const user = createMockUser('callumbao1122@gmail.com')
      expect(hasPermission(user, 'admin')).toBe(true)
    })

    it('非管理員應該沒有 admin 權限', () => {
      const user = createMockUser('regular@example.com')
      expect(hasPermission(user, 'admin')).toBe(false)
    })

    it('任何用戶都應該有 coach 權限（未來擴展）', () => {
      const user = createMockUser('anyone@example.com')
      expect(hasPermission(user, 'coach')).toBe(true)
    })

    it('任何用戶都應該有 staff 權限（未來擴展）', () => {
      const user = createMockUser('anyone@example.com')
      expect(hasPermission(user, 'staff')).toBe(true)
    })

    it('null 用戶應該沒有任何權限', () => {
      expect(hasPermission(null, 'admin')).toBe(false)
      expect(hasPermission(null, 'coach')).toBe(false)
      expect(hasPermission(null, 'staff')).toBe(false)
    })
  })

  describe('useRequireAdmin', () => {
    it('管理員應該不被重定向', () => {
      const user = createMockUser('callumbao1122@gmail.com')
      const { result } = renderHook(() => useRequireAdmin(user), { wrapper: TestWrapper })

      expect(result.current).toBe(true)
      expect(mockNavigate).not.toHaveBeenCalled()
      expect(mockToastError).not.toHaveBeenCalled()
    })

    it('非管理員應該被重定向到首頁並顯示警告', async () => {
      const user = createMockUser('regular@example.com')
      const { result } = renderHook(() => useRequireAdmin(user), { wrapper: TestWrapper })

      expect(result.current).toBe(false)

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('您沒有權限訪問此頁面')
        expect(mockNavigate).toHaveBeenCalledWith('/')
      })
    })

    it('null 用戶應該被重定向', async () => {
      renderHook(() => useRequireAdmin(null), { wrapper: TestWrapper })

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalled()
        expect(mockNavigate).toHaveBeenCalledWith('/')
      })
    })
  })

  describe('useCheckAllowedUser', () => {
    it('應該始終返回允許（白名單已關閉）', () => {
      const user = createMockUser('anyone@example.com')
      const { result } = renderHook(() => useCheckAllowedUser(user))

      expect(result.current.isAllowed).toBe(true)
      expect(result.current.checking).toBe(false)
    })

    it('null 用戶也應該返回允許', () => {
      const { result } = renderHook(() => useCheckAllowedUser(null))

      expect(result.current.isAllowed).toBe(true)
      expect(result.current.checking).toBe(false)
    })
  })
})
