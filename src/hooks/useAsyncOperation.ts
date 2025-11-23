import { useState, useCallback } from 'react'
import { handleError, handleSuccess } from '../utils/errorHandler'

interface UseAsyncOperationOptions {
  onSuccess?: (message?: string) => void
  onError?: (error: string) => void
  showSuccessAlert?: boolean
  showErrorAlert?: boolean
}

interface UseAsyncOperationReturn {
  loading: boolean
  error: string
  success: string
  execute: <T>(
    fn: () => Promise<T>,
    options?: {
      successMessage?: string
      errorContext?: string
      onComplete?: (result: T) => void
    }
  ) => Promise<T | null>
  setError: (error: string) => void
  setSuccess: (success: string) => void
  clearMessages: () => void
}

/**
 * 管理非同步操作的狀態（loading, error, success）
 * 
 * @example
 * ```tsx
 * const { loading, error, success, execute } = useAsyncOperation({
 *   showSuccessAlert: true
 * })
 * 
 * const handleSubmit = async () => {
 *   await execute(
 *     async () => {
 *       await supabase.from('table').insert(data)
 *     },
 *     {
 *       successMessage: '新增成功',
 *       errorContext: '新增資料',
 *       onComplete: () => {
 *         // 重新載入資料
 *       }
 *     }
 *   )
 * }
 * ```
 */
export function useAsyncOperation(
  options: UseAsyncOperationOptions = {}
): UseAsyncOperationReturn {
  const {
    onSuccess,
    onError,
    showSuccessAlert = true,
    showErrorAlert = true
  } = options

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const clearMessages = useCallback(() => {
    setError('')
    setSuccess('')
  }, [])

  const execute = useCallback(
    async <T,>(
      fn: () => Promise<T>,
      executeOptions?: {
        successMessage?: string
        errorContext?: string
        onComplete?: (result: T) => void
      }
    ): Promise<T | null> => {
      setLoading(true)
      clearMessages()

      try {
        const result = await fn()

        // 處理成功訊息
        if (executeOptions?.successMessage) {
          setSuccess(executeOptions.successMessage)
          if (showSuccessAlert) {
            handleSuccess(executeOptions.successMessage, true)
          }
          onSuccess?.(executeOptions.successMessage)
        }

        // 執行完成回調
        executeOptions?.onComplete?.(result)

        return result
      } catch (err: any) {
        // 處理錯誤
        const errorMessage = handleError(
          err,
          executeOptions?.errorContext,
          showErrorAlert
        )
        setError(errorMessage)
        onError?.(errorMessage)
        return null
      } finally {
        setLoading(false)
      }
    },
    [onSuccess, onError, showSuccessAlert, showErrorAlert, clearMessages]
  )

  return {
    loading,
    error,
    success,
    execute,
    setError,
    setSuccess,
    clearMessages
  }
}

