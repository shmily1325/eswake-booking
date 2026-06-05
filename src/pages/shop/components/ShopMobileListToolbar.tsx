import type { ShopFilterState } from '../lib/shopFilters'
import { getShopFilterContextLabelWithBrands } from '../lib/shopFilters'
import { SHOP_COPY, SHOP_LABEL } from '../lib/shopCopy'

interface ShopMobileListToolbarProps {
  filters: ShopFilterState
  itemCount: number
  loading: boolean
  refineCount: number
  showRefine: boolean
  onOpenFilters: () => void
}

/** 手機：一行狀態 + Filter（品牌／預購／排序皆在 drawer） */
export function ShopMobileListToolbar({
  filters,
  itemCount,
  loading,
  refineCount,
  showRefine,
  onOpenFilters,
}: ShopMobileListToolbarProps) {
  const context = getShopFilterContextLabelWithBrands(filters)

  return (
    <div className="lg:hidden mb-3 flex items-center justify-between gap-3 min-w-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-zinc-900 truncate">{context}</p>
        {!loading && (
          <p className="text-xs text-gray-500 tabular-nums">{SHOP_COPY.itemCount(itemCount)}</p>
        )}
      </div>

      {showRefine && (
        <button
          type="button"
          onClick={onOpenFilters}
          className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-gray-200 bg-white text-sm font-medium text-zinc-900 active:bg-gray-50"
        >
          <FilterIcon />
          {SHOP_LABEL.filter}
          {refineCount > 0 && (
            <span className="min-w-[18px] h-5 px-1 rounded-full bg-zinc-900 text-white text-[11px] font-bold inline-flex items-center justify-center">
              {refineCount}
            </span>
          )}
        </button>
      )}
    </div>
  )
}

function FilterIcon() {
  return (
    <svg
      width="16"
      height="16"
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
