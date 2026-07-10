/**
 * 庫存系統的資料層 helper：商品 + SKU 的 CRUD。
 *
 * 庫存增加時 DB trigger 會更新 last_stock_in_at；扣庫不動。
 * stock_movements 異動表留 Phase 2。
 */

import { supabase } from '../../../lib/supabase'
import type { Database } from '../../../types/supabase'
import type { AttributeValue, ProductRow, ProductVariantRow, ProductWithVariants, VariantListItem } from './types'
import { deriveVariantAvailability } from './availabilityHelpers'
import { getCategoryLabelCode } from './schema'
import { buildLabelPrefix, composeLabelCode, maxLabelSeq } from './labelCode'

type VariantInsert = Database['public']['Tables']['product_variants']['Insert']
type VariantUpdate = Database['public']['Tables']['product_variants']['Update']

export interface FetchProductsOptions {
  /**
   * true 時只回 is_public=true 的商品（商城前台用）；
   * 不設或 false 則回所有 is_active 商品（後台用）。
   */
  publicOnly?: boolean
}

/**
 * 載入所有有效商品 + 它們的 SKU。
 * 排序：依商品 brand/model；每個商品內依 SKU updated_at desc。
 */
export async function fetchAllProductsWithVariants(
  options: FetchProductsOptions = {},
): Promise<ProductWithVariants[]> {
  let query = supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
  if (options.publicOnly) query = query.eq('is_public', true)
  const { data: products, error: pe } = await query
    .order('brand', { ascending: true })
    .order('model', { ascending: true })
  if (pe) throw pe

  const productList = (products ?? []) as unknown as ProductRow[]
  if (productList.length === 0) return []

  const ids = productList.map((p) => p.id)
  const { data: variants, error: ve } = await supabase
    .from('product_variants')
    .select('*')
    .in('product_id', ids)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
  if (ve) throw ve

  const variantList = (variants ?? []) as unknown as ProductVariantRow[]
  const byProduct = new Map<string, ProductVariantRow[]>()
  for (const v of variantList) {
    const arr = byProduct.get(v.product_id)
    if (arr) arr.push(v)
    else byProduct.set(v.product_id, [v])
  }
  return productList.map((p) => ({ ...p, variants: byProduct.get(p.id) ?? [] }))
}

/**
 * 把「商品 + 多 SKU」的階層資料攤平成一筆一個 SKU 的清單，方便列表 UI。
 * 沒有 SKU 的商品會跳過（避免空列）。
 */
export function flattenToVariantItems(list: ProductWithVariants[]): VariantListItem[] {
  const out: VariantListItem[] = []
  for (const p of list) {
    for (const v of p.variants) {
      out.push({ variant: v, product: p })
    }
  }
  return out
}

/** 載入單一商品（含 SKU），用於編輯頁／商城詳情 */
export async function fetchProductWithVariants(productId: string): Promise<ProductWithVariants | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*, product_variants(*)')
    .eq('id', productId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  const row = data as ProductRow & {
    product_variants?: ProductVariantRow[] | null
  }
  const variants = (row.product_variants ?? [])
    .filter((v) => v.is_active)
    .sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0
      return ta - tb
    })
  const { product_variants: _omit, ...product } = row
  return { ...(product as ProductRow), variants }
}

export interface CreateProductInput {
  category: string
  brand: string
  model: string
  description?: string | null
  cover_image_url?: string | null
  cover_image_path?: string | null
  /** 是否對外公開（商城可見），預設 true（上架到商城） */
  is_public?: boolean
  created_by?: string | null
}

export async function createProduct(input: CreateProductInput): Promise<ProductRow> {
  const { data, error } = await supabase
    .from('products')
    .insert({
      category: input.category,
      brand: input.brand.trim(),
      model: input.model.trim(),
      description: input.description?.trim() || null,
      cover_image_url: input.cover_image_url ?? null,
      cover_image_path: input.cover_image_path ?? null,
      is_public: input.is_public ?? true,
      created_by: input.created_by ?? null,
      updated_by: input.created_by ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data as unknown as ProductRow
}

export interface UpdateProductInput {
  brand?: string
  model?: string
  description?: string | null
  category?: string
  cover_image_url?: string | null
  cover_image_path?: string | null
  is_public?: boolean
  updated_by?: string | null
}

export async function updateProduct(productId: string, input: UpdateProductInput): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (input.brand !== undefined) patch.brand = input.brand.trim()
  if (input.model !== undefined) patch.model = input.model.trim()
  if (input.description !== undefined) patch.description = input.description?.trim() || null
  if (input.category !== undefined) patch.category = input.category
  if (input.cover_image_url !== undefined) patch.cover_image_url = input.cover_image_url
  if (input.cover_image_path !== undefined) patch.cover_image_path = input.cover_image_path
  if (input.is_public !== undefined) patch.is_public = input.is_public
  if (input.updated_by !== undefined) patch.updated_by = input.updated_by
  if (Object.keys(patch).length === 0) return

  const { error } = await supabase.from('products').update(patch).eq('id', productId)
  if (error) throw error
}

/** 軟刪商品：is_active = false（連帶它的 variants 會在列表查詢時被過濾） */
export async function deleteProduct(productId: string): Promise<void> {
  const { error } = await supabase.from('products').update({ is_active: false }).eq('id', productId)
  if (error) throw error
  // 同時把它的 variants 也設為 inactive，避免列表撈到孤兒
  await supabase.from('product_variants').update({ is_active: false }).eq('product_id', productId)
}

export interface CreateVariantInput {
  product_id: string
  label_code?: string | null
  vendor_code?: string | null
  attributes: Record<string, AttributeValue>
  /** null = 售價待補（前端顯示「缺」）；0 = 真的免費贈品 */
  price: number | null
  cost?: number | null
  stock?: number
  availability?: string
  /** 與 availability 二擇一；後台 UI 只傳這個，由系統推導 availability */
  acceptPreOrder?: boolean
  pre_order_eta?: string | null
  pre_order_note?: string | null
  cover_image_url?: string | null
  cover_image_path?: string | null
  image_url?: string | null
  image_path?: string | null
}

/** 把使用者輸入的售價正規化為 NULL 或非負整數 */
function normalizePrice(v: number | null | undefined): number | null {
  if (v === null || v === undefined) return null
  if (!Number.isFinite(v)) return null
  return Math.max(0, Math.round(v))
}

function resolveAvailabilityFields(input: {
  availability?: string
  /** 與 availability 二擇一；後台 UI 只傳這個，由系統推導 availability */
  acceptPreOrder?: boolean
  pre_order_eta?: string | null
  pre_order_note?: string | null
  stock: number
}): {
  availability: string
  pre_order_eta: string | null
  pre_order_note: string | null
} {
  const stock = Math.max(0, Math.round(input.stock))

  if (input.acceptPreOrder !== undefined) {
    return {
      availability: deriveVariantAvailability(stock, input.acceptPreOrder),
      pre_order_eta: null,
      pre_order_note: null,
    }
  }

  if (
    input.availability === 'pre_order' ||
    input.availability === 'sold_out' ||
    input.availability === 'in_stock'
  ) {
    const availability =
      stock > 0 ? 'in_stock' : input.availability === 'pre_order' ? 'pre_order' : 'sold_out'
    return {
      availability,
      pre_order_eta: availability === 'pre_order' ? input.pre_order_eta?.trim() || null : null,
      pre_order_note: availability === 'pre_order' ? input.pre_order_note?.trim() || null : null,
    }
  }

  return {
    availability: deriveVariantAvailability(stock, false),
    pre_order_eta: null,
    pre_order_note: null,
  }
}

export async function createVariant(input: CreateVariantInput): Promise<ProductVariantRow> {
  const stock = Math.max(0, Math.round(input.stock ?? 0))
  const availFields = resolveAvailabilityFields({
    availability: input.availability,
    acceptPreOrder: input.acceptPreOrder,
    pre_order_eta: input.pre_order_eta,
    pre_order_note: input.pre_order_note,
    stock,
  })
  const payload: VariantInsert = {
    product_id: input.product_id,
    label_code: input.label_code?.trim() || null,
    vendor_code: input.vendor_code?.trim() || null,
    attributes: input.attributes,
    price: normalizePrice(input.price),
    cost: input.cost ?? null,
    stock,
    availability: availFields.availability,
    pre_order_eta: availFields.pre_order_eta,
    pre_order_note: availFields.pre_order_note,
    cover_image_url: input.cover_image_url ?? null,
    cover_image_path: input.cover_image_path ?? null,
    image_url: input.image_url ?? null,
    image_path: input.image_path ?? null,
  }
  const { data, error } = await supabase.from('product_variants').insert(payload).select().single()
  if (error) throw error
  return data as ProductVariantRow
}

export interface UpdateVariantInput {
  label_code?: string | null
  vendor_code?: string | null
  attributes?: Record<string, AttributeValue>
  price?: number | null
  cost?: number | null
  stock?: number
  availability?: string
  /** 與 availability 二擇一；後台 UI 只傳這個，由系統推導 availability */
  acceptPreOrder?: boolean
  pre_order_eta?: string | null
  pre_order_note?: string | null
  cover_image_url?: string | null
  cover_image_path?: string | null
  image_url?: string | null
  image_path?: string | null
}

export async function updateVariant(variantId: string, input: UpdateVariantInput): Promise<void> {
  const patch: VariantUpdate = {}
  if (input.label_code !== undefined) patch.label_code = input.label_code?.trim() || null
  if (input.vendor_code !== undefined) patch.vendor_code = input.vendor_code?.trim() || null
  if (input.attributes !== undefined) patch.attributes = input.attributes
  if (input.price !== undefined) patch.price = normalizePrice(input.price)
  if (input.cost !== undefined) patch.cost = input.cost
  if (input.stock !== undefined) patch.stock = Math.max(0, Math.round(input.stock))
  if (input.cover_image_url !== undefined) patch.cover_image_url = input.cover_image_url
  if (input.cover_image_path !== undefined) patch.cover_image_path = input.cover_image_path
  if (input.image_url !== undefined) patch.image_url = input.image_url
  if (input.image_path !== undefined) patch.image_path = input.image_path

  if (
    input.availability !== undefined ||
    input.acceptPreOrder !== undefined ||
    input.pre_order_eta !== undefined ||
    input.pre_order_note !== undefined
  ) {
    const stockVal =
      input.stock !== undefined ? Math.max(0, Math.round(input.stock)) : (patch.stock as number) ?? 0
    const availFields = resolveAvailabilityFields({
      availability: input.availability,
      acceptPreOrder: input.acceptPreOrder,
      pre_order_eta: input.pre_order_eta,
      pre_order_note: input.pre_order_note,
      stock: stockVal,
    })
    patch.availability = availFields.availability
    patch.pre_order_eta = availFields.pre_order_eta
    patch.pre_order_note = availFields.pre_order_note
  }

  if (Object.keys(patch).length === 0) return

  const { error } = await supabase.from('product_variants').update(patch).eq('id', variantId)
  if (error) throw error
}

export async function deleteVariant(variantId: string): Promise<void> {
  const { error } = await supabase.from('product_variants').update({ is_active: false }).eq('id', variantId)
  if (error) throw error
}

/** 直接調整某個 SKU 的庫存量（Phase 1 用，Phase 2 會改成 RPC + 寫入異動歷史） */
export async function adjustStock(variantId: string, newStock: number): Promise<void> {
  const stock = Math.max(0, Math.round(newStock))
  const { error } = await supabase.from('product_variants').update({ stock }).eq('id', variantId)
  if (error) throw error
}

/**
 * 依商品自動產生標籤代碼：ES + 品牌 + 類別碼 + 流水號（如 ESFOLLOWVEST001）。
 * 每個前綴各自從 001 起算；查同前綴的最大號 +1。
 * 唯一性最終由 DB unique index 保證（極少數併發撞號時可再按一次）。
 */
export async function generateLabelCode(
  brand: string,
  categoryId: string | null | undefined,
  /** 尚未存進 DB 的代碼（同一次編輯的其他 SKU），一併避開避免撞號 */
  extraCodes: ReadonlyArray<string | null | undefined> = [],
): Promise<string> {
  const categoryCode = getCategoryLabelCode(categoryId)
  if (!categoryCode) {
    throw new Error('此類別尚未設定標籤代碼規則，請改用手動輸入')
  }
  const prefix = buildLabelPrefix(brand, categoryCode)

  const { data, error } = await supabase
    .from('product_variants')
    .select('label_code')
    .like('label_code', `${prefix}%`)
  if (error) throw error

  const dbCodes = (data ?? []).map((r) => (r as { label_code: string | null }).label_code)
  const seq = maxLabelSeq([...dbCodes, ...extraCodes], prefix) + 1
  return composeLabelCode(prefix, seq)
}

/**
 * 查標籤代碼是否已被「其他 SKU」使用（跨商品）。
 * 前端存檔前的防呆；最終唯一性仍由 DB unique index 保證。
 * 回傳衝突 SKU 的商品資訊（給友善訊息用）；沒衝突回 null。
 */
export async function findLabelCodeConflict(
  labelCode: string,
  excludeVariantId: string | null,
): Promise<{ brand: string; model: string } | null> {
  const normalized = labelCode.trim().toUpperCase()
  if (!normalized) return null

  let query = supabase
    .from('product_variants')
    .select('id, product_id')
    .eq('label_code', normalized)
    .eq('is_active', true)
  if (excludeVariantId) query = query.neq('id', excludeVariantId)

  const { data, error } = await query.limit(1)
  if (error) throw error
  const conflict = (data ?? [])[0] as { product_id: string } | undefined
  if (!conflict) return null

  const { data: product } = await supabase
    .from('products')
    .select('brand, model')
    .eq('id', conflict.product_id)
    .maybeSingle()
  const p = product as { brand?: string; model?: string } | null
  return { brand: p?.brand ?? '', model: p?.model ?? '' }
}

/** 掃描找貨：用 label_code 查 SKU + 商品主檔 */
export async function fetchVariantItemByLabelCode(
  labelCode: string,
): Promise<VariantListItem | null> {
  const normalized = labelCode.trim().toUpperCase()
  if (!normalized) return null

  const { data: variant, error: ve } = await supabase
    .from('product_variants')
    .select('*')
    .eq('label_code', normalized)
    .eq('is_active', true)
    .maybeSingle()
  if (ve) throw ve
  if (!variant) return null

  const { data: product, error: pe } = await supabase
    .from('products')
    .select('*')
    .eq('id', variant.product_id)
    .eq('is_active', true)
    .maybeSingle()
  if (pe) throw pe
  if (!product) return null

  return {
    variant: variant as unknown as ProductVariantRow,
    product: product as unknown as ProductRow,
  }
}
