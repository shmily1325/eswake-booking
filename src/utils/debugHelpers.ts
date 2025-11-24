/**
 * Debug 輔助工具
 * 用於快速定位運行時錯誤
 */

/**
 * 安全地訪問對象屬性，如果失敗會記錄詳細資訊
 */
export function safeAccess<T>(
  obj: any,
  path: string,
  context: string
): T | null {
  try {
    if (!obj) {
      console.error(`[SafeAccess] ${context}: Object is null/undefined`, { obj, path })
      return null
    }

    const keys = path.split('.')
    let current = obj

    for (const key of keys) {
      if (current === null || current === undefined) {
        console.error(`[SafeAccess] ${context}: Cannot access '${key}' on null/undefined`, {
          obj,
          path,
          failedAt: key,
          current
        })
        return null
      }
      current = current[key]
    }

    return current as T
  } catch (error) {
    console.error(`[SafeAccess] ${context}: Error accessing path`, {
      obj,
      path,
      error: (error as Error).message
    })
    return null
  }
}

/**
 * 安全地映射陣列，自動捕獲並記錄錯誤
 */
export function safeMapArray<T, U>(
  array: T[] | null | undefined,
  mapper: (item: T, index: number) => U,
  context: string
): U[] {
  if (!array) {
    console.warn(`[SafeMapArray] ${context}: Array is null/undefined`)
    return []
  }

  const results: U[] = []
  
  array.forEach((item, index) => {
    try {
      if (item === null || item === undefined) {
        console.warn(`[SafeMapArray] ${context}: Item at index ${index} is null/undefined`, { array })
        return
      }
      
      const result = mapper(item, index)
      results.push(result)
    } catch (error) {
      console.error(`[SafeMapArray] ${context}: Error mapping item at index ${index}`, {
        item,
        error: (error as Error).message,
        stack: (error as Error).stack
      })
    }
  })

  return results
}

/**
 * 驗證並記錄資料結構
 */
export function validateAndLog<T>(
  data: T,
  validator: (item: T) => boolean,
  context: string
): boolean {
  const isValid = validator(data)
  
  if (!isValid) {
    console.error(`[Validation Failed] ${context}:`, {
      data,
      type: typeof data,
      keys: data && typeof data === 'object' ? Object.keys(data) : 'N/A'
    })
  }
  
  return isValid
}

/**
 * 創建帶詳細日誌的 try-catch 包裝器
 */
export function tryCatch<T>(
  fn: () => T,
  context: string,
  fallback: T
): T {
  try {
    return fn()
  } catch (error) {
    console.error(`[TryCatch] ${context}: Error caught`, {
      error: (error as Error).message,
      stack: (error as Error).stack
    })
    return fallback
  }
}

/**
 * 全局錯誤監聽器
 */
export function setupGlobalErrorHandler() {
  // 捕獲未處理的 Promise rejection
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[Unhandled Promise Rejection]', {
      reason: event.reason,
      promise: event.promise
    })
  })

  // 捕獲全局錯誤
  window.addEventListener('error', (event) => {
    console.error('[Global Error]', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error
    })
  })

  console.log('[Debug] Global error handlers installed')
}

/**
 * 檢查並報告可疑的資料
 */
export function inspectData(data: any, name: string) {
  console.group(`[Data Inspector] ${name}`)
  console.log('Type:', typeof data)
  console.log('Is null:', data === null)
  console.log('Is undefined:', data === undefined)
  console.log('Is array:', Array.isArray(data))
  
  if (Array.isArray(data)) {
    console.log('Array length:', data.length)
    console.log('Has null items:', data.some(item => item === null))
    console.log('Has undefined items:', data.some(item => item === undefined))
    console.log('First item:', data[0])
    console.log('Sample (first 3):', data.slice(0, 3))
  } else if (data && typeof data === 'object') {
    console.log('Keys:', Object.keys(data))
    console.log('Values sample:', Object.entries(data).slice(0, 5))
  } else {
    console.log('Value:', data)
  }
  
  console.groupEnd()
}

