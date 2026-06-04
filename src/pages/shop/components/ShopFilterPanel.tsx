import { useEffect, useMemo, useState } from 'react'
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
  preOrderCount: number
  groupCounts: Map<ShopGroup, number>
  categoryCounts: Map<string, number>
  brandCounts: Map<string, number>
  onSelectAll: () => void
  onSelectPreOrder: () => void
  onSelectCategory: (topLevel: TopLevel, subCat?: string) => void
  onToggleBrand: (brand: string) => void
  /** 手機 drawer 用：分類已在上方 chips，這裡只顯示 brand */
  hideCategory?: boolean
}

export function ShopFilterPanel({
  filters,
  preOrderCount,
  groupCounts,
  categoryCounts,
  brandCounts,
  onSelectAll,
  onSelectPreOrder,
  onSelectCategory,
  onToggleBrand,
  hideCategory = false,
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

  const brands = useMemo(
    () =>
      [...brandCounts.keys()].sort((a, b) => a.localeCompare(b)),
    [brandCounts],
  )

  const selectGroup = (g: ShopGroup) => {
    onSelectCategory(g, ALL_SUBCATS)
    setExpandedGroups(new Set([g]))
  }

  const allActive =
    !filters.preOrderOnly &&
    filters.topLevel === ALL_GROUPS &&
    filters.subCat === ALL_SUBCATS

  const preOrderActive =
    filters.preOrderOnly &&
    filters.topLevel === ALL_GROUPS &&
    filters.subCat === ALL_SUBCATS

  return (
    <div className="space-y-6">
      {!hideCategory && (
        <FilterSection title="Category">
          <button
            type="button"
            onClick={onSelectAll}
            className={navLinkClass(allActive)}
          >
            All Products
          </button>

          {preOrderCount > 0 && (
            <button
              type="button"
              onClick={onSelectPreOrder}
              className={navLinkClass(preOrderActive)}
            >
              Pre-Order
            </button>
          )}

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

      {brands.length > 0 && (
        <FilterSection title="Brand">
          <div className="space-y-0.5 max-h-52 overflow-y-auto overflow-x-hidden pr-1">
            {brands.map((name) => {
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

/** Shopify-style: bold + left border for every active level */
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
