import { Link, useParams } from 'react-router-dom'

/**
 * 商品詳情頁（/shop/:productId）
 *
 * M1：先放骨架，確認 route param 拿得到。
 * M3 會補：商品圖、品牌型號、規格選擇、數量、加入購物車、直接 LINE 詢問。
 */
export function ShopDetail() {
  const { productId } = useParams<{ productId: string }>()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link to="/shop" className="text-sm text-blue-600 hover:underline">
          ← 返回商品列表
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mt-4 mb-2">商品詳情</h1>
        <p className="text-sm text-gray-500 mb-6">
          M1 路由骨架 — productId: <code>{productId ?? '(none)'}</code>
        </p>

        <div className="bg-white border border-gray-200 rounded-lg p-5 text-sm text-gray-700">
          M3 會接上實際的商品資料與規格選擇。
        </div>
      </div>
    </div>
  )
}
