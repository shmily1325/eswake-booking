import { supabase } from '../lib/supabase'

/** Supabase PostgREST 單次回應列數上限 */
export const SUPABASE_PAGE_SIZE = 1000

/** `.in(...)` 每批 ID 數，避免 filter 過大 */
export const IN_FILTER_BATCH_SIZE = 250

export type SupabasePageResult<T> = {
  data: T[] | null
  error: { message: string } | null
}

export function chunkArray<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr]
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

/**
 * 分頁取完所有列（僅補齊 Supabase 1000 筆上限，不改查詢條件與排序）
 */
export async function fetchAllPaginated<T>(
  fetchPage: (from: number, to: number) => PromiseLike<SupabasePageResult<T>>
): Promise<T[]> {
  const all: T[] = []
  let offset = 0

  while (true) {
    const { data, error } = await fetchPage(offset, offset + SUPABASE_PAGE_SIZE - 1)
    if (error) {
      throw new Error(error.message)
    }

    const rows = data ?? []
    if (rows.length === 0) break

    all.push(...rows)
    if (rows.length < SUPABASE_PAGE_SIZE) break
    offset += SUPABASE_PAGE_SIZE
  }

  return all
}

type FilterableQuery = {
  eq: (column: string, value: unknown) => FilterableQuery
}

/**
 * 依 booking_id 批次 + 分頁載入關聯列（CoachReport 全部未回報等）
 */
export async function fetchAllByBookingIds<T>(
  table: string,
  select: string,
  bookingIds: number[],
  orderColumn: string,
  applyFilters?: (query: FilterableQuery) => FilterableQuery,
  errorLabel = table
): Promise<T[]> {
  if (bookingIds.length === 0) return []

  const batches = chunkArray(bookingIds, IN_FILTER_BATCH_SIZE)
  const batchResults = await Promise.all(
    batches.map((batch) =>
      fetchAllPaginated<T>(async (from, to) => {
        let query = (supabase.from(table as never) as ReturnType<typeof supabase.from>)
          .select(select)
          .in('booking_id', batch)

        if (applyFilters) {
          query = applyFilters(query as FilterableQuery) as typeof query
        }

        const { data, error } = await query.order(orderColumn, { ascending: true }).range(from, to)
        if (error) {
          throw new Error(`${errorLabel} 查詢失敗: ${error.message}`)
        }
        return { data: data as T[] | null, error: null }
      })
    )
  )

  return batchResults.flat()
}

/**
 * 依任意欄位 `.in()` 批次 + 分頁（交易、代扣關係等）
 */
export async function fetchAllInBatches<T, Id extends string | number>(
  table: string,
  select: string,
  inColumn: string,
  ids: Id[],
  orderColumn: string,
  batchSize = IN_FILTER_BATCH_SIZE,
  applyFilters?: (query: FilterableQuery) => FilterableQuery,
  errorLabel = table
): Promise<T[]> {
  if (ids.length === 0) return []

  const batches = chunkArray(ids, batchSize)
  const batchResults = await Promise.all(
    batches.map((batch) =>
      fetchAllPaginated<T>(async (from, to) => {
        let query = (supabase.from(table as never) as ReturnType<typeof supabase.from>)
          .select(select)
          .in(inColumn, batch)

        if (applyFilters) {
          query = applyFilters(query as FilterableQuery) as typeof query
        }

        const { data, error } = await query.order(orderColumn, { ascending: true }).range(from, to)
        if (error) {
          throw new Error(`${errorLabel} 查詢失敗: ${error.message}`)
        }
        return { data: data as T[] | null, error: null }
      })
    )
  )

  return batchResults.flat()
}
