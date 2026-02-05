/**
 * auditLog.ts 測試
 * 測試審計日誌的所有功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock Supabase - use factory function
vi.mock('../../lib/supabase', () => {
  const mockInsert = vi.fn(() => Promise.resolve({ error: null }))
  return {
    supabase: {
      from: vi.fn(() => ({
        insert: mockInsert
      })),
      __mockInsert: mockInsert  // Export for test access
    }
  }
})

// Import after mock
import * as auditLog from '../auditLog'
import { supabase } from '../../lib/supabase'

describe('auditLog 審計日誌工具', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>
  let mockInsert: any

  beforeEach(() => {
    // Get mock insert function
    mockInsert = (supabase as any).__mockInsert
    
    // 重置所有 mock
    vi.clearAllMocks()
    mockInsert.mockResolvedValue({ error: null })

    // Mock console.error
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Mock Date for consistent timestamps
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-05T10:30:45'))
  })

  afterEach(() => {
    vi.useRealTimers()
    consoleErrorSpy?.mockRestore()
  })

  describe('logBookingCreation - 新增預約日誌', () => {
    it('✅ 應該記錄完整的預約新增（含教練、活動、備註、填表人）', async () => {
      await auditLog.logBookingCreation({
        userEmail: 'test@example.com',
        studentName: 'Fish',
        boatName: 'G23',
        startTime: '2026-02-06T14:30:00',
        durationMin: 60,
        coachNames: ['PAPA', 'Ivan'],
        activityTypes: ['WS', 'Wakeboard'],
        notes: '新手體驗',
        filledBy: '許書潔'
      })

      // 等待非阻塞寫入完成
      await vi.waitFor(() => {
        expect(mockInsert).toHaveBeenCalledWith({
          user_email: 'test@example.com',
          action: 'create',
          table_name: 'bookings',
          details: '新增預約：2026/02/06 14:30 60分 G23 Fish | PAPA教練、Ivan教練 [WS+Wakeboard] [新手體驗] (填表人: 許書潔)',
          created_at: '2026-02-05T10:30:45'
        })
      })
    })

    it('✅ 應該記錄沒有教練的預約', async () => {
      await auditLog.logBookingCreation({
        userEmail: 'test@example.com',
        studentName: 'Fish',
        boatName: 'G23',
        startTime: '2026-02-06T14:30:00',
        durationMin: 60,
        coachNames: []
      })

      await vi.waitFor(() => {
        const call = mockInsert.mock.calls[0][0]
        expect(call.details).toBe('新增預約：2026/02/06 14:30 60分 G23 Fish')
        expect(call.details).not.toContain('|')
      })
    })

    it('✅ 應該記錄沒有活動類型的預約', async () => {
      await auditLog.logBookingCreation({
        userEmail: 'test@example.com',
        studentName: 'Fish',
        boatName: 'G23',
        startTime: '2026-02-06T14:30:00',
        durationMin: 60,
        coachNames: ['PAPA']
      })

      await vi.waitFor(() => {
        const call = mockInsert.mock.calls[0][0]
        expect(call.details).toBe('新增預約：2026/02/06 14:30 60分 G23 Fish | PAPA教練')
        expect(call.details).not.toMatch(/\[.*\]/)
      })
    })

    it('✅ 應該記錄沒有備註的預約', async () => {
      await auditLog.logBookingCreation({
        userEmail: 'test@example.com',
        studentName: 'Fish',
        boatName: 'G23',
        startTime: '2026-02-06T14:30:00',
        durationMin: 60,
        coachNames: ['PAPA'],
        activityTypes: ['WS']
      })

      await vi.waitFor(() => {
        const call = mockInsert.mock.calls[0][0]
        const bracketCount = (call.details.match(/\[/g) || []).length
        expect(bracketCount).toBe(1) // 只有活動類型
      })
    })

    it('✅ 應該忽略空白備註', async () => {
      await auditLog.logBookingCreation({
        userEmail: 'test@example.com',
        studentName: 'Fish',
        boatName: 'G23',
        startTime: '2026-02-06T14:30:00',
        durationMin: 60,
        coachNames: ['PAPA'],
        notes: '   '  // 只有空白
      })

      await vi.waitFor(() => {
        const call = mockInsert.mock.calls[0][0]
        expect(call.details).not.toContain('[   ]')
      })
    })

    it('✅ 應該正確處理特殊字符', async () => {
      await auditLog.logBookingCreation({
        userEmail: 'test@example.com',
        studentName: 'Fish',
        boatName: 'G23',
        startTime: '2026-02-06T14:30:00',
        durationMin: 60,
        coachNames: ['PAPA'],
        notes: '特殊字符: | [] () 、'
      })

      await vi.waitFor(() => {
        const call = mockInsert.mock.calls[0][0]
        expect(call.details).toContain('[特殊字符: | [] () 、]')
      })
    })

    it('⚠️ Supabase 錯誤時應該記錄到 console', async () => {
      mockInsert.mockResolvedValueOnce({ error: { message: 'Database error' } })

      await auditLog.logBookingCreation({
        userEmail: 'test@example.com',
        studentName: 'Fish',
        boatName: 'G23',
        startTime: '2026-02-06T14:30:00',
        durationMin: 60,
        coachNames: []
      })

      await vi.waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('審計日誌寫入錯誤:', { message: 'Database error' })
      })
    })
  })

  describe('logBookingUpdate - 更新預約日誌', () => {
    it('✅ 應該記錄完整的預約更新（含填表人）', async () => {
      await auditLog.logBookingUpdate({
        userEmail: 'test@example.com',
        studentName: 'Fish',
        startTime: '2026-02-06T14:30:00',
        changes: ['時間從 14:00 改為 14:30', '教練從 Ivan 改為 PAPA'],
        filledBy: '許書潔'
      })

      await vi.waitFor(() => {
        expect(mockInsert).toHaveBeenCalledWith({
          user_email: 'test@example.com',
          action: 'update',
          table_name: 'bookings',
          details: '修改預約：2026/02/06 14:30 Fish，變更：時間從 14:00 改為 14:30、教練從 Ivan 改為 PAPA (填表人: 許書潔)',
          created_at: '2026-02-05T10:30:45'
        })
      })
    })

    it('✅ 應該記錄沒有填表人的更新', async () => {
      await auditLog.logBookingUpdate({
        userEmail: 'test@example.com',
        studentName: 'Fish',
        startTime: '2026-02-06T14:30:00',
        changes: ['時間變更']
      })

      await vi.waitFor(() => {
        const call = mockInsert.mock.calls[0][0]
        expect(call.details).toBe('修改預約：2026/02/06 14:30 Fish，變更：時間變更')
        expect(call.details).not.toContain('填表人')
      })
    })

    it('✅ 應該正確處理單一變更', async () => {
      await auditLog.logBookingUpdate({
        userEmail: 'test@example.com',
        studentName: 'Fish',
        startTime: '2026-02-06T14:30:00',
        changes: ['新增教練 PAPA']
      })

      await vi.waitFor(() => {
        const call = mockInsert.mock.calls[0][0]
        expect(call.details).toContain('變更：新增教練 PAPA')
      })
    })

    it('⚠️ Supabase 錯誤時應該記錄到 console', async () => {
      mockInsert.mockResolvedValueOnce({ error: { message: 'Database error' } })

      await auditLog.logBookingUpdate({
        userEmail: 'test@example.com',
        studentName: 'Fish',
        startTime: '2026-02-06T14:30:00',
        changes: ['變更']
      })

      await vi.waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('審計日誌寫入錯誤:', { message: 'Database error' })
      })
    })
  })

  describe('logBookingDeletion - 刪除預約日誌', () => {
    it('✅ 應該記錄完整的預約刪除（含教練、駕駛、活動、備註）', async () => {
      await auditLog.logBookingDeletion({
        userEmail: 'test@example.com',
        studentName: 'Fish',
        boatName: 'G23',
        startTime: '2026-02-06T14:30:00',
        durationMin: 60,
        coachNames: ['PAPA', 'Ivan'],
        driverNames: ['Sky'],
        activityTypes: ['WS', 'Wakeboard'],
        notes: '新手體驗',
        filledBy: '許書潔'
      })

      await vi.waitFor(() => {
        expect(mockInsert).toHaveBeenCalledWith({
          user_email: 'test@example.com',
          action: 'delete',
          table_name: 'bookings',
          details: '刪除預約：2026/02/06 14:30 60分 G23 Fish | PAPA教練、Ivan教練 | 🚤Sky [WS+Wakeboard] [新手體驗] (填表人: 許書潔)',
          created_at: '2026-02-05T10:30:45'
        })
      })
    })

    it('✅ 駕駛與教練相同時不應該重複顯示', async () => {
      await auditLog.logBookingDeletion({
        userEmail: 'test@example.com',
        studentName: 'Fish',
        boatName: 'G23',
        startTime: '2026-02-06T14:30:00',
        durationMin: 60,
        coachNames: ['PAPA'],
        driverNames: ['PAPA']  // 與教練相同
      })

      await vi.waitFor(() => {
        const call = mockInsert.mock.calls[0][0]
        expect(call.details).not.toContain('🚤')
        expect(call.details).toBe('刪除預約：2026/02/06 14:30 60分 G23 Fish | PAPA教練')
      })
    })

    it('✅ 駕駛與教練不同時應該顯示駕駛', async () => {
      await auditLog.logBookingDeletion({
        userEmail: 'test@example.com',
        studentName: 'Fish',
        boatName: 'G23',
        startTime: '2026-02-06T14:30:00',
        durationMin: 60,
        coachNames: ['PAPA'],
        driverNames: ['Sky']
      })

      await vi.waitFor(() => {
        const call = mockInsert.mock.calls[0][0]
        expect(call.details).toContain('🚤Sky')
      })
    })

    it('✅ 沒有教練時駕駛應該顯示', async () => {
      await auditLog.logBookingDeletion({
        userEmail: 'test@example.com',
        studentName: 'Fish',
        boatName: 'G23',
        startTime: '2026-02-06T14:30:00',
        durationMin: 60,
        driverNames: ['Sky']
      })

      await vi.waitFor(() => {
        const call = mockInsert.mock.calls[0][0]
        expect(call.details).toContain('🚤Sky')
      })
    })

    it('✅ 應該記錄沒有任何額外資訊的刪除', async () => {
      await auditLog.logBookingDeletion({
        userEmail: 'test@example.com',
        studentName: 'Fish',
        boatName: 'G23',
        startTime: '2026-02-06T14:30:00',
        durationMin: 60
      })

      await vi.waitFor(() => {
        const call = mockInsert.mock.calls[0][0]
        expect(call.details).toBe('刪除預約：2026/02/06 14:30 60分 G23 Fish')
      })
    })

    it('⚠️ Supabase 錯誤時應該記錄到 console', async () => {
      mockInsert.mockResolvedValueOnce({ error: { message: 'Database error' } })

      await auditLog.logBookingDeletion({
        userEmail: 'test@example.com',
        studentName: 'Fish',
        boatName: 'G23',
        startTime: '2026-02-06T14:30:00',
        durationMin: 60
      })

      await vi.waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('審計日誌寫入錯誤:', { message: 'Database error' })
      })
    })
  })

  describe('logMemberAction - 會員操作日誌', () => {
    it('✅ 應該記錄新增會員', async () => {
      await auditLog.logMemberAction('test@example.com', 'create', 'Fish')

      expect(mockInsert).toHaveBeenCalledWith({
        user_email: 'test@example.com',
        action: 'create',
        table_name: 'members',
        details: '新增會員：Fish'
      })
    })

    it('✅ 應該記錄更新會員（含詳情）', async () => {
      await auditLog.logMemberAction('test@example.com', 'update', 'Fish', '修改電話號碼')

      expect(mockInsert).toHaveBeenCalledWith({
        user_email: 'test@example.com',
        action: 'update',
        table_name: 'members',
        details: '修改會員：Fish，修改電話號碼'
      })
    })

    it('✅ 應該記錄刪除會員', async () => {
      await auditLog.logMemberAction('test@example.com', 'delete', 'Fish')

      expect(mockInsert).toHaveBeenCalledWith({
        user_email: 'test@example.com',
        action: 'delete',
        table_name: 'members',
        details: '刪除會員：Fish'
      })
    })

    it('⚠️ 錯誤時應該記錄到 console', async () => {
      mockInsert.mockRejectedValueOnce(new Error('Database error'))

      await auditLog.logMemberAction('test@example.com', 'create', 'Fish')

      expect(consoleErrorSpy).toHaveBeenCalledWith('審計日誌記錄失敗:', expect.any(Error))
    })
  })

  describe('logTransaction - 交易日誌', () => {
    it('✅ 應該記錄含備註的交易', async () => {
      await auditLog.logTransaction('test@example.com', 'Fish', '儲值', 1000, '首次儲值優惠')

      expect(mockInsert).toHaveBeenCalledWith({
        user_email: 'test@example.com',
        action: 'create',
        table_name: 'transactions',
        details: 'Fish / 儲值 / $1000 / 首次儲值優惠'
      })
    })

    it('✅ 應該記錄沒有備註的交易', async () => {
      await auditLog.logTransaction('test@example.com', 'Fish', '扣款', 500)

      expect(mockInsert).toHaveBeenCalledWith({
        user_email: 'test@example.com',
        action: 'create',
        table_name: 'transactions',
        details: 'Fish / 扣款 / $500'
      })
    })

    it('⚠️ 錯誤時應該記錄到 console', async () => {
      mockInsert.mockRejectedValueOnce(new Error('Database error'))

      await auditLog.logTransaction('test@example.com', 'Fish', '儲值', 1000)

      expect(consoleErrorSpy).toHaveBeenCalledWith('審計日誌記錄失敗:', expect.any(Error))
    })
  })

  describe('logAction - 一般操作日誌', () => {
    it('✅ 應該記錄一般操作', async () => {
      await auditLog.logAction('test@example.com', 'create', 'boats', '新增船隻：G23')

      expect(mockInsert).toHaveBeenCalledWith({
        user_email: 'test@example.com',
        action: 'create',
        table_name: 'boats',
        details: '新增船隻：G23',
        created_at: '2026-02-05T10:30:45'
      })
    })

    it('✅ 應該記錄更新操作', async () => {
      await auditLog.logAction('test@example.com', 'update', 'coaches', '修改教練：PAPA')

      expect(mockInsert).toHaveBeenCalledWith({
        user_email: 'test@example.com',
        action: 'update',
        table_name: 'coaches',
        details: '修改教練：PAPA',
        created_at: '2026-02-05T10:30:45'
      })
    })

    it('✅ 應該記錄刪除操作', async () => {
      await auditLog.logAction('test@example.com', 'delete', 'announcements', '刪除公告')

      expect(mockInsert).toHaveBeenCalledWith({
        user_email: 'test@example.com',
        action: 'delete',
        table_name: 'announcements',
        details: '刪除公告',
        created_at: '2026-02-05T10:30:45'
      })
    })

    it('⚠️ Supabase 錯誤時應該記錄到 console', async () => {
      mockInsert.mockResolvedValueOnce({ error: { message: 'Database error' } })

      await auditLog.logAction('test@example.com', 'create', 'boats', '新增船隻')

      expect(consoleErrorSpy).toHaveBeenCalledWith('審計日誌記錄失敗:', { message: 'Database error' })
    })

    it('⚠️ 異常時應該記錄到 console', async () => {
      mockInsert.mockRejectedValueOnce(new Error('Exception'))

      await auditLog.logAction('test@example.com', 'create', 'boats', '新增船隻')

      expect(consoleErrorSpy).toHaveBeenCalledWith('審計日誌記錄失敗 (exception):', expect.any(Error))
    })
  })

  describe('logCoachAssignment - 排班日誌', () => {
    it('✅ 應該記錄排班變更', async () => {
      await auditLog.logCoachAssignment({
        userEmail: 'test@example.com',
        studentName: 'Fish',
        boatName: 'G23',
        startTime: '2026-02-06T14:30:00',
        changes: ['指派教練：PAPA', '指派駕駛：Sky']
      })

      await vi.waitFor(() => {
        expect(mockInsert).toHaveBeenCalledWith({
          user_email: 'test@example.com',
          action: 'update',
          table_name: 'coach_assignment',
          details: '排班：2026/02/06 14:30 G23 Fish，變更：指派教練：PAPA、指派駕駛：Sky',
          created_at: '2026-02-05T10:30:45'
        })
      })
    })

    it('✅ 應該記錄單一排班變更', async () => {
      await auditLog.logCoachAssignment({
        userEmail: 'test@example.com',
        studentName: 'Fish',
        boatName: 'G23',
        startTime: '2026-02-06T14:30:00',
        changes: ['移除教練：Ivan']
      })

      await vi.waitFor(() => {
        const call = mockInsert.mock.calls[0][0]
        expect(call.details).toContain('變更：移除教練：Ivan')
      })
    })

    it('⚠️ Supabase 錯誤時應該記錄到 console', async () => {
      mockInsert.mockResolvedValueOnce({ error: { message: 'Database error' } })

      await auditLog.logCoachAssignment({
        userEmail: 'test@example.com',
        studentName: 'Fish',
        boatName: 'G23',
        startTime: '2026-02-06T14:30:00',
        changes: ['變更']
      })

      await vi.waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('審計日誌寫入錯誤:', { message: 'Database error' })
      })
    })
  })

  describe('時間格式化', () => {
    it('✅ 應該正確格式化包含年份的時間', async () => {
      await auditLog.logBookingCreation({
        userEmail: 'test@example.com',
        studentName: 'Fish',
        boatName: 'G23',
        startTime: '2026-12-31T23:59:00',
        durationMin: 60,
        coachNames: []
      })

      await vi.waitFor(() => {
        const call = mockInsert.mock.calls[0][0]
        expect(call.details).toContain('2026/12/31 23:59')
      })
    })

    it('✅ 應該正確處理單位數的月份和日期', async () => {
      await auditLog.logBookingCreation({
        userEmail: 'test@example.com',
        studentName: 'Fish',
        boatName: 'G23',
        startTime: '2026-01-05T09:05:00',
        durationMin: 60,
        coachNames: []
      })

      await vi.waitFor(() => {
        const call = mockInsert.mock.calls[0][0]
        expect(call.details).toContain('2026/01/05 09:05')
      })
    })
  })

  describe('邊界情況', () => {
    it('✅ 應該處理空的變更陣列', async () => {
      await auditLog.logBookingUpdate({
        userEmail: 'test@example.com',
        studentName: 'Fish',
        startTime: '2026-02-06T14:30:00',
        changes: []
      })

      await vi.waitFor(() => {
        const call = mockInsert.mock.calls[0][0]
        expect(call.details).toContain('變更：')
      })
    })

    it('✅ 應該處理超長備註', async () => {
      const longNote = '這是一個非常非常非常非常非常非常非常非常非常非常長的備註'.repeat(10)
      
      await auditLog.logBookingCreation({
        userEmail: 'test@example.com',
        studentName: 'Fish',
        boatName: 'G23',
        startTime: '2026-02-06T14:30:00',
        durationMin: 60,
        coachNames: [],
        notes: longNote
      })

      await vi.waitFor(() => {
        const call = mockInsert.mock.calls[0][0]
        expect(call.details).toContain(longNote)
      })
    })

    it('✅ 應該處理多個教練', async () => {
      await auditLog.logBookingDeletion({
        userEmail: 'test@example.com',
        studentName: 'Fish',
        boatName: 'G23',
        startTime: '2026-02-06T14:30:00',
        durationMin: 60,
        coachNames: ['PAPA', 'Ivan', 'Sky', 'ED']
      })

      await vi.waitFor(() => {
        const call = mockInsert.mock.calls[0][0]
        expect(call.details).toContain('PAPA教練、Ivan教練、Sky教練、ED教練')
      })
    })

    it('✅ 應該處理多個活動類型', async () => {
      await auditLog.logBookingCreation({
        userEmail: 'test@example.com',
        studentName: 'Fish',
        boatName: 'G23',
        startTime: '2026-02-06T14:30:00',
        durationMin: 60,
        coachNames: [],
        activityTypes: ['WS', 'Wakeboard', 'SUP', 'Kneeboard']
      })

      await vi.waitFor(() => {
        const call = mockInsert.mock.calls[0][0]
        expect(call.details).toContain('[WS+Wakeboard+SUP+Kneeboard]')
      })
    })
  })
})
