import { supabase } from '../lib/supabase'
import { fetchAllInBatches, fetchAllPaginated } from './supabasePaginate'

export interface SnapshotLine {
  item_id: string
  qty: number
  line_total: number
}

export interface SettlementRow {
  id: string
  amount_total: number
  settled_at: string
  items_snapshot: SnapshotLine[]
  order: { order_no: string; contact_name: string; cancelled_at: string | null } | null
}

export interface ItemMeta {
  salespersonCoachId: string | null
  salespersonName: string
  productName: string
}

export interface SalesDetail {
  id: string
  date: string
  orderNo: string
  customerName: string
  productName: string
  qty: number
  total: number
}

export interface SalespersonGroup {
  id: string
  name: string
  qty: number
  total: number
  details: SalesDetail[]
}

function allocatedLineTotals(lines: SnapshotLine[], amountTotal: number): number[] {
  const sourceTotal = lines.reduce((sum, line) => sum + Number(line.line_total || 0), 0)
  if (lines.length === 0) return []
  if (sourceTotal <= 0) {
    const base = Math.floor(amountTotal / lines.length)
    return lines.map((_, index) =>
      index === lines.length - 1 ? amountTotal - base * (lines.length - 1) : base,
    )
  }
  let allocated = 0
  return lines.map((line, index) => {
    if (index === lines.length - 1) return amountTotal - allocated
    const value = Math.round((Number(line.line_total || 0) / sourceTotal) * amountTotal)
    allocated += value
    return value
  })
}

export function buildSalespersonGroups(
  settlements: SettlementRow[],
  itemMeta: ReadonlyMap<string, ItemMeta>,
  coachId?: string,
): SalespersonGroup[] {
  const groups = new Map<string, SalespersonGroup>()
  for (const settlement of settlements) {
    const totals = allocatedLineTotals(settlement.items_snapshot, Number(settlement.amount_total))
    settlement.items_snapshot.forEach((line, index) => {
      const meta = itemMeta.get(line.item_id)
      const salespersonCoachId = meta?.salespersonCoachId ?? null
      if (coachId && salespersonCoachId !== coachId) return
      const groupId = salespersonCoachId ?? 'unassigned'
      const group = groups.get(groupId) ?? {
        id: groupId,
        name: meta?.salespersonName || '未指定',
        qty: 0,
        total: 0,
        details: [],
      }
      const total = totals[index] ?? 0
      group.qty += Number(line.qty || 0)
      group.total += total
      group.details.push({
        id: `${settlement.id}-${line.item_id}-${index}`,
        date: settlement.settled_at.slice(0, 10),
        orderNo: settlement.order?.order_no ?? '—',
        customerName: settlement.order?.contact_name ?? '—',
        productName: meta?.productName || '商品',
        qty: Number(line.qty || 0),
        total,
      })
      groups.set(groupId, group)
    })
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      details: group.details.sort((a, b) => b.date.localeCompare(a.date)),
    }))
    .sort((a, b) => b.total - a.total || b.qty - a.qty || a.name.localeCompare(b.name))
}

export async function fetchProductSalesGroups({
  startDate,
  endDate,
  coachId,
}: {
  startDate: string
  endDate: string
  coachId?: string
}): Promise<SalespersonGroup[]> {
  const settlementData = await fetchAllPaginated<SettlementRow>(async (from, to) => {
    const { data, error } = await supabase
      .from('shop_order_settlements')
      .select('id, amount_total, settled_at, items_snapshot, order:shop_orders(order_no, contact_name, cancelled_at)')
      .gte('settled_at', `${startDate}T00:00:00`)
      .lte('settled_at', `${endDate}T23:59:59`)
      .order('settled_at', { ascending: false })
      .range(from, to)
    return { data: data as unknown as SettlementRow[] | null, error }
  })
  const settlements = settlementData.filter((row) => !row.order?.cancelled_at)
  const itemIds = [...new Set(
    settlements.flatMap((row) => row.items_snapshot.map((line) => line.item_id)),
  )]
  const meta = new Map<string, ItemMeta>()

  if (itemIds.length > 0) {
    const itemData = await fetchAllInBatches<{
      id: string
      salesperson_coach_id: string | null
      salesperson_name_snapshot: string | null
      variant: {
        vendor_code: string | null
        product: { brand: string; model: string; model_year: number | null } | null
      } | null
    }, string>(
      'shop_order_items',
      `
        id, salesperson_coach_id, salesperson_name_snapshot,
        variant:product_variants(
          vendor_code,
          product:products(brand, model, model_year)
        )
      `,
      'id',
      itemIds,
      'id',
    )
    for (const row of itemData) {
      const product = row.variant?.product
      meta.set(row.id, {
        salespersonCoachId: row.salesperson_coach_id,
        salespersonName: row.salesperson_name_snapshot?.trim() || '未指定',
        productName: product
          ? `${product.brand} ${product.model}${product.model_year ? ` · ${product.model_year}` : ''}`
          : row.variant?.vendor_code || '商品',
      })
    }
  }

  return buildSalespersonGroups(settlements, meta, coachId)
}
