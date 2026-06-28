import type { ShopOrderItemWithVariant, ShopOrderWithItems } from '../../admin/orders/types'
import type { LiffShopOrder } from '../liffShopOrders'

function item(
  overrides: Partial<ShopOrderItemWithVariant> & {
    id: string
    qty: number
    brand: string
    model: string
    category: string
    attributes?: Record<string, string>
    stock?: number
    reserved_qty?: number
    qty_pending_bill?: number
    qty_paid?: number
  },
): ShopOrderItemWithVariant {
  const {
    brand,
    model,
    category,
    attributes = {},
    stock = 10,
    reserved_qty = 0,
    qty_pending_bill = 0,
    qty_paid = 0,
    unit_price = 2050,
    ...rest
  } = overrides
  return {
    order_id: 'preview',
    variant_id: `v-${rest.id}`,
    unit_price,
    qty_pending_bill,
    qty_paid,
    created_at: '2026-06-28T10:00:00',
    updated_at: '2026-06-28T10:00:00',
    variant: {
      id: `v-${rest.id}`,
      product_id: `p-${rest.id}`,
      label_code: null,
      vendor_code: null,
      attributes,
      price: unit_price,
      cost: null,
      stock,
      reserved_qty,
      availability: stock > 0 ? 'in_stock' : 'sold_out',
      pre_order_eta: null,
      pre_order_note: null,
      pre_order_until: null,
      last_stock_in_at: stock > 0 ? '2026-06-28T08:00:00' : null,
      cover_image_url: null,
      cover_image_path: null,
      image_url: null,
      image_path: null,
      is_active: true,
      created_at: null,
      updated_at: null,
      product: { id: `p-${rest.id}`, brand, model, category },
    },
    ...rest,
  }
}

function order(
  overrides: Partial<ShopOrderWithItems> & { id: string; order_no: string; items: ShopOrderItemWithVariant[] },
): LiffShopOrder {
  const { items, ...rest } = overrides
  return {
    member_id: 'preview-member',
    contact_name: 'Fish',
    delivery_method: 'pickup_es',
    shipping_info: null,
    customer_note: null,
    internal_notes: null,
    cancelled_at: null,
    created_at: '2026-06-28T10:00:00',
    updated_at: '2026-06-28T10:00:00',
    created_by: null,
    updated_by: null,
    items,
    ...rest,
  }
}

/** LIFF 商品分頁預覽用 mock（涵蓋各狀態） */
export const PREVIEW_SHOP_ORDERS: LiffShopOrder[] = [
  order({
    id: 'o-done',
    order_no: 'SO-260628-001',
    customer_note: null,
    items: [
      item({
        id: 'wetsuit-done',
        qty: 1,
        qty_paid: 1,
        brand: 'Follow',
        model: 'Ladies Wetsuit Shorts',
        category: 'apparel',
        attributes: { gender: 'Female', size: 'S' },
        stock: 0,
        unit_price: 2050,
      }),
    ],
  }),
  order({
    id: 'o-pending',
    order_no: 'SO-260625-002',
    customer_note: '預計週末面交',
    items: [
      item({
        id: 'board-pending',
        qty: 1,
        qty_pending_bill: 1,
        brand: 'Hyperlite',
        model: 'State 2.0',
        category: 'wb_board',
        attributes: { size: '140' },
        stock: 1,
        reserved_qty: 1,
        unit_price: 12800,
      }),
    ],
  }),
  order({
    id: 'o-waiting',
    order_no: 'SO-260620-003',
    items: [
      item({
        id: 'fin-waiting',
        qty: 1,
        brand: 'Liquid Force',
        model: 'TC Wakesurf Fin',
        category: 'wb_fin',
        attributes: { size: '2.8' },
        stock: 0,
        unit_price: 1800,
      }),
    ],
  }),
  order({
    id: 'o-partial',
    order_no: 'SO-260615-004',
    delivery_method: 'shipping',
    shipping_info: '台北市信義區…',
    items: [
      item({
        id: 'jacket-paid',
        qty: 1,
        qty_paid: 1,
        brand: 'O\'Neill',
        model: 'Reactor',
        category: 'wetsuit',
        attributes: { gender: 'Male', size: 'L', thickness: '3/2' },
        stock: 0,
        unit_price: 4500,
      }),
      item({
        id: 'boots-waiting',
        qty: 1,
        brand: 'Ronix',
        model: 'Vault',
        category: 'wb_boots',
        attributes: { size: '10' },
        stock: 0,
        unit_price: 6200,
      }),
    ],
  }),
]
