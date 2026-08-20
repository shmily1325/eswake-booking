import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { fetchDiscountPresets } from '../../admin/products/discountApi'
import {
  activePreorderPreset,
  activeTagPresets,
  resolveShopPrice,
  type DiscountPreset,
  type ShopPrice,
} from '../lib/shopPricing'
import type { ProductVariantRow } from '../../admin/products/types'

interface ShopPromoValue {
  presets: DiscountPreset[]
  ready: boolean
  resolve: (
    variant: Pick<
      ProductVariantRow,
      'price' | 'discount_preset_id' | 'availability' | 'stock' | 'pre_order_until'
    >,
  ) => ShopPrice
  preorder: DiscountPreset | null
  tags: DiscountPreset[]
}

const ShopPromoContext = createContext<ShopPromoValue | null>(null)

const EMPTY: ShopPrice = {
  original: null,
  sale: null,
  hasDiscount: false,
  badge: null,
  caption: null,
  percent: null,
  source: null,
}

export function ShopPromoProvider({ children }: { children: ReactNode }) {
  const [presets, setPresets] = useState<DiscountPreset[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const list = await fetchDiscountPresets()
        if (!cancelled) setPresets(list)
      } catch (error) {
        console.error('[shop] discount presets', error)
        if (!cancelled) setPresets([])
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo<ShopPromoValue>(() => {
    return {
      presets,
      ready,
      resolve: (variant) => resolveShopPrice(variant, presets),
      preorder: activePreorderPreset(presets),
      tags: activeTagPresets(presets),
    }
  }, [presets, ready])

  return <ShopPromoContext.Provider value={value}>{children}</ShopPromoContext.Provider>
}

export function useShopPromo(): ShopPromoValue {
  const ctx = useContext(ShopPromoContext)
  if (!ctx) {
    return {
      presets: [],
      ready: true,
      resolve: () => EMPTY,
      preorder: null,
      tags: [],
    }
  }
  return ctx
}
