import { Link, useLocation } from 'react-router-dom'
import type { ProductVariantRow, ProductRow } from '../../admin/products/types'
import { formatPreOrderFooter, getProductImageUrl } from '../lib/shopFormat'
import { summarizeProductShopPrice } from '../lib/shopPricing'
import { useShopPromo } from '../hooks/useShopPromo'
import {
  formatProductModelName,
  formatProductSecondaryLine,
  formatProductTitle,
} from '../../admin/products/schema'
import {
  getShopVisibleVariants,
  summarizeProductAvailability,
} from '../lib/productAvailability'
import { formatCardSpecLine } from '../lib/variantSpecAxes'
import { ImageOrFallback } from './ImageOrFallback'
import { NoImagePlaceholder } from './NoImagePlaceholder'
import { SHOP_PRODUCT_IMG } from '../lib/shopUiStyle'
import { shopProductPath } from '../lib/shopPaths'
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
  const modelName = formatProductModelName(product)
  const secondaryLine = formatProductSecondaryLine(product)
  const preOrderFooter = summary.hasPreOrder
    ? formatPreOrderFooter(summary.preOrderUntil)
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

        {priceSummary.badge && (
          <div className="absolute top-2 right-2 bg-red-600 text-white text-[10px] sm:text-[11px] font-semibold px-2 py-1 rounded shadow-sm leading-tight">
            {priceSummary.badge}
          </div>
        )}
      </div>

      <div className="p-3 flex flex-col">
        <div className="h-4 text-[11px] text-gray-400 uppercase tracking-wide truncate">
          {product.brand || '\u00A0'}
        </div>
        <div className="mt-0.5 text-base sm:text-lg font-black text-zinc-900 leading-tight line-clamp-2">
          {modelName}
        </div>
        {secondaryLine ? (
          <div className="mt-0.5 text-xs text-gray-500 truncate">
            {secondaryLine}
          </div>
        ) : null}

        <div className="mt-2">
          {isInquiryOnly ? (
            <span className="inline-block px-2 py-0.5 rounded-md bg-gray-100 text-[11px] text-gray-500 leading-none">
              {priceSummary.saleText}
            </span>
          ) : (
            <div>
              <div className="text-base sm:text-lg font-bold text-zinc-900 tabular-nums leading-none">
                {priceSummary.saleText}
              </div>
              {priceSummary.hasDiscount && priceSummary.originalText ? (
                <div className="mt-1 flex items-center gap-1.5 min-w-0">
                  <span className="text-[11px] text-gray-400 line-through tabular-nums">
                    {priceSummary.originalText}
                  </span>
                  {priceSummary.offerCaption ? (
                    <span className="inline-flex shrink-0 items-center rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 leading-none">
                      {priceSummary.offerCaption}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {specLine ? (
          <div className="mt-1.5 text-[11px] text-gray-400 truncate">
            {specLine}
          </div>
        ) : null}

        {preOrderFooter ? (
          <div className="mt-2 text-[10px] sm:text-[11px] font-semibold tracking-wide text-amber-800">
            {preOrderFooter}
          </div>
        ) : null}
      </div>
    </Link>
  )
}
