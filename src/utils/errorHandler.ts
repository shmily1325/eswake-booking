import { PostgrestError } from '@supabase/supabase-js'

/**
 * 處理 Supabase 錯誤，返回用戶友好的錯誤訊息
 */
export function handleSupabaseError(error: PostgrestError | Error | any): string {
  // PostgreSQL 錯誤碼處理
  if (error?.code) {
    switch (error.code) {
      case '23505': // unique_violation
        return '資料重複：此項目已存在'
      case '23503': // foreign_key_violation
        return '關聯資料不存在：請確認相關資料是否存在'
      case '23502': // not_null_violation
        return '必填欄位缺失：請填寫所有必要資訊'
      case '22001': // string_data_right_truncation
        return '資料過長：請縮短輸入內容'
      case '42P01': // undefined_table
        return '資料表不存在：系統配置錯誤'
      case 'PGRST301': // JWT token expired
        return '登入已過期，請重新登入'
      case '42501': // insufficient_privilege
        return '權限不足：您沒有執行此操作的權限'
    }
  }

  // 檢查是否為網路錯誤
  if (error?.message?.includes('fetch') || error?.message?.includes('network')) {
    return '網路連線失敗，請檢查網路設定'
  }

  // 返回原始錯誤訊息或預設訊息
  return error?.message || '操作失敗，請稍後再試'
}

/**
 * 標準化的錯誤處理函數
 * @param error - 錯誤對象
 * @param context - 錯誤上下文（例如：'新增會員'、'刪除預約'）
 * @param showAlert - 是否顯示 alert（預設 true）
 */
export function handleError(
  error: any, 
  context?: string,
  showAlert: boolean = true
): string {
  const errorMessage = handleSupabaseError(error)
  const fullMessage = context ? `${context}失敗：${errorMessage}` : errorMessage
  
  // 記錄到 console
  console.error(`[錯誤] ${context || '操作'}:`, error)
  
  // 可選：顯示 toast
  if (showAlert) {
    toast.error(fullMessage)
  }
  
  return fullMessage
}

/**
 * 成功訊息處理
 */
export function handleSuccess(
  message: string,
  showAlert: boolean = true
): void {
  console.log(`[成功] ${message}`)
  
  if (showAlert) {
    toast.success(message)
  }
}

/**
 * 確認操作
 */
export function confirmAction(message: string): boolean {
  return confirm(message)
}

/**
 * 驗證必填欄位
 */
export function validateRequired(
  value: string | null | undefined,
  fieldName: string
): { valid: boolean; error?: string } {
  if (!value || !value.trim()) {
    return {
      valid: false,
      error: `請輸入${fieldName}`
    }
  }
  return { valid: true }
}

/**
 * 驗證 Email
 */
export function validateEmail(
  email: string | null | undefined
): { valid: boolean; error?: string } {
  if (!email || !email.trim()) {
    return {
      valid: false,
      error: '請輸入 Email'
    }
  }
  
  if (!email.includes('@')) {
    return {
      valid: false,
      error: '請輸入有效的 Email'
    }
  }
  
  return { valid: true }
}

/**
 * 驗證日期範圍
 */
export function validateDateRange(
  startDate: string,
  endDate: string
): { valid: boolean; error?: string } {
  if (!startDate || !endDate) {
    return {
      valid: false,
      error: '請選擇日期'
    }
  }
  
  if (endDate < startDate) {
    return {
      valid: false,
      error: '結束日期不能早於開始日期'
    }
  }
  
  return { valid: true }
}

