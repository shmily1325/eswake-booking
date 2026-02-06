import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useMemberSearch } from '../useMemberSearch'

// Mock supabase
vi.mock('../../lib/supabase', () => {
  const mockChain = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn()
  }
  
  mockChain.from.mockReturnValue(mockChain)
  mockChain.select.mockReturnValue(mockChain)
  mockChain.eq.mockReturnValue(mockChain)
  mockChain.order.mockResolvedValue({ data: [], error: null })
  
  return {
    supabase: mockChain
  }
})

import { supabase } from '../../lib/supabase'

const mockMembersData = [
  { id: '1', name: '張三', nickname: '小張', phone: '0912345678' },
  { id: '2', name: '李四', nickname: null, phone: '0923456789' },
  { id: '3', name: '王五', nickname: '阿王', phone: '0934567890' },
  { id: '4', name: 'John', nickname: 'Johnny', phone: null }
]

describe('useMemberSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock implementation
    vi.mocked(supabase.from).mockReturnValue(supabase as any)
    vi.mocked(supabase.select).mockReturnValue(supabase as any)
    vi.mocked(supabase.eq).mockReturnValue(supabase as any)
    vi.mocked(supabase.order).mockResolvedValue({ data: mockMembersData, error: null })
  })

  describe('初始狀態', () => {
    it('應該返回初始狀態', () => {
      const { result } = renderHook(() => useMemberSearch())
      
      expect(result.current.members).toEqual([])
      expect(result.current.searchTerm).toBe('')
      expect(result.current.selectedMemberId).toBeNull()
      expect(result.current.showDropdown).toBe(false)
      expect(result.current.manualName).toBe('')
      expect(result.current.filteredMembers).toEqual([])
    })

    it('應該自動載入會員列表', async () => {
      const { result } = renderHook(() => useMemberSearch())
      
      await waitFor(() => {
        expect(result.current.members.length).toBeGreaterThan(0)
      })
      
      expect(result.current.members).toEqual(mockMembersData)
      expect(supabase.from).toHaveBeenCalledWith('members')
      expect(supabase.select).toHaveBeenCalledWith('id, name, nickname, phone')
      expect(supabase.eq).toHaveBeenCalledWith('status', 'active')
      expect(supabase.order).toHaveBeenCalledWith('name')
    })
  })

  describe('搜尋功能', () => {
    it('應該根據名字過濾會員', async () => {
      const { result } = renderHook(() => useMemberSearch())
      
      await waitFor(() => {
        expect(result.current.members.length).toBeGreaterThan(0)
      })
      
      act(() => {
        result.current.handleSearchChange('張三')
      })
      
      expect(result.current.filteredMembers).toEqual([mockMembersData[0]])
      expect(result.current.showDropdown).toBe(true)
    })

    it('應該根據暱稱過濾會員', async () => {
      const { result } = renderHook(() => useMemberSearch())
      
      await waitFor(() => {
        expect(result.current.members.length).toBeGreaterThan(0)
      })
      
      act(() => {
        result.current.handleSearchChange('小張')
      })
      
      expect(result.current.filteredMembers).toEqual([mockMembersData[0]])
    })

    it('應該根據電話過濾會員', async () => {
      const { result } = renderHook(() => useMemberSearch())
      
      await waitFor(() => {
        expect(result.current.members.length).toBeGreaterThan(0)
      })
      
      act(() => {
        result.current.handleSearchChange('0912')
      })
      
      expect(result.current.filteredMembers).toEqual([mockMembersData[0]])
    })

    it('應該不區分大小寫', async () => {
      const { result } = renderHook(() => useMemberSearch())
      
      await waitFor(() => {
        expect(result.current.members.length).toBeGreaterThan(0)
      })
      
      act(() => {
        result.current.handleSearchChange('john')
      })
      
      expect(result.current.filteredMembers).toEqual([mockMembersData[3]])
    })

    it('應該支援部分匹配', async () => {
      const { result } = renderHook(() => useMemberSearch())
      
      await waitFor(() => {
        expect(result.current.members.length).toBeGreaterThan(0)
      })
      
      act(() => {
        result.current.handleSearchChange('王')
      })
      
      expect(result.current.filteredMembers).toContainEqual(mockMembersData[2])
    })

    it('空白搜尋應該返回空陣列', async () => {
      const { result } = renderHook(() => useMemberSearch())
      
      await waitFor(() => {
        expect(result.current.members.length).toBeGreaterThan(0)
      })
      
      act(() => {
        result.current.handleSearchChange('')
      })
      
      expect(result.current.filteredMembers).toEqual([])
      expect(result.current.showDropdown).toBe(false)
    })

    it('無匹配結果應該返回空陣列', async () => {
      const { result } = renderHook(() => useMemberSearch())
      
      await waitFor(() => {
        expect(result.current.members.length).toBeGreaterThan(0)
      })
      
      act(() => {
        result.current.handleSearchChange('不存在的會員')
      })
      
      expect(result.current.filteredMembers).toEqual([])
      expect(result.current.showDropdown).toBe(false)
    })
  })

  describe('選擇會員', () => {
    it('應該正確選擇會員', async () => {
      const { result } = renderHook(() => useMemberSearch())
      
      await waitFor(() => {
        expect(result.current.members.length).toBeGreaterThan(0)
      })
      
      act(() => {
        result.current.selectMember(mockMembersData[0])
      })
      
      expect(result.current.searchTerm).toBe('小張') // 使用 nickname
      expect(result.current.selectedMemberId).toBe('1')
      expect(result.current.manualName).toBe('')
      expect(result.current.showDropdown).toBe(false)
    })

    it('選擇無暱稱的會員應該使用名字', async () => {
      const { result } = renderHook(() => useMemberSearch())
      
      await waitFor(() => {
        expect(result.current.members.length).toBeGreaterThan(0)
      })
      
      act(() => {
        result.current.selectMember(mockMembersData[1])
      })
      
      expect(result.current.searchTerm).toBe('李四') // 使用 name
      expect(result.current.selectedMemberId).toBe('2')
    })
  })

  describe('手動輸入', () => {
    it('手動輸入應該清除選擇的會員', async () => {
      const { result } = renderHook(() => useMemberSearch())
      
      await waitFor(() => {
        expect(result.current.members.length).toBeGreaterThan(0)
      })
      
      // 先選擇一個會員
      act(() => {
        result.current.selectMember(mockMembersData[0])
      })
      expect(result.current.selectedMemberId).toBe('1')
      
      // 再手動輸入
      act(() => {
        result.current.handleSearchChange('新的名字')
      })
      
      expect(result.current.selectedMemberId).toBeNull()
      expect(result.current.manualName).toBe('新的名字')
    })

    it('getContactName 應該返回會員名或手動輸入的名字', async () => {
      const { result } = renderHook(() => useMemberSearch())
      
      await waitFor(() => {
        expect(result.current.members.length).toBeGreaterThan(0)
      })
      
      // 選擇會員時
      act(() => {
        result.current.selectMember(mockMembersData[0])
      })
      expect(result.current.getContactName()).toBe('小張')
      
      // 手動輸入時
      act(() => {
        result.current.handleSearchChange('手動輸入的名字')
      })
      expect(result.current.getContactName()).toBe('手動輸入的名字')
    })

    it('getContactName 應該去除空白', async () => {
      const { result } = renderHook(() => useMemberSearch())
      
      await waitFor(() => {
        expect(result.current.members.length).toBeGreaterThan(0)
      })
      
      act(() => {
        result.current.handleSearchChange('  有空白  ')
      })
      
      expect(result.current.getContactName()).toBe('有空白')
    })
  })

  describe('下拉選單控制', () => {
    it('應該能夠手動控制下拉選單顯示', async () => {
      const { result } = renderHook(() => useMemberSearch())
      
      await waitFor(() => {
        expect(result.current.members.length).toBeGreaterThan(0)
      })
      
      act(() => {
        result.current.setShowDropdown(true)
      })
      expect(result.current.showDropdown).toBe(true)
      
      act(() => {
        result.current.setShowDropdown(false)
      })
      expect(result.current.showDropdown).toBe(false)
    })
  })

  describe('重置功能', () => {
    it('應該重置所有狀態', async () => {
      const { result } = renderHook(() => useMemberSearch())
      
      await waitFor(() => {
        expect(result.current.members.length).toBeGreaterThan(0)
      })
      
      // 先設置一些狀態
      act(() => {
        result.current.handleSearchChange('張三')
        result.current.selectMember(mockMembersData[0])
      })
      
      // 重置
      act(() => {
        result.current.reset()
      })
      
      expect(result.current.searchTerm).toBe('')
      expect(result.current.selectedMemberId).toBeNull()
      expect(result.current.manualName).toBe('')
      expect(result.current.showDropdown).toBe(false)
    })
  })

  describe('錯誤處理', () => {
    it('載入會員失敗時應該返回空陣列', async () => {
      vi.mocked(supabase.order).mockResolvedValue({ data: null, error: new Error('Database error') })
      
      const { result } = renderHook(() => useMemberSearch())
      
      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalled()
      })
      
      expect(result.current.members).toEqual([])
    })
  })

  describe('效能優化', () => {
    it('filteredMembers 應該使用 useMemo 快取', async () => {
      const { result, rerender } = renderHook(() => useMemberSearch())
      
      await waitFor(() => {
        expect(result.current.members.length).toBeGreaterThan(0)
      })
      
      act(() => {
        result.current.handleSearchChange('張三')
      })
      
      const firstFiltered = result.current.filteredMembers
      
      // 重新渲染但不改變 members 和 searchTerm
      rerender()
      
      // 應該返回相同的引用（useMemo 快取）
      expect(result.current.filteredMembers).toBe(firstFiltered)
    })
  })

  describe('邊緣情況', () => {
    it('應該處理 null 暱稱', async () => {
      const { result } = renderHook(() => useMemberSearch())
      
      await waitFor(() => {
        expect(result.current.members.length).toBeGreaterThan(0)
      })
      
      act(() => {
        result.current.handleSearchChange('李四')
      })
      
      // 李四沒有暱稱，應該能正常搜尋
      expect(result.current.filteredMembers).toContainEqual(mockMembersData[1])
    })

    it('應該處理 null 電話', async () => {
      const { result } = renderHook(() => useMemberSearch())
      
      await waitFor(() => {
        expect(result.current.members.length).toBeGreaterThan(0)
      })
      
      act(() => {
        result.current.handleSearchChange('John')
      })
      
      // John 沒有電話，應該能正常搜尋
      expect(result.current.filteredMembers).toContainEqual(mockMembersData[3])
    })

    it('應該處理只有空白的搜尋', async () => {
      const { result } = renderHook(() => useMemberSearch())
      
      await waitFor(() => {
        expect(result.current.members.length).toBeGreaterThan(0)
      })
      
      act(() => {
        result.current.handleSearchChange('   ')
      })
      
      expect(result.current.filteredMembers).toEqual([])
    })
  })
})
