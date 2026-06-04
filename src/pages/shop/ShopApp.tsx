import { Routes, Route } from 'react-router-dom'
import { ShopLayout } from './ShopLayout'
import { ShopList, ShopPreOrderList } from './ShopList'
import { ShopDetail } from './ShopDetail'
import { ShopCart } from './ShopCart'

/**
 * 商城所有 `/shop/*` 路由的單一進入點。
 */
export default function ShopApp() {
  return (
    <ShopLayout>
      <Routes>
        <Route index element={<ShopList />} />
        <Route path="pre-order" element={<ShopPreOrderList />} />
        <Route path="cart" element={<ShopCart />} />
        <Route path=":productId" element={<ShopDetail />} />
      </Routes>
    </ShopLayout>
  )
}
