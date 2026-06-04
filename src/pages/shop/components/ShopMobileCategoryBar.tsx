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

interface ShopMobileCategoryBarProps {
  filters: ShopFilterState
  preOrderCount: number
  groupCounts: Map<ShopGroup, number>
  categoryCounts: Map<string, number>
  onSelectAll: () => void
  onSelectPreOrder: () => void
  onSelectCategory: (topLevel: TopLevel, subCat?: string) => void
}

/**
 * 手機版主導航：All / Pre-Order / 分類 chips（單頁商城）。
 */
export function ShopMobileCategoryBar({
  filters,
  preOrderCount,
  groupCounts,
  categoryCounts,
  onSelectAll,
  onSelectPreOrder,
  onSelectCategory,
}: ShopMobileCategoryBarProps) {
  const allActive =
    !filters.preOrderOnly &&
    filters.topLevel === ALL_GROUPS &&
    filters.subCat === ALL_SUBCATS

  const preOrderActive =
    filters.preOrderOnly &&
    filters.topLevel === ALL_GROUPS &&
    filters.subCat === ALL_SUBCATS

  const activeGroup =
    filters.topLevel !== ALL_GROUPS ? (filters.topLevel as ShopGroup) : null

  const subs =
    activeGroup != null
      ? getSubCategoriesForGroup(activeGroup, categoryCounts)
      : []

  return (
    <div className="lg:hidden sticky top-14 z-20 bg-gray-50/95 backdrop-blur-sm border-b border-gray-200">
      <div
        className="flex gap-2 overflow-x-auto px-4 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Browse"
      >
        <CategoryChip active={allActive} onClick={onSelectAll}>
          All
        </CategoryChip>
        {preOrderCount > 0 && (
          <CategoryChip active={preOrderActive} onClick={onSelectPreOrder}>
            Pre-Order
          </CategoryChip>
        )}
        {SHOP_GROUPS.map((g) => {
          if ((groupCounts.get(g) ?? 0) === 0) return null
          return (
            <CategoryChip
              key={g}
              active={filters.topLevel === g}
              onClick={() => onSelectCategory(g, ALL_SUBCATS)}
            >
              {g}
            </CategoryChip>
          )
        })}
      </div>

      {activeGroup != null && subs.length > 0 && (
        <div
          className="flex gap-2 overflow-x-auto px-4 pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label={`${activeGroup} subcategories`}
        >
          <CategoryChip
            active={filters.subCat === ALL_SUBCATS}
            onClick={() => onSelectCategory(activeGroup, ALL_SUBCATS)}
            subdued
          >
            All
          </CategoryChip>
          {subs.map((cat) => (
            <CategoryChip
              key={cat.id}
              active={filters.subCat === cat.id}
              onClick={() => onSelectCategory(activeGroup, cat.id)}
              subdued
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
  subdued = false,
  onClick,
  children,
}: {
  active: boolean
  subdued?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        'shrink-0 h-9 px-3.5 rounded-full text-sm font-medium transition-colors ' +
        (active
          ? 'bg-zinc-900 text-white'
          : subdued
            ? 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
            : 'bg-white text-gray-800 border border-gray-200 hover:border-gray-300')
      }
    >
      {children}
    </button>
  )
}
