import type { ReactNode } from 'react'
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
 * 預購頁：第一列品牌；選了品牌後才出現第二列商品分類。
 */
export function ShopPreOrderRefineBar({
  filters,
  brandCounts,
  categoryCounts,
  onSelectBrand,
  onSelectCategory,
}: ShopPreOrderRefineBarProps) {
  const brands = [...brandCounts.entries()].sort(([a], [b]) => a.localeCompare(b))
  if (brands.length === 0) return null

  const selectedBrand = filters.brands[0] ?? null
  const brandTotal = [...brandCounts.values()].reduce((sum, count) => sum + count, 0)
  const categories = getAllCategories()
    .filter((cat) => (categoryCounts.get(cat.id) ?? 0) > 0)
    .map((cat) => ({
      ...cat,
      count: categoryCounts.get(cat.id) ?? 0,
      label: `${getGroupPrefix(cat.shopGroup)} ${getCategoryShopName(cat)}`,
    }))
  const categoryTotal = categories.reduce((sum, category) => sum + category.count, 0)
  const showTypeRow = selectedBrand != null && categories.length > 0

  return (
    <div className="relative">
      <ChipRow label={SHOP_LABEL.brand}>
        <RefineChip
          active={selectedBrand == null}
          count={brandTotal}
          onClick={() => onSelectBrand(null)}
        >
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
      </ChipRow>

      {showTypeRow && (
        <ChipRow label={SHOP_LABEL.category}>
          <RefineChip
            active={filters.subCat === ALL_SUBCATS}
            count={categoryTotal}
            onClick={() => onSelectCategory(ALL_SUBCATS)}
            subdued
          >
            {SHOP_LABEL.all}
          </RefineChip>
          {categories.map((cat) => (
            <RefineChip
              key={cat.id}
              active={filters.subCat === cat.id}
              count={cat.count}
              onClick={() => onSelectCategory(cat.id)}
              subdued
            >
              {cat.label}
            </RefineChip>
          ))}
        </ChipRow>
      )}
    </div>
  )
}

function getGroupPrefix(group: string | undefined): string {
  if (group === 'Wakeboarding') return 'WB'
  if (group === 'Wakesurfing') return 'WS'
  if (group === 'Essentials') return 'Essentials'
  if (group === 'ES') return 'ES'
  return ''
}

function ChipRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="relative max-lg:before:pointer-events-none max-lg:before:absolute max-lg:before:right-0 max-lg:before:top-0 max-lg:before:z-10 max-lg:before:h-full max-lg:before:w-10 max-lg:before:bg-linear-to-l max-lg:before:from-black max-lg:before:to-transparent">
      <div
        className="relative z-21 max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto scroll-smooth snap-x snap-mandatory px-4 sm:px-6 py-1.5 sm:py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label={label}
      >
        <span
          aria-hidden="true"
          className="shrink-0 w-16 text-[11px] font-semibold tracking-wider text-white/50 uppercase"
        >
          {label}
        </span>
        {children}
      </div>
    </div>
  )
}

function RefineChip({
  active,
  count,
  onClick,
  subdued = false,
  children,
}: {
  active: boolean
  count?: number
  onClick: () => void
  subdued?: boolean
  children: ReactNode
}) {
  let className =
    'snap-start shrink-0 max-lg:h-10 max-lg:px-4 max-lg:text-[15px] h-9 px-3.5 rounded-full text-sm font-medium leading-none whitespace-nowrap transition-colors '

  if (active) {
    className += 'bg-white text-zinc-900 shadow-sm max-lg:font-semibold'
  } else if (subdued) {
    className +=
      'bg-zinc-900/40 text-zinc-100 border border-zinc-500 hover:border-zinc-300 hover:text-white'
  } else {
    className +=
      'bg-transparent text-white border border-white/55 hover:bg-white/10 hover:border-white'
  }

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={className}
    >
      {children}
      {count != null && count > 0 ? (
        <span
          className={
            'ml-1 tabular-nums ' + (active ? 'text-zinc-500' : 'text-white/55')
          }
        >
          {count}
        </span>
      ) : null}
    </button>
  )
}
