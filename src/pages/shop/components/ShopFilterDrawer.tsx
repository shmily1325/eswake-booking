import { useEffect } from 'react'
import type { ShopGroup } from '../../admin/products/schema'
import { ShopFilterPanel } from './ShopFilterPanel'
import type { ShopFilterState, SortBy } from '../lib/shopFilters'
import { SHOP_COPY, SHOP_LABEL } from '../lib/shopCopy'

interface ShopFilterDrawerProps {
  open: boolean
  resultCount: number
  filters: ShopFilterState
  preOrderCount: number
  groupCounts: Map<ShopGroup, number>
  categoryCounts: Map<string, number>
  brandCounts: Map<string, number>
  onClose: () => void
  onPreOrderOnlyChange: (v: boolean) => void
  onToggleBrand: (brand: string) => void
  onSortChange: (v: SortBy) => void
  onClearAll: () => void
}

/**
 * 手機版 filter sheet：預購、品牌、排序（分類在上方 chips）。
 */
export function ShopFilterDrawer({
  open,
  resultCount,
  filters,
  preOrderCount,
  groupCounts,
  categoryCounts,
  brandCounts,
  onClose,
  onPreOrderOnlyChange,
  onToggleBrand,
  onSortChange,
  onClearAll,
}: ShopFilterDrawerProps) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  const hasRefinement =
    filters.preOrderOnly ||
    filters.brands.length > 0 ||
    filters.sortBy !== 'newest'

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close filters"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-bold text-zinc-900">{SHOP_LABEL.filter}</h2>
          <div className="flex items-center gap-3">
            {hasRefinement && (
              <button
                type="button"
                onClick={onClearAll}
                className="text-sm text-gray-500 underline underline-offset-2"
              >
                {SHOP_LABEL.clear}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100"
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 overscroll-contain">
          <div className="space-y-6">
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400 mb-2">
                {SHOP_LABEL.sort}
              </h3>
              <div className="grid grid-cols-1 gap-1">
                {SORT_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onSortChange(value)}
                    className={
                      'w-full min-h-[44px] px-3 rounded-lg text-sm text-left border transition-colors ' +
                      (filters.sortBy === value
                        ? 'border-zinc-900 bg-zinc-900 text-white font-semibold'
                        : 'border-gray-200 text-gray-700 hover:bg-gray-50')
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <ShopFilterPanel
              filters={filters}
              preOrderCount={preOrderCount}
              groupCounts={groupCounts}
              categoryCounts={categoryCounts}
              brandCounts={brandCounts}
              onSelectAll={() => {}}
              onSelectCategory={() => {}}
              onPreOrderOnlyChange={onPreOrderOnlyChange}
              onToggleBrand={onToggleBrand}
              hideCategory
            />
          </div>
        </div>

        <div className="shrink-0 p-4 border-t border-gray-100 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-12 rounded-lg bg-black text-white text-sm font-semibold"
          >
            {SHOP_COPY.showResults(resultCount)}
          </button>
        </div>
      </div>
    </div>
  )
}

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'newest', label: SHOP_LABEL.newest },
  { value: 'price-asc', label: SHOP_LABEL.priceAsc },
  { value: 'price-desc', label: SHOP_LABEL.priceDesc },
]

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
