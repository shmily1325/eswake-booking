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
  SHOP_RETURN_TO_KEY,
  shopListPathFromLocation,
} from '../lib/shopReturnTo'

interface ProductCardProps {
  product: ProductRow
  variants: ProductVariantRow[]
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
      state={{ [SHOP_RETURN_TO_KEY]: returnTo }}
      className="group block bg-white rounded-xl shadow-sm hover:shadow-md overflow-hidden transition-all"
    >
      <div className="relative aspect-4/5 bg-gray-100 overflow-hidden">
        <ImageOrFallback
          src={imageUrl}
          alt={`${product.brand} ${product.model}`}
          imgClassName="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          fallback={<NoImagePlaceholder />}
        />

        {summary.primaryBadge === 'pre_order' && !summary.hasInStock && (
          <div className="absolute top-2 left-2 bg-amber-600 text-white text-[11px] font-semibold px-2 py-1 rounded">
            {SHOP_LABEL.preOrder}
            {summary.preOrderEta ? (
              <span className="font-normal opacity-90"> · {summary.preOrderEta}</span>
            ) : null}
          </div>
        )}
      </div>

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
