import { useEffect } from 'react'
import type { ShopGroup } from '../../admin/products/schema'
import { ShopFilterPanel } from './ShopFilterPanel'
import type { ShopFilterState, TopLevel } from '../lib/shopFilters'

interface ShopFilterDrawerProps {
  open: boolean
  resultCount: number
  filters: ShopFilterState
  groupCounts: Map<ShopGroup, number>
  categoryCounts: Map<string, number>
  brandCounts: Map<string, number>
  onClose: () => void
  onSelectCategory: (topLevel: TopLevel, subCat?: string) => void
  onToggleBrand: (brand: string) => void
  onClearAll: () => void
}

/**
 * 手機版篩選：全屏遮罩 + 底部 sheet。
 * 「Show N results」sticky 在底部，符合手機 primary UX。
 */
export function ShopFilterDrawer({
  open,
  resultCount,
  filters,
  groupCounts,
  categoryCounts,
  brandCounts,
  onClose,
  onSelectCategory,
  onToggleBrand,
  onClearAll,
}: ShopFilterDrawerProps) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close filters"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[92vh] flex-col rounded-t-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-bold text-zinc-900">Filter</h2>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClearAll}
              className="text-sm text-gray-500 underline underline-offset-2"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100"
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 overscroll-contain">
          <ShopFilterPanel
            filters={filters}
            groupCounts={groupCounts}
            categoryCounts={categoryCounts}
            brandCounts={brandCounts}
            onSelectCategory={onSelectCategory}
            onToggleBrand={onToggleBrand}
          />
        </div>

        <div className="shrink-0 p-4 border-t border-gray-100 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-12 rounded-lg bg-black text-white text-sm font-semibold"
          >
            Show {resultCount} {resultCount === 1 ? 'result' : 'results'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
