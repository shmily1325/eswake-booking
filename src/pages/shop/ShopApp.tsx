import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { ShopLayout } from './ShopLayout'
import { ShopList, ShopPreOrderRedirect } from './ShopList'

const ShopDetail = lazy(() =>
  import('./ShopDetail').then((module) => ({ default: module.ShopDetail })),
)
const ShopCart = lazy(() =>
  import('./ShopCart').then((module) => ({ default: module.ShopCart })),
)

function ShopRouteLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center text-sm text-gray-500">
      載入中…
    </div>
  )
}

/**
 * 商城路由進入點。
 * - 一般網域：掛在 `/shop/*`
 * - shop 子網域：掛在 `/*`（根路徑即首頁）
 */
export default function ShopApp() {
  return (
    <ShopLayout>
      <Suspense fallback={<ShopRouteLoading />}>
        <Routes>
          <Route index element={<ShopList />} />
          <Route path="pre-order" element={<ShopPreOrderRedirect />} />
          <Route path="cart" element={<ShopCart />} />
          <Route path=":productId" element={<ShopDetail />} />
        </Routes>
      </Suspense>
    </ShopLayout>
  )
}
