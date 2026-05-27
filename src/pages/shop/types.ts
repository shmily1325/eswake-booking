/**
 * Shop 內部使用的型別。
 *
 * 注意：商城是純展示頁，不寫入 DB。
 * - 購物車只活在 localStorage / React state，不會 sync 到後端
 * - 沒有訂單概念，最後是用 LINE deep link 把清單帶到官方 LINE
 */

import type { ProductRow, ProductVariantRow } from '../admin/products/types'

/**
 * 購物車單筆品項：以「變體（SKU）」為單位。
 * 同商品不同規格算不同筆。
 *
 * 為了「商品被刪/改名後購物車仍可讀」與避免每次都查 DB，存的是 snapshot：
 * 下單瞬間商品名 / 規格 / 單價會凍結在 localStorage。
 */
export interface CartItem {
  /** 變體 ID（資料庫主鍵），同一 SKU 加兩次會合併數量 */
  variantId: string
  /** 商品 ID，方便客人從購物車回到商品頁 */
  productId: string

  /** 顯示用：品牌 + 型號（例：「Hyperlite State 2.0」） */
  productName: string
  /** 顯示用：分類 id（例：'wakeboard'），方便回查 schema 做格式化 */
  categoryId: string
  /** 顯示用：規格 attributes（{ color: '黑', size: '140cm' }），不依賴 schema 也能顯示 */
  attributes: Record<string, string | number | null>

  /** 單價（NT$，整數）；null = 售價未定（仍可放進購物車，LINE 訊息會註明「價格洽詢」） */
  unitPrice: number | null
  /** 數量，至少 1 */
  quantity: number

  /** 加入購物車的時間，用來排序與除錯 */
  addedAt: number
}

/** product + variants 的簡化型別轉出（給 ShopList / ShopDetail 用） */
export interface ShopProduct extends ProductRow {
  variants: ProductVariantRow[]
}
