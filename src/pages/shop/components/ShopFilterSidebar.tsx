import { ShopBrandFilter } from './ShopBrandFilter'
import { ShopSizeFilter } from './ShopSizeFilter'
import type { ShopFilterState } from '../lib/shopFilters'
import { SHOP_LABEL } from '../lib/shopCopy'

interface ShopFilterSidebarProps {
  filters: ShopFilterState
  brandCounts: Map<string, number>
  sizeCounts: Map<string, number>
  onToggleBrand: (brand: string) => void
  onToggleSize: (size: string) => void
}

/** 桌機 refine sidebar：品牌 + 尺碼（分類在上方 chips） */
export function ShopFilterSidebar({
  filters,
  brandCounts,
  sizeCounts,
  onToggleBrand,
  onToggleSize,
}: ShopFilterSidebarProps) {
  const showBrand =
    brandCounts.size >= 2 || filters.brands.some((b) => brandCounts.has(b))
  const showSize =
    sizeCounts.size >= 2 || filters.sizes.some((s) => sizeCounts.has(s))
  if (!showBrand && !showSize) return null

  return (
    <aside className="hidden lg:block w-[220px] shrink-0">
      <div className="sticky top-30 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2 pb-8">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400 mb-3">
          {SHOP_LABEL.filter}
        </h2>
        <div className="space-y-6">
          {showBrand && (
            <ShopBrandFilter
              filters={filters}
              brandCounts={brandCounts}
              onToggleBrand={onToggleBrand}
              layout="list"
            />
          )}
          {showSize && (
            <ShopSizeFilter
              filters={filters}
              sizeCounts={sizeCounts}
              onToggleSize={onToggleSize}
            />
          )}
        </div>
      </div>
    </aside>
  )
}
