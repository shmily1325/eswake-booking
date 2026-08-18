import type { ProductVariantRow } from '../../admin/products/types'
import { formatVariantAttributes } from '../lib/shopFormat'
import {
  collectSpecAxes,
  findVariantForAxisValue,
  specAttrValue,
} from '../lib/variantSpecAxes'
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
  const visible = getShopVisibleVariants(variants)

  if (visible.length === 0) {
    return <p className="text-sm text-gray-500">{SHOP_DETAIL.noVariants}</p>
  }

  const axes = collectSpecAxes(categoryId, visible)
  const selected = visible.find((v) => v.id === selectedVariantId) ?? visible[0]!

  if (axes.length > 0) {
    return (
      <div className="space-y-3">
        {axes.map((axis) => (
          <div key={axis.key}>
            <div className="text-xs text-gray-400">{axis.label}</div>
            <div className="mt-0.5 flex flex-wrap gap-x-1">
              {axis.values.map((value) => {
                const targetId = findVariantForAxisValue(
                  visible,
                  selected.id,
                  axis.key,
                  value,
                )
                const isSelected = specAttrValue(selected, axis.key) === value
                const target = visible.find((v) => v.id === targetId)
                const purchasable = target ? isVariantPurchasable(target) : false
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => targetId && onSelect(targetId)}
                    disabled={!targetId}
                    className={
                      'min-h-11 min-w-11 px-1.5 text-sm transition-colors ' +
                      (isSelected
                        ? 'font-semibold text-zinc-900'
                        : purchasable
                          ? 'text-gray-400 hover:text-zinc-700'
                          : 'text-gray-300 line-through')
                    }
                    aria-pressed={isSelected}
                  >
                    {value}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (visible.length === 1) {
    const attrsText = formatVariantAttributes(categoryId, selected.attributes)
    const avail = getVariantAvailability(selected)
    if (!attrsText && avail !== 'pre_order') return null
    return (
      <div className="text-sm text-gray-400">
        {attrsText ? (
          <>
            <span>{SHOP_DETAIL.variant}</span>
            {' '}
            {attrsText}
          </>
        ) : null}
      </div>
    )
  }

  return (
    <div>
      <div className="text-xs text-gray-400">{SHOP_DETAIL.variant}</div>
      <div className="mt-0.5 flex flex-wrap gap-x-1">
        {visible.map((v) => {
          const isSelected = v.id === selectedVariantId
          const purchasable = isVariantPurchasable(v)
          const label =
            formatVariantAttributes(categoryId, v.attributes) || '(No spec data)'
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onSelect(v.id)}
              disabled={!purchasable}
              className={
                'min-h-11 px-1.5 text-sm transition-colors ' +
                (isSelected
                  ? 'font-semibold text-zinc-900'
                  : purchasable
                    ? 'text-gray-400 hover:text-zinc-700'
                    : 'text-gray-300 line-through')
              }
              aria-pressed={isSelected}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
