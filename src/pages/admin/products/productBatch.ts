/**
 * 列表批次勾選：上架（商品）、預購／到期日／售價／檔期（SKU）。
 * 現貨 SKU 不能改成預購；到期日只套在已開放預購的 SKU。
 * 售價仍在每個 SKU：批次只改有勾到的尺寸，不會合成一張卡一個價。
 */

import { getVariantAvailability } from '../../shop/lib/productAvailability'
import type { VariantListItem } from './types'

export function normalizePreOrderUntil(value: string | null | undefined): string | null {
  const day = value?.trim().slice(0, 10) ?? ''
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null
}

export function parseBatchPrice(raw: string): number | null {
  const digits = raw.trim().replace(/,/g, '')
  if (!/^\d+$/.test(digits)) return null
  return Number(digits)
}

export function uniqueProductIdsFromSelection(
  items: VariantListItem[],
  selectedIds: ReadonlySet<string>,
): string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  for (const it of items) {
    if (!selectedIds.has(it.variant.id)) continue
    if (seen.has(it.product.id)) continue
    seen.add(it.product.id)
    ids.push(it.product.id)
  }
  return ids
}

export function selectedVariantIds(
  items: VariantListItem[],
  selectedIds: ReadonlySet<string>,
): string[] {
  return items.filter((it) => selectedIds.has(it.variant.id)).map((it) => it.variant.id)
}

export function partitionPreOrderToggle(
  items: VariantListItem[],
  selectedIds: ReadonlySet<string>,
): { applyIds: string[]; skippedInStock: number } {
  const applyIds: string[] = []
  let skippedInStock = 0
  for (const it of items) {
    if (!selectedIds.has(it.variant.id)) continue
    if ((it.variant.stock ?? 0) > 0) {
      skippedInStock += 1
      continue
    }
    applyIds.push(it.variant.id)
  }
  return { applyIds, skippedInStock }
}

export function partitionPreOrderUntil(
  items: VariantListItem[],
  selectedIds: ReadonlySet<string>,
): { applyIds: string[]; skipped: number } {
  const applyIds: string[] = []
  let skipped = 0
  for (const it of items) {
    if (!selectedIds.has(it.variant.id)) continue
    if (getVariantAvailability(it.variant) === 'pre_order') {
      applyIds.push(it.variant.id)
    } else {
      skipped += 1
    }
  }
  return { applyIds, skipped }
}

export function formatBatchToast(
  applied: number,
  skipped: number,
  appliedLabel: string,
  skippedLabel: string,
): string {
  if (applied === 0 && skipped === 0) return '請先勾選'
  if (applied === 0) return `沒有可套用的項目（${skipped} ${skippedLabel}）`
  if (skipped === 0) return `${appliedLabel} ${applied}`
  return `${appliedLabel} ${applied}，略過 ${skipped} ${skippedLabel}`
}
