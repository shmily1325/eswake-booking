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
  useCheckAllowedUser,
  isEditorAsync,
  isEditor,
  hasViewAccess
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

    it('非超級管理員應該不是管理員', async () => {
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

  describe('isEditorAsync', () => {
    it('✅ 超級管理員應該有小編權限', async () => {
      const user = createMockUser('callumbao1122@gmail.com')
      const result = await isEditorAsync(user)
      expect(result).toBe(true)
    })

    it('✅ editor_users 中的用戶應該有小編權限', async () => {
      mockSupabaseResponse([{ email: 'editor@example.com' }])

      const user = createMockUser('editor@example.com')
      const result = await isEditorAsync(user)
      expect(result).toBe(true)
    })

    it('✅ 非小編用戶不應該有小編權限', async () => {
      mockSupabaseResponse([{ email: 'editor@example.com' }])

      const user = createMockUser('regular@example.com')
      const result = await isEditorAsync(user)
      expect(result).toBe(false)
    })

    it('✅ null 用戶不應該有小編權限', async () => {
      const result = await isEditorAsync(null)
      expect(result).toBe(false)
    })

    it('✅ 沒有 email 的用戶不應該有小編權限', async () => {
      const user = { ...createMockUser('test@example.com'), email: undefined }
      const result = await isEditorAsync(user as User)
      expect(result).toBe(false)
    })

    it('✅ 資料庫錯誤時應該只允許超級管理員', async () => {
      mockSupabaseResponse(null, { message: 'Database error' })

      const superAdmin = createMockUser('callumbao1122@gmail.com')
      expect(await isEditorAsync(superAdmin)).toBe(true)

      const regularUser = createMockUser('regular@example.com')
      expect(await isEditorAsync(regularUser)).toBe(false)
    })

    it('✅ 應該使用緩存（60秒內不重複查詢）', async () => {
      mockSupabaseResponse([{ email: 'editor@example.com' }])

      const user = createMockUser('editor@example.com')

      // 第一次查詢
      await isEditorAsync(user)
      const firstCallCount = vi.mocked(supabase.from).mock.calls.length

      // 第二次查詢（應該使用緩存，不查詢數據庫）
      await isEditorAsync(user)
      const secondCallCount = vi.mocked(supabase.from).mock.calls.length

      expect(secondCallCount).toBe(firstCallCount) // 沒有額外的查詢
    })
  })

  describe('isEditor', () => {
    it('✅ 超級管理員應該有小編權限（同步版本）', () => {
      const user = createMockUser('callumbao1122@gmail.com')
      expect(isEditor(user)).toBe(true)
    })

    it('✅ 緩存中的小編應該返回 true', async () => {
      mockSupabaseResponse([{ email: 'editor@example.com' }])

      const user = createMockUser('editor@example.com')

      // 先用異步版本載入緩存
      await isEditorAsync(user)

      // 同步版本應該能從緩存讀取
      expect(isEditor(user)).toBe(true)
    })

    it('✅ 緩存未載入時應該返回 false（非超級管理員）', () => {
      clearPermissionCache()
      const user = createMockUser('editor@example.com')
      expect(isEditor(user)).toBe(false)
    })

    it('✅ null 用戶不應該有小編權限', () => {
      expect(isEditor(null)).toBe(false)
    })

    it('✅ 沒有 email 的用戶不應該有小編權限', () => {
      const user = { ...createMockUser('test@example.com'), email: undefined }
      expect(isEditor(user as User)).toBe(false)
    })
  })

  describe('hasViewAccess', () => {
    it('✅ 超級管理員應該有一般權限', async () => {
      const user = createMockUser('callumbao1122@gmail.com')
      const result = await hasViewAccess(user)
      expect(result).toBe(true)
    })

    it('✅ 小編應該有一般權限', async () => {
      // Mock editor_users 查詢
      let callCount = 0
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        callCount++
        if (callCount === 1) {
          // 第一次查詢 editor_users
          return {
            select: vi.fn(() => Promise.resolve({ 
              data: [{ email: 'editor@example.com' }], 
              error: null 
            }))
          } as any
        } else {
          // 第二次查詢 view_users（不需要，因為已經是小編）
          return {
            select: vi.fn(() => Promise.resolve({ data: [], error: null }))
          } as any
        }
      })

      const user = createMockUser('editor@example.com')
      const result = await hasViewAccess(user)
      expect(result).toBe(true)
    })

    it('✅ view_users 中的用戶應該有一般權限', async () => {
      let callCount = 0
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        callCount++
        if (callCount === 1) {
          // 第一次查詢 editor_users（不在小編列表）
          return {
            select: vi.fn(() => Promise.resolve({ data: [], error: null }))
          } as any
        } else {
          // 第二次查詢 view_users
          return {
            select: vi.fn(() => Promise.resolve({ 
              data: [{ email: 'viewer@example.com' }], 
              error: null 
            }))
          } as any
        }
      })

      const user = createMockUser('viewer@example.com')
      const result = await hasViewAccess(user)
      expect(result).toBe(true)
    })

    it('✅ 不在任何列表中的用戶不應該有一般權限', async () => {
      vi.mocked(supabase.from).mockImplementation(() => ({
        select: vi.fn(() => Promise.resolve({ data: [], error: null }))
      }) as any)

      const user = createMockUser('nobody@example.com')
      const result = await hasViewAccess(user)
      expect(result).toBe(false)
    })

    it('✅ null 用戶不應該有一般權限', async () => {
      const result = await hasViewAccess(null)
      expect(result).toBe(false)
    })

    it('✅ 沒有 email 的用戶不應該有一般權限', async () => {
      const user = { ...createMockUser('test@example.com'), email: undefined }
      const result = await hasViewAccess(user as User)
      expect(result).toBe(false)
    })

    it('✅ 資料庫錯誤時應該只允許超級管理員', async () => {
      mockSupabaseResponse(null, { message: 'Database error' })

      const superAdmin = createMockUser('callumbao1122@gmail.com')
      expect(await hasViewAccess(superAdmin)).toBe(true)

      const regularUser = createMockUser('regular@example.com')
      expect(await hasViewAccess(regularUser)).toBe(false)
    })
  })

  describe('緩存機制', () => {
    it('✅ 緩存應該在 60 秒後過期', async () => {
      vi.useFakeTimers()
      mockSupabaseResponse([{ email: 'test@example.com' }])

      const user = createMockUser('test@example.com')

      // 第一次查詢
      await isAllowedUser(user)
      const firstCallCount = vi.mocked(supabase.from).mock.calls.length

      // 59 秒後查詢（應該使用緩存）
      vi.advanceTimersByTime(59000)
      await isAllowedUser(user)
      expect(vi.mocked(supabase.from).mock.calls.length).toBe(firstCallCount)

      // 61 秒後查詢（緩存過期，應該重新查詢）
      vi.advanceTimersByTime(2000)
      await isAllowedUser(user)
      expect(vi.mocked(supabase.from).mock.calls.length).toBeGreaterThan(firstCallCount)

      vi.useRealTimers()
    })

    it('✅ clearPermissionCache 應該清除所有緩存', async () => {
      mockSupabaseResponse([{ email: 'test@example.com' }])
      const user = createMockUser('test@example.com')

      // 載入所有緩存
      await isAllowedUser(user)
      await isEditorAsync(user)
      await hasViewAccess(user)

      vi.clearAllMocks()

      // 清除緩存
      clearPermissionCache()

      // 再次查詢應該重新從資料庫載入
      await isAllowedUser(user)
      expect(supabase.from).toHaveBeenCalled()
    })

    it('✅ clearPermissionCache 會清除所有緩存', async () => {
      mockSupabaseResponse([{ email: 'test@example.com' }])

      const user = createMockUser('test@example.com')

      // 第一次查詢
      await isAllowedUser(user)
      const firstCallCount = vi.mocked(supabase.from).mock.calls.length

      // 第二次查詢（使用緩存）
      await isAllowedUser(user)
      expect(vi.mocked(supabase.from).mock.calls.length).toBe(firstCallCount)

      // 清除緩存
      clearPermissionCache()

      // 第三次查詢（應該重新查詢數據庫）
      await isAllowedUser(user)
      expect(vi.mocked(supabase.from).mock.calls.length).toBeGreaterThan(firstCallCount)
    })

    it('✅ 不同表的緩存共享時間戳但獨立存儲', async () => {
      let callCount = 0

      vi.mocked(supabase.from).mockImplementation(() => {
        callCount++
        return {
          select: vi.fn(() => Promise.resolve({ data: [], error: null }))
        } as any
      })

      const user = createMockUser('test@example.com')

      // 查詢小編權限（設置時間戳）
      await isEditorAsync(user)
      expect(callCount).toBe(1)

      // 再次查詢小編權限（使用緩存）
      await isEditorAsync(user)
      expect(callCount).toBe(1)

      // 查詢白名單（雖然時間戳相同，但緩存變數不同，需要查詢）
      await isAllowedUser(user)
      expect(callCount).toBe(2)

      // 再次查詢白名單（現在有緩存了）
      await isAllowedUser(user)
      expect(callCount).toBe(2)
    })
  })

  describe('錯誤處理', () => {
    it('✅ supabase.from 拋出異常時應該捕獲並返回預設值', async () => {
      vi.mocked(supabase.from).mockImplementation(() => {
        throw new Error('Network error')
      })

      const user = createMockUser('test@example.com')
      
      // 應該返回 false 而不是拋出錯誤
      const result = await isAllowedUser(user)
      expect(result).toBe(false)
    })

    it('✅ editor_users 查詢失敗時應該返回空陣列', async () => {
      mockSupabaseResponse(null, { message: 'Table not found' })

      const user = createMockUser('editor@example.com')
      const result = await isEditorAsync(user)
      
      // 非超級管理員應該返回 false
      expect(result).toBe(false)
    })

    it('✅ view_users 查詢失敗時應該返回空陣列', async () => {
      let callCount = 0
      vi.mocked(supabase.from).mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // editor_users 查詢成功但為空
          return {
            select: vi.fn(() => Promise.resolve({ data: [], error: null }))
          } as any
        } else {
          // view_users 查詢失敗
          return {
            select: vi.fn(() => Promise.resolve({ 
              data: null, 
              error: { message: 'Permission denied' }
            }))
          } as any
        }
      })

      const user = createMockUser('test@example.com')
      const result = await hasViewAccess(user)
      
      // 應該返回 false
      expect(result).toBe(false)
    })

    it('✅ 資料庫返回 null data 應該正確處理', async () => {
      mockSupabaseResponse(null)

      const user = createMockUser('test@example.com')
      const result = await isAllowedUser(user)
      
      // 非超級管理員應該返回 false
      expect(result).toBe(false)
    })

    it('✅ 空的 email 列表應該正確處理', async () => {
      mockSupabaseResponse([])

      const user = createMockUser('test@example.com')
      const result = await isAllowedUser(user)
      
      // 非超級管理員且不在空列表中
      expect(result).toBe(false)
    })
  })
})
