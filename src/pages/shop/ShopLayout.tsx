import type { ReactNode } from 'react'
import { ShopCartProvider } from './hooks/useShopCart'
import { CartAddedToast } from './components/CartAddedToast'
import { MobileCartFab } from './components/MobileCartFab'

/**
 * 商城頁面的共用 wrapper：
 * - 提供 ShopCartProvider，讓三個 /shop 子頁共用同一份購物車 state
 * - 掛上 CartAddedToast，加入購物車時自動跳訊息
 * - 掛上 MobileCartFab，手機版有商品時右下角浮現購物車按鈕
 *
 * 注意：每條 /shop/* route 都會獨立 mount 這個 wrapper，所以購物車 state
 *   不會跨路由保留在 React 記憶體；改用 localStorage 持久化（在 hook 內處理）。
 */
export function ShopLayout({ children }: { children: ReactNode }) {
  return (
    <ShopCartProvider>
      {children}
      <CartAddedToast />
      <MobileCartFab />
    </ShopCartProvider>
  )
}
