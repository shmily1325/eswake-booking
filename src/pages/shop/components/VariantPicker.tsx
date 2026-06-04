import type { ProductVariantRow } from '../../admin/products/types'
import { formatVariantAttributes } from '../lib/shopFormat'
import {
  getVariantAvailability,
  isVariantPurchasable,
} from '../lib/productAvailability'
import { SHOP_LABEL } from '../lib/shopCopy'

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
  const visible = variants.filter((v) => getVariantAvailability(v) !== 'sold_out')

  if (visible.length === 0) {
    return <p className="text-sm text-gray-500">此商品目前沒有可選規格</p>
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-gray-700">
        選擇規格 <span className="text-gray-400 font-normal">Select variant</span>
      </div>
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
                  {SHOP_LABEL.preOrder}
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
