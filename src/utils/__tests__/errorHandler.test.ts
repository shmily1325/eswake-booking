import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  handleSupabaseError,
  handleError,
  handleSuccess,
  confirmAction,
  validateRequired,
  validateEmail,
  validateDateRange
} from '../errorHandler'
import { toast } from '../toast'

describe('errorHandler.ts - 錯誤處理工具', () => {
  // Mock toast, console.log, console.error, confirm
  let toastErrorMock: ReturnType<typeof vi.fn>
  let toastSuccessMock: ReturnType<typeof vi.fn>
  let consoleLogMock: ReturnType<typeof vi.fn>
  let consoleErrorMock: ReturnType<typeof vi.fn>
  let confirmMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    toastErrorMock = vi.fn()
    toastSuccessMock = vi.fn()
    consoleLogMock = vi.fn()
    consoleErrorMock = vi.fn()
    confirmMock = vi.fn()
    
    toast.error = toastErrorMock as any
    toast.success = toastSuccessMock as any
    global.console.log = consoleLogMock as any
    global.console.error = consoleErrorMock as any
    global.confirm = confirmMock as any
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('handleSupabaseError', () => {
    it('應該處理 unique_violation 錯誤（23505）', () => {
      const error = { code: '23505' }
      expect(handleSupabaseError(error)).toBe('資料重複：此項目已存在')
    })

    it('應該處理 foreign_key_violation 錯誤（23503）', () => {
      const error = { code: '23503' }
      expect(handleSupabaseError(error)).toBe('關聯資料不存在：請確認相關資料是否存在')
    })

    it('應該處理 not_null_violation 錯誤（23502）', () => {
      const error = { code: '23502' }
      expect(handleSupabaseError(error)).toBe('必填欄位缺失：請填寫所有必要資訊')
    })

    it('應該處理 string_data_right_truncation 錯誤（22001）', () => {
      const error = { code: '22001' }
      expect(handleSupabaseError(error)).toBe('資料過長：請縮短輸入內容')
    })

    it('應該處理 undefined_table 錯誤（42P01）', () => {
      const error = { code: '42P01' }
      expect(handleSupabaseError(error)).toBe('資料表不存在：系統配置錯誤')
    })

    it('應該處理 JWT token expired 錯誤（PGRST301）', () => {
      const error = { code: 'PGRST301' }
      expect(handleSupabaseError(error)).toBe('登入已過期，請重新登入')
    })

    it('應該處理 insufficient_privilege 錯誤（42501）', () => {
      const error = { code: '42501' }
      expect(handleSupabaseError(error)).toBe('權限不足：您沒有執行此操作的權限')
    })

    it('應該處理網路錯誤', () => {
      const error = { message: 'fetch failed' }
      expect(handleSupabaseError(error)).toBe('網路連線失敗，請檢查網路設定')
    })

    it('應該處理包含 network 的錯誤訊息', () => {
      const error = { message: 'network error occurred' }
      expect(handleSupabaseError(error)).toBe('網路連線失敗，請檢查網路設定')
    })

    it('應該返回原始錯誤訊息', () => {
      const error = { message: '自訂錯誤訊息' }
      expect(handleSupabaseError(error)).toBe('自訂錯誤訊息')
    })

    it('沒有訊息時應該返回預設訊息', () => {
      const error = {}
      expect(handleSupabaseError(error)).toBe('操作失敗，請稍後再試')
    })

    it('應該處理 null 或 undefined', () => {
      expect(handleSupabaseError(null)).toBe('操作失敗，請稍後再試')
      expect(handleSupabaseError(undefined)).toBe('操作失敗，請稍後再試')
    })
  })

  describe('handleError', () => {
    it('應該顯示錯誤訊息並記錄到 console', () => {
      const error = { message: '測試錯誤' }
      const result = handleError(error)
      
      expect(result).toBe('測試錯誤')
      expect(toastErrorMock).toHaveBeenCalledWith('測試錯誤')
      expect(consoleErrorMock).toHaveBeenCalledWith('[錯誤] 操作:', error)
    })

    it('應該包含上下文訊息', () => {
      const error = { message: '資料庫錯誤' }
      const result = handleError(error, '新增會員')
      
      expect(result).toBe('新增會員失敗：資料庫錯誤')
      expect(toastErrorMock).toHaveBeenCalledWith('新增會員失敗：資料庫錯誤')
      expect(consoleErrorMock).toHaveBeenCalledWith('[錯誤] 新增會員:', error)
    })

    it('showAlert 為 false 時不應該顯示 toast', () => {
      const error = { message: '測試錯誤' }
      handleError(error, undefined, false)
      
      expect(toastErrorMock).not.toHaveBeenCalled()
      expect(consoleErrorMock).toHaveBeenCalled()
    })

    it('應該處理 Supabase 特定錯誤', () => {
      const error = { code: '23505' }
      const result = handleError(error, '新增資料')
      
      expect(result).toBe('新增資料失敗：資料重複：此項目已存在')
      expect(toastErrorMock).toHaveBeenCalledWith('新增資料失敗：資料重複：此項目已存在')
    })
  })

  describe('handleSuccess', () => {
    it('應該顯示成功訊息', () => {
      handleSuccess('操作成功')
      
      expect(toastSuccessMock).toHaveBeenCalledWith('操作成功')
      expect(consoleLogMock).toHaveBeenCalledWith('[成功] 操作成功')
    })

    it('showAlert 為 false 時不應該顯示 toast', () => {
      handleSuccess('操作成功', false)
      
      expect(toastSuccessMock).not.toHaveBeenCalled()
      expect(consoleLogMock).toHaveBeenCalledWith('[成功] 操作成功')
    })
  })

  describe('confirmAction', () => {
    it('使用者確認時應該返回 true', () => {
      confirmMock.mockReturnValue(true)
      
      const result = confirmAction('確定要刪除嗎？')
      
      expect(result).toBe(true)
      expect(confirmMock).toHaveBeenCalledWith('確定要刪除嗎？')
    })

    it('使用者取消時應該返回 false', () => {
      confirmMock.mockReturnValue(false)
      
      const result = confirmAction('確定要刪除嗎？')
      
      expect(result).toBe(false)
      expect(confirmMock).toHaveBeenCalledWith('確定要刪除嗎？')
    })
  })

  describe('validateRequired', () => {
    it('有效值應該通過驗證', () => {
      const result = validateRequired('有效內容', '姓名')
      
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('空字串應該驗證失敗', () => {
      const result = validateRequired('', '姓名')
      
      expect(result.valid).toBe(false)
      expect(result.error).toBe('請輸入姓名')
    })

    it('只有空白的字串應該驗證失敗', () => {
      const result = validateRequired('   ', '姓名')
      
      expect(result.valid).toBe(false)
      expect(result.error).toBe('請輸入姓名')
    })

    it('null 應該驗證失敗', () => {
      const result = validateRequired(null, '姓名')
      
      expect(result.valid).toBe(false)
      expect(result.error).toBe('請輸入姓名')
    })

    it('undefined 應該驗證失敗', () => {
      const result = validateRequired(undefined, '姓名')
      
      expect(result.valid).toBe(false)
      expect(result.error).toBe('請輸入姓名')
    })
  })

  describe('validateEmail', () => {
    it('有效的 Email 應該通過驗證', () => {
      const result = validateEmail('test@example.com')
      
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('空字串應該驗證失敗', () => {
      const result = validateEmail('')
      
      expect(result.valid).toBe(false)
      expect(result.error).toBe('請輸入 Email')
    })

    it('沒有 @ 符號應該驗證失敗', () => {
      const result = validateEmail('invalidemail.com')
      
      expect(result.valid).toBe(false)
      expect(result.error).toBe('請輸入有效的 Email')
    })

    it('只有空白應該驗證失敗', () => {
      const result = validateEmail('   ')
      
      expect(result.valid).toBe(false)
      expect(result.error).toBe('請輸入 Email')
    })

    it('null 應該驗證失敗', () => {
      const result = validateEmail(null)
      
      expect(result.valid).toBe(false)
      expect(result.error).toBe('請輸入 Email')
    })

    it('undefined 應該驗證失敗', () => {
      const result = validateEmail(undefined)
      
      expect(result.valid).toBe(false)
      expect(result.error).toBe('請輸入 Email')
    })

    it('包含 @ 但格式簡陋的 Email 應該通過', () => {
      // 簡單的驗證只檢查是否有 @
      const result = validateEmail('a@b')
      expect(result.valid).toBe(true)
    })
  })

  describe('validateDateRange', () => {
    it('有效的日期範圍應該通過驗證', () => {
      const result = validateDateRange('2025-01-01', '2025-12-31')
      
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('相同的開始和結束日期應該通過驗證', () => {
      const result = validateDateRange('2025-06-15', '2025-06-15')
      
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('結束日期早於開始日期應該驗證失敗', () => {
      const result = validateDateRange('2025-12-31', '2025-01-01')
      
      expect(result.valid).toBe(false)
      expect(result.error).toBe('結束日期不能早於開始日期')
    })

    it('缺少開始日期應該驗證失敗', () => {
      const result = validateDateRange('', '2025-12-31')
      
      expect(result.valid).toBe(false)
      expect(result.error).toBe('請選擇日期')
    })

    it('缺少結束日期應該驗證失敗', () => {
      const result = validateDateRange('2025-01-01', '')
      
      expect(result.valid).toBe(false)
      expect(result.error).toBe('請選擇日期')
    })

    it('兩個日期都缺少應該驗證失敗', () => {
      const result = validateDateRange('', '')
      
      expect(result.valid).toBe(false)
      expect(result.error).toBe('請選擇日期')
    })
  })
})

