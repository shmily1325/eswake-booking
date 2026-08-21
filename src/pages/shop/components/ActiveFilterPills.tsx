import {
  ALL_SUBCATS,
  formatSizeFacetLabel,
  type ShopFilterState,
  type SortBy,
} from '../lib/shopFilters'
import { SHOP_LABEL } from '../lib/shopCopy'

interface ActiveFilterPillsProps {
  filters: ShopFilterState
  onClear: (
    key: 'preorder' | 'group' | 'cat' | 'brand' | 'size' | 'search' | 'sort',
    value?: string,
  ) => void
  onClearAll: () => void
}

/** 只顯示 refine pills（分類已由 chips 表示） */
export function ActiveFilterPills({
  filters,
  onClear,
  onClearAll,
}: ActiveFilterPillsProps) {
  const pills: {
    key: 'search' | 'sort' | 'brand' | 'size'
    label: string
    value?: string
  }[] = []

  if (!filters.preOrderOnly) {
    for (const brand of filters.brands) {
      pills.push({ key: 'brand', label: brand, value: brand })
    }
    const categoryId = filters.subCat !== ALL_SUBCATS ? filters.subCat : null
    for (const size of filters.sizes) {
      pills.push({
        key: 'size',
        label: formatSizeFacetLabel(categoryId, size),
        value: size,
      })
    }
  }
  if (filters.sortBy !== 'newest') {
    pills.push({ key: 'sort', label: sortLabel(filters.sortBy) })
  }
  if (filters.search.trim()) {
    pills.push({ key: 'search', label: `"${filters.search.trim()}"` })
  }

  if (pills.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-3">
      {pills.map((pill) => (
        <button
          key={`${pill.key}-${pill.value ?? pill.label}`}
          type="button"
          onClick={() => onClear(pill.key, pill.value)}
          className="inline-flex items-center gap-1 h-8 px-2.5 text-xs font-medium rounded-full bg-zinc-900 text-white"
        >
          <span>{pill.label}</span>
          <span aria-hidden className="text-zinc-400">
            ×
          </span>
        </button>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="h-8 px-2 text-xs text-gray-500 underline underline-offset-2"
      >
        {SHOP_LABEL.clearAll}
      </button>
    </div>
  )
}

function sortLabel(sortBy: SortBy): string {
  if (sortBy === 'price-asc') return SHOP_LABEL.priceAsc
  if (sortBy === 'price-desc') return SHOP_LABEL.priceDesc
  return SHOP_LABEL.newest
}
