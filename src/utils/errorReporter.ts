/**
 * 錯誤報告工具
 * 用於追蹤和定位確切的錯誤來源
 */

let errorCount = 0
const MAX_ERRORS = 10 // 避免無限日誌

/**
 * 包裝任何可能拋出錯誤的操作
 * 會精確報告錯誤位置和上下文
 */
export function wrapWithErrorReport<T>(
  operation: () => T,
  context: {
    component: string
    operation: string
    data?: any
  }
): T | null {
  if (errorCount >= MAX_ERRORS) {
    return null
  }

  try {
    return operation()
  } catch (error) {
    errorCount++
    
    console.group(`🔴 [Error #${errorCount}] ${context.component} - ${context.operation}`)
    console.log('Context:', {
      component: context.component,
      operation: context.operation,
      ...(context.data !== undefined ? { data: context.data } : {}),
    })
    if (context.data !== undefined) {
      console.log('Data:', context.data)
    }
    console.error('Error:', (error as Error).message)
    console.error('Stack:', (error as Error).stack)
    console.groupEnd()
    
    // 如果是 "Cannot read properties of null" 錯誤，提供額外資訊
    if ((error as Error).message && (error as Error).message.includes('Cannot read properties of null')) {
      console.error('⚠️ NULL ACCESS DETECTED!')
      console.trace('Full trace')
    }
    
    return null
  }
}

/**
 * 重置錯誤計數器
 */
export function resetErrorCount() {
  errorCount = 0
}

