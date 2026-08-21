import { useMemo } from 'react'
import {
  ALL_SUBCATS,
  formatSizeFacetLabel,
  type ShopFilterState,
} from '../lib/shopFilters'
import { SHOP_LABEL } from '../lib/shopCopy'
import { SHOP_SECTION_LABEL } from '../lib/shopUiStyle'
import { sortSpecValues } from '../lib/variantSpecAxes'

type ShopSizeFilterProps = {
  filters: ShopFilterState
  sizeCounts: Map<string, number>
  onToggleSize: (size: string) => void
  className?: string
}

export function ShopSizeFilter({
  filters,
  sizeCounts,
  onToggleSize,
  className = '',
}: ShopSizeFilterProps) {
  const sizes = useMemo(
    () =>
      sortSpecValues([...sizeCounts.keys()], 'size').map(
        (name) => [name, sizeCounts.get(name) ?? 0] as const,
      ),
    [sizeCounts],
  )

  const show =
    sizes.length >= 2 || filters.sizes.some((s) => sizeCounts.has(s))
  if (!show) return null

  const categoryId =
    filters.subCat !== ALL_SUBCATS ? filters.subCat : null

  return (
    <div className={className}>
      <h3 className={SHOP_SECTION_LABEL + ' mb-2'}>{SHOP_LABEL.size}</h3>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={SHOP_LABEL.size}
      >
        {sizes.map(([name, count]) => {
          const active = filters.sizes.includes(name)
          return (
            <button
              key={name}
              type="button"
              onClick={() => onToggleSize(name)}
              aria-pressed={active}
              className={
                'inline-flex items-center gap-1.5 min-h-11 px-3 rounded-full text-sm font-medium border transition-colors ' +
                (active
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'bg-white text-zinc-800 border-gray-200 hover:border-gray-300')
              }
            >
              <span>{formatSizeFacetLabel(categoryId, name)}</span>
              <span
                className={
                  'tabular-nums text-xs ' + (active ? 'text-white/70' : 'text-gray-400')
                }
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
