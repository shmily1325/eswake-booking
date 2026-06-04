import { type ShopFilterState } from '../lib/shopFilters'
import { SHOP_LABEL } from '../lib/shopCopy'

interface ActiveFilterPillsProps {
  filters: ShopFilterState
  onClear: (
    key: 'preorder' | 'group' | 'cat' | 'brand' | 'search',
    brand?: string,
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
    key: 'preorder' | 'brand' | 'search'
    label: string
    brand?: string
  }[] = []

  if (filters.preOrderOnly) {
    pills.push({ key: 'preorder', label: SHOP_LABEL.preOrder })
  }
  for (const brand of filters.brands) {
    pills.push({ key: 'brand', label: brand, brand })
  }
  if (filters.search.trim()) {
    pills.push({ key: 'search', label: `"${filters.search.trim()}"` })
  }

  if (pills.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-3">
      {pills.map((pill) => (
        <button
          key={`${pill.key}-${pill.label}`}
          type="button"
          onClick={() => onClear(pill.key, pill.brand)}
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
