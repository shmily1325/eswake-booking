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

interface ShopCategoryBarProps {
  filters: ShopFilterState
  groupCounts: Map<ShopGroup, number>
  categoryCounts: Map<string, number>
  onSelectAll: () => void
  onSelectCategory: (topLevel: TopLevel, subCat?: string) => void
  /** dark = 貼在黑色 hero 底下；light = 灰底列表頁（legacy） */
  variant?: 'dark' | 'light'
}

/** 單排 chips：大類 +（選中時）子分類接在同一列，不再第二排 All */
export function ShopCategoryBar({
  filters,
  groupCounts,
  categoryCounts,
  onSelectAll,
  onSelectCategory,
  variant = 'dark',
}: ShopCategoryBarProps) {
  const onDark = variant === 'dark'

  const allActive =
    filters.topLevel === ALL_GROUPS && filters.subCat === ALL_SUBCATS

  const activeGroup =
    filters.topLevel !== ALL_GROUPS ? (filters.topLevel as ShopGroup) : null

  const subs =
    activeGroup != null
      ? getSubCategoriesForGroup(activeGroup, categoryCounts)
      : []

  return (
    <div
      className={
        'sticky top-14 z-20 border-b ' +
        (onDark
          ? 'bg-black border-zinc-800'
          : 'bg-gray-50/95 backdrop-blur-sm border-gray-200')
      }
    >
      <div
        className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto px-4 sm:px-6 py-2.5 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Categories"
      >
        <CategoryChip active={allActive} onClick={onSelectAll} onDark={onDark}>
          {SHOP_LABEL.all}
        </CategoryChip>

        {SHOP_GROUPS.map((g) => {
          if ((groupCounts.get(g) ?? 0) === 0) return null
          const groupAllActive =
            filters.topLevel === g && filters.subCat === ALL_SUBCATS
          const groupPartial =
            filters.topLevel === g && filters.subCat !== ALL_SUBCATS
          return (
            <CategoryChip
              key={g}
              active={groupAllActive}
              partial={groupPartial}
              onClick={() => onSelectCategory(g, ALL_SUBCATS)}
              onDark={onDark}
            >
              {g}
            </CategoryChip>
          )
        })}

        {activeGroup != null && subs.length > 0 && (
          <>
            <span
              className={
                'shrink-0 w-px h-5 self-center ' +
                (onDark ? 'bg-zinc-700' : 'bg-gray-300')
              }
              aria-hidden
            />
            {subs.map((cat) => (
              <CategoryChip
                key={cat.id}
                active={filters.subCat === cat.id}
                onClick={() => onSelectCategory(activeGroup, cat.id)}
                subdued
                onDark={onDark}
              >
                {getCategoryShopName(cat)}
              </CategoryChip>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

function CategoryChip({
  active,
  partial = false,
  subdued = false,
  onDark = false,
  onClick,
  children,
}: {
  active: boolean
  partial?: boolean
  subdued?: boolean
  onDark?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  let className =
    'shrink-0 h-9 px-3.5 rounded-full text-sm font-medium transition-colors '

  if (active) {
    className += onDark
      ? 'bg-white text-zinc-900'
      : 'bg-zinc-900 text-white'
  } else if (partial) {
    className += onDark
      ? 'bg-white/10 text-white border border-white/70'
      : 'bg-zinc-100 text-zinc-900 border border-zinc-900'
  } else if (onDark) {
    className += subdued
      ? 'bg-transparent text-zinc-400 border border-zinc-700 hover:border-zinc-500 hover:text-zinc-200'
      : 'bg-transparent text-zinc-200 border border-zinc-600 hover:border-zinc-400 hover:text-white'
  } else {
    className += subdued
      ? 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
      : 'bg-white text-gray-800 border border-gray-200 hover:border-gray-300'
  }

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active || partial}
      onClick={onClick}
      className={className}
    >
      {children}
    </button>
  )
}

/** @deprecated use ShopCategoryBar */
export const ShopMobileCategoryBar = ShopCategoryBar
