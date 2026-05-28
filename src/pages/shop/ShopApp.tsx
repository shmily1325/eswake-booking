import { Routes, Route } from 'react-router-dom'
import { ShopLayout } from './ShopLayout'
import { ShopList } from './ShopList'
import { ShopDetail } from './ShopDetail'
import { ShopCart } from './ShopCart'

/**
 * 商城所有 `/shop/*` 路由的單一進入點。
 *
 * 為什麼存在：
 * - 讓 `App.tsx` 只需要 lazy-load 一個 chunk 就把整個商城拆出主 bundle
 * - 匿名訪客逛商城時不會被迫下載 `/admin /coach` 等後台 JS
 * - 商城自己的子路由放在這裡，比把 3 個 Route 散在 `App.tsx` 乾淨
 */
export default function ShopApp() {
  return (
    <ShopLayout>
      <Routes>
        {/* /shop */}
        <Route index element={<ShopList />} />
        {/* /shop/cart  ─ 必須排在 :productId 之前，避免被當成商品 ID 解析 */}
        <Route path="cart" element={<ShopCart />} />
        {/* /shop/:productId */}
        <Route path=":productId" element={<ShopDetail />} />
      </Routes>
    </ShopLayout>
  )
}
