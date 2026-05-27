import { Link } from 'react-router-dom'

/**
 * 商城列表頁（/shop）
 *
 * M1：先放骨架，確認路由可達。
 * M2 會補：分類 tab、商品卡片、Shop Header、浮動購物車按鈕。
 */
export function ShopList() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">ES SHOP</h1>
        <p className="text-sm text-gray-500 mb-6">
          商城開發中 — M1 路由骨架
        </p>

        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
          <p className="text-sm text-gray-700">路由測試連結：</p>
          <ul className="text-sm space-y-2">
            <li>
              <Link
                to="/shop/demo-product-id"
                className="text-blue-600 hover:underline"
              >
                /shop/demo-product-id（商品詳情）
              </Link>
            </li>
            <li>
              <Link to="/shop/cart" className="text-blue-600 hover:underline">
                /shop/cart（購物車）
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
