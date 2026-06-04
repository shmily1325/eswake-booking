import { useMemo, useState } from 'react'
import {
  getCategoryShopName,
  SHOP_GROUPS,
  type ShopGroup,
} from '../../admin/products/schema'
import {
  ALL_GROUPS,
  ALL_SUBCATS,
  getSubCategoriesForGroup,
  type ShopFilterState,
  type TopLevel,
} from '../lib/shopFilters'

interface ShopFilterPanelProps {
  filters: ShopFilterState
  groupCounts: Map<ShopGroup, number>
  categoryCounts: Map<string, number>
  brandCounts: Map<string, number>
  onTopLevelChange: (v: TopLevel) => void
  onSubCatChange: (v: string) => void
  onToggleBrand: (brand: string) => void
}

export function ShopFilterPanel({
  filters,
  groupCounts,
  categoryCounts,
  brandCounts,
  onTopLevelChange,
  onSubCatChange,
  onToggleBrand,
}: ShopFilterPanelProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const s = new Set<string>()
    if (filters.topLevel !== ALL_GROUPS) s.add(filters.topLevel)
    else s.add('Essentials')
    return s
  })

  const brands = useMemo(
    () =>
      [...brandCounts.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, count]) => ({ name, count })),
    [brandCounts],
  )

  const toggleGroupExpand = (g: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(g)) next.delete(g)
      else next.add(g)
      return next
    })
  }

  return (
    <div className="space-y-6">
      <FilterSection title="Category">
        <button
          type="button"
          onClick={() => onTopLevelChange(ALL_GROUPS)}
          className={rowClass(filters.topLevel === ALL_GROUPS && filters.subCat === ALL_SUBCATS)}
        >
          <span>All Products</span>
          <Count n={[...categoryCounts.values()].reduce((a, b) => a + b, 0)} />
        </button>

        {SHOP_GROUPS.map((g) => {
          const n = groupCounts.get(g) ?? 0
          if (n === 0) return null
          const expanded = expandedGroups.has(g)
          const subs = getSubCategoriesForGroup(g, categoryCounts)
          const groupActive = filters.topLevel === g

          return (
            <div key={g} className="border-t border-gray-100 pt-1">
              <div className="flex items-stretch gap-0.5">
                <button
                  type="button"
                  onClick={() => toggleGroupExpand(g)}
                  className="shrink-0 w-9 flex items-center justify-center text-gray-400 hover:text-black"
                  aria-expanded={expanded}
                  aria-label={expanded ? 'Collapse' : 'Expand'}
                >
                  <Chevron className={expanded ? 'rotate-90' : ''} />
                </button>
                <button
                  type="button"
                  onClick={() => onTopLevelChange(g)}
                  className={'flex-1 ' + rowClass(groupActive && filters.subCat === ALL_SUBCATS)}
                >
                  <span>{g}</span>
                  <Count n={n} />
                </button>
              </div>

              {expanded && subs.length > 0 && (
                <div className="ml-9 mt-0.5 space-y-0.5 pb-1">
                  <button
                    type="button"
                    onClick={() => {
                      onTopLevelChange(g)
                      onSubCatChange(ALL_SUBCATS)
                    }}
                    className={subRowClass(groupActive && filters.subCat === ALL_SUBCATS)}
                  >
                    <span>All</span>
                    <Count n={n} muted />
                  </button>
                  {subs.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        onTopLevelChange(g)
                        onSubCatChange(cat.id)
                      }}
                      className={subRowClass(groupActive && filters.subCat === cat.id)}
                    >
                      <span>{getCategoryShopName(cat)}</span>
                      <Count n={cat.count} muted />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </FilterSection>

      {brands.length > 0 && (
        <FilterSection title="Brand">
          <div className="space-y-0.5 max-h-52 overflow-y-auto pr-1">
            {brands.map(({ name, count }) => {
              const checked = filters.brands.includes(name)
              return (
                <label
                  key={name}
                  className="flex items-center gap-2.5 min-h-[44px] px-1 cursor-pointer rounded-md hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleBrand(name)}
                    className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
                  />
                  <span className="flex-1 text-sm text-gray-800">{name}</span>
                  <Count n={count} muted />
                </label>
              )
            })}
          </div>
        </FilterSection>
      )}
    </div>
  )
}

function FilterSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400 mb-2">
        {title}
      </h3>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function rowClass(active: boolean) {
  return (
    'w-full flex items-center justify-between gap-2 min-h-[44px] px-2 rounded-md text-sm text-left transition-colors ' +
    (active
      ? 'bg-zinc-900 text-white font-semibold'
      : 'text-gray-700 hover:bg-gray-100')
  )
}

function subRowClass(active: boolean) {
  return (
    'w-full flex items-center justify-between gap-2 min-h-[40px] px-2 rounded-md text-sm text-left ' +
    (active ? 'font-semibold text-black bg-gray-100' : 'text-gray-600 hover:bg-gray-50')
  )
}

function Count({ n, muted = false }: { n: number; muted?: boolean }) {
  return (
    <span
      className={
        'text-xs tabular-nums ' + (muted ? 'text-gray-400 font-normal' : 'opacity-70')
      }
    >
      {n}
    </span>
  )
}

function Chevron({ className = '' }: { className?: string }) {
  return (
    <svg
      className={'w-4 h-4 transition-transform ' + className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}
