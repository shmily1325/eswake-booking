import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  safeAccess,
  safeMapArray,
  validateAndLog,
  tryCatch,
  inspectData
} from '../debugHelpers'

describe('debugHelpers', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>
  let consoleLogSpy: ReturnType<typeof vi.spyOn>
  let consoleGroupSpy: ReturnType<typeof vi.spyOn>
  let consoleGroupEndSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleGroupSpy = vi.spyOn(console, 'group').mockImplementation(() => {})
    consoleGroupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('safeAccess', () => {
    it('應該成功訪問簡單屬性', () => {
      const obj = { name: 'Test', age: 25 }
      const result = safeAccess<string>(obj, 'name', 'test context')
      
      expect(result).toBe('Test')
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })

    it('應該成功訪問嵌套屬性', () => {
      const obj = { user: { profile: { name: 'John' } } }
      const result = safeAccess<string>(obj, 'user.profile.name', 'nested access')
      
      expect(result).toBe('John')
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })

    it('應該對 null 對象返回 null 並記錄錯誤', () => {
      const result = safeAccess<string>(null, 'name', 'null object')
      
      expect(result).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it('應該對 undefined 對象返回 null 並記錄錯誤', () => {
      const result = safeAccess<string>(undefined, 'name', 'undefined object')
      
      expect(result).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it('應該對不存在的屬性返回 undefined', () => {
      const obj = { name: 'Test' }
      const result = safeAccess<string>(obj, 'age', 'missing property')
      
      expect(result).toBeUndefined()
    })

    it('應該對中間為 null 的路徑返回 null 並記錄錯誤', () => {
      const obj = { user: null }
      const result = safeAccess<string>(obj, 'user.profile.name', 'null in path')
      
      expect(result).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it('應該處理數組訪問', () => {
      const obj = { items: ['a', 'b', 'c'] }
      const result = safeAccess<string>(obj, 'items.1', 'array access')
      
      expect(result).toBe('b')
    })

    it('應該捕獲並記錄訪問錯誤', () => {
      // 創建一個會拋出錯誤的 getter
      const obj = {}
      Object.defineProperty(obj, 'bad', {
        get() { throw new Error('Access error') }
      })
      
      const result = safeAccess<any>(obj, 'bad', 'error access')
      
      expect(result).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalled()
    })
  })

  describe('safeMapArray', () => {
    it('應該成功映射陣列', () => {
      const array = [1, 2, 3]
      const result = safeMapArray(array, (item) => item * 2, 'double')
      
      expect(result).toEqual([2, 4, 6])
      expect(consoleWarnSpy).not.toHaveBeenCalled()
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })

    it('應該對 null 陣列返回空陣列並警告', () => {
      const result = safeMapArray(null, (item) => item, 'null array')
      
      expect(result).toEqual([])
      expect(consoleWarnSpy).toHaveBeenCalled()
    })

    it('應該對 undefined 陣列返回空陣列並警告', () => {
      const result = safeMapArray(undefined, (item) => item, 'undefined array')
      
      expect(result).toEqual([])
      expect(consoleWarnSpy).toHaveBeenCalled()
    })

    it('應該跳過 null 項目並警告', () => {
      const array = [1, null, 3]
      const result = safeMapArray(array, (item) => item * 2, 'with null')
      
      expect(result).toEqual([2, 6])
      expect(consoleWarnSpy).toHaveBeenCalled()
    })

    it('應該跳過 undefined 項目並警告', () => {
      const array = [1, undefined, 3]
      const result = safeMapArray(array, (item) => item * 2, 'with undefined')
      
      expect(result).toEqual([2, 6])
      expect(consoleWarnSpy).toHaveBeenCalled()
    })

    it('應該捕獲映射函數中的錯誤', () => {
      const array = [1, 2, 3]
      const result = safeMapArray(
        array,
        (item) => {
          if (item === 2) throw new Error('Mapping error')
          return item * 2
        },
        'with error'
      )
      
      expect(result).toEqual([2, 6])
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it('應該保留映射函數的索引參數', () => {
      const array = ['a', 'b', 'c']
      const result = safeMapArray(
        array,
        (item, index) => `${index}:${item}`,
        'with index'
      )
      
      expect(result).toEqual(['0:a', '1:b', '2:c'])
    })

    it('應該處理複雜對象的映射', () => {
      const array = [
        { name: 'John', age: 25 },
        { name: 'Jane', age: 30 }
      ]
      const result = safeMapArray(array, (item) => item.name, 'extract names')
      
      expect(result).toEqual(['John', 'Jane'])
    })
  })

  describe('validateAndLog', () => {
    it('應該對有效數據返回 true', () => {
      const data = { name: 'Test', age: 25 }
      const validator = (item: any) => item.name && item.age > 0
      
      const result = validateAndLog(data, validator, 'valid data')
      
      expect(result).toBe(true)
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })

    it('應該對無效數據返回 false 並記錄錯誤', () => {
      const data = { name: '', age: -1 }
      const validator = (item: any) => !!(item.name && item.age > 0)
      
      const result = validateAndLog(data, validator, 'invalid data')
      
      expect(result).toBe(false)
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it('應該記錄數據類型', () => {
      const data = 'test string'
      const validator = () => false
      
      validateAndLog(data, validator, 'string data')
      
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it('應該記錄對象的鍵', () => {
      const data = { a: 1, b: 2, c: 3 }
      const validator = () => false
      
      validateAndLog(data, validator, 'object data')
      
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it('應該處理 null 數據', () => {
      const validator = (item: any) => item !== null
      
      const result = validateAndLog(null, validator, 'null data')
      
      expect(result).toBe(false)
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it('應該處理陣列數據', () => {
      const data = [1, 2, 3]
      const validator = (item: any) => Array.isArray(item) && item.length > 0
      
      const result = validateAndLog(data, validator, 'array data')
      
      expect(result).toBe(true)
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })
  })

  describe('tryCatch', () => {
    it('應該執行函數並返回結果', () => {
      const fn = () => 'success'
      const result = tryCatch(fn, 'test', 'fallback')
      
      expect(result).toBe('success')
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })

    it('應該捕獲錯誤並返回 fallback', () => {
      const fn = () => { throw new Error('test error') }
      const result = tryCatch(fn, 'error test', 'fallback')
      
      expect(result).toBe('fallback')
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it('應該記錄錯誤訊息和堆疊', () => {
      const error = new Error('specific error')
      const fn = () => { throw error }
      
      tryCatch(fn, 'logged error', null)
      
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it('應該處理非 Error 類型的拋出', () => {
      const fn = () => { throw 'string error' }
      const result = tryCatch(fn, 'string error', 'fallback')
      
      expect(result).toBe('fallback')
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it('應該支援不同類型的 fallback', () => {
      const fn = () => { throw new Error() }
      
      expect(tryCatch(fn, 'test', null)).toBeNull()
      expect(tryCatch(fn, 'test', 0)).toBe(0)
      expect(tryCatch(fn, 'test', [])).toEqual([])
      expect(tryCatch(fn, 'test', {})).toEqual({})
    })

    it('應該處理異步操作中的錯誤（如果函數返回 Promise）', () => {
      const fn = () => Promise.resolve('async success')
      const result = tryCatch(fn, 'async', null)
      
      expect(result).toBeInstanceOf(Promise)
    })
  })

  describe('inspectData', () => {
    it('應該檢查簡單值', () => {
      inspectData('test string', 'string value')
      
      expect(consoleGroupSpy).toHaveBeenCalledWith('[Data Inspector] string value')
      expect(consoleLogSpy).toHaveBeenCalledWith('Type:', 'string')
      expect(consoleGroupEndSpy).toHaveBeenCalled()
    })

    it('應該檢查陣列', () => {
      const array = [1, 2, 3]
      inspectData(array, 'test array')
      
      expect(consoleLogSpy).toHaveBeenCalledWith('Is array:', true)
      expect(consoleLogSpy).toHaveBeenCalledWith('Array length:', 3)
    })

    it('應該檢查包含 null 項目的陣列', () => {
      const array = [1, null, 3]
      inspectData(array, 'array with null')
      
      expect(consoleLogSpy).toHaveBeenCalledWith('Has null items:', true)
    })

    it('應該檢查包含 undefined 項目的陣列', () => {
      const array = [1, undefined, 3]
      inspectData(array, 'array with undefined')
      
      expect(consoleLogSpy).toHaveBeenCalledWith('Has undefined items:', true)
    })

    it('應該檢查對象', () => {
      const obj = { name: 'Test', age: 25, city: 'Tokyo' }
      inspectData(obj, 'test object')
      
      expect(consoleLogSpy).toHaveBeenCalledWith('Keys:', ['name', 'age', 'city'])
    })

    it('應該檢查 null', () => {
      inspectData(null, 'null value')
      
      expect(consoleLogSpy).toHaveBeenCalledWith('Is null:', true)
    })

    it('應該檢查 undefined', () => {
      inspectData(undefined, 'undefined value')
      
      expect(consoleLogSpy).toHaveBeenCalledWith('Is undefined:', true)
    })

    it('應該限制對象的值樣本', () => {
      const obj = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 }
      inspectData(obj, 'large object')
      
      // 應該只顯示前 5 個
      expect(consoleLogSpy).toHaveBeenCalled()
    })

    it('應該限制陣列的樣本', () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      inspectData(array, 'large array')
      
      // 應該只顯示前 3 個
      expect(consoleLogSpy).toHaveBeenCalled()
    })
  })

  describe('實際使用場景', () => {
    it('應該安全地訪問 API 響應中的嵌套數據', () => {
      const apiResponse = {
        data: {
          user: {
            profile: {
              email: 'test@example.com'
            }
          }
        }
      }
      
      const email = safeAccess<string>(apiResponse, 'data.user.profile.email', 'API response')
      
      expect(email).toBe('test@example.com')
    })

    it('應該安全地映射不完整的資料', () => {
      const bookings = [
        { id: 1, member: { name: 'John' } },
        { id: 2, member: null },
        { id: 3, member: { name: 'Jane' } }
      ]
      
      const names = safeMapArray(
        bookings,
        (booking) => {
          const name = safeAccess<string>(booking, 'member.name', 'booking member')
          return name || 'Unknown'
        },
        'extract member names'
      )
      
      expect(names).toEqual(['John', 'Unknown', 'Jane'])
    })

    it('應該在數據處理管道中使用 tryCatch', () => {
      const processData = (data: any) => {
        return tryCatch(
          () => JSON.parse(data),
          'parse JSON',
          null
        )
      }
      
      expect(processData('{"valid": true}')).toEqual({ valid: true })
      expect(processData('invalid json')).toBeNull()
    })
  })
})
