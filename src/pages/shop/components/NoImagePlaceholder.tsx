/**
 * 商品沒圖時的通用佔位視覺：淺灰底 + 微淡的 ES Wake circle mark。
 *
 * 為什麼用 logo 當水印而不是分類 emoji（之前 `cat.icon`）：
 * - emoji 風格跟全站 Ronix 黑白 monochrome 衝突
 * - 用 logo 同時加強品牌印象，無圖也不會看起來是 broken state
 * - 一張通用置中 SVG 比 10 個分類 emoji 一致性高很多
 *
 * 用在：ProductCard、ShopDetail、ShopCart line item。
 */
export function NoImagePlaceholder({ className = '' }: { className?: string }) {
  return (
    <div
      className={`w-full h-full flex items-center justify-center bg-gray-100 ${className}`}
      aria-hidden
    >
      <img
        src="/logo_circle (black).png"
        alt=""
        className="w-1/2 max-w-[96px] opacity-[0.08] select-none"
        draggable={false}
      />
    </div>
  )
}
