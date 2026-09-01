import type { DiscountPreset } from '../../shop/lib/shopPricing'
import { resolveShopPrice } from '../../shop/lib/shopPricing'
import type { VariantListItem } from '../products/types'

export type OrderLinePriceSuggestion = {
  unitPrice: number
  originalPrice: number | null
  discountCaption: string | null
}

/** 後台開單與商城共用同一套即時折扣規則；實際存檔後仍以訂單單價快照為準。 */
export function resolveOrderLinePrice(
  item: VariantListItem,
  presets: readonly DiscountPreset[],
): OrderLinePriceSuggestion {
  const price = resolveShopPrice(item.variant, presets)
  return {
    unitPrice: price.sale ?? item.variant.price ?? 0,
    originalPrice: price.hasDiscount ? price.original : null,
    discountCaption: price.hasDiscount ? price.caption : null,
  }
}
