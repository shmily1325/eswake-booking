import { supabase } from '../../../lib/supabase'
import type { Database } from '../../../types/supabase'

export type ProductBrandRow = Database['public']['Tables']['product_brands']['Row']

export interface ManagedProductBrand extends ProductBrandRow {
  productCount: number
}

export function normalizeProductBrandName(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleUpperCase()
}

export async function fetchManagedProductBrands(): Promise<ManagedProductBrand[]> {
  const [brandsResult, productsResult] = await Promise.all([
    supabase
      .from('product_brands')
      .select('*')
      .order('is_active', { ascending: false })
      .order('name', { ascending: true }),
    supabase.from('products').select('brand'),
  ])
  if (brandsResult.error) throw brandsResult.error
  if (productsResult.error) throw productsResult.error

  const counts = new Map<string, number>()
  for (const product of productsResult.data ?? []) {
    const name = normalizeProductBrandName(product.brand ?? '')
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1)
  }

  return (brandsResult.data ?? []).map((brand) => ({
    ...brand,
    productCount: counts.get(brand.name) ?? 0,
  }))
}

export async function createManagedProductBrand(
  name: string,
  currentUserEmail?: string | null,
): Promise<ProductBrandRow> {
  const normalized = normalizeProductBrandName(name)
  if (!normalized) throw new Error('請輸入品牌名稱')

  const { data: existing, error: findError } = await supabase
    .from('product_brands')
    .select('is_active')
    .eq('name', normalized)
    .maybeSingle()
  if (findError) throw findError
  if (existing) {
    throw new Error(existing.is_active ? '品牌已存在' : '品牌已停用，請從清單恢復')
  }

  const { data, error } = await supabase
    .from('product_brands')
    .insert({
      name: normalized,
      created_by: currentUserEmail ?? null,
      updated_by: currentUserEmail ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function renameManagedProductBrand(
  id: string,
  name: string,
  currentUserEmail?: string | null,
): Promise<ProductBrandRow> {
  const normalized = normalizeProductBrandName(name)
  if (!normalized) throw new Error('請輸入品牌名稱')
  const { data, error } = await supabase.rpc('rename_product_brand', {
    p_brand_id: id,
    p_new_name: normalized,
    p_updated_by: currentUserEmail ?? null,
  })
  if (error) throw error
  return data
}

export async function setManagedProductBrandActive(
  id: string,
  isActive: boolean,
  currentUserEmail?: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('product_brands')
    .update({
      is_active: isActive,
      updated_by: currentUserEmail ?? null,
    })
    .eq('id', id)
  if (error) throw error
}
