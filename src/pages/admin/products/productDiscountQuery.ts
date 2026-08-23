/** 商品列表：從折扣頁過來查看已掛，或直接進入選取去掛 */

export const FILTER_DISCOUNT_PARAM = 'discount'
export const SELECT_PARAM = 'select'

export function productsListPath(opts?: {
  filterId?: string | null
  select?: boolean
}): string {
  const p = new URLSearchParams()
  if (opts?.filterId) p.set(FILTER_DISCOUNT_PARAM, opts.filterId)
  if (opts?.select) p.set(SELECT_PARAM, '1')
  const q = p.toString()
  return q ? `/products?${q}` : '/products'
}

export function readDiscountQuery(search: string): {
  filterId: string | null
  select: boolean
} {
  const p = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  return {
    filterId: p.get(FILTER_DISCOUNT_PARAM),
    select: p.get(SELECT_PARAM) === '1',
  }
}
