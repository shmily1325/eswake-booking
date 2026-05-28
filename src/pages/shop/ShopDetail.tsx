import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchProductWithVariants } from '../admin/products/api'
import type { ProductWithVariants, ProductVariantRow } from '../admin/products/types'
import { ShopHeader } from './components/ShopHeader'
import { VariantPicker } from './components/VariantPicker'
import { QuantityStepper } from './components/QuantityStepper'
import { useShopCart } from './hooks/useShopCart'
import {
  formatPrice,
  getCategoryIcon,
  getCategoryName,
} from './lib/shopFormat'
import { buildSingleInquiry, launchInquiry } from './lib/lineDeepLink'
import { LineInquiryModal } from './components/LineInquiryModal'
import { ImageOrFallback } from './components/ImageOrFallback'

/** Supabase 的 `id` 是 uuid，亂打字串會炸出 22P02 錯誤，先在 client 擋掉 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * 商品詳情頁（/shop/:productId）。
 *
 * M3 內容：
 * - 撈單一商品 + variants
 * - 兩欄版型：左圖右資訊（桌機）、上下堆疊（手機）
 * - 選規格 → 顯示對應價格 / 庫存
 * - 數量選擇器
 * - 兩顆按鈕：加入購物車（主）、直接 LINE 詢問（次）
 *   ⚠️ M3 兩顆都先 stub（console + alert），M4 接購物車、M5 接 LINE deep link
 */
export function ShopDetail() {
  const { productId } = useParams<{ productId: string }>()
  const { addItem } = useShopCart()

  const [product, setProduct] = useState<ProductWithVariants | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  /** 桌機 fallback modal 要顯示的訊息；null = 不顯示 */
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // 沒帶 productId 或格式不像 UUID（例如 /shop/abc 亂打）：直接視為「找不到」，
    // 不要打 Supabase（會回 22P02 invalid input syntax for uuid，那是技術錯誤、不該秀給客人）
    if (!productId || !UUID_REGEX.test(productId)) {
      setProduct(null)
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    void (async () => {
      try {
        const p = await fetchProductWithVariants(productId)
        if (cancelled) return
        setProduct(p)
        setError(null)
        // 預選第一個有貨的變體；都沒貨就選第一個
        if (p && p.variants.length > 0) {
          const firstInStock = p.variants.find((v) => (v.stock ?? 0) > 0)
          setSelectedVariantId((firstInStock ?? p.variants[0]).id)
        }
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [productId])

  const selectedVariant: ProductVariantRow | null = useMemo(() => {
    if (!product || !selectedVariantId) return null
    return product.variants.find((v) => v.id === selectedVariantId) ?? null
  }, [product, selectedVariantId])

  const imageUrl =
    selectedVariant?.image_url ??
    product?.variants.find((v) => v.image_url)?.image_url ??
    null

  const handleAddToCart = () => {
    if (!product || !selectedVariant) return
    const productName = [product.brand, product.model].filter(Boolean).join(' ').trim()
    addItem({
      variantId: selectedVariant.id,
      productId: product.id,
      productName: productName || '(未命名商品)',
      categoryId: product.category ?? '',
      attributes: selectedVariant.attributes,
      imageUrl: selectedVariant.image_url ?? imageUrl ?? null,
      unitPrice: selectedVariant.price,
      quantity,
    })
    // 加完還原 quantity 到 1，方便繼續加同商品其他規格
    setQuantity(1)
  }

  const handleDirectInquiry = () => {
    if (!product || !selectedVariant) return
    const productName = [product.brand, product.model].filter(Boolean).join(' ').trim()
    const payload = buildSingleInquiry({
      productId: product.id,
      productName: productName || '(未命名商品)',
      categoryId: product.category,
      attributes: selectedVariant.attributes,
      quantity,
      unitPrice: selectedVariant.price,
    })
    if (payload.stillTooLong) {
      alert('詢問內容過長，建議減少數量或備註資訊')
      return
    }
    const result = launchInquiry(payload)
    if (result.mode === 'desktop-fallback') {
      setFallbackMessage(result.message)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ShopHeader showBack />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} />
        ) : !product ? (
          <NotFoundState />
        ) : (
          <ProductDetailBody
            product={product}
            imageUrl={imageUrl}
            selectedVariant={selectedVariant}
            selectedVariantId={selectedVariantId}
            onSelectVariant={setSelectedVariantId}
            quantity={quantity}
            onChangeQuantity={setQuantity}
            onAddToCart={handleAddToCart}
            onDirectInquiry={handleDirectInquiry}
          />
        )}
      </main>

      <LineInquiryModal
        message={fallbackMessage}
        onClose={() => setFallbackMessage(null)}
      />
    </div>
  )
}

interface ProductDetailBodyProps {
  product: ProductWithVariants
  imageUrl: string | null
  selectedVariant: ProductVariantRow | null
  selectedVariantId: string | null
  onSelectVariant: (id: string) => void
  quantity: number
  onChangeQuantity: (n: number) => void
  onAddToCart: () => void
  onDirectInquiry: () => void
}

function ProductDetailBody({
  product,
  imageUrl,
  selectedVariant,
  selectedVariantId,
  onSelectVariant,
  quantity,
  onChangeQuantity,
  onAddToCart,
  onDirectInquiry,
}: ProductDetailBodyProps) {
  const fallbackIcon = getCategoryIcon(product.category)
  const categoryName = getCategoryName(product.category)
  const isOutOfStock = selectedVariant ? (selectedVariant.stock ?? 0) <= 0 : true
  const priceText =
    selectedVariant?.price != null
      ? formatPrice(selectedVariant.price)
      : '價格洽詢'

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 bg-white rounded-xl shadow-sm p-4 sm:p-6 md:p-8">
      {/* 圖片 */}
      <div className="relative aspect-[9/16] bg-gray-100 rounded-lg overflow-hidden">
        <ImageOrFallback
          src={imageUrl}
          alt={`${product.brand} ${product.model}`}
          imgClassName="w-full h-full object-cover"
          loading="eager"
          fallback={
            <div className="w-full h-full flex items-center justify-center text-8xl text-gray-300">
              <span aria-hidden>{fallbackIcon}</span>
            </div>
          }
        />
      </div>

      {/* 資訊區 */}
      <div className="flex flex-col">
        <Link
          to={`/shop?category=${product.category ?? ''}`}
          className="self-start text-xs text-gray-500 uppercase tracking-wide hover:text-orange-500"
        >
          {categoryName}
        </Link>

        <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight">
          {product.brand && (
            <span className="block text-base font-medium text-gray-600">
              {product.brand}
            </span>
          )}
          {product.model || '(未命名商品)'}
        </h1>

        <div className="mt-4 flex items-baseline gap-3">
          <div className="text-2xl sm:text-3xl font-bold text-zinc-900">
            {priceText}
          </div>
          {isOutOfStock && (
            <span className="text-sm text-red-600 font-medium">目前缺貨</span>
          )}
        </div>

        {product.description && (
          <p className="mt-3 text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
            {product.description}
          </p>
        )}

        <div className="mt-6">
          <VariantPicker
            variants={product.variants}
            selectedVariantId={selectedVariantId}
            categoryId={product.category}
            onSelect={onSelectVariant}
          />
        </div>

        <div className="mt-6">
          <div className="text-sm font-medium text-gray-700 mb-2">數量</div>
          <QuantityStepper value={quantity} onChange={onChangeQuantity} />
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onAddToCart}
            disabled={!selectedVariant}
            className="flex-1 h-12 rounded-md bg-orange-500 text-white font-semibold text-base hover:bg-orange-600 active:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            🛒 加入購物車
          </button>
          <button
            type="button"
            onClick={onDirectInquiry}
            disabled={!selectedVariant}
            className="flex-1 h-12 rounded-md bg-zinc-900 text-white font-semibold text-base hover:bg-zinc-800 active:bg-zinc-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            📞 直接 LINE 詢問
          </button>
        </div>

        <p className="mt-4 text-xs text-gray-500 leading-relaxed">
          *
          線上瀏覽不直接成立訂單；按下「LINE 詢問」會跳到我們的官方 LINE，店家收到訊息後與您確認購買細節。
        </p>
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 animate-pulse">
      <div className="aspect-[9/16] bg-gray-100 rounded-lg" />
      <div className="space-y-3">
        <div className="h-3 w-1/4 bg-gray-100 rounded" />
        <div className="h-7 w-2/3 bg-gray-100 rounded" />
        <div className="h-9 w-1/2 bg-gray-100 rounded" />
        <div className="h-20 w-full bg-gray-100 rounded mt-6" />
        <div className="h-12 w-full bg-gray-100 rounded mt-8" />
      </div>
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="text-center py-16">
      <div className="text-5xl mb-3" aria-hidden>
        ⚠️
      </div>
      <h2 className="text-lg font-semibold text-zinc-900">暫時無法載入商品</h2>
      <p className="mt-1 text-sm text-gray-500">{message}</p>
      <Link
        to="/shop"
        className="mt-4 inline-flex items-center px-4 py-2 rounded-md bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800"
      >
        ← 返回商品列表
      </Link>
    </div>
  )
}

function NotFoundState() {
  return (
    <div className="text-center py-16 text-gray-500">
      <div className="text-5xl mb-3" aria-hidden>
        🔍
      </div>
      <h2 className="text-lg font-semibold text-zinc-900">找不到這個商品</h2>
      <p className="mt-1 text-sm">商品可能已下架或網址有誤。</p>
      <Link
        to="/shop"
        className="mt-4 inline-flex items-center px-4 py-2 rounded-md bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800"
      >
        ← 返回商品列表
      </Link>
    </div>
  )
}
