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
  /** 與 hero 底部漸層重疊，無硬邊界 */
  fadeFromHero?: boolean
}

/** 桌機單排含子分類；手機選大類後第二排只列子分類（無 All） */
export function ShopCategoryBar({
  filters,
  groupCounts,
  categoryCounts,
  onSelectAll,
  onSelectCategory,
  variant = 'dark',
  fadeFromHero = false,
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

  const showSubRow = activeGroup != null && subs.length > 0

  return (
    <div
      className={
        'sticky top-14 z-20 ' +
        (onDark
          ? fadeFromHero
            ? 'bg-black border-b-0 pt-0 pb-1'
            : 'bg-black border-b border-zinc-800'
          : 'bg-gray-50/95 backdrop-blur-sm border-b border-gray-200')
      }
    >
      <div
        className={
          'max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto px-4 sm:px-6 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ' +
          (showSubRow ? 'pb-2 lg:pb-3' : 'pb-3')
        }
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

        {/* 桌機：子分類接在同一列 */}
        {showSubRow && (
          <div className="hidden lg:contents">
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
                onClick={() => onSelectCategory(activeGroup!, cat.id)}
                subdued
                onDark={onDark}
              >
                {getCategoryShopName(cat)}
              </CategoryChip>
            ))}
          </div>
        )}
      </div>

      {/* 手機：第二排只列子分類（不要 All） */}
      {showSubRow && (
        <div
          className="lg:hidden max-w-7xl mx-auto flex gap-2 overflow-x-auto px-4 sm:px-6 pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label={`${activeGroup} subcategories`}
        >
          {subs.map((cat) => (
            <CategoryChip
              key={cat.id}
              active={filters.subCat === cat.id}
              onClick={() => onSelectCategory(activeGroup!, cat.id)}
              subdued
              onDark={onDark}
            >
              {getCategoryShopName(cat)}
            </CategoryChip>
          ))}
        </div>
      )}
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

  if (onDark) {
    if (active) {
      className += 'bg-white text-zinc-900'
    } else if (partial) {
      className += 'bg-white/15 text-white border border-white'
    } else if (subdued) {
      className +=
        'bg-transparent text-zinc-400 border border-zinc-700 hover:border-zinc-500 hover:text-zinc-200'
    } else {
      className +=
        'bg-transparent text-white border border-white/45 hover:bg-white/10 hover:border-white/80'
    }
  } else if (active) {
    className += 'bg-zinc-900 text-white'
  } else if (subdued) {
    className += 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
  } else {
    className += 'bg-white text-gray-800 border border-gray-200 hover:border-gray-300'
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
