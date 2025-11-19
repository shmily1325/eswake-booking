/**
 * 日誌工具
 * 
 * 在開發環境輸出所有日誌，生產環境只輸出錯誤
 * 避免生產環境洩漏敏感資訊和影響性能
 */

const isDev = import.meta.env.DEV

export const logger = {
  /**
   * 一般日誌 - 僅開發環境
   */
  log: (...args: any[]) => {
    if (isDev) {
      console.log(...args)
    }
  },

  /**
   * 錯誤日誌 - 所有環境都輸出
   */
  error: (...args: any[]) => {
    console.error(...args)
  },

  /**
   * 警告日誌 - 僅開發環境
   */
  warn: (...args: any[]) => {
    if (isDev) {
      console.warn(...args)
    }
  },

  /**
   * 調試日誌 - 僅開發環境
   */
  debug: (...args: any[]) => {
    if (isDev) {
      console.debug(...args)
    }
  },

  /**
   * 資訊日誌 - 僅開發環境
   */
  info: (...args: any[]) => {
    if (isDev) {
      console.info(...args)
    }
  }
}

