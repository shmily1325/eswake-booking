import type { ProductVariantRow } from '../../admin/products/types'
import { formatVariantAttributes } from '../lib/shopFormat'
import {
  getShopVisibleVariants,
  getVariantAvailability,
  isVariantPurchasable,
} from '../lib/productAvailability'
import { SHOP_DETAIL } from '../lib/shopCopy'

interface VariantPickerProps {
  variants: ProductVariantRow[]
  selectedVariantId: string | null
  categoryId: string | null | undefined
  onSelect: (variantId: string) => void
}

export function VariantPicker({
  variants,
  selectedVariantId,
  categoryId,
  onSelect,
}: VariantPickerProps) {
  // 與商城可見邏輯一致：現貨被留光（stock 全數送結帳保留）的規格視同缺貨不顯示
  const visible = getShopVisibleVariants(variants)

  if (visible.length === 0) {
    return <p className="text-sm text-gray-500">{SHOP_DETAIL.noVariants}</p>
  }

  if (visible.length === 1) {
    const v = visible[0]!
    const attrsText = formatVariantAttributes(categoryId, v.attributes)
    const avail = getVariantAvailability(v)
    if (!attrsText && avail !== 'pre_order') return null

    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {attrsText ? (
          <span className="text-gray-700">
            <span className="font-medium text-gray-500">{SHOP_DETAIL.variant}</span>
            {' '}
            {attrsText}
          </span>
        ) : null}
        {avail === 'pre_order' && (
          <span className="text-amber-700 font-medium">
            {SHOP_DETAIL.preOrder}
            {v.pre_order_eta ? (
              <span className="text-gray-500 font-normal">
                {' '}
                · 預計 {v.pre_order_eta}
              </span>
            ) : null}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-gray-700">{SHOP_DETAIL.variant}</div>
      <div className="flex flex-wrap gap-2">
        {visible.map((v) => {
          const isSelected = v.id === selectedVariantId
          const avail = getVariantAvailability(v)
          const purchasable = isVariantPurchasable(v)
          const attrsText = formatVariantAttributes(categoryId, v.attributes)
          const label = attrsText || '(No spec data)'

          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onSelect(v.id)}
              disabled={!purchasable}
              className={
                'relative px-3 py-2 text-sm rounded-md border-2 transition-all min-w-[80px] text-left ' +
                (isSelected
                  ? 'border-black bg-zinc-50 text-zinc-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400') +
                (!purchasable ? ' opacity-50 cursor-not-allowed' : '')
              }
              aria-pressed={isSelected}
            >
              <div className="font-medium">{label}</div>
              {avail === 'pre_order' && (
                <div className="text-xs text-amber-700 mt-0.5">
                  {SHOP_DETAIL.preOrder}
                  {v.pre_order_eta ? ` · ${v.pre_order_eta}` : ''}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
