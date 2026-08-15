import { getAllCategories, getCategoryShopName } from '../../admin/products/schema'
import { ALL_SUBCATS, type ShopFilterState } from '../lib/shopFilters'
import { SHOP_LABEL } from '../lib/shopCopy'

interface ShopPreOrderRefineBarProps {
  filters: ShopFilterState
  brandCounts: Map<string, number>
  categoryCounts: Map<string, number>
  onSelectBrand: (brand: string | null) => void
  onSelectCategory: (subCat: string) => void
}

/**
 * 預購專用篩選列（白底、貼在商品格上方）。
 * 品牌與類型兩排都常駐，避免使用者不知道還有下一層可以選。
 */
export function ShopPreOrderRefineBar({
  filters,
  brandCounts,
  categoryCounts,
  onSelectBrand,
  onSelectCategory,
}: ShopPreOrderRefineBarProps) {
  const brands = [...brandCounts.entries()].sort(([a], [b]) => a.localeCompare(b))
  const categories = getAllCategories()
    .filter((cat) => (categoryCounts.get(cat.id) ?? 0) > 0)
    .map((cat) => ({ ...cat, count: categoryCounts.get(cat.id) ?? 0 }))

  if (brands.length === 0) return null

  const selectedBrand = filters.brands[0] ?? null

  return (
    <div className="mb-4 space-y-1">
      <RefineRow label={SHOP_LABEL.brand}>
        <RefineChip active={selectedBrand == null} onClick={() => onSelectBrand(null)}>
          {SHOP_LABEL.all}
        </RefineChip>
        {brands.map(([brand, count]) => (
          <RefineChip
            key={brand}
            active={selectedBrand === brand}
            count={count}
            onClick={() => onSelectBrand(brand)}
          >
            {brand}
          </RefineChip>
        ))}
      </RefineRow>

      {categories.length > 0 && (
        <RefineRow label={SHOP_LABEL.type}>
          <RefineChip
            active={filters.subCat === ALL_SUBCATS}
            onClick={() => onSelectCategory(ALL_SUBCATS)}
          >
            {SHOP_LABEL.all}
          </RefineChip>
          {categories.map((cat) => (
            <RefineChip
              key={cat.id}
              active={filters.subCat === cat.id}
              count={cat.count}
              onClick={() => onSelectCategory(cat.id)}
            >
              {getCategoryShopName(cat)}
            </RefineChip>
          ))}
        </RefineRow>
      )}
    </div>
  )
}

function RefineRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2.5 sm:gap-3">
      <span className="w-10 shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400">
        {label}
      </span>
      <div
        className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto scroll-smooth py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="group"
        aria-label={label}
      >
        {children}
      </div>
    </div>
  )
}

function RefineChip({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean
  count?: number
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        'inline-flex shrink-0 items-center gap-1 h-8 px-3 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors ' +
        (active
          ? 'bg-zinc-900 text-white'
          : 'bg-gray-100 text-zinc-600 hover:bg-gray-200')
      }
    >
      <span>{children}</span>
      {count != null && count > 0 && (
        <span
          className={
            'tabular-nums text-[11px] ' + (active ? 'text-white/50' : 'text-gray-400')
          }
        >
          {count}
        </span>
      )}
    </button>
  )
}
