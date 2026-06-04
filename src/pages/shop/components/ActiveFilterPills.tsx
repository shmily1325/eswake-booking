import {
  getAllCategories,
  getCategoryShopName,
} from '../../admin/products/schema'
import { ALL_GROUPS, ALL_SUBCATS, type ShopFilterState } from '../lib/shopFilters'

interface ActiveFilterPillsProps {
  filters: ShopFilterState
  onClear: (key: 'group' | 'cat' | 'brand' | 'search', brand?: string) => void
  onClearAll: () => void
}

export function ActiveFilterPills({
  filters,
  onClear,
  onClearAll,
}: ActiveFilterPillsProps) {
  const pills: { key: 'group' | 'cat' | 'brand' | 'search'; label: string; brand?: string }[] =
    []

  if (filters.topLevel !== ALL_GROUPS) {
    pills.push({ key: 'group', label: filters.topLevel })
  }
  if (filters.subCat !== ALL_SUBCATS) {
    const cat = getAllCategories().find((c) => c.id === filters.subCat)
    pills.push({
      key: 'cat',
      label: cat ? getCategoryShopName(cat) : filters.subCat,
    })
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
        Clear all
      </button>
    </div>
  )
}
