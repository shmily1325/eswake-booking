import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAsyncOperation } from './useAsyncOperation'
import { confirmAction } from '../utils/errorHandler'

interface UseCrudOptions<T> {
  tableName: string
  onDataChange?: () => void
  defaultOrderBy?: keyof T
  ascending?: boolean
}

interface UseCrudReturn<T, IdType = number | string> {
  data: T[]
  loading: boolean
  error: string
  success: string
  loadData: (filters?: Record<string, any>) => Promise<void>
  addItem: (item: Partial<T>, successMessage?: string) => Promise<T | null>
  updateItem: (id: IdType, updates: Partial<T>, successMessage?: string) => Promise<boolean>
  deleteItem: (id: IdType, confirmMessage?: string, successMessage?: string) => Promise<boolean>
  refreshData: () => Promise<void>
}

/**
 * 通用 CRUD Hook，用於管理資料表的 CRUD 操作
 * 
 * @example
 * ```tsx
 * interface Coach {
 *   id: string
 *   name: string
 *   status: string
 * }
 * 
 * const {
 *   data: coaches,
 *   loading,
 *   error,
 *   loadData,
 *   addItem,
 *   updateItem,
 *   deleteItem
 * } = useCrud<Coach, string>({
 *   tableName: 'coaches',
 *   defaultOrderBy: 'name',
 *   onDataChange: () => console.log('Data changed!')
 * })
 * 
 * // 載入資料
 * useEffect(() => {
 *   loadData()
 * }, [])
 * 
 * // 新增
 * await addItem({ name: '新教練', status: 'active' }, '新增成功')
 * 
 * // 更新
 * await updateItem('id-123', { status: 'inactive' }, '更新成功')
 * 
 * // 刪除
 * await deleteItem('id-123', '確定要刪除嗎？', '刪除成功')
 * ```
 */
export function useCrud<T extends Record<string, any>, IdType = number | string>(
  options: UseCrudOptions<T>
): UseCrudReturn<T, IdType> {
  const {
    tableName,
    onDataChange,
    defaultOrderBy,
    ascending = true
  } = options

  const [data, setData] = useState<T[]>([])
  const { loading, error, success, execute, setError } = useAsyncOperation({
    showSuccessAlert: true,
    showErrorAlert: true
  })

  /**
   * 載入資料
   */
  const loadData = useCallback(
    async (filters?: Record<string, any>) => {
      await execute(
        async () => {
          let query = supabase.from(tableName).select('*')

          // 套用篩選條件
          if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
              if (value !== undefined && value !== null) {
                query = query.eq(key, value)
              }
            })
          }

          // 套用排序
          if (defaultOrderBy) {
            query = query.order(defaultOrderBy as string, { ascending })
          }

          const { data: result, error } = await query

          if (error) throw error
          
          setData(result || [])
          return result
        },
        {
          errorContext: '載入資料'
        }
      )
    },
    [tableName, defaultOrderBy, ascending, execute]
  )

  /**
   * 重新載入資料
   */
  const refreshData = useCallback(async () => {
    await loadData()
    onDataChange?.()
  }, [loadData, onDataChange])

  /**
   * 新增項目
   */
  const addItem = useCallback(
    async (item: Partial<T>, successMessage?: string): Promise<T | null> => {
      const result = await execute(
        async () => {
          const { data, error } = await supabase
            .from(tableName)
            .insert([item as any])
            .select()
            .single()

          if (error) throw error

          return data as T
        },
        {
          successMessage: successMessage || '新增成功',
          errorContext: '新增資料',
          onComplete: () => {
            refreshData()
          }
        }
      )

      return result
    },
    [tableName, execute, refreshData]
  )

  /**
   * 更新項目
   */
  const updateItem = useCallback(
    async (
      id: IdType,
      updates: Partial<T>,
      successMessage?: string
    ): Promise<boolean> => {
      const result = await execute(
        async () => {
          const { error } = await supabase
            .from(tableName)
            .update(updates as any)
            .eq('id', id)

          if (error) throw error

          return true
        },
        {
          successMessage: successMessage || '更新成功',
          errorContext: '更新資料',
          onComplete: () => {
            refreshData()
          }
        }
      )

      return result !== null
    },
    [tableName, execute, refreshData]
  )

  /**
   * 刪除項目
   */
  const deleteItem = useCallback(
    async (
      id: IdType,
      confirmMessage?: string,
      successMessage?: string
    ): Promise<boolean> => {
      // 確認刪除
      if (confirmMessage && !confirmAction(confirmMessage)) {
        return false
      }

      const result = await execute(
        async () => {
          const { error } = await supabase
            .from(tableName)
            .delete()
            .eq('id', id)

          if (error) throw error

          return true
        },
        {
          successMessage: successMessage || '刪除成功',
          errorContext: '刪除資料',
          onComplete: () => {
            refreshData()
          }
        }
      )

      return result !== null
    },
    [tableName, execute, refreshData]
  )

  return {
    data,
    loading,
    error,
    success,
    loadData,
    addItem,
    updateItem,
    deleteItem,
    refreshData
  }
}

