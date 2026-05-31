import { Link } from 'react-router-dom'
import type { ProductVariantRow, ProductRow } from '../../admin/products/types'
import {
  formatProductPriceRange,
  getProductImageUrl,
  isProductOutOfStock,
} from '../lib/shopFormat'
import { ImageOrFallback } from './ImageOrFallback'
import { NoImagePlaceholder } from './NoImagePlaceholder'

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
 * - 圖：第一個 SKU 的封面（或實品照 fallback）；沒有就用分類 emoji
 * - 標題：brand + model
 * - 價格：最低價（多規格時加「起」），全 null 顯示「價格洽詢」
 * - 缺貨：所有變體 stock <= 0 時掛「缺貨」標籤
 */
export function ProductCard({ product, variants }: ProductCardProps) {
  const imageUrl = getProductImageUrl(product, variants)
  const outOfStock = isProductOutOfStock(variants)
  const priceText = formatProductPriceRange(variants)

  /**
   * 區分「真有價格」與「價格洽詢」：
   * - 有價格：粗體主標
   * - 價格洽詢：降階為淺灰小標籤，避免在 grid 裡每張卡都用粗體大字喊「洽詢」
   */
  const isInquiryOnly = priceText === '價格洽詢'

  return (
    <Link
      to={`/shop/${product.id}`}
      className="group block bg-white rounded-xl shadow-sm hover:shadow-md overflow-hidden transition-all"
    >
      {/* 圖片區（4:5 比例，比 9:16 矮一截，瀏覽時一屏能看到更多） */}
      <div className="relative aspect-4/5 bg-gray-100 overflow-hidden">
        <ImageOrFallback
          src={imageUrl}
          alt={`${product.brand} ${product.model}`}
          imgClassName="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          fallback={<NoImagePlaceholder />}
        />

        {outOfStock && (
          <div className="absolute top-2 left-2 bg-zinc-900/85 text-white text-xs font-medium px-2 py-1 rounded">
            Out of Stock
          </div>
        )}
      </div>

      {/* 文字區（padding 收緊；價格依「有/沒有數字」用不同樣式） */}
      <div className="p-3">
        {product.brand && (
          <div className="text-[11px] text-gray-400 uppercase tracking-wide">
            {product.brand}
          </div>
        )}
        <div className="mt-0.5 text-sm sm:text-base font-semibold text-gray-900 line-clamp-2 min-h-9 leading-snug">
          {product.model || '(Unnamed product)'}
        </div>
        <div className="mt-2">
          {isInquiryOnly ? (
            <span className="inline-block px-2 py-0.5 rounded-md bg-gray-100 text-[11px] text-gray-500">
              {priceText}
            </span>
          ) : (
            <span className="text-base sm:text-lg font-bold text-zinc-900">
              {priceText}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
