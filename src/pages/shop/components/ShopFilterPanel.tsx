import { useEffect, useState } from 'react'
import { ShopBrandFilter } from './ShopBrandFilter'
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
import { SHOP_LABEL } from '../lib/shopCopy'

interface ShopFilterPanelProps {
  filters: ShopFilterState
  preOrderCount: number
  groupCounts: Map<ShopGroup, number>
  categoryCounts: Map<string, number>
  brandCounts: Map<string, number>
  onSelectAll: () => void
  onSelectCategory: (topLevel: TopLevel, subCat?: string) => void
  onPreOrderOnlyChange: (v: boolean) => void
  onToggleBrand: (brand: string) => void
  hideCategory?: boolean
  hideBrand?: boolean
}

export function ShopFilterPanel({
  filters,
  preOrderCount,
  groupCounts,
  categoryCounts,
  brandCounts,
  onSelectAll,
  onSelectCategory,
  onPreOrderOnlyChange,
  onToggleBrand,
  hideCategory = false,
  hideBrand = false,
}: ShopFilterPanelProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() =>
    filters.topLevel !== ALL_GROUPS ? new Set([filters.topLevel]) : new Set(),
  )

  useEffect(() => {
    if (filters.topLevel !== ALL_GROUPS) {
      setExpandedGroups(new Set([filters.topLevel]))
    } else {
      setExpandedGroups(new Set())
    }
  }, [filters.topLevel])

  const selectGroup = (g: ShopGroup) => {
    onSelectCategory(g, ALL_SUBCATS)
    setExpandedGroups(new Set([g]))
  }

  const allActive =
    filters.topLevel === ALL_GROUPS && filters.subCat === ALL_SUBCATS

  return (
    <div className="space-y-6">
      {!hideCategory && (
        <FilterSection title={SHOP_LABEL.category}>
          <button
            type="button"
            onClick={onSelectAll}
            className={navLinkClass(allActive)}
          >
            {SHOP_LABEL.allProducts}
          </button>

          <div className="mt-1 space-y-0.5">
            {SHOP_GROUPS.map((g) => {
              if ((groupCounts.get(g) ?? 0) === 0) return null

              const expanded = expandedGroups.has(g)
              const subs = getSubCategoriesForGroup(g, categoryCounts)
              const groupActive = filters.topLevel === g
              const groupAllActive = groupActive && filters.subCat === ALL_SUBCATS

              return (
                <div key={g}>
                  <button
                    type="button"
                    onClick={() => selectGroup(g)}
                    className={
                      navLinkClass(groupAllActive) +
                      (groupActive && !groupAllActive
                        ? ' font-medium text-zinc-800'
                        : '')
                    }
                  >
                    <Chevron className={expanded ? 'rotate-90' : ''} />
                    {g}
                  </button>

                  {expanded && subs.length > 0 && (
                    <div className="mt-0.5 space-y-0.5">
                      {subs.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => onSelectCategory(g, cat.id)}
                          className={
                            subNavLinkClass(
                              groupActive && filters.subCat === cat.id,
                            ) + ' ml-4'
                          }
                        >
                          {getCategoryShopName(cat)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </FilterSection>
      )}

      {!hideBrand && (
        <ShopBrandFilter
          filters={filters}
          brandCounts={brandCounts}
          onToggleBrand={onToggleBrand}
          layout="list"
        />
      )}

      {preOrderCount > 0 && (
        <FilterSection title={SHOP_LABEL.availability}>
          <label className="flex items-center gap-2.5 min-h-[44px] px-1 cursor-pointer rounded-md hover:bg-gray-50">
            <input
              type="checkbox"
              checked={filters.preOrderOnly}
              onChange={(e) => onPreOrderOnlyChange(e.target.checked)}
              className="w-4 h-4 shrink-0 rounded border-gray-300 text-black focus:ring-black"
            />
            <span className="text-sm text-gray-800">{SHOP_LABEL.preOrderOnly}</span>
          </label>
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

function navLinkClass(active: boolean) {
  return (
    'w-full flex items-center gap-1.5 min-h-[44px] pl-3 border-l-2 text-sm text-left transition-colors ' +
    (active
      ? 'border-zinc-900 font-semibold text-zinc-900'
      : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-zinc-900')
  )
}

function subNavLinkClass(active: boolean) {
  return (
    'w-full flex items-center min-h-[40px] pl-3 border-l-2 text-sm text-left transition-colors ' +
    (active
      ? 'border-zinc-900 font-semibold text-zinc-900'
      : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-zinc-900')
  )
}

function Chevron({ className = '' }: { className?: string }) {
  return (
    <svg
      className={'w-3.5 h-3.5 shrink-0 transition-transform ' + className}
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
