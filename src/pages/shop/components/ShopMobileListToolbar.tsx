import type { SortBy, ShopFilterState } from '../lib/shopFilters'
import { getShopFilterContextLabelWithBrands } from '../lib/shopFilters'
import { SHOP_COPY, SHOP_LABEL } from '../lib/shopCopy'

interface ShopMobileListToolbarProps {
  filters: ShopFilterState
  itemCount: number
  loading: boolean
  refineCount: number
  showRefine: boolean
  onOpenFilters: () => void
  onSortChange: (v: SortBy) => void
}

/** 手機列表：目前範圍 + 篩選／排序（分類在 hero 下方 chips） */
export function ShopMobileListToolbar({
  filters,
  itemCount,
  loading,
  refineCount,
  showRefine,
  onOpenFilters,
  onSortChange,
}: ShopMobileListToolbarProps) {
  const context = getShopFilterContextLabelWithBrands(filters)

  return (
    <div className="lg:hidden mb-3 space-y-2.5">
      <div className="flex items-baseline justify-between gap-3 min-w-0">
        <p className="text-sm font-semibold text-zinc-900 truncate">{context}</p>
        {!loading && (
          <p className="text-xs text-gray-500 shrink-0 tabular-nums">
            {SHOP_COPY.itemCount(itemCount)}
          </p>
        )}
      </div>

      {showRefine && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onOpenFilters}
            className="flex-1 min-w-0 inline-flex items-center justify-center gap-2 h-11 px-3.5 rounded-xl border border-gray-200 bg-white shadow-sm active:bg-gray-50 text-sm font-semibold text-zinc-900"
          >
            <FilterIcon />
            {SHOP_LABEL.filter}
            {refineCount > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-zinc-900 text-white text-xs font-bold inline-flex items-center justify-center">
                {refineCount}
              </span>
            )}
          </button>

          <label className="shrink-0 h-11 min-w-[7.5rem] max-w-[42%] flex items-center">
            <select
              value={filters.sortBy}
              onChange={(e) => onSortChange(e.target.value as SortBy)}
              aria-label="Sort by"
              className="h-9 w-full px-2.5 text-xs font-medium bg-white border border-gray-200 rounded-lg cursor-pointer focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900/20"
            >
              <option value="newest">Newest</option>
              <option value="price-asc">Price ↑</option>
              <option value="price-desc">Price ↓</option>
            </select>
          </label>
        </div>
      )}
    </div>
  )
}

function FilterIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="shrink-0"
      aria-hidden
    >
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="10" y1="18" x2="14" y2="18" />
    </svg>
  )
}
