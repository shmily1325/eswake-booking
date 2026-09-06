import type { ProductVariantRow } from '../../admin/products/types'
import { formatPrice, formatVariantAttributes } from '../lib/shopFormat'
import { collectSpecAxes, findVariantForAxisValue, specAttrValue } from '../lib/variantSpecAxes'
import { getShopVisibleVariants, getVariantAvailability, isVariantPurchasable } from '../lib/productAvailability'
import { SHOP_DETAIL } from '../lib/shopCopy'

interface VariantPickerProps {
  variants: ProductVariantRow[]
  selectedVariantId: string | null
  categoryId: string | null | undefined
  optionConfig?: unknown
  onSelect: (variantId: string) => void
}

export function VariantPicker({ variants, selectedVariantId, categoryId, optionConfig, onSelect }: VariantPickerProps) {
  const visible = getShopVisibleVariants(variants)

  if (visible.length === 0) {
    return <p className="text-sm text-gray-500">{SHOP_DETAIL.noVariants}</p>
  }

  const axes = collectSpecAxes(categoryId, visible, optionConfig)
  const axisKeys = axes.map((axis) => axis.key)
  const selected = visible.find((v) => v.id === selectedVariantId) ?? visible[0]!

  if (axes.length > 0) {
    return (
      <div className="space-y-3">
        {axes.map((axis) => (
          <div key={axis.key}>
            <div className="text-sm font-medium text-gray-700">{axis.label}</div>
            <div className={axis.key === 'finish' ? 'mt-2 grid gap-2' : 'mt-2 flex flex-wrap gap-2'}>
              {axis.values.map((value) => {
                const targetId = findVariantForAxisValue(visible, selected.id, axis.key, value, axisKeys)
                const isSelected = specAttrValue(selected, axis.key) === value
                const target = visible.find((v) => v.id === targetId)
                const purchasable = target ? isVariantPurchasable(target) : false
                const priceLabel = target?.price != null ? formatPrice(target.price) : '價格洽詢'
                const finishNote = value === 'Full Color'
                  ? '可選顏色'
                  : value === 'Full Carbon'
                    ? '固定黑色'
                    : '標準製作'
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => targetId && onSelect(targetId)}
                    disabled={!targetId}
                    className={
                      axis.key === 'finish'
                        ? `flex min-h-16 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                            isSelected
                              ? 'border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900'
                              : purchasable
                                ? 'border-gray-200 bg-white text-zinc-800 hover:border-gray-500'
                                : 'border-gray-200 bg-gray-50 text-gray-300 line-through'
                          }`
                        : `min-h-11 min-w-14 rounded-lg border px-3 text-sm transition ${
                            isSelected
                              ? 'border-zinc-900 bg-zinc-900 font-semibold text-white'
                              : purchasable
                                ? 'border-gray-300 bg-white text-zinc-700 hover:border-zinc-700'
                                : 'border-gray-200 bg-gray-50 text-gray-300 line-through'
                          }`
                    }
                    aria-pressed={isSelected}
                  >
                    {axis.key === 'finish' ? (
                      <>
                        <span
                          aria-hidden="true"
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                            isSelected ? 'border-zinc-900' : 'border-gray-300'
                          }`}
                        >
                          {isSelected ? <span className="h-2.5 w-2.5 rounded-full bg-zinc-900" /> : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-zinc-900">{value}</span>
                          <span className="mt-0.5 block text-xs text-gray-500">{finishNote}</span>
                        </span>
                        <span className="shrink-0 text-sm font-bold text-zinc-900">
                          {priceLabel}
                        </span>
                      </>
                    ) : (
                      value
                    )}
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
            <span>{SHOP_DETAIL.variant}</span> {attrsText}
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
          const label = formatVariantAttributes(categoryId, v.attributes) || '(No spec data)'
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
