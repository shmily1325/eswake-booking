import type { ShopGroup } from '../../admin/products/schema'
import { ShopFilterPanel } from './ShopFilterPanel'
import type { ShopFilterState, TopLevel } from '../lib/shopFilters'

interface ShopFilterSidebarProps {
  filters: ShopFilterState
  groupCounts: Map<ShopGroup, number>
  categoryCounts: Map<string, number>
  brandCounts: Map<string, number>
  onTopLevelChange: (v: TopLevel) => void
  onSubCatChange: (v: string) => void
  onToggleBrand: (brand: string) => void
}

export function ShopFilterSidebar(props: ShopFilterSidebarProps) {
  return (
    <aside className="hidden lg:block w-[260px] shrink-0">
      <div className="sticky top-[7.5rem] max-h-[calc(100vh-8rem)] overflow-y-auto pr-2 pb-8">
        <ShopFilterPanel {...props} />
      </div>
    </aside>
  )
}
