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
import { preloadShopHeroForCategory } from '../lib/shopHeroPreload'

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
      <div className="relative max-lg:before:pointer-events-none max-lg:before:absolute max-lg:before:right-0 max-lg:before:top-0 max-lg:before:z-10 max-lg:before:h-full max-lg:before:w-10 max-lg:before:bg-linear-to-l max-lg:before:from-black max-lg:before:to-transparent">
      <div
        className={
          'relative z-21 max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto scroll-smooth snap-x snap-mandatory px-4 sm:px-6 py-1.5 sm:py-2.5 max-lg:py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ' +
          (showSubRow ? 'pb-1.5 sm:pb-2 lg:pb-3' : 'pb-2 sm:pb-3')
        }
        role="tablist"
        aria-label="Categories"
      >
        <CategoryChip
          active={allActive}
          onClick={onSelectAll}
          onDark={onDark}
          onWarmHover={() => void preloadShopHeroForCategory(ALL_GROUPS, ALL_SUBCATS)}
        >
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
              onWarmHover={() => void preloadShopHeroForCategory(g, ALL_SUBCATS)}
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
                onWarmHover={() =>
                  void preloadShopHeroForCategory(activeGroup!, cat.id)
                }
                subdued
                onDark={onDark}
                count={cat.count}
              >
                {getCategoryShopName(cat)}
              </CategoryChip>
            ))}
          </div>
        )}
      </div>
      </div>

      {/* 手機：子分類（回到大類全選 → 再點上方 Wakeboarding） */}
      {showSubRow && activeGroup && (
        <div className="relative lg:hidden">
          <div
            className="relative z-21 max-w-7xl mx-auto flex gap-2 overflow-x-auto scroll-smooth snap-x snap-mandatory px-4 sm:px-6 pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="tablist"
            aria-label={`${activeGroup} subcategories`}
          >
            {subs.map((cat) => (
              <CategoryChip
                key={cat.id}
                active={filters.subCat === cat.id}
                onClick={() => onSelectCategory(activeGroup, cat.id)}
                onWarmHover={() =>
                  void preloadShopHeroForCategory(activeGroup, cat.id)
                }
                subdued
                onDark={onDark}
                count={cat.count}
              >
                {getCategoryShopName(cat)}
              </CategoryChip>
            ))}
          </div>
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
  count,
  onClick,
  onWarmHover,
  children,
}: {
  active: boolean
  partial?: boolean
  subdued?: boolean
  onDark?: boolean
  count?: number
  onClick: () => void
  onWarmHover?: () => void
  children: React.ReactNode
}) {
  let className =
    'snap-start shrink-0 max-lg:h-10 max-lg:px-4 max-lg:text-[15px] h-9 px-3.5 rounded-full text-sm font-medium leading-none whitespace-nowrap transition-colors '

  if (onDark) {
    if (active) {
      className += 'bg-white text-zinc-900 shadow-sm max-lg:font-semibold'
    } else if (partial) {
      className += 'bg-white/20 text-white border-2 border-white max-lg:font-semibold'
    } else if (subdued) {
      className +=
        'bg-zinc-900/40 text-zinc-100 border border-zinc-500 hover:border-zinc-300 hover:text-white'
    } else {
      className +=
        'bg-transparent text-white border border-white/55 hover:bg-white/10 hover:border-white'
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
      onMouseEnter={onWarmHover}
      onFocus={onWarmHover}
      className={className}
    >
      {children}
      {count != null && count > 0 ? (
        <span
          className={
            'ml-1 tabular-nums ' +
            (active && onDark ? 'text-zinc-500' : onDark ? 'text-white/55' : 'text-gray-400')
          }
        >
          {count}
        </span>
      ) : null}
    </button>
  )
}

/** @deprecated use ShopCategoryBar */
export const ShopMobileCategoryBar = ShopCategoryBar
