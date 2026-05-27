/**
 * 商城購物車 Context + hook。
 *
 * 設計重點：
 * - 純前端購物車，存 localStorage（不寫進資料庫，跟「不做訂單」原則一致）
 * - 同 variantId 加入會合併數量，不會出現重複列
 * - 存的是 snapshot（品名/規格/單價），商品被改名/改價/下架不影響購物車內容
 * - 包一個輕量 toast，加入購物車時自動跳出「已加入」訊息
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { CartItem } from '../types'

const STORAGE_KEY = 'eswake_shop_cart_v1'

interface CartContextValue {
  items: CartItem[]
  /** 總件數（所有 quantity 加總） */
  totalCount: number
  /** 預估金額：只計算有價格的品項 */
  totalAmount: number
  /** 是否有「價格洽詢」（null 單價）的品項 */
  hasUnknownPrice: boolean

  /** 加入購物車；若 variantId 已存在則合併數量 */
  addItem: (item: Omit<CartItem, 'addedAt' | 'quantity'> & { quantity?: number }) => void
  updateQuantity: (variantId: string, quantity: number) => void
  removeItem: (variantId: string) => void
  clear: () => void

  /** 最近加入的品項摘要，用來觸發 toast */
  lastAdded: { name: string; quantity: number; at: number } | null
  dismissLastAdded: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

function loadFromStorage(): CartItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidCartItem)
  } catch {
    return []
  }
}

function isValidCartItem(v: unknown): v is CartItem {
  if (!v || typeof v !== 'object') return false
  const obj = v as Record<string, unknown>
  return (
    typeof obj.variantId === 'string' &&
    typeof obj.productId === 'string' &&
    typeof obj.productName === 'string' &&
    typeof obj.quantity === 'number' &&
    obj.quantity > 0
  )
}

function saveToStorage(items: CartItem[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    /* ignore localStorage quota / 隱身模式錯誤 */
  }
}

export function ShopCartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => loadFromStorage())
  const [lastAdded, setLastAdded] = useState<CartContextValue['lastAdded']>(null)
  // 第一次 mount 跳過儲存，避免覆蓋 storage（雖然內容一樣但寫一次也浪費）
  const hydrated = useRef(false)

  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true
      return
    }
    saveToStorage(items)
  }, [items])

  const addItem = useCallback<CartContextValue['addItem']>((input) => {
    const qty = input.quantity ?? 1
    if (qty <= 0) return
    setItems((prev) => {
      const existing = prev.find((it) => it.variantId === input.variantId)
      if (existing) {
        return prev.map((it) =>
          it.variantId === input.variantId
            ? { ...it, quantity: it.quantity + qty, addedAt: Date.now() }
            : it
        )
      }
      const next: CartItem = {
        variantId: input.variantId,
        productId: input.productId,
        productName: input.productName,
        categoryId: input.categoryId,
        attributes: input.attributes,
        unitPrice: input.unitPrice,
        quantity: qty,
        addedAt: Date.now(),
      }
      return [...prev, next]
    })
    setLastAdded({ name: input.productName, quantity: qty, at: Date.now() })
  }, [])

  const updateQuantity = useCallback((variantId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((it) => it.variantId !== variantId))
      return
    }
    setItems((prev) =>
      prev.map((it) => (it.variantId === variantId ? { ...it, quantity } : it))
    )
  }, [])

  const removeItem = useCallback((variantId: string) => {
    setItems((prev) => prev.filter((it) => it.variantId !== variantId))
  }, [])

  const clear = useCallback(() => {
    setItems([])
  }, [])

  const dismissLastAdded = useCallback(() => setLastAdded(null), [])

  const value = useMemo<CartContextValue>(() => {
    const totalCount = items.reduce((sum, it) => sum + it.quantity, 0)
    const totalAmount = items.reduce(
      (sum, it) => sum + (it.unitPrice ?? 0) * it.quantity,
      0
    )
    const hasUnknownPrice = items.some((it) => it.unitPrice == null)
    return {
      items,
      totalCount,
      totalAmount,
      hasUnknownPrice,
      addItem,
      updateQuantity,
      removeItem,
      clear,
      lastAdded,
      dismissLastAdded,
    }
  }, [items, lastAdded, addItem, updateQuantity, removeItem, clear, dismissLastAdded])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useShopCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) {
    throw new Error('useShopCart must be used within <ShopCartProvider>')
  }
  return ctx
}
