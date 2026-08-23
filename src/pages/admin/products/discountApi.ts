import { supabase } from '../../../lib/supabase'
import type { DiscountKind, DiscountPreset } from '../../shop/lib/shopPricing'
import { foldLabel, isDiscountPercent } from '../../shop/lib/shopPricing'

type PresetRow = {
  id: string
  kind: DiscountKind
  name: string
  label: string
  percent: number
  is_active: boolean
  sort_order: number
}

function asPreset(row: PresetRow): DiscountPreset {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    label: row.label,
    percent: row.percent,
    is_active: row.is_active,
    sort_order: row.sort_order,
  }
}

export async function fetchDiscountPresets(): Promise<DiscountPreset[]> {
  const { data, error } = await supabase
    .from('shop_discount_presets')
    .select('id, kind, name, label, percent, is_active, sort_order')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw error
  return ((data ?? []) as PresetRow[]).map(asPreset)
}

export async function updatePreorderDiscount(input: {
  isActive: boolean
  percent: number
}): Promise<void> {
  if (!isDiscountPercent(input.percent)) throw new Error('請填 1–9.9 折')
  const { data: existing, error: findError } = await supabase
    .from('shop_discount_presets')
    .select('id')
    .eq('kind', 'preorder')
    .maybeSingle()
  if (findError) throw findError

  const patch = {
    kind: 'preorder' as const,
    name: '預購全館',
    label: foldLabel(input.percent),
    percent: input.percent,
    is_active: input.isActive,
    sort_order: 0,
  }

  if (existing?.id) {
    const { error } = await supabase
      .from('shop_discount_presets')
      .update(patch)
      .eq('id', existing.id)
    if (error) throw error
    return
  }

  const { error } = await supabase.from('shop_discount_presets').insert(patch)
  if (error) throw error
}

export async function createTagPreset(input: {
  name: string
  label: string
  percent: number
}): Promise<DiscountPreset> {
  const name = input.name.trim()
  const label = input.label.trim() || name
  if (!name) throw new Error('請填檔期名稱')
  if (!isDiscountPercent(input.percent)) throw new Error('請填 1–9.9 折')

  const { data: maxRow } = await supabase
    .from('shop_discount_presets')
    .select('sort_order')
    .eq('kind', 'tag')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabase
    .from('shop_discount_presets')
    .insert({
      kind: 'tag',
      name,
      label,
      percent: input.percent,
      is_active: true,
      sort_order: (maxRow?.sort_order ?? 0) + 1,
    })
    .select('id, kind, name, label, percent, is_active, sort_order')
    .single()
  if (error) throw error
  return asPreset(data as PresetRow)
}

export async function updateTagPreset(
  id: string,
  patch: Partial<Pick<DiscountPreset, 'name' | 'label' | 'percent' | 'is_active'>>,
): Promise<void> {
  const next: Record<string, unknown> = {}
  if (patch.name !== undefined) next.name = patch.name.trim()
  if (patch.label !== undefined) next.label = patch.label.trim()
  if (patch.percent !== undefined) {
    if (!isDiscountPercent(patch.percent)) throw new Error('請填 1–9.9 折')
    next.percent = patch.percent
  }
  if (patch.is_active !== undefined) next.is_active = patch.is_active
  if (Object.keys(next).length === 0) return
  const { error } = await supabase
    .from('shop_discount_presets')
    .update(next)
    .eq('id', id)
    .eq('kind', 'tag')
  if (error) throw error
}

export async function fetchDiscountPresetUsage(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('product_variants')
    .select('discount_preset_id')
    .not('discount_preset_id', 'is', null)
  if (error) throw error
  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    const id = row.discount_preset_id
    if (!id) continue
    counts[id] = (counts[id] ?? 0) + 1
  }
  return counts
}

export async function deleteTagPreset(id: string): Promise<void> {
  const { error } = await supabase
    .from('shop_discount_presets')
    .delete()
    .eq('id', id)
    .eq('kind', 'tag')
  if (error) throw error
}

export async function batchSetVariantsDiscountPreset(
  variantIds: string[],
  presetId: string | null,
): Promise<void> {
  if (variantIds.length === 0) return
  const CHUNK = 80
  for (let i = 0; i < variantIds.length; i += CHUNK) {
    const slice = variantIds.slice(i, i + CHUNK)
    const { error } = await supabase
      .from('product_variants')
      .update({ discount_preset_id: presetId })
      .in('id', slice)
    if (error) throw error
  }
}
