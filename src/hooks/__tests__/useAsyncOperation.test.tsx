import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAsyncOperation } from '../useAsyncOperation'

// Mock toast first (needed by errorHandler)
vi.mock('../../utils/toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn()
  }
}))

// Mock errorHandler
vi.mock('../../utils/errorHandler', () => ({
  handleError: vi.fn(),
  handleSuccess: vi.fn()
}))

// Import the mocked module
import * as errorHandler from '../../utils/errorHandler'

describe('useAsyncOperation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup handleError mock implementation
    vi.mocked(errorHandler.handleError).mockImplementation((error: any, context?: string, showAlert?: boolean) => {
      // 提取錯誤訊息
      let message = '錯誤'
      if (error instanceof Error && error.message) {
        message = error.message
      } else if (typeof error === 'string') {
        message = error
      } else if (error?.message) {
        message = error.message
      }
      
      // 組合完整訊息
      const fullMessage = context ? `${context}失敗：${message}` : message
      return fullMessage
    })
  })

  describe('初始狀態', () => {
    it('應該返回初始狀態', () => {
      const { result } = renderHook(() => useAsyncOperation())
      
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBe('')
      expect(result.current.success).toBe('')
      expect(typeof result.current.execute).toBe('function')
      expect(typeof result.current.setError).toBe('function')
      expect(typeof result.current.setSuccess).toBe('function')
      expect(typeof result.current.clearMessages).toBe('function')
    })
  })

  describe('execute - 成功情況', () => {
    it('應該執行成功的操作', async () => {
      const { result } = renderHook(() => useAsyncOperation())
      
      let executedResult: string | null = null
      
      await act(async () => {
        executedResult = await result.current.execute(async () => 'success')
      })
      
      expect(executedResult).toBe('success')
      expect(result.current.loading).toBe(false)
    })

    it('應該在執行期間設置 loading 為 true', async () => {
      const { result } = renderHook(() => useAsyncOperation())
      
      const slowOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return 'done'
      }
      
      // 檢查初始狀態
      expect(result.current.loading).toBe(false)
      
      // 啟動操作但不等待
      let executePromise: Promise<any>
      act(() => {
        executePromise = result.current.execute(slowOperation)
      })
      
      // loading 應該立即變成 true（同步部分已執行）
      expect(result.current.loading).toBe(true)
      
      // 等待操作完成
      await act(async () => {
        await executePromise!
      })
      
      // 完成後應該是 false
      expect(result.current.loading).toBe(false)
    })

    it('應該設置成功訊息', async () => {
      const { result } = renderHook(() => useAsyncOperation())
      
      await act(async () => {
        await result.current.execute(
          async () => 'result',
          { successMessage: '操作成功' }
        )
      })
      
      expect(result.current.success).toBe('操作成功')
      expect(result.current.error).toBe('')
    })

    it('應該調用 onComplete 回調', async () => {
      const { result } = renderHook(() => useAsyncOperation())
      const onComplete = vi.fn()
      
      await act(async () => {
        await result.current.execute(
          async () => ({ id: 123, name: 'test' }),
          { onComplete }
        )
      })
      
      expect(onComplete).toHaveBeenCalledWith({ id: 123, name: 'test' })
    })

    it('應該調用全局 onSuccess 回調', async () => {
      const onSuccess = vi.fn()
      const { result } = renderHook(() => useAsyncOperation({ onSuccess }))
      
      await act(async () => {
        await result.current.execute(
          async () => 'result',
          { successMessage: '成功' }
        )
      })
      
      expect(onSuccess).toHaveBeenCalledWith('成功')
    })

    it('應該返回操作結果', async () => {
      const { result } = renderHook(() => useAsyncOperation())
      
      let executedResult: any
      
      await act(async () => {
        executedResult = await result.current.execute(async () => {
          return { data: 'test data', count: 42 }
        })
      })
      
      expect(executedResult).toEqual({ data: 'test data', count: 42 })
    })
  })

  describe('execute - 錯誤情況', () => {
    it('應該捕獲並處理錯誤', async () => {
      const { result } = renderHook(() => useAsyncOperation())
      
      let executedResult: any
      
      await act(async () => {
        executedResult = await result.current.execute(async () => {
          throw new Error('操作失敗')
        })
      })
      
      expect(executedResult).toBeNull()
      expect(result.current.error).toBe('操作失敗')
      expect(result.current.success).toBe('')
      expect(result.current.loading).toBe(false)
    })

    it('應該調用全局 onError 回調', async () => {
      const onError = vi.fn()
      const { result } = renderHook(() => useAsyncOperation({ onError }))
      
      await act(async () => {
        await result.current.execute(async () => {
          throw new Error('錯誤訊息')
        })
      })
      
      expect(onError).toHaveBeenCalledWith('錯誤訊息')
    })

    it('應該處理非 Error 類型的拋出', async () => {
      const { result } = renderHook(() => useAsyncOperation())
      
      await act(async () => {
        await result.current.execute(async () => {
          throw 'string error'
        })
      })
      
      expect(result.current.error).toBe('string error')
      expect(result.current.loading).toBe(false)
    })

    it('執行錯誤後 loading 應該變回 false', async () => {
      const { result } = renderHook(() => useAsyncOperation())
      
      await act(async () => {
        await result.current.execute(async () => {
          throw new Error('error')
        })
      })
      
      expect(result.current.loading).toBe(false)
    })
  })

  describe('clearMessages', () => {
    it('應該清除錯誤和成功訊息', async () => {
      const { result } = renderHook(() => useAsyncOperation())
      
      // 設置成功訊息
      await act(async () => {
        await result.current.execute(
          async () => 'result',
          { successMessage: '成功' }
        )
      })
      
      expect(result.current.success).toBe('成功')
      
      // 清除訊息
      act(() => {
        result.current.clearMessages()
      })
      
      expect(result.current.success).toBe('')
      expect(result.current.error).toBe('')
    })

    it('execute 時應該自動清除之前的訊息', async () => {
      const { result } = renderHook(() => useAsyncOperation())
      
      // 第一次操作 - 成功
      await act(async () => {
        await result.current.execute(
          async () => 'result1',
          { successMessage: '第一次成功' }
        )
      })
      
      expect(result.current.success).toBe('第一次成功')
      
      // 第二次操作 - 應該清除之前的訊息
      await act(async () => {
        await result.current.execute(async () => 'result2')
      })
      
      expect(result.current.success).toBe('')
    })
  })

  describe('setError 和 setSuccess', () => {
    it('應該允許手動設置錯誤訊息', () => {
      const { result } = renderHook(() => useAsyncOperation())
      
      act(() => {
        result.current.setError('手動錯誤')
      })
      
      expect(result.current.error).toBe('手動錯誤')
    })

    it('應該允許手動設置成功訊息', () => {
      const { result } = renderHook(() => useAsyncOperation())
      
      act(() => {
        result.current.setSuccess('手動成功')
      })
      
      expect(result.current.success).toBe('手動成功')
    })
  })

  describe('options 配置', () => {
    it('應該支援禁用成功提示', async () => {
      const { handleSuccess } = await import('../../utils/errorHandler')
      
      const { result } = renderHook(() => 
        useAsyncOperation({ showSuccessAlert: false })
      )
      
      await act(async () => {
        await result.current.execute(
          async () => 'result',
          { successMessage: '成功' }
        )
      })
      
      expect(result.current.success).toBe('成功')
      expect(handleSuccess).not.toHaveBeenCalled()
    })

    it('應該支援禁用錯誤提示', async () => {
      const { handleError } = await import('../../utils/errorHandler')
      vi.mocked(handleError).mockReturnValue('錯誤')
      
      const { result } = renderHook(() => 
        useAsyncOperation({ showErrorAlert: false })
      )
      
      await act(async () => {
        await result.current.execute(async () => {
          throw new Error('錯誤')
        })
      })
      
      expect(handleError).toHaveBeenCalledWith(
        expect.any(Error),
        undefined,
        false
      )
    })
  })

  describe('併發執行', () => {
    it('應該能夠連續執行多個操作', async () => {
      const { result } = renderHook(() => useAsyncOperation())
      
      let result1: any, result2: any, result3: any
      
      await act(async () => {
        result1 = await result.current.execute(async () => 'op1')
      })
      
      await act(async () => {
        result2 = await result.current.execute(async () => 'op2')
      })
      
      await act(async () => {
        result3 = await result.current.execute(async () => 'op3')
      })
      
      expect(result1).toBe('op1')
      expect(result2).toBe('op2')
      expect(result3).toBe('op3')
    })

    it('後續操作應該清除前一個操作的訊息', async () => {
      const { result } = renderHook(() => useAsyncOperation())
      
      // 第一個操作 - 成功
      await act(async () => {
        await result.current.execute(
          async () => 'result1',
          { successMessage: '第一次成功' }
        )
      })
      expect(result.current.success).toBe('第一次成功')
      
      // 第二個操作 - 失敗
      await act(async () => {
        await result.current.execute(
          async () => {
            throw new Error('第二次失敗')
          },
          { errorContext: '第二次操作' }
        )
      })
      
      expect(result.current.success).toBe('')
      // handleError mock 會返回帶 context 的完整訊息
      expect(result.current.error).toBe('第二次操作失敗：第二次失敗')
    })
  })

  describe('實際使用場景', () => {
    it('應該用於表單提交', async () => {
      const { result } = renderHook(() => useAsyncOperation())
      const onComplete = vi.fn()
      
      await act(async () => {
        await result.current.execute(
          async () => {
            // 模擬 API 調用
            await new Promise(resolve => setTimeout(resolve, 10))
            return { id: 1, created: true }
          },
          {
            successMessage: '新增成功',
            errorContext: '新增預約',
            onComplete
          }
        )
      })
      
      expect(result.current.success).toBe('新增成功')
      expect(onComplete).toHaveBeenCalledWith({ id: 1, created: true })
    })

    it('應該用於刪除操作', async () => {
      const { result } = renderHook(() => useAsyncOperation())
      
      await act(async () => {
        await result.current.execute(
          async () => {
            // 模擬刪除
            return { deleted: true }
          },
          {
            successMessage: '刪除成功',
            errorContext: '刪除預約'
          }
        )
      })
      
      expect(result.current.success).toBe('刪除成功')
    })

    it('應該用於更新操作', async () => {
      const { result } = renderHook(() => useAsyncOperation())
      
      await act(async () => {
        await result.current.execute(
          async () => ({ updated: true }),
          { successMessage: '更新成功' }
        )
      })
      
      expect(result.current.success).toBe('更新成功')
    })
  })

  describe('邊緣情況', () => {
    it('應該處理返回 null 的操作', async () => {
      const { result } = renderHook(() => useAsyncOperation())
      
      let executedResult: any
      
      await act(async () => {
        executedResult = await result.current.execute(async () => null)
      })
      
      expect(executedResult).toBeNull()
      expect(result.current.error).toBe('')
    })

    it('應該處理返回 undefined 的操作', async () => {
      const { result } = renderHook(() => useAsyncOperation())
      
      let executedResult: any
      
      await act(async () => {
        executedResult = await result.current.execute(async () => undefined)
      })
      
      expect(executedResult).toBeUndefined()
    })

    it('應該處理返回 0 的操作', async () => {
      const { result } = renderHook(() => useAsyncOperation())
      
      let executedResult: any
      
      await act(async () => {
        executedResult = await result.current.execute(async () => 0)
      })
      
      expect(executedResult).toBe(0)
    })

    it('應該處理返回 false 的操作', async () => {
      const { result } = renderHook(() => useAsyncOperation())
      
      let executedResult: any
      
      await act(async () => {
        executedResult = await result.current.execute(async () => false)
      })
      
      expect(executedResult).toBe(false)
    })

    it('應該處理沒有 successMessage 的成功操作', async () => {
      const { result } = renderHook(() => useAsyncOperation())
      
      await act(async () => {
        await result.current.execute(async () => 'result')
      })
      
      expect(result.current.success).toBe('')
      expect(result.current.error).toBe('')
    })

    it('應該處理沒有 errorContext 的錯誤操作', async () => {
      const { result } = renderHook(() => useAsyncOperation())
      
      await act(async () => {
        await result.current.execute(async () => {
          throw new Error('錯誤')
        })
      })
      
      expect(result.current.error).toBe('錯誤')
    })
  })

  describe('onComplete 回調時機', () => {
    it('onComplete 應該在 loading 結束後才執行', async () => {
      const { result } = renderHook(() => useAsyncOperation())
      let loadingWhenCompleted: boolean | undefined
      
      await act(async () => {
        await result.current.execute(
          async () => 'result',
          {
            onComplete: () => {
              loadingWhenCompleted = result.current.loading
            }
          }
        )
      })
      
      // onComplete 執行時，loading 應該已經是 false
      expect(loadingWhenCompleted).toBe(false)
    })

    it('錯誤時不應該調用 onComplete', async () => {
      const { result } = renderHook(() => useAsyncOperation())
      const onComplete = vi.fn()
      
      await act(async () => {
        await result.current.execute(
          async () => {
            throw new Error('error')
          },
          { onComplete }
        )
      })
      
      expect(onComplete).not.toHaveBeenCalled()
    })
  })

  describe('多個 hook 實例', () => {
    it('多個實例應該獨立工作', async () => {
      const { result: result1 } = renderHook(() => useAsyncOperation())
      const { result: result2 } = renderHook(() => useAsyncOperation())
      
      await act(async () => {
        await result1.current.execute(
          async () => 'success',
          { successMessage: '成功 1' }
        )
      })
      
      await act(async () => {
        await result2.current.execute(
          async () => {
            throw new Error('失敗 2')
          },
          { errorContext: '操作 2' }
        )
      })
      
      expect(result1.current.success).toBe('成功 1')
      expect(result1.current.error).toBe('')
      
      expect(result2.current.success).toBe('')
      // handleError mock 會返回帶 context 的完整訊息
      expect(result2.current.error).toBe('操作 2失敗：失敗 2')
    })
  })

  describe('複雜操作', () => {
    it('應該處理需要多步驟的操作', async () => {
      const { result } = renderHook(() => useAsyncOperation())
      const steps: string[] = []
      
      await act(async () => {
        await result.current.execute(
          async () => {
            steps.push('step1')
            await new Promise(resolve => setTimeout(resolve, 10))
            steps.push('step2')
            await new Promise(resolve => setTimeout(resolve, 10))
            steps.push('step3')
            return steps
          },
          {
            successMessage: '多步驟完成',
            onComplete: (result) => {
              steps.push('completed')
            }
          }
        )
      })
      
      expect(steps).toEqual(['step1', 'step2', 'step3', 'completed'])
      expect(result.current.success).toBe('多步驟完成')
    })

    it('應該處理帶有條件判斷的操作', async () => {
      const { result } = renderHook(() => useAsyncOperation())
      
      const checkAndUpdate = async (value: number) => {
        if (value < 0) {
          throw new Error('值不能為負數')
        }
        if (value > 100) {
          throw new Error('值不能超過 100')
        }
        return { value, valid: true }
      }
      
      // 正常值
      let res1: any
      await act(async () => {
        res1 = await result.current.execute(
          async () => checkAndUpdate(50),
          { successMessage: '驗證成功' }
        )
      })
      expect(res1).toEqual({ value: 50, valid: true })
      
      // 負數
      let res2: any
      await act(async () => {
        res2 = await result.current.execute(
          async () => checkAndUpdate(-1),
          { errorContext: '驗證' }
        )
      })
      expect(res2).toBeNull()
      expect(result.current.error).toBe('驗證失敗：值不能為負數')
      
      // 超過 100
      let res3: any
      await act(async () => {
        res3 = await result.current.execute(
          async () => checkAndUpdate(150),
          { errorContext: '驗證' }
        )
      })
      expect(res3).toBeNull()
      expect(result.current.error).toBe('驗證失敗：值不能超過 100')
    })
  })

  describe('Alert 顯示控制', () => {
    it('showSuccessAlert 為 true 時應該顯示成功提示', async () => {
      const { handleSuccess } = await import('../../utils/errorHandler')
      
      const { result } = renderHook(() => 
        useAsyncOperation({ showSuccessAlert: true })
      )
      
      await act(async () => {
        await result.current.execute(
          async () => 'result',
          { successMessage: '成功訊息' }
        )
      })
      
      expect(handleSuccess).toHaveBeenCalledWith('成功訊息', true)
    })

    it('showErrorAlert 為 true 時應該顯示錯誤提示', async () => {
      const { handleError } = await import('../../utils/errorHandler')
      
      const { result } = renderHook(() => 
        useAsyncOperation({ showErrorAlert: true })
      )
      
      await act(async () => {
        await result.current.execute(async () => {
          throw new Error('錯誤訊息')
        })
      })
      
      expect(handleError).toHaveBeenCalledWith(
        expect.any(Error),
        undefined,
        true
      )
    })
  })
})
