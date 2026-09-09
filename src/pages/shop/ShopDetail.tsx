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
  getSkuFields,
} from '../admin/products/schema'
import { normalizeVariantCoverImages } from '../admin/products/coverImages'
import { getVariantAvailability, getVariantPurchaseLimit, isVariantPurchasable } from './lib/productAvailability'
import { SHOP_DETAIL } from './lib/shopCopy'
import { buildSingleInquiry, launchInquiry } from './lib/lineDeepLink'
import { LineInquiryModal } from './components/LineInquiryModal'
import { ShopDetailGallery } from './components/ShopDetailGallery'
import type { GalleryImage } from './components/ShopDetailGallery'
import { getShopReturnTo } from './lib/shopReturnTo'
import { shopListPath } from './lib/shopPaths'
import { SHOP_DETAIL_FRAME, SHOP_DETAIL_WRAP, shopDiscountBadgeClass } from './lib/shopUiStyle'
import { ES_BRAND } from '../../lib/esBrandTokens'
import { ShopFooter } from './components/ShopFooter'
import { ProductSizeChart } from './components/ProductSizeChart'
import {
  buildSelectedOptionSnapshot,
  isEmptyProductOptionConfig,
  normalizeProductOptionConfig,
  pruneHiddenCustomValues,
  resolveCustomPriceRange,
  resolveCustomSelectionPrice,
  validateCustomSelection,
  visibleCustomFields,
  type ProductOptionConfig,
} from '../admin/products/productOptions'
import { parsePantoneSelection } from './lib/pantoneSelection'

/** Supabase 的 `id` 是 uuid，亂打字串會炸出 22P02 錯誤，先在 client 擋掉 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function selectionValuesWithPendingColor(
  config: ProductOptionConfig | null,
  attributes: Readonly<Record<string, unknown>>,
  values: Readonly<Record<string, string>>,
): Record<string, string> | null {
  const next = { ...values }
  let filledPendingColor = false
  for (const field of visibleCustomFields(config, attributes, values)) {
    if (field.required && !values[field.key]?.trim() && field.displayStyle === 'swatches' && field.allowCustomValue) {
      next[field.key] = '待與客服確認'
      filledPendingColor = true
    }
  }
  return filledPendingColor && validateCustomSelection(config, attributes, next) === null ? next : null
}

function customFieldShopLabel(key: string, fallback: string): string {
  if (key === 'build_option') return 'Build'
  if (key === 'standard_color' || key === 'spray_color' || key === 'carbon_color') return 'Color'
  return fallback
}

function customOptionShopLabel(fieldKey: string, value: string): string {
  return fieldKey === 'build_option' && value === 'Standard Build' ? 'Standard' : value
}

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
  const firstVisible = variants.find((v) => getVariantAvailability(v) !== 'sold_out')
  return (firstPurchasable ?? firstVisible ?? variants[0])?.id ?? null
}

export function ShopDetail() {
  const { productId } = useParams<{ productId: string }>()
  const location = useLocation()
  const { addItem } = useShopCart()
  const catalog = useShopCatalog()
  const getCatalogProduct = catalog.getProduct
  const isProductDetailFresh = catalog.isProductDetailFresh
  const mergeCatalogProduct = catalog.mergeProduct
  const promo = useShopPromo()

  const preview = productId && UUID_REGEX.test(productId) ? getShopProductPreview(location.state, productId) : null
  const cachedProduct = productId && UUID_REGEX.test(productId) ? getCatalogProduct(productId) : null
  const initialProduct = cachedProduct ?? preview

  const [product, setProduct] = useState<ProductWithVariants | null>(initialProduct)
  const [loading, setLoading] = useState(!initialProduct)
  const [error, setError] = useState<string | null>(null)

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(() =>
    initialProduct ? pickDefaultVariantId(initialProduct.variants) : null,
  )
  const productRef = useRef(product)
  const resolvedProductIdRef = useRef<string | null>(null)
  productRef.current = product
  const [quantity, setQuantity] = useState(1)
  const [customValues, setCustomValues] = useState<Record<string, string>>({})
  /** 桌機 fallback modal 要顯示的訊息；null = 不顯示 */
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null)

  useEffect(() => {
    setCustomValues({})
  }, [productId])

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
      resolvedProductIdRef.current = null
      setProduct(null)
      setError(null)
      setLoading(false)
      return
    }
    const freshDetail = isProductDetailFresh(productId) ? getCatalogProduct(productId) : null
    if (freshDetail) {
      resolvedProductIdRef.current = productId
      setProduct(freshDetail)
      setError(null)
      setSelectedVariantId((prev) => {
        if (prev && freshDetail.variants.some((variant) => variant.id === prev)) return prev
        return pickDefaultVariantId(freshDetail.variants)
      })
      setLoading(false)
      return
    }
    if (productRef.current?.id !== productId) setLoading(true)
    void (async () => {
      try {
        const p = await fetchProductWithVariants(productId)
        if (cancelled) return
        if (!p || !p.is_public || !isProductListedInShop(p)) {
          resolvedProductIdRef.current = productId
          setProduct(null)
          setError(null)
          setSelectedVariantId(null)
          return
        }
        resolvedProductIdRef.current = productId
        setProduct(p)
        mergeCatalogProduct(p, { detail: true })
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
  }, [productId, preview, getCatalogProduct, isProductDetailFresh, mergeCatalogProduct])

  useEffect(() => {
    if (!productId || !UUID_REGEX.test(productId)) return
    if (resolvedProductIdRef.current === productId) return
    const next = getCatalogProduct(productId) ?? getShopProductPreview(location.state, productId)
    if (!next) return
    setProduct(next)
    setSelectedVariantId((prev) => {
      if (prev && next.variants.some((v) => v.id === prev)) return prev
      return pickDefaultVariantId(next.variants)
    })
    setLoading(false)
  }, [productId, location.state, getCatalogProduct])

  const selectedVariant: ProductVariantRow | null = useMemo(() => {
    if (!product || !selectedVariantId) return null
    return product.variants.find((v) => v.id === selectedVariantId) ?? null
  }, [product, selectedVariantId])
  const optionConfig = useMemo(() => normalizeProductOptionConfig(product?.option_config), [product?.option_config])
  const quantityLimit = selectedVariant ? Math.max(1, getVariantPurchaseLimit(selectedVariant)) : 99

  useEffect(() => {
    setQuantity((current) => Math.min(current, quantityLimit))
  }, [quantityLimit])

  useEffect(() => {
    if (!selectedVariant) return
    setCustomValues((current) => pruneHiddenCustomValues(optionConfig, selectedVariant.attributes, current))
  }, [optionConfig, selectedVariant])

  const imageUrl = product ? getProductDetailHeroImageUrl(product, selectedVariant, product.variants) : null

  const handleAddToCart = () => {
    if (!product || !selectedVariant || !isVariantPurchasable(selectedVariant)) return
    const selectionError = validateCustomSelection(optionConfig, selectedVariant.attributes, customValues)
    const cartValues = selectionValuesWithPendingColor(optionConfig, selectedVariant.attributes, customValues)
    if (selectionError && !cartValues) {
      alert(selectionError)
      return
    }
    const productName = formatProductTitle(product) || '(Unnamed product)'
    const avail = getVariantAvailability(selectedVariant)
    const shopPrice = promo.resolve(selectedVariant)
    const customPrice = resolveCustomSelectionPrice(optionConfig, selectedVariant.attributes, customValues)
    addItem({
      variantId: selectedVariant.id,
      productId: product.id,
      productName,
      categoryId: product.category ?? '',
      attributes: selectedVariant.attributes,
      imageUrl: selectedVariant.cover_image_url ?? selectedVariant.image_url ?? imageUrl ?? null,
      unitPrice: customPrice ?? shopPrice.sale,
      originalPrice: customPrice == null ? shopPrice.original : null,
      discountCaption: customPrice == null ? shopPrice.caption : null,
      quantity: Math.min(quantity, quantityLimit),
      maxQuantity: quantityLimit,
      availability: avail === 'pre_order' ? 'pre_order' : avail === 'custom_order' ? 'custom_order' : 'in_stock',
      preOrderEta: selectedVariant.pre_order_eta,
      selectedOptions: buildSelectedOptionSnapshot(
        optionConfig,
        selectedVariant.attributes,
        cartValues ?? customValues,
        getSkuFields(product.category).map((field) => field.key),
      ),
    })
    setQuantity(1)
  }

  const handleDirectInquiry = () => {
    if (!product || !selectedVariant || !isVariantPurchasable(selectedVariant)) return
    const selectionError = validateCustomSelection(optionConfig, selectedVariant.attributes, customValues)
    const inquiryValues = selectionValuesWithPendingColor(optionConfig, selectedVariant.attributes, customValues)
    if (selectionError && !inquiryValues) {
      alert(selectionError)
      return
    }
    const productName = formatProductTitle(product) || '(Unnamed product)'
    const avail = getVariantAvailability(selectedVariant)
    const shopPrice = promo.resolve(selectedVariant)
    const customPrice = resolveCustomSelectionPrice(optionConfig, selectedVariant.attributes, customValues)
    const payload = buildSingleInquiry({
      productId: product.id,
      productName: productName || '(Unnamed product)',
      categoryId: product.category,
      attributes: selectedVariant.attributes,
      quantity: Math.min(quantity, quantityLimit),
      unitPrice: customPrice ?? shopPrice.sale,
      originalPrice: customPrice == null ? shopPrice.original : null,
      discountCaption: customPrice == null ? shopPrice.caption : null,
      isPreOrder: avail === 'pre_order',
      isCustomOrder: avail === 'custom_order',
      preOrderEta: selectedVariant.pre_order_eta,
      selectedOptions: buildSelectedOptionSnapshot(
        optionConfig,
        selectedVariant.attributes,
        inquiryValues ?? customValues,
        getSkuFields(product.category).map((field) => field.key),
      ),
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
            optionConfig={optionConfig}
            customValues={customValues}
            onCustomValueChange={(key, value) =>
              setCustomValues((current) => {
                if (!selectedVariant) return { ...current, [key]: value }
                return pruneHiddenCustomValues(optionConfig, selectedVariant.attributes, { ...current, [key]: value })
              })
            }
          />
        )}
      </main>

      <ShopFooter />

      <LineInquiryModal message={fallbackMessage} onClose={() => setFallbackMessage(null)} />
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
  optionConfig: ProductOptionConfig | null
  customValues: Record<string, string>
  onCustomValueChange: (key: string, value: string) => void
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
  optionConfig,
  customValues,
  onCustomValueChange,
}: ProductDetailBodyProps) {
  const promo = useShopPromo()
  const [pantoneDialogFieldKey, setPantoneDialogFieldKey] = useState<string | null>(null)
  const [pantoneCode, setPantoneCode] = useState('')
  const categoryName = getCategoryShopName(product.category)
  const variantAvail = selectedVariant ? getVariantAvailability(selectedVariant) : null
  const canPurchase = selectedVariant ? isVariantPurchasable(selectedVariant) : false
  const isPreOrder = variantAvail === 'pre_order'
  const isCustomOrder = variantAvail === 'custom_order'
  const shopPrice = selectedVariant ? promo.resolve(selectedVariant) : null
  const customPrice = selectedVariant
    ? resolveCustomSelectionPrice(optionConfig, selectedVariant.attributes, customValues)
    : null
  const customPriceRange = resolveCustomPriceRange(optionConfig)
  const effectivePrice = customPrice ?? shopPrice?.sale ?? null
  const hasPrice = effectivePrice != null || customPriceRange != null
  const priceText =
    customPrice != null
      ? formatPrice(customPrice)
      : customPriceRange
        ? customPriceRange.min === customPriceRange.max
          ? formatPrice(customPriceRange.min)
          : `${formatPrice(customPriceRange.min)} – ${formatPrice(customPriceRange.max)}`
        : effectivePrice != null
          ? formatPrice(effectivePrice)
          : '價格洽詢'
  const memberPrice = selectedVariant?.member_price != null ? formatPrice(selectedVariant.member_price) : null
  const secondaryLine = formatProductSecondaryLine(product)
  const configured = optionConfig && !isEmptyProductOptionConfig(optionConfig)
  const detailSpecs =
    configured && selectedVariant
      ? optionConfig.variantFields.detail.map((field) => {
            if (field.key === 'max_rider_weight_kg') return null
            const value = selectedVariant.attributes[field.key]
            if (value == null || String(value).trim() === '') return null
            const suffix = field.suffix?.trim()
            const label =
              field.key === 'width'
                ? 'Width'
                : field.key === 'thickness'
                  ? 'Thickness'
                  : field.key === 'volume'
                    ? 'Volume'
                    : field.label
            return {
              key: field.key,
              label,
              value: `${String(value).trim()}${suffix ? ` ${suffix}` : ''}`,
            }
          }).filter((spec): spec is { key: string; label: string; value: string } => spec !== null)
      : []
  const customFields = selectedVariant
    ? visibleCustomFields(optionConfig, selectedVariant.attributes, customValues)
    : []
  const customSelectionError = selectedVariant
    ? validateCustomSelection(optionConfig, selectedVariant.attributes, customValues)
    : null
  const pendingColorValues = selectedVariant
    ? selectionValuesWithPendingColor(optionConfig, selectedVariant.attributes, customValues)
    : null
  const selectedSwatchImage = customFields
    .map((field) => field.swatchImages?.[customValues[field.key] ?? ''])
    .find((image) => Boolean(image?.url))

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
    if (selectedSwatchImage?.url) {
      add(selectedSwatchImage.url, 'Selected color reference')
    }
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
  }, [product, selectedVariant, imageUrl, selectedSwatchImage?.url])

  const priceBlock = (
    <div>
      {hasPrice ? (
        <div>
          <div className="text-2xl sm:text-3xl font-bold text-zinc-900 tabular-nums">{priceText}</div>
          {customPrice == null && shopPrice?.hasDiscount && shopPrice.original != null && (
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-400 line-through tabular-nums">{formatPrice(shopPrice.original)}</span>
              {shopPrice.caption ? (
                <span className={shopDiscountBadgeClass(shopPrice.source) + ' sm:text-xs'}>{shopPrice.caption}</span>
              ) : null}
            </div>
          )}
        </div>
      ) : (
        <span className="inline-block px-2.5 py-1 rounded-md bg-gray-100 text-sm text-gray-600">{priceText}</span>
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
            resetKey={`${product.id}:${selectedVariantId ?? ''}:${selectedSwatchImage?.url ?? ''}`}
          />
        </div>

        {/* 資訊區 */}
        <div className="flex flex-col">
          <Link
            to={product.category ? shopListPath(`cat=${encodeURIComponent(product.category)}`) : shopListPath()}
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
          {secondaryLine ? <div className="mt-1 text-sm sm:text-base text-gray-500">{secondaryLine}</div> : null}

          <div className="mt-3 sm:mt-4">{priceBlock}</div>
          {isPreOrder && (
            <div className="mt-2 text-xs sm:text-sm text-amber-800">
              {formatPreOrderDeadline(selectedVariant?.pre_order_until) ?? SHOP_DETAIL.preOrder}
              {selectedVariant?.pre_order_eta ? (
                <span className="ml-2 font-normal text-gray-500">預計 {selectedVariant.pre_order_eta}</span>
              ) : null}
            </div>
          )}
          {isCustomOrder && (
            <div className="mt-2 inline-flex self-start items-center gap-2 rounded bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-800">
              <span>{SHOP_DETAIL.madeToOrder}</span>
            </div>
          )}

          <div className="mt-4">
            <VariantPicker
              variants={product.variants}
              selectedVariantId={selectedVariantId}
              categoryId={product.category}
              optionConfig={product.option_config}
              onSelect={onSelectVariant}
            />
          </div>

          {detailSpecs.length > 0 ? (
            <section className="mt-4 rounded-lg border border-gray-200 bg-zinc-50 p-3" aria-labelledby="board-specs">
              <h2 id="board-specs" className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-700">
                Board Specs
              </h2>
              <dl className="mt-3 grid grid-cols-3 gap-x-4 gap-y-3">
                {detailSpecs.map((spec) => (
                  <div key={spec.key}>
                    <dt className="text-xs text-gray-500">{spec.label}</dt>
                    <dd className="mt-0.5 font-semibold tabular-nums text-zinc-900">{spec.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {customFields.length > 0 ? (
            <div className="mt-4 space-y-3">
              {customFields.map((field) => (
                <div key={field.key} className="block">
                  <span className="text-sm font-medium text-gray-700">
                    {customFieldShopLabel(field.key, field.label)}
                    {field.required ? ' *' : ''}
                  </span>
                  {field.inputType === 'select' && field.displayStyle === 'price-list' ? (
                    <div
                      className="mt-2 grid gap-2"
                      role="radiogroup"
                      aria-label={customFieldShopLabel(field.key, field.label)}
                    >
                      {(field.values ?? []).map((value) => {
                        const selected = customValues[field.key] === value
                        const price = field.optionPrices?.[value]
                        return (
                          <button
                            key={value}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left ${
                              selected
                                ? 'border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900'
                                : 'border-gray-200 hover:border-gray-400'
                            }`}
                            onClick={() => onCustomValueChange(field.key, value)}
                          >
                            <span
                              className={`mt-1 h-4 w-4 shrink-0 rounded-full border ${
                                selected ? 'border-4 border-zinc-900' : 'border-gray-400'
                              }`}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block font-semibold text-zinc-900">
                                {customOptionShopLabel(field.key, value)}
                              </span>
                              {field.optionNotes?.[value] ? (
                                <span className="mt-0.5 block text-xs text-gray-500">{field.optionNotes[value]}</span>
                              ) : null}
                            </span>
                            <span className="shrink-0 font-semibold tabular-nums text-zinc-900">
                              {Number.isFinite(price) ? formatPrice(price!) : '價格未設定'}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  ) : field.inputType === 'select' && field.displayStyle === 'swatches' ? (
                    <div className="mt-2">
                      <div
                        className="flex flex-nowrap gap-3 overflow-x-auto py-1"
                        role="radiogroup"
                        aria-label={customFieldShopLabel(field.key, field.label)}
                      >
                        {(field.allowCustomValue ? (field.values ?? []).slice(0, 8) : (field.values ?? [])).map(
                          (value) => {
                            const selected = customValues[field.key] === value
                            return (
                              <button
                                key={value}
                                type="button"
                                role="radio"
                                aria-label={value}
                                aria-checked={selected}
                                title={value}
                                className={`aspect-square shrink-0 rounded-full border-2 p-0 transition ${
                                  selected
                                    ? 'border-zinc-900 ring-1 ring-zinc-900 ring-offset-1'
                                    : 'border-gray-200 hover:border-gray-500'
                                }`}
                                style={{
                                  width: 26,
                                  height: 26,
                                  minWidth: 26,
                                  minHeight: 26,
                                  padding: 0,
                                  boxSizing: 'border-box',
                                  backgroundColor: field.swatches?.[value] ?? '#d1d5db',
                                }}
                                onClick={() => onCustomValueChange(field.key, value)}
                              />
                            )
                          },
                        )}
                      </div>
                      {field.allowCustomValue ? (
                        <button
                          type="button"
                          className="mt-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:border-zinc-700"
                          onClick={() => {
                            const current = field.values?.includes(customValues[field.key] ?? '')
                              ? ''
                              : (customValues[field.key] ?? '')
                            const parsed = parsePantoneSelection(current)
                            setPantoneCode(parsed?.code ?? current)
                            setPantoneDialogFieldKey(field.key)
                          }}
                        >
                          其他 Pantone 色號
                        </button>
                      ) : null}
                      {customValues[field.key] ? (
                        <div className="mt-2 flex min-h-5 items-center gap-3 text-sm text-gray-600">
                          <span>
                            已選：
                            {parsePantoneSelection(customValues[field.key] ?? '')?.code ?? customValues[field.key]}
                          </span>
                          <button
                            type="button"
                            className="border-0 bg-transparent p-0 text-xs font-medium text-gray-500 underline underline-offset-2 hover:text-zinc-900"
                            style={{ padding: 0 }}
                            onClick={() => onCustomValueChange(field.key, '')}
                          >
                            清除
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : field.readOnly && (field.key === 'carbon_color' || field.key === 'standard_color') ? (
                    <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                      <span
                        aria-hidden="true"
                        className="block h-[26px] w-[26px] shrink-0 rounded-full border-2 border-zinc-900 ring-1 ring-zinc-900 ring-offset-1"
                        style={{
                          backgroundColor: field.key === 'carbon_color' ? '#000000' : '#FFFFFF',
                        }}
                      />
                      <span>已選：{field.defaultDisplay || (field.key === 'carbon_color' ? 'Black' : 'White')}</span>
                    </div>
                  ) : field.readOnly ? (
                    <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-zinc-800">
                      {field.defaultDisplay || '—'}
                    </div>
                  ) : field.inputType === 'select' ? (
                    <select
                      className="mt-1 block w-full min-h-11 rounded-md border border-gray-300 bg-white px-3 text-base"
                      value={customValues[field.key] ?? (field.readOnly ? (field.defaultDisplay ?? '') : '')}
                      disabled={field.readOnly}
                      onChange={(event) => onCustomValueChange(field.key, event.target.value)}
                    >
                      <option value="">{field.defaultDisplay || '--'}</option>
                      {(field.values ?? []).map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="mt-1 block w-full min-h-11 rounded-md border border-gray-300 bg-white px-3 text-base"
                      value={customValues[field.key] ?? (field.readOnly ? (field.defaultDisplay ?? '') : '')}
                      placeholder={field.placeholder || field.defaultDisplay}
                      disabled={field.readOnly}
                      onChange={(event) => onCustomValueChange(field.key, event.target.value)}
                    />
                  )}
                  {!field.readOnly && field.displayStyle !== 'swatches' && (field.help || field.defaultDisplay) ? (
                    <span className="mt-1 block text-xs text-gray-500">{field.help || field.defaultDisplay}</span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
          {pantoneDialogFieldKey ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
              role="dialog"
              aria-modal="true"
              aria-label="其他 Pantone 色號"
              onClick={() => setPantoneDialogFieldKey(null)}
            >
              <div
                className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
                onClick={(event) => event.stopPropagation()}
              >
                <h2 className="text-lg font-bold text-zinc-900">其他 Pantone 色號</h2>
                <p className="mt-1 text-xs text-gray-500">請輸入製作時使用的 Pantone 色號。</p>
                <label className="mt-4 block text-sm font-medium text-gray-700">
                  Pantone 色號
                  <input
                    className="mt-1 block min-h-11 w-full rounded-md border border-gray-300 px-3 text-base"
                    value={pantoneCode}
                    placeholder="例如 186 C"
                    autoFocus
                    onChange={(event) => setPantoneCode(event.target.value)}
                  />
                </label>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-gray-300 px-4 py-2 text-sm"
                    onClick={() => setPantoneDialogFieldKey(null)}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    disabled={!pantoneCode.trim()}
                    className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-40"
                    onClick={() => {
                      onCustomValueChange(pantoneDialogFieldKey, pantoneCode.trim().toUpperCase())
                      setPantoneDialogFieldKey(null)
                    }}
                  >
                    確認
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          {!pendingColorValues && customSelectionError ? (
            <div className="mt-2 text-xs text-amber-700">{customSelectionError}</div>
          ) : pendingColorValues && customSelectionError ? (
            <div className="mt-2 text-xs text-gray-500">尚未選色時，將由客服後續確認。</div>
          ) : null}

          {product.size_chart ? <ProductSizeChart chart={product.size_chart} /> : null}

          <div className="mt-4 flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">{SHOP_DETAIL.quantity}</span>
            <ShopDetailQuantity value={quantity} max={quantityLimit} onChange={onChangeQuantity} />
            {variantAvail === 'in_stock' && canPurchase && (
              <span className="text-xs text-gray-500">最多 {quantityLimit} 件</span>
            )}
          </div>

          <div className="mt-6 hidden lg:block">
            <DetailPurchaseActions
              layout="stacked"
              canAddToCart={!!selectedVariant && canPurchase && (!customSelectionError || pendingColorValues !== null)}
              canInquire={!!selectedVariant && canPurchase && (!customSelectionError || pendingColorValues !== null)}
              onAddToCart={onAddToCart}
              onDirectInquiry={onDirectInquiry}
            />
          </div>
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
            canAddToCart={!!selectedVariant && canPurchase && (!customSelectionError || pendingColorValues !== null)}
            canInquire={!!selectedVariant && canPurchase && (!customSelectionError || pendingColorValues !== null)}
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
