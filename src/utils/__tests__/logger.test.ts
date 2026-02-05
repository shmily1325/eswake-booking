import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { logger } from '../logger'

describe('logger', () => {
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>
    error: ReturnType<typeof vi.spyOn>
    warn: ReturnType<typeof vi.spyOn>
    debug: ReturnType<typeof vi.spyOn>
    info: ReturnType<typeof vi.spyOn>
  }

  beforeEach(() => {
    // Spy on all console methods
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {})
    }
  })

  afterEach(() => {
    // Restore all mocks
    vi.restoreAllMocks()
  })

  describe('log', () => {
    it('應該輸出日誌訊息', () => {
      logger.log('測試訊息')
      
      // 在開發環境中應該會被調用
      expect(consoleSpy.log).toHaveBeenCalled()
    })

    it('應該支援多個參數', () => {
      logger.log('訊息', 123, { key: 'value' })
      
      expect(consoleSpy.log).toHaveBeenCalledWith('訊息', 123, { key: 'value' })
    })

    it('應該支援對象', () => {
      const obj = { name: '測試', value: 42 }
      logger.log(obj)
      
      expect(consoleSpy.log).toHaveBeenCalledWith(obj)
    })
  })

  describe('error', () => {
    it('應該始終輸出錯誤訊息（不受環境影響）', () => {
      logger.error('錯誤訊息')
      
      expect(consoleSpy.error).toHaveBeenCalledWith('錯誤訊息')
    })

    it('應該支援 Error 對象', () => {
      const error = new Error('測試錯誤')
      logger.error('發生錯誤:', error)
      
      expect(consoleSpy.error).toHaveBeenCalledWith('發生錯誤:', error)
    })

    it('應該支援多個參數', () => {
      logger.error('錯誤:', 'details', { code: 500 })
      
      expect(consoleSpy.error).toHaveBeenCalledWith('錯誤:', 'details', { code: 500 })
    })
  })

  describe('warn', () => {
    it('應該輸出警告訊息', () => {
      logger.warn('警告訊息')
      
      expect(consoleSpy.warn).toHaveBeenCalled()
    })

    it('應該支援多個參數', () => {
      logger.warn('警告:', '詳細資訊')
      
      expect(consoleSpy.warn).toHaveBeenCalledWith('警告:', '詳細資訊')
    })
  })

  describe('debug', () => {
    it('應該輸出調試訊息', () => {
      logger.debug('調試訊息')
      
      expect(consoleSpy.debug).toHaveBeenCalled()
    })

    it('應該支援複雜對象', () => {
      const debugInfo = {
        timestamp: Date.now(),
        data: { nested: { value: 123 } }
      }
      logger.debug('調試資訊:', debugInfo)
      
      expect(consoleSpy.debug).toHaveBeenCalledWith('調試資訊:', debugInfo)
    })
  })

  describe('info', () => {
    it('應該輸出資訊訊息', () => {
      logger.info('資訊訊息')
      
      expect(consoleSpy.info).toHaveBeenCalled()
    })

    it('應該支援多個參數', () => {
      logger.info('操作成功', { id: 123, status: 'ok' })
      
      expect(consoleSpy.info).toHaveBeenCalledWith('操作成功', { id: 123, status: 'ok' })
    })
  })

  describe('不同類型的日誌', () => {
    it('應該能夠連續輸出不同類型的日誌', () => {
      logger.log('開始操作')
      logger.info('處理中')
      logger.warn('注意事項')
      logger.error('發生錯誤')
      logger.debug('調試資訊')

      expect(consoleSpy.log).toHaveBeenCalled()
      expect(consoleSpy.info).toHaveBeenCalled()
      expect(consoleSpy.warn).toHaveBeenCalled()
      expect(consoleSpy.error).toHaveBeenCalled()
      expect(consoleSpy.debug).toHaveBeenCalled()
    })
  })

  describe('邊緣情況', () => {
    it('應該處理空參數', () => {
      expect(() => {
        logger.log()
        logger.error()
        logger.warn()
        logger.debug()
        logger.info()
      }).not.toThrow()
    })

    it('應該處理 undefined', () => {
      logger.log(undefined)
      expect(consoleSpy.log).toHaveBeenCalledWith(undefined)
    })

    it('應該處理 null', () => {
      logger.error(null)
      expect(consoleSpy.error).toHaveBeenCalledWith(null)
    })

    it('應該處理空字串', () => {
      logger.warn('')
      expect(consoleSpy.warn).toHaveBeenCalledWith('')
    })

    it('應該處理很長的字串', () => {
      const longString = 'a'.repeat(10000)
      logger.log(longString)
      expect(consoleSpy.log).toHaveBeenCalledWith(longString)
    })

    it('應該處理循環引用的對象', () => {
      const obj: any = { name: '測試' }
      obj.self = obj // 創建循環引用

      expect(() => {
        logger.log(obj)
      }).not.toThrow()
    })

    it('應該處理 Symbol', () => {
      const sym = Symbol('test')
      logger.debug(sym)
      expect(consoleSpy.debug).toHaveBeenCalledWith(sym)
    })

    it('應該處理 BigInt', () => {
      const big = BigInt(9007199254740991)
      logger.log(big)
      expect(consoleSpy.log).toHaveBeenCalledWith(big)
    })
  })

  describe('實際使用場景', () => {
    it('應該記錄 API 請求', () => {
      const request = {
        method: 'GET',
        url: '/api/bookings',
        timestamp: Date.now()
      }
      logger.log('[API Request]', request)
      
      expect(consoleSpy.log).toHaveBeenCalledWith('[API Request]', request)
    })

    it('應該記錄錯誤堆疊', () => {
      const error = new Error('API 失敗')
      logger.error('[API Error]', error.message, error.stack)
      
      expect(consoleSpy.error).toHaveBeenCalled()
    })

    it('應該記錄性能資訊', () => {
      const startTime = Date.now()
      // 模擬操作
      const endTime = Date.now()
      logger.info('[Performance]', 'Operation took', endTime - startTime, 'ms')
      
      expect(consoleSpy.info).toHaveBeenCalled()
    })

    it('應該記錄使用者操作', () => {
      logger.log('[User Action]', 'Create booking', {
        user: 'test@example.com',
        timestamp: new Date().toISOString()
      })
      
      expect(consoleSpy.log).toHaveBeenCalled()
    })
  })
})
