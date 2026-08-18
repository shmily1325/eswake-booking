import { type ShopFilterState } from '../lib/shopFilters'
import { SHOP_LABEL } from '../lib/shopCopy'

interface ShopPreOrderRefineBarProps {
  filters: ShopFilterState
  brandCounts: Map<string, number>
  onSelectBrand: (brand: string | null) => void
}

/**
 * 預購頁主篩：只留品牌一排，貼在 hero 下黑底，取代運動分類 chips。
 */
export function ShopPreOrderRefineBar({
  filters,
  brandCounts,
  onSelectBrand,
}: ShopPreOrderRefineBarProps) {
  const brands = [...brandCounts.entries()].sort(([a], [b]) => a.localeCompare(b))
  if (brands.length === 0) return null

  const selectedBrand = filters.brands[0] ?? null

  return (
    <div className="relative max-lg:before:pointer-events-none max-lg:before:absolute max-lg:before:right-0 max-lg:before:top-0 max-lg:before:z-10 max-lg:before:h-full max-lg:before:w-10 max-lg:before:bg-linear-to-l max-lg:before:from-black max-lg:before:to-transparent">
      <div
        className="relative z-21 max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto scroll-smooth snap-x snap-mandatory px-4 sm:px-6 py-2 sm:py-2.5 pb-2 sm:pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label={SHOP_LABEL.brand}
      >
        <BrandChip
          active={selectedBrand == null}
          onClick={() => onSelectBrand(null)}
        >
          {SHOP_LABEL.all}
        </BrandChip>
        {brands.map(([brand, count]) => (
          <BrandChip
            key={brand}
            active={selectedBrand === brand}
            count={count}
            onClick={() => onSelectBrand(brand)}
          >
            {brand}
          </BrandChip>
        ))}
      </div>
    </div>
  )
}

function BrandChip({
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
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        'snap-start shrink-0 max-lg:h-10 max-lg:px-4 max-lg:text-[15px] h-9 px-3.5 rounded-full text-sm font-medium leading-none whitespace-nowrap transition-colors ' +
        (active
          ? 'bg-white text-zinc-900 shadow-sm max-lg:font-semibold'
          : 'bg-transparent text-white border border-white/55 hover:bg-white/10 hover:border-white')
      }
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
