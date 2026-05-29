import type { ProductVariantRow } from '../../admin/products/types'
import { formatVariantAttributes } from '../lib/shopFormat'

interface VariantPickerProps {
  variants: ProductVariantRow[]
  selectedVariantId: string | null
  categoryId: string | null | undefined
  onSelect: (variantId: string) => void
}

/**
 * 規格選擇器。
 *
 * 設計：把每個變體當成一張可選的小按鈕，顯示「規格摘要」。
 * 為什麼不用「按屬性分組（顏色一列、尺寸一列）」？
 * - 既有資料的 attributes 很稀疏（很多欄位是 null）
 * - 不同分類欄位差異大（救生衣 vs WB 板）
 * - 「列出所有變體」比較直觀也不會誤導（避免顯示「實際上不存在」的組合）
 *
 * 缺貨變體仍可選（會在按鈕上顯示「缺貨」），這樣客人可以詢問補貨。
 */
export function VariantPicker({
  variants,
  selectedVariantId,
  categoryId,
  onSelect,
}: VariantPickerProps) {
  if (variants.length === 0) {
    return <p className="text-sm text-gray-500">此商品目前沒有可選規格</p>
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-gray-700">
        選擇規格 <span className="text-gray-400 font-normal">Select variant</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {variants.map((v) => {
          const isSelected = v.id === selectedVariantId
          const isOutOfStock = (v.stock ?? 0) <= 0
          const attrsText = formatVariantAttributes(categoryId, v.attributes)
          const label = attrsText || '(No spec data)'

          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onSelect(v.id)}
              className={
                'relative px-3 py-2 text-sm rounded-md border-2 transition-all min-w-[80px] text-left ' +
                (isSelected
                  ? 'border-black bg-zinc-50 text-zinc-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400')
              }
              aria-pressed={isSelected}
            >
              <div className="font-medium">{label}</div>
              {isOutOfStock && (
                <div className="text-xs text-red-600 mt-0.5">Out of stock</div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
