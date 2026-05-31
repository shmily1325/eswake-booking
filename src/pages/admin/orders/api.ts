import { supabase } from '../../../lib/supabase'
import type { Json } from '../../../types/supabase'
import type {
  CreateOrderInput,
  OrderLineInput,
  OrderPaymentMethod,
  ShopOrderSettlementRow,
  ShopOrderWithItems,
  UpdateOrderInput,
} from './types'

const ORDER_SELECT = `
  *,
  items:shop_order_items(
    *,
    variant:product_variants(
      id, product_id, vendor_code, attributes, price, stock, reserved_qty, is_active,
      product:products(id, brand, model, category)
    )
  )
`

async function rpcError(result: { data: unknown; error: unknown }): Promise<void> {
  if (result.error) {
    const err = result.error as { message?: string }
    throw new Error(err.message || '操作失敗')
  }
  const payload = result.data as { success?: boolean; error?: string } | null
  if (payload && payload.success === false) {
    throw new Error(payload.error || '操作失敗')
  }
}

export async function fetchShopOrders(): Promise<ShopOrderWithItems[]> {
  const { data, error } = await supabase
    .from('shop_orders')
    .select(ORDER_SELECT)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as ShopOrderWithItems[]
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
  const all = await fetchShopOrders()
  return all.filter(
    (o) => !o.cancelled_at && o.items.some((it) => it.qty_pending_bill > 0),
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

export async function deleteShopOrder(orderId: string): Promise<void> {
  const order = await fetchShopOrder(orderId)
  if (!order) throw new Error('找不到訂單')

  const pendingItems = order.items
    .filter((it) => it.qty_pending_bill > 0)
    .map((it) => ({ item_id: it.id, qty: it.qty_pending_bill }))

  if (pendingItems.length > 0) {
    await cancelShopOrderBilling(orderId, pendingItems)
  }

  const { error } = await supabase.from('shop_orders').delete().eq('id', orderId)
  if (error) throw new Error(error.message)
}

/** @deprecated 改用 deleteShopOrder（硬刪除） */
export async function cancelShopOrder(orderId: string, updatedBy?: string | null): Promise<void> {
  void updatedBy
  await deleteShopOrder(orderId)
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

export async function fetchOrderSettlements(orderId: string): Promise<ShopOrderSettlementRow[]> {
  const { data, error } = await supabase
    .from('shop_order_settlements')
    .select('*')
    .eq('order_id', orderId)
    .order('settled_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as ShopOrderSettlementRow[]
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
