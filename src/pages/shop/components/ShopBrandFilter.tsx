import { useMemo } from 'react'
import type { ShopFilterState } from '../lib/shopFilters'
import { SHOP_LABEL } from '../lib/shopCopy'
import { SHOP_SECTION_LABEL } from '../lib/shopUiStyle'

type ShopBrandFilterProps = {
  filters: ShopFilterState
  brandCounts: Map<string, number>
  onToggleBrand: (brand: string) => void
  layout: 'chips' | 'list'
  className?: string
}

export function ShopBrandFilter({
  filters,
  brandCounts,
  onToggleBrand,
  layout,
  className = '',
}: ShopBrandFilterProps) {
  const brands = useMemo(
    () =>
      [...brandCounts.entries()].sort(([a], [b]) => a.localeCompare(b)),
    [brandCounts],
  )

  if (brands.length === 0) return null

  if (layout === 'chips') {
    return (
      <div className={className}>
        <p className={SHOP_SECTION_LABEL + ' mb-1.5'}>{SHOP_LABEL.brand}</p>
        <div
          className="flex gap-2 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="group"
          aria-label={SHOP_LABEL.brand}
        >
          {brands.map(([name, count]) => {
            const active = filters.brands.includes(name)
            return (
              <button
                key={name}
                type="button"
                onClick={() => onToggleBrand(name)}
                aria-pressed={active}
                className={
                  'snap-start shrink-0 inline-flex items-center gap-1.5 h-9 pl-3 pr-2.5 rounded-full text-sm font-medium border transition-colors ' +
                  (active
                    ? 'bg-zinc-900 text-white border-zinc-900'
                    : 'bg-white text-zinc-800 border-gray-200 hover:border-gray-300')
                }
              >
                <span className="max-w-[9rem] truncate">{name}</span>
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

  return (
    <div className={className}>
      <h3 className={SHOP_SECTION_LABEL + ' mb-2'}>{SHOP_LABEL.brand}</h3>
      <div className="space-y-0.5">
        {brands.map(([name, count]) => {
          const checked = filters.brands.includes(name)
          return (
            <label
              key={name}
              className="flex items-center gap-2.5 min-h-[44px] px-1 cursor-pointer rounded-md hover:bg-gray-50 min-w-0"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggleBrand(name)}
                className="w-4 h-4 shrink-0 rounded border-gray-300 text-black focus:ring-black"
              />
              <span className="flex-1 min-w-0 text-sm text-gray-800 truncate">
                {name}
              </span>
              <span className="text-xs text-gray-400 tabular-nums shrink-0">{count}</span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
