/**
 * 庫存系統的應用層型別。
 *
 * 直接從 src/types/supabase.ts 取出 Row 型別，確保跟 DB schema 一致。
 * attributes 是 JSONB，DB 上是 Json 型別，但業務上一定是物件，因此這裡幫忙窄化為
 * Record<string, AttributeValue>，之後 UI 不需要每次都做型別判斷。
 */

import type { Database } from '../../../types/supabase'

/** attributes JSONB 內合理的值類型（select/text 用 string，number 用 number） */
export type AttributeValue = string | number | null

export type ProductRow = Database['public']['Tables']['products']['Row']

type RawVariantRow = Database['public']['Tables']['product_variants']['Row']

export type ProductVariantRow = Omit<RawVariantRow, 'attributes'> & {
  attributes: Record<string, AttributeValue>
}

/** 列表頁要用的合併型別：商品 + 它的所有 SKU */
export interface ProductWithVariants extends ProductRow {
  variants: ProductVariantRow[]
}

/** 列表頁顯示的扁平化單列：每個 SKU 一列，但帶上商品資訊 */
export interface VariantListItem {
  variant: ProductVariantRow
  product: ProductRow
}
