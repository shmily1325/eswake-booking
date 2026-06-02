import { supabase } from '../../../lib/supabase'
import { getLocalDateString } from '../../../utils/date'
import { sortPendingBillOrders } from './orderUtils'
import { formatShopOrderRpcError } from './shopOrderRpcErrors'

/** 訂單開單列表預設只載入近 N 個月（待結帳 inbox 不受限） */
export const SHOP_ORDERS_LIST_MONTHS = 6

export function shopOrdersListCreatedAfterIso(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - SHOP_ORDERS_LIST_MONTHS)
  return `${getLocalDateString(d)}T00:00:00`
}
import type { Json } from '../../../types/supabase'
import type {
  CreateOrderInput,
  OrderLineInput,
  OrderPaymentMethod,
  SettlementSnapshotLine,
  ShopOrderSettlementRow,
  ShopOrderSettlementWithDetails,
  ShopOrderWithItems,
  UpdateOrderInput,
} from './types'

const ORDER_SELECT = `
  *,
  items:shop_order_items(
    *,
    variant:product_variants(
      id, product_id, vendor_code, attributes, price, stock, reserved_qty, is_active, last_stock_in_at, cover_image_url, image_url,
      product:products(id, brand, model, category)
    )
  )
`

async function rpcError(result: { data: unknown; error: unknown }): Promise<void> {
  if (result.error) {
    const err = result.error as { message?: string }
    throw new Error(formatShopOrderRpcError(err.message, '連線失敗'))
  }
  const payload = result.data as { success?: boolean; error?: string } | null
  if (payload && payload.success === false) {
    throw new Error(formatShopOrderRpcError(payload.error))
  }
}

/** 供 UI catch 區塊使用（含 RPC 與 Supabase 錯誤） */
export function shopOrderErrorMessage(e: unknown, fallback = '操作失敗'): string {
  if (e instanceof Error) return formatShopOrderRpcError(e.message, fallback)
  return fallback
}

export type FetchShopOrdersOptions = {
  /** 若設定，只載入 created_at >= 此 ISO 時間的訂單 */
  createdAfter?: string
}

export async function fetchShopOrders(
  options?: FetchShopOrdersOptions,
): Promise<ShopOrderWithItems[]> {
  let query = supabase.from('shop_orders').select(ORDER_SELECT)
  if (options?.createdAfter) {
    query = query.gte('created_at', options.createdAfter)
  }
  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as ShopOrderWithItems[]
}

/** 待結帳訂單數（供 BAO／Header badge） */
export async function fetchPendingBillOrderCount(): Promise<number> {
  const { data, error } = await supabase
    .from('shop_order_items')
    .select('order_id, shop_orders!inner(cancelled_at)')
    .gt('qty_pending_bill', 0)
    .is('shop_orders.cancelled_at', null)
  if (error) throw new Error(error.message)
  const ids = new Set(
    (data ?? []).map((row) => (row as { order_id: string }).order_id),
  )
  return ids.size
}

export async function fetchShopOrder(orderId: string): Promise<ShopOrderWithItems | null> {
  const { data, error } = await supabase
    .from('shop_orders')
    .select(ORDER_SELECT)
    .eq('id', orderId)
    .maybeSingle()
  if (error) throw error
  return (data as unknown as ShopOrderWithItems) ?? null
}

export async function fetchPendingBillOrders(): Promise<ShopOrderWithItems[]> {
  const { data: itemRows, error: itemErr } = await supabase
    .from('shop_order_items')
    .select('order_id')
    .gt('qty_pending_bill', 0)
  if (itemErr) throw new Error(itemErr.message)

  const orderIds = [...new Set((itemRows ?? []).map((r) => r.order_id as string))]
  if (orderIds.length === 0) return []

  const { data, error } = await supabase
    .from('shop_orders')
    .select(ORDER_SELECT)
    .in('id', orderIds)
    .is('cancelled_at', null)
    .order('updated_at', { ascending: true })
  if (error) throw new Error(error.message)

  const orders = (data ?? []) as unknown as ShopOrderWithItems[]
  return sortPendingBillOrders(
    orders.filter((o) => o.items.some((it) => it.qty_pending_bill > 0)),
  )
}

export async function generateOrderNo(): Promise<string> {
  const { data, error } = await supabase.rpc('generate_shop_order_no')
  if (error) throw new Error(error.message)
  return String(data)
}

export async function createShopOrder(input: CreateOrderInput): Promise<string> {
  const orderNo = await generateOrderNo()
  const { data, error } = await supabase
    .from('shop_orders')
    .insert({
      order_no: orderNo,
      member_id: input.member_id,
      contact_name: input.contact_name.trim(),
      delivery_method: input.delivery_method,
      shipping_info: input.shipping_info?.trim() || null,
      customer_note: input.customer_note?.trim() || null,
      internal_notes: input.internal_notes?.trim() || null,
      created_by: input.created_by ?? null,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  const orderId = data.id as string
  if (input.lines.length > 0) {
    const { error: ie } = await supabase.from('shop_order_items').insert(
      input.lines.map((line) => ({
        order_id: orderId,
        variant_id: line.variant_id,
        unit_price: line.unit_price,
        qty: line.qty,
      })),
    )
    if (ie) throw new Error(ie.message)
  }
  return orderId
}

export async function updateShopOrder(orderId: string, input: UpdateOrderInput): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (input.member_id !== undefined) patch.member_id = input.member_id
  if (input.contact_name !== undefined) patch.contact_name = input.contact_name.trim()
  if (input.delivery_method !== undefined) patch.delivery_method = input.delivery_method
  if (input.shipping_info !== undefined) patch.shipping_info = input.shipping_info?.trim() || null
  if (input.customer_note !== undefined) patch.customer_note = input.customer_note?.trim() || null
  if (input.internal_notes !== undefined) patch.internal_notes = input.internal_notes?.trim() || null
  if (input.updated_by !== undefined) patch.updated_by = input.updated_by

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from('shop_orders').update(patch).eq('id', orderId)
    if (error) throw new Error(error.message)
  }

  if (input.lines) {
    const { error: de } = await supabase.from('shop_order_items').delete().eq('order_id', orderId)
    if (de) throw new Error(de.message)
    if (input.lines.length > 0) {
      const { error: ie } = await supabase.from('shop_order_items').insert(
        input.lines.map((line) => ({
          order_id: orderId,
          variant_id: line.variant_id,
          unit_price: line.unit_price,
          qty: line.qty,
        })),
      )
      if (ie) throw new Error(ie.message)
    }
  }
}

/** 作廢訂單（軟刪）：還原庫存、保留訂單與結帳紀錄 */
export async function voidShopOrder(
  orderId: string,
  operatorEmail?: string | null,
): Promise<void> {
  const result = await supabase.rpc('void_shop_order', {
    p_order_id: orderId,
    p_operator_email: operatorEmail ?? null,
  })
  await rpcError(result)
}

/** @deprecated 請用 voidShopOrder */
export async function deleteShopOrder(
  orderId: string,
  operatorEmail?: string | null,
): Promise<void> {
  await voidShopOrder(orderId, operatorEmail)
}

/** @deprecated 請用 voidShopOrder */
export async function cancelShopOrder(orderId: string, updatedBy?: string | null): Promise<void> {
  await voidShopOrder(orderId, updatedBy)
}

export async function submitShopOrderBilling(
  orderId: string,
  items: { item_id: string; qty: number }[],
  operatorEmail?: string | null,
): Promise<void> {
  const result = await supabase.rpc('submit_shop_order_billing', {
    p_order_id: orderId,
    p_items: items as unknown as Json,
    p_operator_email: operatorEmail ?? null,
  })
  await rpcError(result)
}

export async function cancelShopOrderBilling(
  orderId: string,
  items: { item_id: string; qty: number }[],
  operatorEmail?: string | null,
): Promise<void> {
  const result = await supabase.rpc('cancel_shop_order_billing', {
    p_order_id: orderId,
    p_items: items as unknown as Json,
    p_operator_email: operatorEmail ?? null,
  })
  await rpcError(result)
}

export interface SettleLineInput {
  item_id: string
  qty: number
  unit_price: number
  line_total: number
  description?: string | null
}

export async function settleShopOrder(
  orderId: string,
  items: SettleLineInput[],
  paymentMethod: OrderPaymentMethod,
  chargeMemberId: string | null,
  operatorId?: string,
  notes?: string | null,
  operatorEmail?: string | null,
): Promise<void> {
  const result = await supabase.rpc('settle_shop_order', {
    p_order_id: orderId,
    p_items: items as unknown as Json,
    p_charge_member_id: chargeMemberId,
    p_payment_method: paymentMethod,
    p_operator_id: operatorId ?? null,
    p_notes: notes ?? null,
    p_operator_email: operatorEmail ?? null,
  })
  await rpcError(result)
}

export async function adjustShopOrderSettlement(
  settlementId: string,
  amountTotal: number,
  itemsSnapshot: SettleLineInput[],
  operatorId?: string,
  notes?: string | null,
): Promise<void> {
  const result = await supabase.rpc('adjust_shop_order_settlement', {
    p_settlement_id: settlementId,
    p_amount_total: amountTotal,
    p_items_snapshot: itemsSnapshot as unknown as Json,
    p_notes: notes ?? null,
    p_operator_id: operatorId ?? null,
  })
  await rpcError(result)
}

function parseItemsSnapshot(raw: unknown): SettlementSnapshotLine[] {
  if (!Array.isArray(raw)) return []
  return raw as SettlementSnapshotLine[]
}

export async function fetchOrderSettlements(orderId: string): Promise<ShopOrderSettlementRow[]> {
  const { data, error } = await supabase
    .from('shop_order_settlements')
    .select('*')
    .eq('order_id', orderId)
    .order('settled_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as unknown as ShopOrderSettlementRow[]).map((row) => ({
    ...row,
    items_snapshot: parseItemsSnapshot(row.items_snapshot),
  }))
}

/** 依 settled_at 區間查結帳紀錄（已結帳統計／細帳）；預設不含已作廢訂單 */
export async function fetchSettlementsInRange(
  startDate: string,
  endDate: string,
  options?: { includeVoided?: boolean },
): Promise<ShopOrderSettlementWithDetails[]> {
  const { data, error } = await supabase
    .from('shop_order_settlements')
    .select(
      `
      *,
      order:shop_orders(order_no, contact_name, cancelled_at),
      charge_member:members!charge_member_id(id, name, nickname)
    `,
    )
    .gte('settled_at', `${startDate}T00:00:00`)
    .lte('settled_at', `${endDate}T23:59:59`)
    .order('settled_at', { ascending: false })
  if (error) throw new Error(error.message)

  return ((data ?? []) as unknown as Array<
    ShopOrderSettlementRow & {
      order: { order_no: string; contact_name: string; cancelled_at: string | null } | null
      charge_member: { name: string; nickname: string | null } | null
    }
  >).map((row) => ({
    id: row.id,
    order_id: row.order_id,
    payment_method: row.payment_method as OrderPaymentMethod,
    charge_member_id: row.charge_member_id,
    amount_total: Number(row.amount_total),
    items_snapshot: parseItemsSnapshot(row.items_snapshot),
    notes: row.notes,
    settled_by: row.settled_by,
    settled_at: row.settled_at,
    order_no: row.order?.order_no ?? '—',
    contact_name: row.order?.contact_name ?? '—',
    order_cancelled_at: row.order?.cancelled_at ?? null,
    charge_member_name: row.charge_member
      ? row.charge_member.nickname || row.charge_member.name
      : null,
  })).filter((row) => options?.includeVoided || !row.order_cancelled_at)
}

export async function countOrderTransactions(orderId: string): Promise<number> {
  const { count, error } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('shop_order_id', orderId)
  if (error) throw error
  return count ?? 0
}

export function linesToInput(lines: OrderLineInput[]): OrderLineInput[] {
  return lines.filter((l) => l.qty > 0 && l.variant_id)
}
