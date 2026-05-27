import { Link } from 'react-router-dom'
import { ShopHeader } from './components/ShopHeader'
import { QuantityStepper } from './components/QuantityStepper'
import { useShopCart } from './hooks/useShopCart'
import type { CartItem } from './types'
import {
  formatPrice,
  formatVariantAttributes,
  getCategoryIcon,
} from './lib/shopFormat'

/**
 * 購物車頁（/shop/cart）。
 *
 * M4 內容：
 * - 列出購物車內所有品項（多商品 / 多規格）
 * - 每項可改數量、移除
 * - 顯示「預估金額」+ 是否有「價格洽詢」品項提醒
 * - 提供「清空購物車」、「繼續逛」連結
 * - 「LINE 統一詢問購買」按鈕（M5 才接 deep link）
 */
export function ShopCart() {
  const {
    items,
    totalCount,
    totalAmount,
    hasUnknownPrice,
    updateQuantity,
    removeItem,
    clear,
  } = useShopCart()

  const handleInquiry = () => {
    // M5 會接上 LINE deep link
    console.log('[shop] unified LINE inquiry (stub)', items)
    alert(`（M5 待實作）將跳轉到 LINE，預填 ${items.length} 項商品的詢問訊息`)
  }

  const handleClear = () => {
    if (items.length === 0) return
    if (window.confirm('要清空整個購物車嗎？')) clear()
  }

  return (
    <div className="min-h-screen bg-white">
      <ShopHeader showBack />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight">
            購物車
            {totalCount > 0 && (
              <span className="ml-2 text-base font-medium text-gray-500">
                （{totalCount} 件）
              </span>
            )}
          </h1>
          {items.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="text-sm text-gray-500 hover:text-red-600 transition-colors"
            >
              清空
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <EmptyCart />
        ) : (
          <>
            <ul className="space-y-3 mb-6">
              {items.map((item) => (
                <CartLine
                  key={item.variantId}
                  item={item}
                  onChangeQuantity={(q) => updateQuantity(item.variantId, q)}
                  onRemove={() => removeItem(item.variantId)}
                />
              ))}
            </ul>

            <CartSummary
              totalCount={totalCount}
              totalAmount={totalAmount}
              hasUnknownPrice={hasUnknownPrice}
              onInquiry={handleInquiry}
            />
          </>
        )}
      </main>
    </div>
  )
}

interface CartLineProps {
  item: CartItem
  onChangeQuantity: (n: number) => void
  onRemove: () => void
}

function CartLine({ item, onChangeQuantity, onRemove }: CartLineProps) {
  const icon = getCategoryIcon(item.categoryId)
  const attrsText = formatVariantAttributes(item.categoryId, item.attributes)
  const subtotal = item.unitPrice != null ? item.unitPrice * item.quantity : null

  return (
    <li className="flex gap-3 sm:gap-4 p-3 sm:p-4 bg-white border border-gray-200 rounded-lg">
      {/* 縮圖（emoji fallback；v1 不存圖片 URL 進 localStorage） */}
      <Link
        to={`/shop/${item.productId}`}
        className="flex-shrink-0 w-16 h-20 sm:w-20 sm:h-24 bg-gray-50 rounded-md flex items-center justify-center text-3xl sm:text-4xl text-gray-300 hover:bg-gray-100 transition-colors"
        aria-label="返回商品頁"
      >
        <span aria-hidden>{icon}</span>
      </Link>

      {/* 主資訊 */}
      <div className="flex-1 min-w-0 flex flex-col">
        <Link
          to={`/shop/${item.productId}`}
          className="text-sm sm:text-base font-semibold text-zinc-900 hover:text-orange-600 line-clamp-2"
        >
          {item.productName}
        </Link>
        {attrsText && (
          <div className="mt-0.5 text-xs sm:text-sm text-gray-500">
            {attrsText}
          </div>
        )}

        <div className="mt-auto pt-2 flex items-center justify-between gap-2">
          <QuantityStepper
            value={item.quantity}
            onChange={onChangeQuantity}
          />
          <div className="text-right">
            <div className="text-sm sm:text-base font-semibold text-zinc-900">
              {subtotal != null ? formatPrice(subtotal) : '價格洽詢'}
            </div>
            {item.unitPrice != null && item.quantity > 1 && (
              <div className="text-xs text-gray-500">
                單價 {formatPrice(item.unitPrice)}
              </div>
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onRemove}
        className="flex-shrink-0 self-start text-gray-400 hover:text-red-600 p-1 -m-1 transition-colors"
        aria-label="移除此商品"
        title="移除"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </li>
  )
}

interface CartSummaryProps {
  totalCount: number
  totalAmount: number
  hasUnknownPrice: boolean
  onInquiry: () => void
}

function CartSummary({
  totalCount,
  totalAmount,
  hasUnknownPrice,
  onInquiry,
}: CartSummaryProps) {
  return (
    <div className="sticky bottom-0 bg-white border-t border-gray-200 -mx-4 sm:-mx-6 px-4 sm:px-6 py-4 sm:rounded-t-lg sm:border sm:relative sm:bottom-auto sm:mx-0 sm:bg-gray-50 sm:shadow-inner">
      <div className="flex items-end justify-between mb-3">
        <div className="text-sm text-gray-600">
          預估金額（共 {totalCount} 件）
        </div>
        <div className="text-2xl font-bold text-zinc-900">
          {formatPrice(totalAmount)}
        </div>
      </div>

      {hasUnknownPrice && (
        <p className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
          ⚠️ 部分商品為「價格洽詢」，最終金額以店家報價為準
        </p>
      )}

      <button
        type="button"
        onClick={onInquiry}
        className="w-full h-12 rounded-md bg-orange-500 text-white font-semibold text-base hover:bg-orange-600 active:bg-orange-700 transition-colors shadow-sm"
      >
        📞 LINE 統一詢問購買
      </button>

      <p className="mt-3 text-xs text-gray-500 text-center leading-relaxed">
        按下後會跳到我們的官方 LINE，訊息已預填完整品項清單，按送出即可
      </p>

      <div className="mt-3 text-center">
        <Link
          to="/shop"
          className="text-sm text-gray-500 hover:text-orange-600"
        >
          ← 繼續逛商品
        </Link>
      </div>
    </div>
  )
}

function EmptyCart() {
  return (
    <div className="text-center py-16">
      <div className="text-6xl mb-4" aria-hidden>
        🛒
      </div>
      <h2 className="text-lg font-semibold text-zinc-900">購物車是空的</h2>
      <p className="mt-1 text-sm text-gray-500">
        快去挑幾樣感興趣的裝備吧
      </p>
      <Link
        to="/shop"
        className="mt-5 inline-flex items-center px-5 py-2.5 rounded-md bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 transition-colors"
      >
        ← 返回商品列表
      </Link>
    </div>
  )
}
