import { Link } from 'react-router-dom'

/**
 * 購物車頁（/shop/cart）
 *
 * M1：先放骨架。
 * M4 會補：localStorage 購物車清單、改數量、移除、預估金額。
 * M5 會補：「LINE 統一詢問」按鈕（產生 deep link）。
 */
export function ShopCart() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link to="/shop" className="text-sm text-blue-600 hover:underline">
          ← 返回商品列表
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mt-4 mb-2">購物車</h1>
        <p className="text-sm text-gray-500 mb-6">M1 路由骨架</p>

        <div className="bg-white border border-gray-200 rounded-lg p-5 text-sm text-gray-700">
          購物車目前是空的（尚未實作）。
        </div>
      </div>
    </div>
  )
}
