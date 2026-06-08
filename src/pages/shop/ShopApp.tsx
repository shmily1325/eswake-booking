import { Routes, Route } from 'react-router-dom'
import { ShopLayout } from './ShopLayout'
import { ShopList, ShopPreOrderRedirect } from './ShopList'
import { ShopDetail } from './ShopDetail'
import { ShopCart } from './ShopCart'

/**
 * 商城路由進入點。
 * - 一般網域：掛在 `/shop/*`
 * - shop 子網域：掛在 `/*`（根路徑即首頁）
 */
export default function ShopApp() {
  return (
    <ShopLayout>
      <Routes>
        <Route index element={<ShopList />} />
        <Route path="pre-order" element={<ShopPreOrderRedirect />} />
        <Route path="cart" element={<ShopCart />} />
        <Route path=":productId" element={<ShopDetail />} />
      </Routes>
    </ShopLayout>
  )
}
