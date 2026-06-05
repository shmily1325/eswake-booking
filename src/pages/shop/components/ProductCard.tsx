import { Link, useLocation } from 'react-router-dom'
import type { ProductVariantRow, ProductRow } from '../../admin/products/types'
import {
  formatProductPriceRange,
  getProductImageUrl,
} from '../lib/shopFormat'
import {
  getShopVisibleVariants,
  summarizeProductAvailability,
} from '../lib/productAvailability'
import { ImageOrFallback } from './ImageOrFallback'
import { NoImagePlaceholder } from './NoImagePlaceholder'
import { SHOP_LABEL } from '../lib/shopCopy'
import {
  SHOP_PRODUCT_PREVIEW_KEY,
  SHOP_RETURN_TO_KEY,
  shopListPathFromLocation,
} from '../lib/shopReturnTo'

interface ProductCardProps {
  product: ProductRow
  variants: ProductVariantRow[]
}

function cardNavigationState(
  returnTo: string,
  product: ProductRow,
  variants: ProductVariantRow[],
) {
  return {
    [SHOP_RETURN_TO_KEY]: returnTo,
    [SHOP_PRODUCT_PREVIEW_KEY]: { ...product, variants },
  }
}

export function ProductCard({ product, variants }: ProductCardProps) {
  const location = useLocation()
  const returnTo = shopListPathFromLocation(
    location.pathname,
    location.search,
  )

  const visibleVariants = getShopVisibleVariants(variants)
  const summary = summarizeProductAvailability(variants)
  const imageUrl = getProductImageUrl(product, visibleVariants.length ? visibleVariants : variants)
  const priceText = formatProductPriceRange(
    visibleVariants.length ? visibleVariants : variants,
  )
  const isInquiryOnly = priceText === '價格洽詢'

  return (
    <Link
      to={`/shop/${product.id}`}
      state={cardNavigationState(returnTo, product, variants)}
      className="group block bg-white rounded-xl shadow-sm hover:shadow-md overflow-hidden transition-all"
    >
      <div className="relative aspect-4/5 bg-gray-100 overflow-hidden">
        <ImageOrFallback
          src={imageUrl}
          alt={`${product.brand} ${product.model}`}
          imgClassName="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          fallback={<NoImagePlaceholder />}
        />

        {summary.hasPreOrder && (
          <div className="absolute top-2 left-2 max-w-[85%] bg-amber-600 text-white text-[10px] sm:text-[11px] font-semibold px-2 py-1 rounded shadow-sm leading-tight">
            {SHOP_LABEL.preOrder}
            {summary.preOrderEta ? (
              <span className="font-normal opacity-90"> · {summary.preOrderEta}</span>
            ) : null}
          </div>
        )}
      </div>

      <div className="p-3 flex flex-col">
        <div className="h-4 text-[11px] text-gray-400 uppercase tracking-wide truncate">
          {product.brand || '\u00A0'}
        </div>
        <div className="mt-0.5 text-sm sm:text-base font-semibold text-gray-900 line-clamp-2 min-h-[2.5rem] leading-snug">
          {product.model || '(Unnamed product)'}
        </div>
        <div className="mt-2 min-h-7 flex items-end">
          {isInquiryOnly ? (
            <span className="inline-block px-2 py-0.5 rounded-md bg-gray-100 text-[11px] text-gray-500 leading-none">
              {priceText}
            </span>
          ) : (
            <span className="text-base sm:text-lg font-bold text-zinc-900 leading-none tabular-nums">
              {priceText}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
