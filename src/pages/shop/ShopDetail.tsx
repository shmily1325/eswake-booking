import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { getShopProductPreview } from './lib/shopReturnTo'
import { fetchProductWithVariants } from '../admin/products/api'
import type { ProductWithVariants, ProductVariantRow } from '../admin/products/types'
import { ShopHeader } from './components/ShopHeader'
import { DetailPurchaseActions } from './components/DetailPurchaseActions'
import { ShopDetailQuantity } from './components/ShopDetailQuantity'
import { VariantPicker } from './components/VariantPicker'
import { useShopCart } from './hooks/useShopCart'
import { useShopCatalog } from './hooks/useShopCatalog'
import { useShopPromo } from './hooks/useShopPromo'
import {
  formatPrice,
  formatPreOrderDeadline,
  getCategoryShopName,
  getProductCoverImages,
  getProductDetailHeroImageUrl,
  isProductListedInShop,
} from './lib/shopFormat'
import {
  formatProductModelName,
  formatProductSecondaryLine,
  formatProductTitle,
} from '../admin/products/schema'
import { normalizeVariantCoverImages } from '../admin/products/coverImages'
import {
  getVariantAvailability,
  getVariantPurchaseLimit,
  isVariantPurchasable,
} from './lib/productAvailability'
import { SHOP_DETAIL } from './lib/shopCopy'
import { buildSingleInquiry, launchInquiry } from './lib/lineDeepLink'
import { LineInquiryModal } from './components/LineInquiryModal'
import { ShopDetailGallery } from './components/ShopDetailGallery'
import type { GalleryImage } from './components/ShopDetailGallery'
import { getShopReturnTo } from './lib/shopReturnTo'
import { shopListPath } from './lib/shopPaths'
import {
  SHOP_DETAIL_FRAME,
  SHOP_DETAIL_WRAP,
  shopDiscountBadgeClass,
} from './lib/shopUiStyle'
import { ES_BRAND } from '../../lib/esBrandTokens'
import { ShopFooter } from './components/ShopFooter'
import { ProductSizeChart } from './components/ProductSizeChart'

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
function pickDefaultVariantId(variants: ProductVariantRow[]): string | null {
  const firstPurchasable = variants.find((v) => isVariantPurchasable(v))
  const firstVisible = variants.find(
    (v) => getVariantAvailability(v) !== 'sold_out',
  )
  return (firstPurchasable ?? firstVisible ?? variants[0])?.id ?? null
}

export function ShopDetail() {
  const { productId } = useParams<{ productId: string }>()
  const location = useLocation()
  const { addItem } = useShopCart()
  const catalog = useShopCatalog()
  const promo = useShopPromo()

  const preview =
    productId && UUID_REGEX.test(productId)
      ? getShopProductPreview(location.state, productId)
      : null
  const cachedProduct =
    productId && UUID_REGEX.test(productId)
      ? catalog.getProduct(productId)
      : null
  const initialProduct = preview ?? cachedProduct

  const [product, setProduct] = useState<ProductWithVariants | null>(initialProduct)
  const [loading, setLoading] = useState(!initialProduct)
  const [error, setError] = useState<string | null>(null)

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(() =>
    initialProduct ? pickDefaultVariantId(initialProduct.variants) : null,
  )
  const productRef = useRef(product)
  productRef.current = product
  const [quantity, setQuantity] = useState(1)
  /** 桌機 fallback modal 要顯示的訊息；null = 不顯示 */
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!product) {
      document.title = ES_BRAND.shopTitle
      return
    }
    const name = formatProductTitle(product)
    document.title = name ? `${name} | ${ES_BRAND.shopTitle}` : ES_BRAND.shopTitle
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
    if (productRef.current?.id !== productId) setLoading(true)
    void (async () => {
      try {
        const p = await fetchProductWithVariants(productId)
        if (cancelled) return
        if (!p || !p.is_public || !isProductListedInShop(p)) {
          setProduct(null)
          setError(null)
          setSelectedVariantId(null)
          return
        }
        setProduct(p)
        catalog.mergeProduct(p)
        setError(null)
        setSelectedVariantId((prev) => {
          if (prev && p.variants.some((v) => v.id === prev)) return prev
          return pickDefaultVariantId(p.variants)
        })
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
  }, [productId, preview, catalog.mergeProduct])

  useEffect(() => {
    if (!productId || !UUID_REGEX.test(productId)) return
    const next =
      getShopProductPreview(location.state, productId) ??
      catalog.getProduct(productId)
    if (!next) return
    setProduct(next)
    setSelectedVariantId((prev) => {
      if (prev && next.variants.some((v) => v.id === prev)) return prev
      return pickDefaultVariantId(next.variants)
    })
    setLoading(false)
  }, [productId, location.state, catalog.getProduct])

  const selectedVariant: ProductVariantRow | null = useMemo(() => {
    if (!product || !selectedVariantId) return null
    return product.variants.find((v) => v.id === selectedVariantId) ?? null
  }, [product, selectedVariantId])
  const quantityLimit = selectedVariant
    ? Math.max(1, getVariantPurchaseLimit(selectedVariant))
    : 99

  useEffect(() => {
    setQuantity((current) => Math.min(current, quantityLimit))
  }, [quantityLimit])

  const imageUrl = product
    ? getProductDetailHeroImageUrl(product, selectedVariant, product.variants)
    : null

  const handleAddToCart = () => {
    if (!product || !selectedVariant || !isVariantPurchasable(selectedVariant)) return
    const productName = formatProductTitle(product) || '(Unnamed product)'
    const avail = getVariantAvailability(selectedVariant)
    const shopPrice = promo.resolve(selectedVariant)
    addItem({
      variantId: selectedVariant.id,
      productId: product.id,
      productName,
      categoryId: product.category ?? '',
      attributes: selectedVariant.attributes,
      imageUrl: selectedVariant.cover_image_url ?? selectedVariant.image_url ?? imageUrl ?? null,
      unitPrice: shopPrice.sale,
      originalPrice: shopPrice.original,
      discountCaption: shopPrice.caption,
      quantity: Math.min(quantity, quantityLimit),
      maxQuantity: quantityLimit,
      availability: avail === 'pre_order' ? 'pre_order' : 'in_stock',
      preOrderEta: selectedVariant.pre_order_eta,
    })
    setQuantity(1)
  }

  const handleDirectInquiry = () => {
    if (!product || !selectedVariant || !isVariantPurchasable(selectedVariant)) return
    const productName = formatProductTitle(product) || '(Unnamed product)'
    const avail = getVariantAvailability(selectedVariant)
    const shopPrice = promo.resolve(selectedVariant)
    const payload = buildSingleInquiry({
      productId: product.id,
      productName: productName || '(Unnamed product)',
      categoryId: product.category,
      attributes: selectedVariant.attributes,
      quantity: Math.min(quantity, quantityLimit),
      unitPrice: shopPrice.sale,
      originalPrice: shopPrice.original,
      discountCaption: shopPrice.caption,
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 pb-28 lg:pb-10">
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
            quantityLimit={quantityLimit}
            onChangeQuantity={setQuantity}
            onAddToCart={handleAddToCart}
            onDirectInquiry={handleDirectInquiry}
          />
        )}
      </main>

      <ShopFooter />

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
  quantityLimit: number
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
  quantityLimit,
  onChangeQuantity,
  onAddToCart,
  onDirectInquiry,
}: ProductDetailBodyProps) {
  const promo = useShopPromo()
  const categoryName = getCategoryShopName(product.category)
  const variantAvail = selectedVariant ? getVariantAvailability(selectedVariant) : null
  const canPurchase = selectedVariant ? isVariantPurchasable(selectedVariant) : false
  const isPreOrder = variantAvail === 'pre_order'
  const shopPrice = selectedVariant ? promo.resolve(selectedVariant) : null
  const hasPrice = shopPrice?.sale != null
  const priceText = hasPrice ? formatPrice(shopPrice!.sale!) : '價格洽詢'
  const memberPrice =
    selectedVariant?.member_price != null
      ? formatPrice(selectedVariant.member_price)
      : null
  const secondaryLine = formatProductSecondaryLine(product)

  /**
   * gallery：商品卡封面（一色共用）優先；沒有才用 SKU 封面。
   * 再加選中 SKU 實品照。完全沒圖時退回 imageUrl。
   */
  const imageOptions = useMemo(() => {
    const seen = new Set<string>()
    const options: GalleryImage[] = []
    const add = (url: string | null | undefined, label: string) => {
      if (!url || seen.has(url)) return
      seen.add(url)
      options.push({ url, label })
    }
    const productCovers = getProductCoverImages(product)
    if (productCovers.length > 0) {
      productCovers.forEach((img, i) => {
        add(img.url, i === 0 ? SHOP_DETAIL.imageCover : `${SHOP_DETAIL.imageCover} ${i + 1}`)
      })
    } else if (selectedVariant) {
      const covers = normalizeVariantCoverImages(
        selectedVariant.cover_images,
        selectedVariant.cover_image_url,
        selectedVariant.cover_image_path,
      )
      covers.forEach((img, i) => {
        add(img.url, i === 0 ? SHOP_DETAIL.imageCover : `${SHOP_DETAIL.imageCover} ${i + 1}`)
      })
    }
    if (selectedVariant) add(selectedVariant.image_url, SHOP_DETAIL.imagePhoto)
    if (options.length === 0) add(imageUrl, SHOP_DETAIL.imageCover)
    return options
  }, [product, selectedVariant, imageUrl])

  const priceBlock = (
    <div>
      {hasPrice ? (
        <div>
          <div className="text-2xl sm:text-3xl font-bold text-zinc-900 tabular-nums">
            {priceText}
          </div>
          {shopPrice?.hasDiscount && shopPrice.original != null && (
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-400 line-through tabular-nums">
                {formatPrice(shopPrice.original)}
              </span>
              {shopPrice.caption ? (
                <span className={shopDiscountBadgeClass(shopPrice.source) + ' sm:text-xs'}>
                  {shopPrice.caption}
                </span>
              ) : null}
            </div>
          )}
        </div>
      ) : (
        <span className="inline-block px-2.5 py-1 rounded-md bg-gray-100 text-sm text-gray-600">
          {priceText}
        </span>
      )}
      {memberPrice ? (
        <div className="mt-2 text-base sm:text-lg font-semibold text-zinc-800 tabular-nums">
          {SHOP_DETAIL.memberPrice} {memberPrice}
        </div>
      ) : null}
    </div>
  )

  return (
    <>
    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6 md:gap-10 bg-white rounded-xl shadow-sm p-4 sm:p-6 md:p-8">
      {/* 圖片 gallery：手機滑主圖 + 圓點，桌機縮圖列 + 箭頭 */}
      <div className="relative">
        <ShopDetailGallery
          images={imageOptions}
          alt={formatProductTitle(product)}
          resetKey={`${product.id}:${selectedVariantId ?? ''}`}
        />
      </div>

      {/* 資訊區 */}
      <div className="flex flex-col">
        <Link
          to={
            product.category
              ? shopListPath(`cat=${encodeURIComponent(product.category)}`)
              : shopListPath()
          }
          className="self-start text-xs text-gray-400 uppercase tracking-widest hover:text-black"
        >
          {categoryName}
        </Link>

        {/*
          標題層級：品牌 kicker → 型號最大 → 顏色 · 年份次要
        */}
        {product.brand && (
          <div className="text-xs sm:text-sm font-bold tracking-[0.18em] text-gray-500 uppercase">
            {product.brand}
          </div>
        )}
        <h1 className="mt-1 text-2xl sm:text-3xl md:text-4xl font-black text-zinc-900 tracking-tight leading-tight">
          {formatProductModelName(product)}
        </h1>
        {secondaryLine ? (
          <div className="mt-1 text-sm sm:text-base text-gray-500">
            {secondaryLine}
          </div>
        ) : null}

        <div className="mt-3 sm:mt-4">{priceBlock}</div>
        {isPreOrder && (
          <div className="mt-2 text-xs sm:text-sm text-amber-800">
            {formatPreOrderDeadline(selectedVariant?.pre_order_until) ?? SHOP_DETAIL.preOrder}
            {selectedVariant?.pre_order_eta ? (
              <span className="ml-2 font-normal text-gray-500">
                預計 {selectedVariant.pre_order_eta}
              </span>
            ) : null}
          </div>
        )}

        <div className="mt-4">
          <VariantPicker
            variants={product.variants}
            selectedVariantId={selectedVariantId}
            categoryId={product.category}
            onSelect={onSelectVariant}
          />
        </div>

        {product.size_chart ? <ProductSizeChart chart={product.size_chart} /> : null}

        <div className="mt-4 flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">{SHOP_DETAIL.quantity}</span>
          <ShopDetailQuantity
            value={quantity}
            max={quantityLimit}
            onChange={onChangeQuantity}
          />
          {variantAvail === 'in_stock' && canPurchase && (
            <span className="text-xs text-gray-500">
              最多 {quantityLimit} 件
            </span>
          )}
        </div>

        <div className="mt-6 hidden lg:block">
          <DetailPurchaseActions
            layout="stacked"
            canPurchase={!!selectedVariant && canPurchase}
            onAddToCart={onAddToCart}
            onDirectInquiry={onDirectInquiry}
          />
        </div>

        <p className="mt-4 text-xs text-gray-500 leading-relaxed hidden lg:block">
          * {SHOP_DETAIL.lineNote}
        </p>
      </div>
    </div>

    <div
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white shadow-[0_-4px_24px_rgba(0,0,0,0.08)] pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      role="region"
      aria-label="Purchase actions"
    >
      <div className="max-w-7xl mx-auto px-4 pt-3">
        <DetailPurchaseActions
          layout="sticky"
          canPurchase={!!selectedVariant && canPurchase}
          onAddToCart={onAddToCart}
          onDirectInquiry={onDirectInquiry}
        />
      </div>
    </div>
    </>
  )
}

function LoadingState() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 animate-pulse">
      <div className={SHOP_DETAIL_WRAP + ' bg-gray-100 rounded-lg overflow-hidden ' + SHOP_DETAIL_FRAME} />
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
  const backTo = getShopReturnTo(useLocation().state)
  return (
    <div className="text-center py-16">
      <AlertIcon className="mx-auto mb-3 w-12 h-12 text-gray-300" />
      <h2 className="text-lg font-semibold text-zinc-900">暫時無法載入商品</h2>
      <p className="mt-1 text-sm text-gray-500">{message}</p>
      <Link
        to={backTo}
        className="mt-4 inline-flex items-center px-4 py-2 rounded-md bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800"
      >
        ← Back to products
      </Link>
    </div>
  )
}

function NotFoundState() {
  const backTo = getShopReturnTo(useLocation().state)
  return (
    <div className="text-center py-16 text-gray-500">
      <SearchIcon className="mx-auto mb-3 w-12 h-12 text-gray-300" />
      <h2 className="text-lg font-semibold text-zinc-900">找不到這個商品</h2>
      <p className="mt-1 text-sm">商品可能已下架或網址有誤。</p>
      <Link
        to={backTo}
        className="mt-4 inline-flex items-center px-4 py-2 rounded-md bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800"
      >
        ← Back to products
      </Link>
    </div>
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
