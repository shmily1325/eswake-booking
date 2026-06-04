import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShopHeader } from './components/ShopHeader'
import { QuantityStepper } from './components/QuantityStepper'
import { LineInquiryModal } from './components/LineInquiryModal'
import { ImageOrFallback } from './components/ImageOrFallback'
import { useShopCart } from './hooks/useShopCart'
import type { CartItem } from './types'
import {
  formatPrice,
  formatVariantAttributes,
} from './lib/shopFormat'
import { NoImagePlaceholder } from './components/NoImagePlaceholder'
import { buildCartInquiry, launchInquiry } from './lib/lineDeepLink'

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

  /** 桌機 fallback modal 的訊息；null = 不顯示 */
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'Cart | ES Wake Shop'
  }, [])

  const handleInquiry = () => {
    if (items.length === 0) return
    const payload = buildCartInquiry(items)
    if (payload.stillTooLong) {
      const ok = window.confirm(
        `購物車品項較多，預填訊息可能過長導致 LINE 無法完整顯示。\n建議分批詢問（先送一半，再回來把剩下的送出）。\n\n要繼續嗎？`
      )
      if (!ok) return
    }
    const result = launchInquiry(payload)
    if (result.mode === 'desktop-fallback') {
      setFallbackMessage(result.message)
    }
  }

  const handleClear = () => {
    if (items.length === 0) return
    if (window.confirm('要清空整個購物車嗎？')) clear()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ShopHeader showBack />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight">
            Cart
            {totalCount > 0 && (
              <span className="ml-2 text-base font-medium text-gray-500">
                ({totalCount} {totalCount === 1 ? 'item' : 'items'})
              </span>
            )}
          </h1>
          {items.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="text-sm text-gray-500 hover:text-red-600 transition-colors"
            >
              Clear
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

      <LineInquiryModal
        message={fallbackMessage}
        onClose={() => setFallbackMessage(null)}
      />
    </div>
  )
}

interface CartLineProps {
  item: CartItem
  onChangeQuantity: (n: number) => void
  onRemove: () => void
}

function CartLine({ item, onChangeQuantity, onRemove }: CartLineProps) {
  const attrsText = formatVariantAttributes(item.categoryId, item.attributes)
  const subtotal = item.unitPrice != null ? item.unitPrice * item.quantity : null

  return (
    <li className="flex gap-3 sm:gap-4 p-3 sm:p-4 bg-white rounded-xl shadow-sm">
      {/* 縮圖：優先用 snapshot 圖片，沒有就 ES Wake logo 水印佔位 */}
      <Link
        to={`/shop/${item.productId}`}
        className="flex-shrink-0 w-16 h-20 sm:w-20 sm:h-24 rounded-md overflow-hidden hover:opacity-90 transition-opacity"
        aria-label="Back to product"
      >
        <ImageOrFallback
          src={item.imageUrl}
          alt={item.productName}
          imgClassName="w-full h-full object-cover"
          fallback={<NoImagePlaceholder />}
        />
      </Link>

      {/* 主資訊 */}
      <div className="flex-1 min-w-0 flex flex-col">
        <Link
          to={`/shop/${item.productId}`}
          className="text-sm sm:text-base font-semibold text-zinc-900 hover:text-black underline-offset-2 hover:underline line-clamp-2"
        >
          {item.productName}
        </Link>
        {attrsText && (
          <div className="mt-0.5 text-xs sm:text-sm text-gray-500">
            {attrsText}
          </div>
        )}
        {item.availability === 'pre_order' && (
          <span className="mt-1 inline-block text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
            預購
          </span>
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
        aria-label="Remove item"
        title="Remove"
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
    <div className="sticky bottom-0 bg-white border-t border-gray-200 -mx-4 px-4 py-4 sm:relative sm:bottom-auto sm:mx-0 sm:px-6 sm:py-5 sm:border-0 sm:rounded-xl sm:shadow-sm">
      <div className="flex items-end justify-between mb-3">
        <div className="text-sm text-gray-600">
          預估金額（共 {totalCount} 件）
        </div>
        <div className="text-2xl font-bold text-zinc-900">
          {formatPrice(totalAmount)}
        </div>
      </div>

      {hasUnknownPrice && (
        <p className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 flex items-start gap-1.5">
          <AlertIcon className="w-3.5 h-3.5 shrink-0 mt-px" />
          <span>部分商品為洽詢價，最終金額以官方 LINE報價為準</span>
        </p>
      )}

      <button
        type="button"
        onClick={onInquiry}
        className="w-full h-12 rounded-md bg-black text-white font-semibold text-base hover:bg-zinc-800 active:bg-zinc-700 transition-colors shadow-sm inline-flex items-center justify-center gap-2"
      >
        <LineIcon className="w-5 h-5" />
        <span>用 LINE 詢問</span>
        <span className="text-sm font-normal text-zinc-300">Inquire via LINE</span>
      </button>

      <p className="mt-3 text-xs text-gray-500 text-center leading-relaxed">
        Opens LINE with your full item list pre-filled — just hit send.
      </p>

      <div className="mt-3 text-center">
        <Link
          to="/shop"
          className="text-sm text-gray-500 hover:text-black"
        >
          ← Continue shopping
        </Link>
      </div>
    </div>
  )
}

function EmptyCart() {
  return (
    <div className="text-center py-16">
      <EmptyCartIllustration className="mx-auto mb-4 w-14 h-14 text-gray-300" />
      <h2 className="text-lg font-semibold text-zinc-900">購物車是空的</h2>
      <p className="mt-1 text-sm text-gray-500">
        先去挑幾件感興趣的裝備吧
      </p>
      <Link
        to="/shop"
        className="mt-5 inline-flex items-center px-5 py-2.5 rounded-md bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 transition-colors"
      >
        ← Browse products
      </Link>
    </div>
  )
}

/** 小型警示三角（給 inline 警告字句用，size 比 state page 的 icon 小一階） */
function AlertIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

/** 空購物車插畫：線稿購物車 icon，比 header 的 cart icon 略大略線粗 */
function EmptyCartIllustration({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
      <path d="M3 4h2l2.5 12.5a1.5 1.5 0 0 0 1.5 1.2h9.6a1.5 1.5 0 0 0 1.5-1.2L21 8H6" />
    </svg>
  )
}

// 跟 ShopDetail 用的 LINE icon 同樣的 SVG（手調，免引 icon library）
function LineIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 3C6.48 3 2 6.74 2 11.31c0 4.05 3.54 7.46 8.32 8.16.32.07.76.21.87.49.1.25.07.64.03.9l-.14.85c-.04.25-.2.99.86.54 1.06-.45 5.73-3.38 7.82-5.78C20.95 14.96 22 13.27 22 11.31 22 6.74 17.52 3 12 3zM8.34 13.74h-2c-.29 0-.52-.24-.52-.52V9.74c0-.29.23-.52.52-.52.29 0 .52.23.52.52v2.95h1.48c.29 0 .52.23.52.52 0 .29-.23.53-.52.53zm1.79-.52c0 .29-.23.52-.52.52-.29 0-.52-.23-.52-.52V9.74c0-.29.23-.52.52-.52.29 0 .52.23.52.52v3.48zm4.07 0c0 .22-.14.42-.36.49-.06.02-.11.03-.17.03-.16 0-.32-.07-.42-.21l-1.83-2.49v2.19c0 .29-.23.52-.52.52-.29 0-.52-.23-.52-.52V9.74c0-.22.14-.42.36-.49.06-.02.11-.03.17-.03.16 0 .32.08.41.21l1.84 2.49V9.74c0-.29.23-.52.52-.52.29 0 .52.23.52.52v3.48zm3.32-2.27c.29 0 .52.23.52.52 0 .29-.23.52-.52.52h-1.48v.71h1.48c.29 0 .52.23.52.52 0 .29-.23.53-.52.53h-2c-.29 0-.52-.24-.52-.52V9.74c0-.29.23-.52.52-.52h2c.29 0 .52.23.52.52 0 .29-.23.52-.52.52h-1.48v.71h1.48z" />
    </svg>
  )
}
