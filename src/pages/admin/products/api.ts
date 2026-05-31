/**
 * 庫存系統的資料層 helper：商品 + SKU 的 CRUD。
 *
 * 庫存增加時 DB trigger 會更新 last_stock_in_at；扣庫不動。
 * stock_movements 異動表留 Phase 2。
 */

import { supabase } from '../../../lib/supabase'
import type { Database } from '../../../types/supabase'
import type { AttributeValue, ProductRow, ProductVariantRow, ProductWithVariants, VariantListItem } from './types'

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

/** 載入單一商品（含 SKU），用於編輯頁 */
export async function fetchProductWithVariants(productId: string): Promise<ProductWithVariants | null> {
  const { data: product, error: pe } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .maybeSingle()
  if (pe) throw pe
  if (!product) return null

  const { data: variants, error: ve } = await supabase
    .from('product_variants')
    .select('*')
    .eq('product_id', productId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
  if (ve) throw ve

  return {
    ...(product as unknown as ProductRow),
    variants: (variants ?? []) as unknown as ProductVariantRow[],
  }
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
  vendor_code?: string | null
  attributes: Record<string, AttributeValue>
  /** null = 售價待補（前端顯示「缺」）；0 = 真的免費贈品 */
  price: number | null
  cost?: number | null
  stock?: number
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

export async function createVariant(input: CreateVariantInput): Promise<ProductVariantRow> {
  const payload: VariantInsert = {
    product_id: input.product_id,
    vendor_code: input.vendor_code?.trim() || null,
    attributes: input.attributes,
    price: normalizePrice(input.price),
    cost: input.cost ?? null,
    stock: Math.max(0, Math.round(input.stock ?? 0)),
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
  vendor_code?: string | null
  attributes?: Record<string, AttributeValue>
  price?: number | null
  cost?: number | null
  stock?: number
  cover_image_url?: string | null
  cover_image_path?: string | null
  image_url?: string | null
  image_path?: string | null
}

export async function updateVariant(variantId: string, input: UpdateVariantInput): Promise<void> {
  const patch: VariantUpdate = {}
  if (input.vendor_code !== undefined) patch.vendor_code = input.vendor_code?.trim() || null
  if (input.attributes !== undefined) patch.attributes = input.attributes
  if (input.price !== undefined) patch.price = normalizePrice(input.price)
  if (input.cost !== undefined) patch.cost = input.cost
  if (input.stock !== undefined) patch.stock = Math.max(0, Math.round(input.stock))
  if (input.cover_image_url !== undefined) patch.cover_image_url = input.cover_image_url
  if (input.cover_image_path !== undefined) patch.cover_image_path = input.cover_image_path
  if (input.image_url !== undefined) patch.image_url = input.image_url
  if (input.image_path !== undefined) patch.image_path = input.image_path
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
