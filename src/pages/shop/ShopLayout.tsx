import type { ReactNode } from 'react'
import { ShopCartProvider } from './hooks/useShopCart'
import { ShopCatalogProvider } from './hooks/useShopCatalog'
import { ShopPromoProvider } from './hooks/useShopPromo'
import { CartAddedToast } from './components/CartAddedToast'

export function ShopLayout({ children }: { children: ReactNode }) {
  return (
    <ShopPromoProvider>
      <ShopCatalogProvider>
        <ShopCartProvider>
          {children}
          <CartAddedToast />
        </ShopCartProvider>
      </ShopCatalogProvider>
    </ShopPromoProvider>
  )
}
