import type { ReactNode } from 'react'
import { ShopCartProvider } from './hooks/useShopCart'
import { ShopPromoProvider } from './hooks/useShopPromo'
import { CartAddedToast } from './components/CartAddedToast'

export function ShopLayout({ children }: { children: ReactNode }) {
  return (
    <ShopPromoProvider>
      <ShopCartProvider>
        {children}
        <CartAddedToast />
      </ShopCartProvider>
    </ShopPromoProvider>
  )
}
