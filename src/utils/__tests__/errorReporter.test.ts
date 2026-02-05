import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { wrapWithErrorReport, resetErrorCount } from '../errorReporter'

describe('errorReporter', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>
  let consoleLogSpy: ReturnType<typeof vi.spyOn>
  let consoleGroupSpy: ReturnType<typeof vi.spyOn>
  let consoleGroupEndSpy: ReturnType<typeof vi.spyOn>
  let consoleTraceSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // 每個測試前重置錯誤計數器
    resetErrorCount()
    
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleGroupSpy = vi.spyOn(console, 'group').mockImplementation(() => {})
    consoleGroupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {})
    consoleTraceSpy = vi.spyOn(console, 'trace').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('wrapWithErrorReport', () => {
    it('應該執行成功的操作並返回結果', () => {
      const operation = () => 'success'
      const result = wrapWithErrorReport(operation, {
        component: 'TestComponent',
        operation: 'testOperation'
      })
      
      expect(result).toBe('success')
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })

    it('應該捕獲錯誤並返回 null', () => {
      const operation = () => { throw new Error('test error') }
      const result = wrapWithErrorReport(operation, {
        component: 'TestComponent',
        operation: 'failingOperation'
      })
      
      expect(result).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it('應該記錄錯誤訊息', () => {
      const errorMessage = 'Specific error message'
      const operation = () => { throw new Error(errorMessage) }
      
      wrapWithErrorReport(operation, {
        component: 'MyComponent',
        operation: 'doSomething'
      })
      
      expect(consoleErrorSpy).toHaveBeenCalled()
      expect(consoleErrorSpy.mock.calls.some(call => 
        call.some(arg => typeof arg === 'string' && arg.includes(errorMessage))
      )).toBe(true)
    })

    it('應該記錄錯誤堆疊', () => {
      const operation = () => { throw new Error('error with stack') }
      
      wrapWithErrorReport(operation, {
        component: 'MyComponent',
        operation: 'doSomething'
      })
      
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it('應該在錯誤組中記錄上下文', () => {
      const operation = () => { throw new Error('error') }
      
      wrapWithErrorReport(operation, {
        component: 'MyComponent',
        operation: 'myOperation',
        data: { id: 123, name: 'test' }
      })
      
      expect(consoleGroupSpy).toHaveBeenCalled()
      expect(consoleLogSpy).toHaveBeenCalledWith('Context:', expect.objectContaining({
        component: 'MyComponent',
        operation: 'myOperation',
        data: { id: 123, name: 'test' }
      }))
      expect(consoleGroupEndSpy).toHaveBeenCalled()
    })

    it('應該記錄數據（如果提供）', () => {
      const operation = () => { throw new Error('error') }
      const testData = { userId: 1, action: 'create' }
      
      wrapWithErrorReport(operation, {
        component: 'UserManager',
        operation: 'createUser',
        data: testData
      })
      
      expect(consoleLogSpy).toHaveBeenCalledWith('Data:', testData)
    })

    it('不應該記錄數據（如果未提供）', () => {
      const operation = () => { throw new Error('error') }
      
      wrapWithErrorReport(operation, {
        component: 'MyComponent',
        operation: 'myOperation'
      })
      
      // 檢查沒有 'Data:' 的 log
      const dataLogs = consoleLogSpy.mock.calls.filter(call => 
        call[0] === 'Data:'
      )
      expect(dataLogs).toHaveLength(0)
    })

    it('應該為 null 訪問錯誤提供額外資訊', () => {
      const operation = () => {
        const obj: any = null
        return obj.property // 這會拋出 "Cannot read properties of null" 錯誤
      }
      
      wrapWithErrorReport(operation, {
        component: 'NullAccessComponent',
        operation: 'accessProperty'
      })
      
      expect(consoleErrorSpy).toHaveBeenCalled()
      expect(consoleTraceSpy).toHaveBeenCalled()
    })

    it('應該增加錯誤計數', () => {
      const operation = () => { throw new Error('error 1') }
      
      wrapWithErrorReport(operation, { component: 'A', operation: 'op1' })
      
      // 檢查錯誤編號
      expect(consoleGroupSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Error #1]')
      )
      
      wrapWithErrorReport(operation, { component: 'B', operation: 'op2' })
      
      expect(consoleGroupSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Error #2]')
      )
    })

    it('應該在達到最大錯誤數後停止記錄', () => {
      const operation = () => { throw new Error('repeated error') }
      
      // 執行 12 次（超過 MAX_ERRORS = 10）
      for (let i = 0; i < 12; i++) {
        wrapWithErrorReport(operation, {
          component: 'TestComponent',
          operation: `operation${i}`
        })
      }
      
      // 前 10 次應該記錄，後 2 次應該直接返回 null
      expect(consoleGroupSpy).toHaveBeenCalledTimes(10)
    })

    it('resetErrorCount 應該重置錯誤計數器', () => {
      const operation = () => { throw new Error('error') }
      
      // 產生一些錯誤
      wrapWithErrorReport(operation, { component: 'A', operation: 'op' })
      wrapWithErrorReport(operation, { component: 'B', operation: 'op' })
      
      // 重置
      resetErrorCount()
      
      // 再次產生錯誤，應該從 #1 開始
      wrapWithErrorReport(operation, { component: 'C', operation: 'op' })
      
      const calls = consoleGroupSpy.mock.calls
      const lastCall = calls[calls.length - 1][0]
      expect(lastCall).toContain('[Error #1]')
    })

    it('應該處理非 Error 對象的拋出', () => {
      const operation = () => { throw 'string error' }
      
      const result = wrapWithErrorReport(operation, {
        component: 'StringErrorComponent',
        operation: 'throwString'
      })
      
      expect(result).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it('應該處理返回各種類型的操作', () => {
      expect(wrapWithErrorReport(() => 42, {
        component: 'A',
        operation: 'number'
      })).toBe(42)
      
      expect(wrapWithErrorReport(() => 'text', {
        component: 'A',
        operation: 'string'
      })).toBe('text')
      
      expect(wrapWithErrorReport(() => ({ key: 'value' }), {
        component: 'A',
        operation: 'object'
      })).toEqual({ key: 'value' })
      
      expect(wrapWithErrorReport(() => [1, 2, 3], {
        component: 'A',
        operation: 'array'
      })).toEqual([1, 2, 3])
      
      expect(wrapWithErrorReport(() => true, {
        component: 'A',
        operation: 'boolean'
      })).toBe(true)
    })
  })

  describe('實際使用場景', () => {
    it('應該安全地執行 API 請求', () => {
      const fetchData = () => {
        // 模擬 API 調用
        return { data: 'success' }
      }
      
      const result = wrapWithErrorReport(fetchData, {
        component: 'DataService',
        operation: 'fetchBookings',
        data: { userId: 123 }
      })
      
      expect(result).toEqual({ data: 'success' })
    })

    it('應該捕獲 JSON 解析錯誤', () => {
      const parseJSON = () => JSON.parse('invalid json')
      
      const result = wrapWithErrorReport(parseJSON, {
        component: 'JSONParser',
        operation: 'parse',
        data: { input: 'invalid json' }
      })
      
      expect(result).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it('應該捕獲數組操作錯誤', () => {
      const processArray = () => {
        const arr: any = null
        return arr.map((x: any) => x * 2)
      }
      
      const result = wrapWithErrorReport(processArray, {
        component: 'ArrayProcessor',
        operation: 'mapArray'
      })
      
      expect(result).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it('應該捕獲對象訪問錯誤', () => {
      const accessProperty = () => {
        const obj: any = { user: null }
        return obj.user.name
      }
      
      const result = wrapWithErrorReport(accessProperty, {
        component: 'UserManager',
        operation: 'getName',
        data: { userId: 456 }
      })
      
      expect(result).toBeNull()
      expect(consoleTraceSpy).toHaveBeenCalled() // 因為是 null 訪問錯誤
    })
  })

  describe('resetErrorCount', () => {
    it('應該重置錯誤計數器', () => {
      const operation = () => { throw new Error('error') }
      
      // 產生幾個錯誤
      for (let i = 0; i < 5; i++) {
        wrapWithErrorReport(operation, {
          component: 'TestComponent',
          operation: `operation${i}`
        })
      }
      
      // 重置
      resetErrorCount()
      
      // 應該能再次記錄 10 個錯誤
      consoleGroupSpy.mockClear()
      
      for (let i = 0; i < 11; i++) {
        wrapWithErrorReport(operation, {
          component: 'TestComponent',
          operation: `operation${i}`
        })
      }
      
      // 應該記錄 10 個（第 11 個超過限制）
      expect(consoleGroupSpy).toHaveBeenCalledTimes(10)
    })

    it('應該允許多次重置', () => {
      expect(() => {
        resetErrorCount()
        resetErrorCount()
        resetErrorCount()
      }).not.toThrow()
    })
  })
})
