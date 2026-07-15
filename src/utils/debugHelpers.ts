/**
 * Debug 輔助工具
 * 用於快速定位運行時錯誤
 */

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
