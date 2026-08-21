import { Link, useLocation } from 'react-router-dom'
import type { ProductVariantRow, ProductRow } from '../../admin/products/types'
import { formatPreOrderDeadline, getProductImageUrl } from '../lib/shopFormat'
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
import {
  SHOP_DISCOUNT_BADGE,
  SHOP_PRODUCT_FRAME,
  SHOP_PRODUCT_IMG,
} from '../lib/shopUiStyle'
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
  const deadline = summary.hasPreOrder
    ? formatPreOrderDeadline(summary.preOrderUntil)
    : null

  return (
    <Link
      to={shopProductPath(product.id)}
      state={cardNavigationState(returnTo, product, variants)}
      className="group block bg-white rounded-xl shadow-sm hover:shadow-md overflow-hidden transition-all"
    >
      <div className={SHOP_PRODUCT_FRAME}>
        <ImageOrFallback
          src={imageUrl}
          alt={formatProductTitle(product)}
          imgClassName={SHOP_PRODUCT_IMG}
          fallback={<NoImagePlaceholder />}
        />
      </div>

      <div className="px-3 pt-2.5 pb-3 flex flex-col">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600 truncate">
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

        <div className="mt-3">
          {isInquiryOnly ? (
            <div className="text-sm text-gray-500 leading-none">
              {priceSummary.saleText}
            </div>
          ) : (
            <div>
              <div className="text-base sm:text-lg font-bold text-zinc-900 tabular-nums leading-none">
                {priceSummary.saleText}
              </div>
              {priceSummary.hasDiscount && priceSummary.originalText ? (
                <div className="mt-1.5 flex items-center gap-2 min-w-0 flex-wrap">
                  <span className="text-xs text-gray-400 line-through tabular-nums">
                    {priceSummary.originalText}
                  </span>
                  {priceSummary.offerCaption ? (
                    <span className={SHOP_DISCOUNT_BADGE}>
                      {priceSummary.offerCaption}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {specLine ? (
          <div className="mt-2 text-xs text-zinc-600 truncate">
            {specLine}
          </div>
        ) : null}

        {deadline ? (
          <div className="mt-1.5 text-[11px] text-gray-400">
            {deadline}
          </div>
        ) : null}
      </div>
    </Link>
  )
}
