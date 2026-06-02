import type { ProductRow, ProductVariantRow } from '../products/types'

export type DeliveryMethod = 'pickup_es' | 'shipping'
export type OrderPaymentMethod = 'balance' | 'transfer' | 'cash'

export const PAYMENT_METHOD_LABELS: Record<OrderPaymentMethod, string> = {
  balance: '扣儲值',
  transfer: '匯款',
  cash: '現金',
}

export interface ShopOrderRow {
  id: string
  order_no: string
  member_id: string | null
  contact_name: string
  delivery_method: DeliveryMethod
  shipping_info: string | null
  customer_note: string | null
  internal_notes: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export interface ShopOrderItemRow {
  id: string
  order_id: string
  variant_id: string
  unit_price: number
  qty: number
  qty_pending_bill: number
  qty_paid: number
  created_at: string
  updated_at: string
}

export interface ShopOrderItemWithVariant extends ShopOrderItemRow {
  variant: ProductVariantRow & {
    reserved_qty?: number
    product?: Pick<ProductRow, 'id' | 'brand' | 'model' | 'category'>
  }
}

export interface ShopOrderWithItems extends ShopOrderRow {
  items: ShopOrderItemWithVariant[]
}

export interface ShopOrderSettlementRow {
  id: string
  order_id: string
  payment_method: OrderPaymentMethod
  charge_member_id: string | null
  amount_total: number
  items_snapshot: SettlementSnapshotLine[]
  notes: string | null
  settled_by: string | null
  settled_at: string
}

/** 結帳統計用：含訂單與扣款會員顯示欄位 */
export interface ShopOrderSettlementWithDetails extends ShopOrderSettlementRow {
  order_no: string
  contact_name: string
  order_cancelled_at: string | null
  charge_member_name: string | null
}

export interface SettlementSnapshotLine {
  item_id: string
  variant_id: string
  qty: number
  unit_price: number
  line_total: number
  description?: string | null
}

export interface OrderLineInput {
  variant_id: string
  unit_price: number
  qty: number
}

export interface CreateOrderInput {
  member_id: string | null
  contact_name: string
  delivery_method: DeliveryMethod
  shipping_info?: string | null
  customer_note?: string | null
  internal_notes?: string | null
  lines: OrderLineInput[]
  created_by?: string | null
}

export interface UpdateOrderInput {
  member_id?: string | null
  contact_name?: string
  delivery_method?: DeliveryMethod
  shipping_info?: string | null
  customer_note?: string | null
  internal_notes?: string | null
  lines?: OrderLineInput[]
  updated_by?: string | null
}

export type OrderInboxTab = 'waiting' | 'ready' | 'pending' | 'settled' | 'cancelled' | 'all'
