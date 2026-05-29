import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useShopCart } from '../hooks/useShopCart'

/**
 * 「已加入購物車」浮動提示。
 *
 * - 監聽 cart context 的 lastAdded
 * - 從畫面右上滑入
 * - 3 秒後自動消失
 * - 也可點 X 立刻關閉
 *
 * 為什麼不用既有 src/components/ui/Toast？
 * 它預期在已登入頁面使用，且 API 偏向「error/warn/success」。
 * 商城這邊只需要一種「加入購物車成功」訊息，做簡單版即可。
 */
export function CartAddedToast() {
  const { lastAdded, dismissLastAdded } = useShopCart()

  useEffect(() => {
    if (!lastAdded) return
    const t = window.setTimeout(() => dismissLastAdded(), 3000)
    return () => window.clearTimeout(t)
  }, [lastAdded, dismissLastAdded])

  if (!lastAdded) return null

  return (
    <div
      className="fixed top-16 right-4 z-50 max-w-xs animate-[slideInRight_0.25s_ease-out] bg-white border border-zinc-200 shadow-xl rounded-lg overflow-hidden"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3 p-3">
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-black text-white flex items-center justify-center text-lg">
          ✓
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-zinc-900">
            Added to cart
          </div>
          <div className="mt-0.5 text-xs text-gray-600 truncate">
            {lastAdded.name} × {lastAdded.quantity}
          </div>
          <Link
            to="/shop/cart"
            className="mt-2 inline-block text-xs font-medium text-black underline underline-offset-2 hover:text-zinc-700"
            onClick={dismissLastAdded}
          >
            View cart →
          </Link>
        </div>
        <button
          type="button"
          onClick={dismissLastAdded}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 p-1"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>

      {/* keyframes 寫在 JSX 內，避免改動全域 index.css */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
