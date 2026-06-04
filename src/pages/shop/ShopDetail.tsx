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
  getCategoryShopName,
  getProductDetailHeroImageUrl,
} from './lib/shopFormat'
import {
  getVariantAvailability,
  isProductVisibleInShop,
  isVariantPurchasable,
} from './lib/productAvailability'
import { NoImagePlaceholder } from './components/NoImagePlaceholder'
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
    if (!product) {
      document.title = 'ES Wake Shop'
      return
    }
    const name = [product.brand, product.model].filter(Boolean).join(' ').trim()
    document.title = name ? `${name} | ES Wake Shop` : 'ES Wake Shop'
  }, [product])

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
        if (!p || !p.is_public || !isProductVisibleInShop(p.variants)) {
          setProduct(null)
          setError(null)
          return
        }
        setProduct(p)
        setError(null)
        const firstPurchasable = p.variants.find((v) => isVariantPurchasable(v))
        const firstVisible = p.variants.find(
          (v) => getVariantAvailability(v) !== 'sold_out',
        )
        setSelectedVariantId((firstPurchasable ?? firstVisible ?? p.variants[0])?.id ?? null)
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

  const imageUrl = product
    ? getProductDetailHeroImageUrl(product, selectedVariant, product.variants)
    : null

  const handleAddToCart = () => {
    if (!product || !selectedVariant || !isVariantPurchasable(selectedVariant)) return
    const productName = [product.brand, product.model].filter(Boolean).join(' ').trim()
    const avail = getVariantAvailability(selectedVariant)
    addItem({
      variantId: selectedVariant.id,
      productId: product.id,
      productName: productName || '(Unnamed product)',
      categoryId: product.category ?? '',
      attributes: selectedVariant.attributes,
      imageUrl: selectedVariant.cover_image_url ?? selectedVariant.image_url ?? imageUrl ?? null,
      unitPrice: selectedVariant.price,
      quantity,
      availability: avail === 'pre_order' ? 'pre_order' : 'in_stock',
      preOrderEta: selectedVariant.pre_order_eta,
    })
    setQuantity(1)
  }

  const handleDirectInquiry = () => {
    if (!product || !selectedVariant || !isVariantPurchasable(selectedVariant)) return
    const productName = [product.brand, product.model].filter(Boolean).join(' ').trim()
    const avail = getVariantAvailability(selectedVariant)
    const payload = buildSingleInquiry({
      productId: product.id,
      productName: productName || '(Unnamed product)',
      categoryId: product.category,
      attributes: selectedVariant.attributes,
      quantity,
      unitPrice: selectedVariant.price,
      isPreOrder: avail === 'pre_order',
      preOrderEta: selectedVariant.pre_order_eta,
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
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
  const categoryName = getCategoryShopName(product.category)
  const variantAvail = selectedVariant ? getVariantAvailability(selectedVariant) : null
  const canPurchase = selectedVariant ? isVariantPurchasable(selectedVariant) : false
  const isPreOrder = variantAvail === 'pre_order'
  const hasPrice = selectedVariant?.price != null
  const priceText = hasPrice ? formatPrice(selectedVariant!.price!) : '價格洽詢'

  /**
   * 縮圖列：目前 SKU 的封面 + 實品照（若不同）。
   */
  const imageOptions = useMemo(() => {
    if (!selectedVariant) return []
    const seen = new Set<string>()
    const options: { url: string; label: string }[] = []
    const add = (url: string | null | undefined, label: string) => {
      if (!url || seen.has(url)) return
      seen.add(url)
      options.push({ url, label })
    }
    add(selectedVariant.cover_image_url, '封面')
    add(selectedVariant.image_url, '實品')
    return options
  }, [selectedVariant])

  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const heroImageUrl = previewImageUrl ?? imageUrl

  useEffect(() => {
    setPreviewImageUrl(null)
  }, [product.id, selectedVariantId, imageUrl])

  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6 md:gap-10 bg-white rounded-xl shadow-sm p-4 sm:p-6 md:p-8">
      {/* 圖片 + 縮圖列 */}
      <div>
        {/*
          全平台都用 4:5 比例（跟 list 卡片同調），不再 9:16 那種戲劇直立。
          手機 / 桌機都限制 max-h 跟 max-w，
          避免桌機左欄拉超長、右欄底下留白；手機則避免吃整個首屏。
        */}
        <div className="relative aspect-4/5 max-h-[60vh] md:max-h-[500px] max-w-[320px] sm:max-w-sm md:max-w-none mx-auto bg-gray-100 rounded-lg overflow-hidden">
          <ImageOrFallback
            src={heroImageUrl}
            alt={`${product.brand} ${product.model}`}
            imgClassName="w-full h-full object-cover"
            loading="eager"
            fallback={<NoImagePlaceholder />}
          />
        </div>

        {imageOptions.length > 1 && (
          <div
            className="mt-3 flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: 'none' }}
            role="tablist"
            aria-label="Product images"
          >
            {imageOptions.map((opt) => {
              const active = heroImageUrl === opt.url
              return (
                <button
                  key={opt.url}
                  type="button"
                  onClick={() => setPreviewImageUrl(opt.url)}
                  role="tab"
                  aria-selected={active}
                  title={opt.label}
                  className={
                    'shrink-0 w-14 h-18 sm:w-16 sm:h-20 rounded-md overflow-hidden border-2 transition-colors ' +
                    (active
                      ? 'border-black'
                      : 'border-transparent hover:border-gray-300')
                  }
                >
                  <img
                    src={opt.url}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* 資訊區 */}
      <div className="flex flex-col">
        <Link
          to={product.category ? `/shop?cat=${encodeURIComponent(product.category)}` : '/shop'}
          className="self-start text-xs text-gray-400 uppercase tracking-widest hover:text-black"
        >
          {categoryName}
        </Link>

        {/*
          標題層級（Ronix 風）：
          - Brand：小字 + ALL-CAPS + uppercase tracking-widest 當 kicker（雜誌封面那種小品牌標）
          - Model：大字 + Inter Black 900，跟 list hero 的字重呼應
          - Model 不上 italic：模型名常有數字（"RXT 142"）、太多斜體不好讀
        */}
        {product.brand && (
          <div className="text-xs sm:text-sm font-bold tracking-[0.18em] text-gray-500 uppercase">
            {product.brand}
          </div>
        )}
        <h1 className="mt-1 text-2xl sm:text-3xl md:text-4xl font-black text-zinc-900 tracking-tight leading-tight">
          {product.model || '(Unnamed product)'}
        </h1>

        <div className="mt-3 sm:mt-4 flex items-baseline gap-3 flex-wrap">
          {hasPrice ? (
            <div className="text-2xl sm:text-3xl font-bold text-zinc-900">
              {priceText}
            </div>
          ) : (
            /* 沒有實價時降階成淺灰標籤，跟 list 卡片同一套視覺語言 */
            <span className="inline-block px-2.5 py-1 rounded-md bg-gray-100 text-sm text-gray-600">
              {priceText}
            </span>
          )}
          {isPreOrder && (
            <span className="text-sm text-amber-700 font-medium">
              預購
              {selectedVariant?.pre_order_eta ? (
                <span className="text-gray-500 font-normal">
                  {' '}
                  · 預計 {selectedVariant.pre_order_eta}
                </span>
              ) : null}
            </span>
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
          <div className="text-sm font-medium text-gray-700 mb-2">
            Quantity <span className="text-gray-400 font-normal">數量</span>
          </div>
          <QuantityStepper value={quantity} onChange={onChangeQuantity} />
        </div>

        {/*
          按鈕：英文主標 + 中文副標雙行（垂直 stack），避免上一版「Add to Cart 加入購物車」
          硬塞同一行被切成「加入購物 / 車」的爆版。
          高度 h-14（行高更舒服），手機/桌機都用同樣 layout。
        */}
        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          {/*
            兩顆按鈕：
            - 主 CTA「Add to Cart」用黑底白字（全站主互動色）
            - 次 CTA「Inquire via LINE」用白底黑邊（avoid 兩顆全黑撞在一起）
          */}
          <button
            type="button"
            onClick={onAddToCart}
            disabled={!selectedVariant || !canPurchase}
            className="flex-1 h-14 px-4 rounded-md bg-black text-white font-semibold hover:bg-zinc-800 active:bg-zinc-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm inline-flex items-center justify-center gap-2.5"
          >
            <CartIcon className="w-5 h-5 shrink-0" />
            <span className="flex flex-col items-start leading-tight">
              <span className="text-base">Add to Cart</span>
              <span className="text-xs font-normal text-zinc-300">加入購物車</span>
            </span>
          </button>
          <button
            type="button"
            onClick={onDirectInquiry}
            disabled={!selectedVariant || !canPurchase}
            className="flex-1 h-14 px-4 rounded-md bg-gray-50 text-black font-semibold border-2 border-black hover:bg-gray-100 active:bg-gray-200 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-300 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2.5"
          >
            <LineIcon className="w-5 h-5 shrink-0" />
            <span className="flex flex-col items-start leading-tight">
              <span className="text-base">用 LINE 詢問</span>
              <span className="text-xs font-normal text-gray-500">Inquire via LINE</span>
            </span>
          </button>
        </div>

        <p className="mt-4 text-xs text-gray-500 leading-relaxed">
          * 請透過 LINE 詢問購買，我們會盡快回覆。
        </p>
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 animate-pulse">
      <div className="aspect-4/5 max-h-[500px] max-w-[320px] sm:max-w-sm md:max-w-none mx-auto w-full bg-gray-100 rounded-lg" />
      <div className="space-y-3">
        <div className="h-3 w-1/4 bg-gray-100 rounded" />
        <div className="h-7 w-2/3 bg-gray-100 rounded" />
        <div className="h-9 w-1/2 bg-gray-100 rounded" />
        <div className="h-20 w-full bg-gray-100 rounded mt-6" />
        <div className="h-14 w-full bg-gray-100 rounded mt-8" />
      </div>
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="text-center py-16">
      <AlertIcon className="mx-auto mb-3 w-12 h-12 text-gray-300" />
      <h2 className="text-lg font-semibold text-zinc-900">暫時無法載入商品</h2>
      <p className="mt-1 text-sm text-gray-500">{message}</p>
      <Link
        to="/shop"
        className="mt-4 inline-flex items-center px-4 py-2 rounded-md bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800"
      >
        ← Back to products
      </Link>
    </div>
  )
}

function NotFoundState() {
  return (
    <div className="text-center py-16 text-gray-500">
      <SearchIcon className="mx-auto mb-3 w-12 h-12 text-gray-300" />
      <h2 className="text-lg font-semibold text-zinc-900">找不到這個商品</h2>
      <p className="mt-1 text-sm">商品可能已下架或網址有誤。</p>
      <Link
        to="/shop"
        className="mt-4 inline-flex items-center px-4 py-2 rounded-md bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800"
      >
        ← Back to products
      </Link>
    </div>
  )
}

// ============================================================
// Inline icons：避免引入 icon library，跟產品色系手調 SVG 即可
// ============================================================

function CartIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
      <path d="M3 4h2l2.5 12.5a2 2 0 0 0 2 1.5h8a2 2 0 0 0 2-1.5L21 8H6" />
    </svg>
  )
}

function LineIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 3C6.48 3 2 6.74 2 11.31c0 4.05 3.54 7.46 8.32 8.16.32.07.76.21.87.49.1.25.07.64.03.9l-.14.85c-.04.25-.2.99.86.54 1.06-.45 5.73-3.38 7.82-5.78C20.95 14.96 22 13.27 22 11.31 22 6.74 17.52 3 12 3zM8.34 13.74h-2c-.29 0-.52-.24-.52-.52V9.74c0-.29.23-.52.52-.52.29 0 .52.23.52.52v2.95h1.48c.29 0 .52.23.52.52 0 .29-.23.53-.52.53zm1.79-.52c0 .29-.23.52-.52.52-.29 0-.52-.23-.52-.52V9.74c0-.29.23-.52.52-.52.29 0 .52.23.52.52v3.48zm4.07 0c0 .22-.14.42-.36.49-.06.02-.11.03-.17.03-.16 0-.32-.07-.42-.21l-1.83-2.49v2.19c0 .29-.23.52-.52.52-.29 0-.52-.23-.52-.52V9.74c0-.22.14-.42.36-.49.06-.02.11-.03.17-.03.16 0 .32.08.41.21l1.84 2.49V9.74c0-.29.23-.52.52-.52.29 0 .52.23.52.52v3.48zm3.32-2.27c.29 0 .52.23.52.52 0 .29-.23.52-.52.52h-1.48v.71h1.48c.29 0 .52.23.52.52 0 .29-.23.53-.52.53h-2c-.29 0-.52-.24-.52-.52V9.74c0-.29.23-.52.52-.52h2c.29 0 .52.23.52.52 0 .29-.23.52-.52.52h-1.48v.71h1.48z" />
    </svg>
  )
}

/** 警示三角（給 ErrorState 用） */
function AlertIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

/** 放大鏡（給 NotFoundState 用） */
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}
