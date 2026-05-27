import { Link } from 'react-router-dom'
import type { ProductVariantRow, ProductRow } from '../../admin/products/types'
import {
  formatProductPriceRange,
  getCategoryIcon,
  getProductImageUrl,
  isProductOutOfStock,
} from '../lib/shopFormat'

interface ProductCardProps {
  product: ProductRow
  variants: ProductVariantRow[]
}

/**
 * 商品卡片（列表頁用）。
 *
 * 設計：圖大、文字精簡。參考 eswakeschool.com 卡片風格（大圖在上、文字在下）。
 * 點整張卡片進詳情頁。
 *
 * 顯示策略：
 * - 圖：第一個有 image_url 的變體；沒有就用分類 emoji
 * - 標題：brand + model
 * - 價格：最低價（多規格時加「起」），全 null 顯示「價格洽詢」
 * - 缺貨：所有變體 stock <= 0 時掛「缺貨」標籤
 */
export function ProductCard({ product, variants }: ProductCardProps) {
  const imageUrl = getProductImageUrl(variants)
  const outOfStock = isProductOutOfStock(variants)
  const priceText = formatProductPriceRange(variants)
  const fallbackIcon = getCategoryIcon(product.category)

  return (
    <Link
      to={`/shop/${product.id}`}
      className="group block bg-white rounded-xl shadow-sm hover:shadow-md overflow-hidden transition-all"
    >
      {/* 圖片區（9:16 直式，貼合手機照片比例與直式商品照） */}
      <div className="relative aspect-[9/16] bg-gray-100 overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`${product.brand} ${product.model}`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl text-gray-300">
            <span aria-hidden>{fallbackIcon}</span>
          </div>
        )}

        {outOfStock && (
          <div className="absolute top-2 left-2 bg-zinc-900/85 text-white text-xs font-medium px-2 py-1 rounded">
            缺貨
          </div>
        )}
      </div>

      {/* 文字區 */}
      <div className="p-3 sm:p-4">
        {product.brand && (
          <div className="text-xs text-gray-500 uppercase tracking-wide">
            {product.brand}
          </div>
        )}
        <div className="mt-0.5 text-sm sm:text-base font-semibold text-gray-900 line-clamp-2 min-h-[2.5rem]">
          {product.model || '(未命名商品)'}
        </div>
        <div className="mt-2 text-base sm:text-lg font-bold text-zinc-900">
          {priceText}
        </div>
      </div>
    </Link>
  )
}
