import { Link, useLocation } from 'react-router-dom'
import type { ProductVariantRow, ProductRow } from '../../admin/products/types'
import {
  formatOrderByLabel,
  getProductImageUrl,
} from '../lib/shopFormat'
import { summarizeProductShopPrice } from '../lib/shopPricing'
import { useShopPromo } from '../hooks/useShopPromo'
import { formatProductModelLine, formatProductTitle } from '../../admin/products/schema'
import {
  getShopVisibleVariants,
  summarizeProductAvailability,
} from '../lib/productAvailability'
import { formatCardSpecLine } from '../lib/variantSpecAxes'
import { ImageOrFallback } from './ImageOrFallback'
import { NoImagePlaceholder } from './NoImagePlaceholder'
import { SHOP_PRODUCT_IMG } from '../lib/shopUiStyle'
import { SHOP_LABEL } from '../lib/shopCopy'
import { shopProductPath } from '../lib/shopPaths'
import {
  SHOP_PRODUCT_PREVIEW_KEY,
  SHOP_RETURN_TO_KEY,
  shopListPathFromLocation,
} from '../lib/shopReturnTo'

interface ProductCardProps {
  product: ProductRow
  variants: ProductVariantRow[]
  /** 已在預購頁時省略 Pre-Order 字樣，只保留到貨時間 */
  inPreOrderView?: boolean
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

export function ProductCard({
  product,
  variants,
  inPreOrderView = false,
}: ProductCardProps) {
  const location = useLocation()
  const returnTo = shopListPathFromLocation(
    location.pathname,
    location.search,
  )

  const promo = useShopPromo()
  const visibleVariants = getShopVisibleVariants(variants)
  const summary = summarizeProductAvailability(variants)
  const imageUrl = getProductImageUrl(product, visibleVariants.length ? visibleVariants : variants)
  const priceSummary = summarizeProductShopPrice(
    visibleVariants.length ? visibleVariants : variants,
    promo.presets,
  )
  const isInquiryOnly = priceSummary.inquiry
  const specLine = formatCardSpecLine(
    product.category,
    visibleVariants.length ? visibleVariants : variants,
  )
  const orderBy =
    inPreOrderView && summary.preOrderUntil
      ? formatOrderByLabel(summary.preOrderUntil)
      : null

  return (
    <Link
      to={shopProductPath(product.id)}
      state={cardNavigationState(returnTo, product, variants)}
      className="group block bg-white rounded-xl shadow-sm hover:shadow-md overflow-hidden transition-all"
    >
      <div className="relative aspect-4/5 bg-white overflow-hidden">
        <ImageOrFallback
          src={imageUrl}
          alt={formatProductTitle(product)}
          imgClassName={SHOP_PRODUCT_IMG}
          fallback={<NoImagePlaceholder />}
        />

        {summary.hasPreOrder && !inPreOrderView && (
          <div className="absolute top-2 left-2 max-w-[85%] bg-amber-600 text-white text-[10px] sm:text-[11px] font-semibold px-2 py-1 rounded shadow-sm leading-tight">
            {SHOP_LABEL.preOrder}
            {summary.preOrderEta ? (
              <span className="font-normal opacity-90"> · {summary.preOrderEta}</span>
            ) : null}
          </div>
        )}

        {priceSummary.badge && (
          <div className="absolute top-2 right-2 bg-red-600 text-white text-[10px] sm:text-[11px] font-semibold px-2 py-1 rounded shadow-sm leading-tight">
            {priceSummary.badge}
          </div>
        )}

        {summary.hasPreOrder && inPreOrderView && summary.preOrderEta && (
          <div className="absolute top-2 left-2 max-w-[85%] rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium leading-tight text-white backdrop-blur-sm">
            {summary.preOrderEta}
          </div>
        )}
      </div>

      <div className="p-3 flex flex-col">
        <div className="h-4 text-[11px] text-gray-400 uppercase tracking-wide truncate">
          {product.brand || '\u00A0'}
        </div>
        <div className="mt-0.5 text-sm sm:text-base font-semibold text-gray-900 line-clamp-2 min-h-[2.5rem] leading-snug">
          {formatProductModelLine(product)}
        </div>
        <div className="mt-1 h-4 text-[11px] text-gray-400 truncate">
          {specLine || '\u00A0'}
        </div>
        <div className="mt-2 min-h-7 flex items-end">
          {isInquiryOnly ? (
            <span className="inline-block px-2 py-0.5 rounded-md bg-gray-100 text-[11px] text-gray-500 leading-none">
              {priceSummary.saleText}
            </span>
          ) : (
            <div className="flex flex-col gap-0.5">
              {priceSummary.hasDiscount && priceSummary.originalText && (
                <span className="text-xs text-gray-400 line-through tabular-nums leading-none">
                  {priceSummary.originalText}
                </span>
              )}
              <div className="flex items-baseline gap-1.5 min-w-0">
                <span className="text-base sm:text-lg font-bold text-zinc-900 leading-none tabular-nums">
                  {priceSummary.saleText}
                </span>
                {priceSummary.percentLabel ? (
                  <span className="text-sm sm:text-base font-black text-red-600 leading-none tabular-nums">
                    {priceSummary.percentLabel}
                  </span>
                ) : null}
              </div>
            </div>
          )}
        </div>
        {orderBy ? (
          <div className="mt-1 text-[11px] font-medium text-red-600">{orderBy}</div>
        ) : null}
      </div>
    </Link>
  )
}
