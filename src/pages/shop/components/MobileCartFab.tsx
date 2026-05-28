import { Link, useLocation } from 'react-router-dom'
import { useShopCart } from '../hooks/useShopCart'

/**
 * 手機版浮動購物車按鈕（Floating Action Button）。
 *
 * 為什麼有這個東西：
 * - 大多數客人用手機瀏覽，往下捲之後 ShopHeader 雖然 sticky，但客人滑到很長
 *   的列表深處時，要回到 header 上的購物車 icon 還是很久
 * - 桌機畫面寬、購物車 icon 一直在右上很顯眼，所以這個 FAB 只在 < sm 出現
 *
 * 顯示規則：
 * - 只在 < sm（手機）
 * - 購物車有東西時才出現（避免空 FAB 一直在那擋畫面）
 * - 在 /shop/cart 頁時不要重複出現（客人已經在購物車頁了）
 *
 * 位置：
 * - 右下，bottom 用 calc(... + env(safe-area-inset-bottom)) 避開 iPhone home indicator
 * - z-40 蓋過 sticky header（header 是 z-30）
 */
export function MobileCartFab() {
  const { totalCount } = useShopCart()
  const location = useLocation()

  // 已經在購物車頁就不要再秀按鈕
  const onCartPage = location.pathname.endsWith('/shop/cart')
  if (onCartPage || totalCount === 0) return null

  return (
    <Link
      to="/shop/cart"
      aria-label={`View cart (${totalCount} ${totalCount === 1 ? 'item' : 'items'})`}
      className="sm:hidden fixed right-4 z-40 inline-flex items-center justify-center w-14 h-14 rounded-full bg-black text-white shadow-lg shadow-black/30 active:scale-95 transition-transform"
      style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-6 h-6"
        aria-hidden
      >
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
      <span
        className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-white text-black text-[11px] font-bold leading-none ring-2 ring-black"
        aria-hidden
      >
        {totalCount > 99 ? '99+' : totalCount}
      </span>
    </Link>
  )
}
