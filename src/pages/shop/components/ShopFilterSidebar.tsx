import type { ShopGroup } from '../../admin/products/schema'
import { ShopFilterPanel } from './ShopFilterPanel'
import type { ShopFilterState, TopLevel } from '../lib/shopFilters'
import { SHOP_LABEL } from '../lib/shopCopy'

interface ShopFilterSidebarProps {
  filters: ShopFilterState
  preOrderCount: number
  groupCounts: Map<ShopGroup, number>
  categoryCounts: Map<string, number>
  brandCounts: Map<string, number>
  onSelectAll: () => void
  onPreOrderOnlyChange: (v: boolean) => void
  onSelectCategory: (topLevel: TopLevel, subCat?: string) => void
  onToggleBrand: (brand: string) => void
}

/** 桌機 refine sidebar：預購 + 品牌（分類在上方 chips） */
export function ShopFilterSidebar(props: ShopFilterSidebarProps) {
  return (
    <aside className="hidden lg:block w-[220px] shrink-0">
      <div className="sticky top-30 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2 pb-8">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400 mb-3">
          {SHOP_LABEL.filter}
        </h2>
        <ShopFilterPanel {...props} hideCategory />
      </div>
    </aside>
  )
}
