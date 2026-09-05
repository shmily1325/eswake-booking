/**
 * Design thinking:
 * Current feel: identity is folded on edit; SKU opens on stock, price, then spec.
 * Hierarchy: this SKU first; product identity and extra cover sources stay secondary.
 * Primary task: change stock / price / photo / label and save once.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Badge, useToast } from '../../../components/ui'
import { ConfirmModal } from '../../../components/ui/Modal'
import { NumericTextInput } from '../../../components/ui/numericInputs'
import { designSystem, getButtonStyle, getFontSize, getInputStyle } from '../../../styles/designSystem'
import { useResponsive } from '../../../hooks/useResponsive'
import { CoverImageEditor } from './CoverImageEditor'
import { ImageUploader } from './ImageUploader'
import { SizeChartPicker } from './SizeChartPicker'
import {
  CATEGORY_SCHEMAS,
  formatAttributes,
  formatProductModelLine,
  formatProductTitle,
  getSkuFields,
  getCategory,
  isEsSeriesCategory,
  normalizeGenderValue,
  normalizeVariantAttributes,
  validateAttributes,
  type FieldDef,
} from './schema'
import {
  createProduct,
  createVariant,
  deleteProduct,
  deleteVariant,
  applySizeChartToSameModel,
  fetchProductWithVariants,
  findExistingProductIdentity,
  findLabelCodeConflict,
  generateLabelCode,
  updateProduct,
  updateVariant,
} from './api'
import { fetchDiscountPresets } from './discountApi'
import type { ProductVariantRow, ProductWithVariants } from './types'
import {
  acceptPreOrderFromVariant,
  deriveVariantAvailability,
} from './availabilityHelpers'
import { ShopStatusPill } from './ShopStatusPill'
import { collectZeroStockWarnings } from './productSaveWarnings'
import { normalizePreOrderUntil } from './productBatch'
import {
  activeTagPresets,
  foldLabel,
  resolveShopPrice,
  TAG_ON_PREORDER_HINT,
  type DiscountPreset,
} from '../../shop/lib/shopPricing'
import { isPreOrderOpen } from '../../shop/lib/productAvailability'
import { ProductLabelPreview } from './ProductLabelPreview'
import {
  findDuplicateLabelCodes,
  LABEL_CODE_MAX_LEN,
  normalizeLabelCode,
  sanitizeLabelCodeInput,
  validateLabelCodeFormat,
} from './labelCode'
import { copyProductImage, removeProductImage } from '../../../utils/imageUpload'
import { trackClick } from '../../../utils/trackClick'
import { formatDateTime } from '../../../utils/formatters'
import {
  findExactProductIdentityMatch,
  findProductIdentityCandidates,
  findSameModelCandidates,
  type ProductIdentityCandidate,
} from './productIdentity'
import { ProductBrandSelector } from './ProductBrandSelector'
import {
  coverImagesForDb,
  createCoverImageClientKey,
  draftCoverImagesFromVariant,
  primaryCoverFromGallery,
  type DraftCoverImage,
} from './coverImages'

interface ProductEditViewProps {
  /** 編輯模式：傳入 productId；新增模式：傳 null */
  productId: string | null
  /** 從庫存列表點進來時，自動展開並捲到這個 SKU */
  focusVariantId?: string
  /** 從重複商品提示導入時，載入後直接新增一筆空 SKU */
  addNewVariantOnLoad?: boolean
  /** 預設類別（新增時用，從目前 Tab 帶入） */
  defaultCategory?: string
  /** 已存在的商品（給 autocomplete 與重複建檔檢查用） */
  existingProducts?: readonly ProductIdentityCandidate[]
  /** 新增時發現既有商品，改前往該商品新增 SKU */
  onOpenExistingProduct?: (productId: string) => void
  /** 可選的唯讀呈現（目前商品入口不使用） */
  readOnly?: boolean
  onClose: (changed: boolean) => void
  currentUserEmail?: string | null
}

interface DraftVariant {
  clientKey: string
  /** 已存在於 DB 的 SKU id；新加的尚未儲存則為 null */
  id: string | null
  label_code: string
  /** DB 已儲存的標籤代碼（儲存商品時對齊） */
  savedLabelCode: string
  vendor_code: string
  attributes: Record<string, string>
  price: string
  member_price: string
  stock: string
  /** 已送結帳、待結帳的保留量（唯讀提示用；不可在此頁編輯） */
  reserved_qty: number
  /** 無庫存時是否開放預購（有庫存時忽略，自動為現貨） */
  acceptPreOrder: boolean
  /** 預購截止日 YYYY-MM-DD；未填則一直掛到關掉預購 */
  pre_order_until: string | null
  last_stock_in_at: string | null
  /** 封面 gallery；[0] 為主圖 */
  cover_images: DraftCoverImage[]
  /** 編輯前 DB 的全部封面 path（換圖後清 orphan） */
  originalCoverImagePaths: string[]
  image_url: string | null
  image_path: string | null
  /**
   * 編輯前 DB 的原始 image_path（實品照）。
   * 儲存成功後若跟最新 image_path 不一樣，要把這張原始檔從 storage 刪掉。
   * 取消編輯時，這張原始檔保留（DB 還引用它）。
   */
  originalImagePath: string | null
  /** 已存在但需刪除的 SKU 在儲存時批次處理 */
  pendingDelete?: boolean
  discount_preset_id: string | null
}

type CreateStep = 1 | 2 | 3
type VariantSectionMode = 'all' | 'core' | 'advanced'
let nextDraftClientKey = 0

function createDraftClientKey(prefix: string): string {
  nextDraftClientKey += 1
  return `${prefix}-${nextDraftClientKey}`
}

function variantRowToDraft(v: ProductVariantRow): DraftVariant {
  const attrs: Record<string, string> = {}
  for (const [k, val] of Object.entries(v.attributes ?? {})) {
    if (k === 'gender') {
      const g = normalizeGenderValue(val)
      attrs[k] = g ?? (val == null ? '' : String(val))
    } else {
      attrs[k] = val == null ? '' : String(val)
    }
  }
  const cover_images = draftCoverImagesFromVariant(
    v.cover_images,
    v.cover_image_url,
    v.cover_image_path,
    `variant-${v.id}`,
  )
  return {
    clientKey: `variant-${v.id}`,
    id: v.id,
    label_code: v.label_code ?? '',
    savedLabelCode: v.label_code ?? '',
    vendor_code: v.vendor_code ?? '',
    attributes: attrs,
    // price 為 null 時保留空字串（UI 顯示「待補」），不要強制變成 "0"
    price: v.price == null ? '' : String(v.price),
    member_price: v.member_price == null ? '' : String(v.member_price),
    stock: String(v.stock ?? 0),
    reserved_qty: v.reserved_qty ?? 0,
    acceptPreOrder: acceptPreOrderFromVariant(v),
    pre_order_until: v.pre_order_until?.slice(0, 10) || null,
    last_stock_in_at: v.last_stock_in_at ?? null,
    cover_images,
    originalCoverImagePaths: cover_images.map((img) => img.path).filter(Boolean),
    image_url: v.image_url,
    image_path: v.image_path,
    originalImagePath: v.image_path,
    discount_preset_id: v.discount_preset_id ?? null,
  }
}

function emptyDraft(): DraftVariant {
  return {
    clientKey: createDraftClientKey('new-variant'),
    id: null,
    label_code: '',
    savedLabelCode: '',
    vendor_code: '',
    attributes: {},
    price: '',
    member_price: '',
    stock: '',
    reserved_qty: 0,
    acceptPreOrder: false,
    pre_order_until: null,
    last_stock_in_at: null,
    cover_images: [],
    originalCoverImagePaths: [],
    image_url: null,
    image_path: null,
    originalImagePath: null,
    discount_preset_id: null,
  }
}

export function ProductEditView({
  productId,
  focusVariantId,
  addNewVariantOnLoad = false,
  defaultCategory,
  existingProducts = [],
  onOpenExistingProduct,
  readOnly = false,
  onClose,
  currentUserEmail,
}: ProductEditViewProps) {
  const toast = useToast()
  const { isMobile } = useResponsive()
  const isNew = productId == null

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  /** 正在把某筆 SKU 的封面／實品照套用到其他尺寸時，記住來源 index */
  const [applyingImagesIdx, setApplyingImagesIdx] = useState<number | null>(null)
  const [labelCodeGeneratingIdx, setLabelCodeGeneratingIdx] = useState<number | null>(null)
  const [original, setOriginal] = useState<ProductWithVariants | null>(null)
  const [discountPresets, setDiscountPresets] = useState<DiscountPreset[]>([])

  const [category, setCategory] = useState<string>(defaultCategory ?? Object.keys(CATEGORY_SCHEMAS)[0] ?? 'lifejacket')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [modelYear, setModelYear] = useState('')
  const [color, setColor] = useState('')
  const [description, setDescription] = useState('')
  const [sizeChartId, setSizeChartId] = useState<string | null>(null)
  const [applySizeChartToModel, setApplySizeChartToModel] = useState(true)
  /**
   * 是否上架到商城（/shop 對外可見）。
   * - 新商品預設 true（上架到商城）
   * - 既有商品由 DB 載入
   */
  const [isPublic, setIsPublic] = useState<boolean>(isNew)
  /** 商品卡層封面（一色一卡共用）；多色舊卡可留空改用 SKU 封面 */
  const [productCoverImages, setProductCoverImages] = useState<DraftCoverImage[]>([])
  const [originalProductCoverPaths, setOriginalProductCoverPaths] = useState<string[]>([])
  const [drafts, setDrafts] = useState<DraftVariant[]>(() => (isNew ? [emptyDraft()] : []))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmZeroStock, setConfirmZeroStock] = useState(false)
  const [serverIdentityMatch, setServerIdentityMatch] = useState<ProductIdentityCandidate | null>(null)
  const [confirmedSeparateProduct, setConfirmedSeparateProduct] = useState(false)
  const [createdProductId, setCreatedProductId] = useState<string | null>(null)
  const [createStep, setCreateStep] = useState<CreateStep>(1)
  const [activeSkuIndex, setActiveSkuIndex] = useState<number | null>(0)
  const [identityOpen, setIdentityOpen] = useState(isNew)

  /**
   * 這個編輯 session 內所有「上傳到 storage 的新檔路徑」。
   * 用來在 save / cancel 時判斷哪些是孤兒、要不要刪。
   * - save 成功後：只保留每個 variant 最終的 image_path，其餘的全刪
   * - cancel 時：DB 沒寫入，所有 session uploads 都是孤兒，全刪
   */
  const sessionUploadsRef = useRef<Set<string>>(new Set())
  const mobileScrollRef = useRef<HTMLDivElement>(null)
  const trackUpload = (path: string) => {
    sessionUploadsRef.current.add(path)
  }

  /** 同品牌下已出現過的型號（依目前選擇的 brand 動態提示） */
  const modelSuggestions = useMemo(() => {
    const trimmedBrand = brand.trim().toLowerCase()
    const set = new Set<string>()
    for (const p of existingProducts) {
      if (p.category !== category) continue
      if (trimmedBrand && p.brand.trim().toLowerCase() !== trimmedBrand) continue
      if (p.model.trim()) set.add(p.model.trim())
    }
    return Array.from(set).sort()
  }, [existingProducts, category, brand])

  const identityCandidates = useMemo(
    () => findProductIdentityCandidates(existingProducts, category, brand),
    [existingProducts, category, brand],
  )
  const parsedModelYear = useMemo(() => {
    if (!modelYear.trim()) return null
    const value = Number(modelYear)
    return Number.isInteger(value) ? value : null
  }, [modelYear])
  const normalizedProductColor = useMemo(() => color.trim() || null, [color])
  const sameModelCandidates = useMemo(
    () => findSameModelCandidates(existingProducts, category, brand, model),
    [existingProducts, category, brand, model],
  )
  const localIdentityMatch = useMemo(
    () => findExactProductIdentityMatch(
      existingProducts,
      category,
      brand,
      model,
      parsedModelYear,
      normalizedProductColor,
    ),
    [existingProducts, category, brand, model, parsedModelYear, normalizedProductColor],
  )
  const identityMatch = localIdentityMatch ?? serverIdentityMatch
  const identityNeedsDecision = isNew
    && !confirmedSeparateProduct
    && Boolean(identityMatch || (parsedModelYear == null && sameModelCandidates.length > 0))

  /** 顏色已在商品層；若 SKU 仍殘留 2+ color 才當多色舊卡 */
  const isMultiColorProduct = useMemo(() => {
    if (normalizedProductColor) return false
    const colors = new Set<string>()
    for (const d of drafts) {
      if (d.pendingDelete) continue
      const c = (d.attributes.color ?? '').trim()
      if (c) colors.add(c)
    }
    return colors.size >= 2
  }, [drafts, normalizedProductColor])
  const useProductLevelCovers = !isMultiColorProduct
  const productEntityId = productId ?? createdProductId

  useEffect(() => {
    let cancelled = false
    void fetchDiscountPresets()
      .then((list) => {
        if (!cancelled) setDiscountPresets(list)
      })
      .catch((error) => {
        console.error('[ProductEditView] discount presets', error)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setServerIdentityMatch(null)
    setConfirmedSeparateProduct(false)
  }, [category, brand, model, modelYear, color])

  useEffect(() => {
    if (isNew) return
    let cancelled = false
    setLoading(true)
    fetchProductWithVariants(productId!)
      .then((p) => {
        if (cancelled) return
        if (!p) {
          toast.error('找不到商品')
          onClose(false)
          return
        }
        setOriginal(p)
        setCategory(p.category)
        setBrand(p.brand)
        setModel(p.model)
        setModelYear(p.model_year?.toString() ?? '')
        setColor(p.color ?? '')
        setDescription(p.description ?? '')
        setSizeChartId(p.size_chart_id)
        setIsPublic(p.is_public)
        const loadedProductCovers = draftCoverImagesFromVariant(
          p.cover_images,
          p.cover_image_url,
          p.cover_image_path,
          `product-${p.id}`,
        )
        setProductCoverImages(loadedProductCovers)
        setOriginalProductCoverPaths(
          loadedProductCovers.map((img) => img.path).filter(Boolean),
        )
        const loadedDrafts = p.variants.map(variantRowToDraft)
        const nextDrafts = addNewVariantOnLoad
          ? [...loadedDrafts, emptyDraft()]
          : loadedDrafts.length > 0
            ? loadedDrafts
            : [emptyDraft()]
        setDrafts(nextDrafts)
        if (addNewVariantOnLoad) setActiveSkuIndex(nextDrafts.length - 1)
      })
      .catch((err) => {
        console.error('[ProductEditView] load failed', err)
        toast.error('載入商品失敗')
        onClose(false)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId])

  const updateDraft = (idx: number, patch: Partial<DraftVariant>) => {
    setDrafts((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)))
  }

  const updateDraftAttribute = (idx: number, key: string, value: string) => {
    setDrafts((prev) =>
      prev.map((d, i) => (i === idx ? { ...d, attributes: { ...d.attributes, [key]: value } } : d)),
    )
  }

  const handleAddVariant = () => {
    setActiveSkuIndex(drafts.length)
    setDrafts((prev) => [...prev, emptyDraft()])
  }

  /**
   * 複製最後一筆有效（非 pendingDelete）SKU 當新規格的範本。
   * 封面與實品照會複製成 Storage 新檔，避免多個 variant 共用同一 path。
   */
  const copyDraftImage = async (
    sourcePath: string | null,
    storageFolder: 'variants' | 'covers',
  ): Promise<{ url: string; path: string } | null> => {
    if (!sourcePath) return null
    try {
      const copied = await copyProductImage(sourcePath, { storageFolder })
      trackUpload(copied.path)
      return { url: copied.publicUrl, path: copied.path }
    } catch (e) {
      console.error('[ProductEditView] image copy failed', sourcePath, e)
      return null
    }
  }

  const handleDuplicateLast = async () => {
    const lastActive = [...drafts].reverse().find((d) => !d.pendingDelete)
    if (!lastActive) {
      handleAddVariant()
      return
    }

    setDuplicating(true)
    try {
      const coverCopies = await Promise.all(
        lastActive.cover_images.map((img) => copyDraftImage(img.path || null, 'covers')),
      )
      const photo = await copyDraftImage(lastActive.image_path, 'variants')

      const cover_images: DraftCoverImage[] = []
      let coverFail = false
      for (let i = 0; i < lastActive.cover_images.length; i++) {
        const copied = coverCopies[i]
        if (copied) {
          cover_images.push({
            clientKey: createCoverImageClientKey(),
            url: copied.url,
            path: copied.path,
          })
        } else if (lastActive.cover_images[i]?.path) {
          coverFail = true
        }
      }

      if (coverFail || (lastActive.image_path && !photo)) {
        toast.error('部分圖片複製失敗，其餘欄位已帶入')
      }

      setDrafts((prev) => [
        ...prev,
        {
          clientKey: createDraftClientKey('new-variant'),
          id: null,
          label_code: '',
          savedLabelCode: '',
          vendor_code: lastActive.vendor_code,
          attributes: { ...lastActive.attributes },
          price: lastActive.price,
          member_price: lastActive.member_price,
          stock: '',
          reserved_qty: 0,
          acceptPreOrder: lastActive.acceptPreOrder,
          pre_order_until: lastActive.pre_order_until,
          last_stock_in_at: null,
          cover_images,
          originalCoverImagePaths: [],
          image_url: photo?.url ?? null,
          image_path: photo?.path ?? null,
          originalImagePath: null,
          discount_preset_id: lastActive.discount_preset_id,
        },
      ])
      setActiveSkuIndex(drafts.length)
    } finally {
      setDuplicating(false)
    }
  }

  /**
   * 將指定 SKU 的折扣檔次複製到本商品其他規格。
   */
  const handleApplyDiscountToAllSizes = (sourceIdx: number) => {
    const source = drafts[sourceIdx]
    if (!source || source.pendingDelete) return
    const targetCount = drafts.filter((d, i) => i !== sourceIdx && !d.pendingDelete).length
    if (targetCount === 0) {
      toast.error('沒有其他尺寸可套用')
      return
    }
    setDrafts((prev) =>
      prev.map((d, i) =>
        i === sourceIdx || d.pendingDelete
          ? d
          : { ...d, discount_preset_id: source.discount_preset_id },
      ),
    )
    toast.success(`已套用到其他 ${targetCount} 個尺寸`)
  }

  /**
   * 將指定 SKU 的封面／實品照複製到本商品其他規格（同色不同尺寸共用圖）。
   * 每個目標各存一份 Storage 檔，避免共用 path。
   */
  const handleApplyImagesToAllSizes = async (sourceIdx: number) => {
    const source = drafts[sourceIdx]
    if (!source || source.pendingDelete) return
    if (source.cover_images.length === 0 && !source.image_path) {
      toast.error('此規格還沒有封面或實品照')
      return
    }

    const targetIndexes = drafts
      .map((d, i) => ({ d, i }))
      .filter(({ d, i }) => i !== sourceIdx && !d.pendingDelete)
      .map(({ i }) => i)

    if (targetIndexes.length === 0) {
      toast.error('沒有其他尺寸可套用')
      return
    }

    setApplyingImagesIdx(sourceIdx)
    let failCount = 0
    try {
      const updates = new Map<number, Partial<DraftVariant>>()

      for (const targetIdx of targetIndexes) {
        const coverCopies = await Promise.all(
          source.cover_images.map((img) => copyDraftImage(img.path || null, 'covers')),
        )
        const photo = await copyDraftImage(source.image_path, 'variants')

        let coverFail = false
        const cover_images: DraftCoverImage[] = []
        for (let i = 0; i < source.cover_images.length; i++) {
          const copied = coverCopies[i]
          if (copied) {
            cover_images.push({
              clientKey: createCoverImageClientKey(),
              url: copied.url,
              path: copied.path,
            })
          } else if (source.cover_images[i]?.path || source.cover_images[i]?.url) {
            // path 缺失（僅有 URL）或複製失敗
            coverFail = true
          }
        }

        const photoFail = Boolean(source.image_path && !photo)
        const patch: Partial<DraftVariant> = {}
        // 只有成功複製到至少一張封面時才覆寫，避免複製全失敗把目標清空
        if (cover_images.length > 0) {
          patch.cover_images = cover_images
        }
        if (source.image_path && photo) {
          patch.image_url = photo.url
          patch.image_path = photo.path
        }
        if (coverFail || photoFail || (source.cover_images.length > 0 && cover_images.length === 0)) {
          failCount += 1
        }
        if (Object.keys(patch).length > 0) {
          updates.set(targetIdx, patch)
        }
      }

      if (updates.size > 0) {
        setDrafts((prev) =>
          prev.map((d, i) => {
            const patch = updates.get(i)
            return patch ? { ...d, ...patch } : d
          }),
        )
      }

      if (failCount > 0) {
        toast.error(`已套用 ${updates.size} 筆，其中 ${failCount} 筆部分圖片複製失敗`)
      } else {
        toast.success(`已套用圖片到其他 ${updates.size} 個尺寸（記得按儲存）`)
      }
    } finally {
      setApplyingImagesIdx(null)
    }
  }

  const handleRemoveVariant = (idx: number) => {
    const target = drafts[idx]
    if (!target) return
    if (target.id) {
      // 已存在於 DB 的 SKU：標記 pendingDelete，儲存時刪除
      setDrafts((prev) => prev.map((d, i) => (i === idx ? { ...d, pendingDelete: true } : d)))
    } else {
      // 新增中尚未存檔：直接從 UI 拿掉
      // image_path 若是 session 上傳，會在 save / cancel 時統一清理，這裡不立刻刪
      setDrafts((prev) => prev.filter((_, i) => i !== idx))
      setActiveSkuIndex((current) => {
        if (drafts.length <= 1) return null
        if (current === idx) return Math.max(0, idx - 1)
        if (current != null && current > idx) return current - 1
        return current
      })
    }
  }

  const handleRestoreVariant = (idx: number) => {
    setDrafts((prev) => prev.map((d, i) => (i === idx ? { ...d, pendingDelete: false } : d)))
  }

  const visibleDrafts = drafts // 顯示全部，含 pendingDelete（給 UI 顯示「已標記刪除」狀態）

  const originalVariantsById = useMemo(() => {
    const map = new Map<string, ProductVariantRow>()
    for (const v of original?.variants ?? []) {
      map.set(v.id, v)
    }
    return map
  }, [original])

  const zeroStockWarnings = useMemo(
    () => collectZeroStockWarnings(drafts, originalVariantsById),
    [drafts, originalVariantsById],
  )

  const zeroStockConfirmMessage = useMemo(() => {
    if (zeroStockWarnings.length === 0) return ''
    const lines = zeroStockWarnings.map((d) => {
      const spec = formatAttributes(category, d.attributes)?.trim()
      const label = spec || d.vendor_code?.trim() || '未命名規格'
      return `· ${label}`
    })
    return [
      '以下規格庫存仍是 0，儲存後會變成「已售完」（Shop 不顯示）：',
      '',
      ...lines,
      '',
      '若剛到貨，請先填庫存再儲存。',
    ].join('\n')
  }, [zeroStockWarnings, category])

  const validateProductIdentity = (): string | null => {
    if (!brand.trim()) return '品牌為必填'
    if (!model.trim()) return '型號為必填'
    if (modelYear.trim()) {
      const year = Number(modelYear)
      if (!Number.isInteger(year) || year < 1900 || year > 2100) {
        return '年份請填四位數，例如 2025；無法確認可留空'
      }
    }
    if (identityNeedsDecision) {
      return '請先確認這是既有商品的新 SKU，還是需要獨立顯示的不同商品'
    }
    return null
  }

  const validateSkuCore = (): string | null => {
    const active = drafts.filter((d) => !d.pendingDelete)
    if (active.length === 0) return '至少要有一個規格 (SKU)'
    for (const [i, d] of active.entries()) {
      const errs = validateAttributes(category, d.attributes)
      if (errs.length > 0) return `規格 #${i + 1}：${errs.join('、')}`
      // 售價可留空（= NULL，待補）；有填的話必須是非負整數
      if (d.price.trim() !== '') {
        const priceNum = Number(d.price)
        if (!Number.isFinite(priceNum) || priceNum < 0) return `規格 #${i + 1}：售價需為非負整數，或留空表待補`
      }
      if (d.member_price.trim() !== '') {
        const memberNum = Number(d.member_price)
        if (!Number.isFinite(memberNum) || memberNum < 0) {
          return `規格 #${i + 1}：會員價需為非負整數，或留空`
        }
      }
      if (d.stock.trim() === '') return `規格 #${i + 1}：庫存為必填`
      const stockNum = Number(d.stock)
      if (!Number.isFinite(stockNum) || stockNum < 0) return `規格 #${i + 1}：庫存需為非負整數`
      if (d.reserved_qty > 0 && stockNum < d.reserved_qty) {
        return `規格 #${i + 1}：庫存不可少於已送結帳保留量（保留 ${d.reserved_qty} 件），請先撤回送結帳或作廢訂單`
      }
    }
    return null
  }

  const validate = (): string | null => {
    const identityError = validateProductIdentity()
    if (identityError) return identityError
    const coreError = validateSkuCore()
    if (coreError) return coreError
    const active = drafts.filter((d) => !d.pendingDelete)
    for (const [i, d] of active.entries()) {
      const labelErr = validateLabelCodeFormat(d.label_code)
      if (labelErr) return `規格 #${i + 1}：${labelErr}`
    }
    const dup = findDuplicateLabelCodes(active)
    if (dup) return `標籤代碼「${dup}」在此商品內重複，請改成唯一代碼`
    return null
  }

  const handleGenerateLabelCode = async (idx: number) => {
    if (!brand.trim()) {
      toast.error('請先填品牌，才能自動產生標籤代碼')
      return
    }
    if (!category) {
      toast.error('請先選類別，才能自動產生標籤代碼')
      return
    }
    setLabelCodeGeneratingIdx(idx)
    try {
      const extraCodes = drafts
        .filter((row, i) => i !== idx && !row.pendingDelete)
        .map((row) => normalizeLabelCode(row.label_code))
      const code = await generateLabelCode(brand, category, extraCodes)
      updateDraft(idx, { label_code: code })
      toast.success('已產生標籤代碼')
    } catch (e) {
      console.error('[ProductEditView] generate label_code failed', e)
      toast.error(e instanceof Error ? e.message : '自動產生失敗')
    } finally {
      setLabelCodeGeneratingIdx(null)
    }
  }

  const performSave = async () => {
    setSaving(true)
    try {
      let pid = productId ?? createdProductId
      if (isNew) {
        if (!pid) {
          if (!confirmedSeparateProduct) {
            const duplicate = await findExistingProductIdentity(
              category,
              brand,
              model,
              parsedModelYear,
              normalizedProductColor,
            )
            if (duplicate) {
              setServerIdentityMatch(duplicate)
              throw new Error('找到相同型號、年份與顏色的商品，請先確認要加入既有商品或另建商品')
            }
          }
          const productCovers = coverImagesForDb(productCoverImages)
          const productPrimary = primaryCoverFromGallery(productCovers)
          const created = await createProduct({
            category,
            brand,
            model,
            model_year: parsedModelYear,
            color: normalizedProductColor,
            description: description.trim() || null,
            size_chart_id: sizeChartId,
            cover_images: productCovers,
            cover_image_url: productPrimary.url,
            cover_image_path: productPrimary.path,
            is_public: isPublic,
            created_by: currentUserEmail ?? null,
          })
          pid = created.id
          setCreatedProductId(created.id)
          setOriginalProductCoverPaths(productCovers.map((img) => img.path).filter(Boolean))
        } else {
          const productCovers = coverImagesForDb(productCoverImages)
          const productPrimary = primaryCoverFromGallery(productCovers)
          await updateProduct(pid, {
            category,
            brand,
            model,
            model_year: parsedModelYear,
            color: normalizedProductColor,
            description: description.trim() || null,
            size_chart_id: sizeChartId,
            cover_images: productCovers,
            cover_image_url: productPrimary.url,
            cover_image_path: productPrimary.path,
            is_public: isPublic,
            updated_by: currentUserEmail ?? null,
          })
          setOriginalProductCoverPaths(productCovers.map((img) => img.path).filter(Boolean))
        }
      } else {
        const productCovers = coverImagesForDb(productCoverImages)
        const productPrimary = primaryCoverFromGallery(productCovers)
        await updateProduct(productId!, {
          category,
          brand,
          model,
          model_year: parsedModelYear,
          color: normalizedProductColor,
          description: description.trim() || null,
          size_chart_id: sizeChartId,
          cover_images: productCovers,
          cover_image_url: productPrimary.url,
          cover_image_path: productPrimary.path,
          is_public: isPublic,
          updated_by: currentUserEmail ?? null,
        })
        setOriginalProductCoverPaths(productCovers.map((img) => img.path).filter(Boolean))
      }

      if (applySizeChartToModel) {
        await applySizeChartToSameModel({
          category,
          brand,
          model,
          model_year: parsedModelYear,
          size_chart_id: sizeChartId,
          updated_by: currentUserEmail ?? null,
        })
      }

      // 標籤代碼：跨商品唯一（DB index + 存檔前查詢）
      for (const d of drafts) {
        if (d.pendingDelete) continue
        const normalized = normalizeLabelCode(d.label_code)
        if (!normalized) continue
        const conflict = await findLabelCodeConflict(normalized, d.id)
        if (conflict) {
          const who = [conflict.brand, conflict.model].filter(Boolean).join(' ')
          throw new Error(
            who
              ? `標籤代碼「${normalized}」已被「${who}」使用`
              : `標籤代碼「${normalized}」已被其他商品使用`,
          )
        }
      }

      // SKU：依狀態 dispatch
      for (const [draftIndex, d] of drafts.entries()) {
        if (d.pendingDelete) {
          if (d.id) {
            await deleteVariant(d.id)
            // 軟刪不清圖（保留以防誤刪復原），如要清圖：if (d.image_path) await removeProductImage(d.image_path)
          }
          continue
        }
        const stockNum = Number(d.stock)
        const availability = deriveVariantAvailability(stockNum, d.acceptPreOrder)
        // 一色一卡：封面只掛商品層，SKU 封面刻意清空，避免再複製出重複 storage 檔
        const cover_images = useProductLevelCovers
          ? []
          : coverImagesForDb(d.cover_images)
        const primary = primaryCoverFromGallery(cover_images)
        const payload = {
          label_code: normalizeLabelCode(d.label_code),
          vendor_code: d.vendor_code,
          attributes: normalizeVariantAttributes(d.attributes),
          price: d.price.trim() === '' ? null : Number(d.price),
          member_price: d.member_price.trim() === '' ? null : Number(d.member_price),
          stock: stockNum,
          availability,
          pre_order_eta: null,
          pre_order_until:
            availability === 'pre_order'
              ? normalizePreOrderUntil(d.pre_order_until)
              : null,
          cover_image_url: primary.url,
          cover_image_path: primary.path,
          cover_images,
          image_url: d.image_url,
          image_path: d.image_path,
          discount_preset_id: d.discount_preset_id,
        }
        if (d.id) {
          await updateVariant(d.id, payload)
        } else {
          const createdVariant = await createVariant({ product_id: pid!, ...payload })
          setDrafts(prev => prev.map((row, index) => index === draftIndex
            ? {
                ...row,
                id: createdVariant.id,
                savedLabelCode: createdVariant.label_code ?? '',
                originalCoverImagePaths: cover_images.map((img) => img.path).filter(Boolean),
                originalImagePath: createdVariant.image_path,
              }
            : row))
        }
      }

      // ===== Storage 清理：刪掉這個 session 內不再被引用的舊圖 =====
      // 1) 收集所有「最終會被 DB 引用」的 path
      const finalPaths = new Set<string>()
      for (const img of productCoverImages) {
        if (img.path) finalPaths.add(img.path)
      }
      for (const d of drafts) {
        if (d.pendingDelete) {
          // 軟刪不清圖：原始 path 保留，以防誤刪復原
          for (const p of d.originalCoverImagePaths) finalPaths.add(p)
          if (d.originalImagePath) finalPaths.add(d.originalImagePath)
        } else {
          if (!useProductLevelCovers) {
            for (const img of d.cover_images) {
              if (img.path) finalPaths.add(img.path)
            }
          }
          if (d.image_path) finalPaths.add(d.image_path)
        }
      }
      // 2) 蒐集「應該被刪掉」的 path：
      //    - 每個 variant 的 originalImagePath（若跟新 image_path 不同且不再被引用）
      //    - 這個 session 上傳但最終沒被任何 variant 採用的（中途又換掉的中間檔）
      const toRemove = new Set<string>()
      for (const originalPath of originalProductCoverPaths) {
        if (!finalPaths.has(originalPath)) toRemove.add(originalPath)
      }
      for (const d of drafts) {
        if (d.pendingDelete) continue
        for (const originalPath of d.originalCoverImagePaths) {
          if (!finalPaths.has(originalPath)) toRemove.add(originalPath)
        }
        if (d.originalImagePath && d.originalImagePath !== d.image_path) {
          if (!finalPaths.has(d.originalImagePath)) toRemove.add(d.originalImagePath)
        }
      }
      for (const p of sessionUploadsRef.current) {
        if (!finalPaths.has(p)) toRemove.add(p)
      }
      await Promise.all(Array.from(toRemove).map((p) => removeProductImage(p)))
      // 清掉 session 紀錄，避免後續若重新儲存又被算進 toRemove
      sessionUploadsRef.current.clear()

      toast.success(isNew ? '商品已新增' : '已儲存變更')
      onClose(true)
    } catch (e) {
      console.error('[ProductEditView] save failed', e)
      toast.error(e instanceof Error ? e.message : '儲存失敗')
      // 寫 DB 過程中失敗，可能已有部分 SKU 已寫入新 image_path。
      // 為了避免後續取消時誤刪已被 DB 引用的圖（造成 broken reference），
      // 直接清掉 session 追蹤；殘留的孤兒檔由清理腳本處理即可（孤兒可接受、破洞不可）。
      sessionUploadsRef.current.clear()
    } finally {
      setSaving(false)
    }
  }

  const handleSave = () => {
    const err = validate()
    if (err) {
      toast.error(err)
      return
    }
    if (zeroStockWarnings.length > 0) {
      setConfirmZeroStock(true)
      return
    }
    void performSave()
  }

  const goToCreateStep = (step: CreateStep) => {
    setCreateStep(step)
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }

  const handleCreateNext = () => {
    const error = createStep === 1 ? validateProductIdentity() : validateSkuCore()
    if (error) {
      toast.error(error)
      return
    }
    goToCreateStep((createStep + 1) as CreateStep)
  }

  const handleConfirmZeroStockSave = () => {
    setConfirmZeroStock(false)
    void performSave()
  }

  /** 取消編輯：把這個 session 上傳但沒寫入 DB 的圖全清掉，避免孤兒檔 */
  const handleCancel = () => {
    if (sessionUploadsRef.current.size > 0) {
      const paths = Array.from(sessionUploadsRef.current)
      sessionUploadsRef.current.clear()
      void Promise.all(paths.map((p) => removeProductImage(p)))
    }
    onClose(false)
  }

  const handleOpenExistingProduct = (productIdToOpen: string) => {
    const hasDraftWork = drafts.some(d =>
      d.stock.trim() !== '' ||
      d.price.trim() !== '' ||
      d.member_price.trim() !== '' ||
      d.vendor_code.trim() !== '' ||
      d.label_code.trim() !== '' ||
      Object.values(d.attributes).some(value => value.trim() !== '') ||
      Boolean(d.image_path || d.cover_images.length > 0),
    ) || productCoverImages.length > 0
    if (hasDraftWork && !window.confirm('前往既有商品後，目前尚未儲存的 SKU 草稿不會自動合併。確定繼續？')) {
      return
    }
    if (sessionUploadsRef.current.size > 0) {
      const paths = Array.from(sessionUploadsRef.current)
      sessionUploadsRef.current.clear()
      void Promise.all(paths.map(path => removeProductImage(path)))
    }
    onOpenExistingProduct?.(productIdToOpen)
  }

  const handleDeleteProduct = async () => {
    if (!productId) return
    trackClick('product_edit_delete_confirm', currentUserEmail ?? undefined)
    setSaving(true)
    try {
      await deleteProduct(productId)
      // 刪商品時也順手清掉這個 session 上傳但還沒被 DB 引用的孤兒
      if (sessionUploadsRef.current.size > 0) {
        const paths = Array.from(sessionUploadsRef.current)
        sessionUploadsRef.current.clear()
        void Promise.all(paths.map((p) => removeProductImage(p)))
      }
      toast.success('商品已刪除')
      onClose(true)
    } catch (e) {
      console.error('[ProductEditView] delete failed', e)
      toast.error('刪除失敗')
    } finally {
      setSaving(false)
      setConfirmDelete(false)
    }
  }

  if (loading) {
    return (
      <div
        style={{
          padding: 40,
          textAlign: 'center',
          color: designSystem.colors.text.secondary,
          fontSize: getFontSize('body', isMobile),
        }}
      >
        載入中…
      </div>
    )
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: getFontSize('bodySmall', isMobile),
    fontWeight: 600,
    color: designSystem.colors.text.secondary,
    marginBottom: 6,
  }
  const inputStyle: React.CSSProperties = {
    ...getInputStyle(isMobile),
    width: '100%',
    boxSizing: 'border-box',
    background: designSystem.colors.background.card,
  }
  const mobileCreateWizard = isNew && isMobile && !readOnly
  const sectionStyle: React.CSSProperties = {
    background: 'transparent',
    padding: 0,
    marginBottom: isMobile ? 28 : 32,
    border: 'none',
  }
  const showIdentitySection = !mobileCreateWizard || createStep === 1
  const showSkuCoreSection = !mobileCreateWizard || createStep === 2
  const showAdvancedSection = !mobileCreateWizard || createStep === 3

  /** 手機：取消／儲存固定貼在螢幕底，避開 Home 條 */
  const mobileFooterBar =
    isMobile && !readOnly ? (
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 40,
          display: 'flex',
          gap: 10,
          padding: '12px 16px max(12px, env(safe-area-inset-bottom))',
          borderTop: `1px solid ${designSystem.colors.border.light}`,
          background: designSystem.colors.background.card,
          boxShadow: '0 -8px 24px rgba(15, 23, 42, 0.08)',
        }}
      >
        <button
          type="button"
          data-track={mobileCreateWizard && createStep > 1 ? 'product_create_previous' : 'product_edit_cancel'}
          onClick={mobileCreateWizard && createStep > 1
            ? () => goToCreateStep((createStep - 1) as CreateStep)
            : handleCancel}
          disabled={saving}
          style={{
            ...getButtonStyle('outline', 'large', isMobile),
            flex: 1,
            opacity: saving ? 0.5 : 1,
            cursor: saving ? 'not-allowed' : 'pointer',
            touchAction: 'manipulation',
            minHeight: 48,
          }}
        >
          {mobileCreateWizard && createStep > 1 ? '上一步' : '取消'}
        </button>
        <button
          type="button"
          data-track={mobileCreateWizard && createStep < 3 ? 'product_create_next' : 'product_edit_save'}
          onClick={mobileCreateWizard && createStep < 3 ? handleCreateNext : () => void handleSave()}
          disabled={saving || (mobileCreateWizard && createStep === 1 && identityNeedsDecision)}
          style={{
            ...getButtonStyle('primary', 'large', isMobile),
            flex: 1,
            opacity: saving || (mobileCreateWizard && createStep === 1 && identityNeedsDecision) ? 0.55 : 1,
            cursor: saving || (mobileCreateWizard && createStep === 1 && identityNeedsDecision) ? 'not-allowed' : 'pointer',
            touchAction: 'manipulation',
            minHeight: 48,
            background: saving
              ? designSystem.colors.secondary[300]
              : designSystem.colors.primary[500],
          }}
        >
          {saving
            ? '儲存中…'
            : mobileCreateWizard && createStep < 3
              ? '下一步'
              : '儲存'}
        </button>
      </div>
    ) : null

  const mainContent = (
    <>
      {/* 標題列 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        <Button
          variant="outline"
          size={isMobile ? 'large' : 'small'}
          data-track="product_edit_back"
          onClick={handleCancel}
          disabled={saving}
        >
          ← 返回
        </Button>
        <h2
          style={{
            margin: 0,
            fontSize: getFontSize('h2', isMobile),
            flex: 1,
            color: designSystem.colors.text.primary,
          }}
        >
          {readOnly ? '查看商品' : isNew ? '新增商品' : '編輯商品'}
          {original && (
            <span
              style={{
                fontSize: getFontSize('bodySmall', isMobile),
                color: designSystem.colors.text.secondary,
                marginLeft: 8,
                fontWeight: 400,
              }}
            >
              {original.brand} {original.model}
            </span>
          )}
        </h2>
        {!isMobile && !readOnly && (
          <Button
            variant="primary"
            data-track="product_edit_save"
            onClick={handleSave}
            disabled={saving || identityNeedsDecision}
          >
            {saving ? '儲存中…' : '儲存'}
          </Button>
        )}
      </div>

      {mobileCreateWizard && (
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 6,
            }}
          >
            {([1, 2, 3] as CreateStep[]).map(step => (
              <div
                key={step}
                style={{
                  height: 4,
                  borderRadius: designSystem.borderRadius.full,
                  background: step <= createStep
                    ? designSystem.colors.primary[500]
                    : designSystem.colors.secondary[200],
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* 商品基本資訊：編輯時預設收合，新增維持全開 */}
      {showIdentitySection && <section style={sectionStyle}>
        <div
          role={!isNew ? 'button' : undefined}
          tabIndex={!isNew ? 0 : undefined}
          onClick={!isNew ? () => setIdentityOpen((open) => !open) : undefined}
          onKeyDown={!isNew ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setIdentityOpen((open) => !open)
            }
          } : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: isNew || identityOpen ? 16 : 0,
            cursor: !isNew ? 'pointer' : 'default',
            userSelect: 'none',
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: getFontSize('h3', isMobile),
              fontWeight: 700,
              color: designSystem.colors.text.primary,
              flexShrink: 0,
            }}
          >
            商品資訊
          </h3>
          {!isNew && (
            <>
              {!identityOpen && (
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: getFontSize('bodySmall', isMobile),
                    color: designSystem.colors.text.secondary,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {formatProductTitle({
                    brand,
                    model,
                    color,
                    model_year: modelYear ? Number(modelYear) : null,
                  }) || getCategory(category)?.name || '（未命名）'}
                </span>
              )}
              {identityOpen && <span style={{ flex: 1 }} />}
              <span
                aria-hidden
                style={{
                  fontSize: getFontSize('caption', isMobile),
                  color: designSystem.colors.text.disabled,
                  transform: identityOpen ? 'rotate(180deg)' : 'none',
                }}
              >
                ▾
              </span>
            </>
          )}
        </div>
        {(isNew || identityOpen) && (
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr' }}>
          <div>
            <label style={labelStyle}>類別 *</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={inputStyle}
              disabled={saving || readOnly}
            >
              {Object.values(CATEGORY_SCHEMAS).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>品牌 *</label>
            <ProductBrandSelector
              value={brand}
              onChange={setBrand}
              currentUserEmail={currentUserEmail}
              disabled={saving || readOnly}
              isMobile={isMobile}
            />
          </div>
          <div>
            <label style={labelStyle}>型號 *</label>
            <input
              style={inputStyle}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="例如：Signal Ladies"
              disabled={saving || readOnly}
              list="product-model-suggestions"
              autoComplete="off"
            />
            <datalist id="product-model-suggestions">
              {modelSuggestions.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            {isNew && sameModelCandidates.length > 0 && (
              <div
                role="alert"
                style={{
                  marginTop: 10,
                  padding: 12,
                  borderRadius: designSystem.borderRadius.md,
                  border: `1px solid ${designSystem.colors.border.main}`,
                  background: designSystem.colors.background.card,
                  color: designSystem.colors.text.primary,
                }}
              >
                <div style={{ fontSize: getFontSize('bodySmall', isMobile), lineHeight: 1.5 }}>
                  <strong>已有同型號商品</strong>
                </div>
                <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                  {sameModelCandidates.slice(0, 4).map((candidate) => (
                    <div
                      key={candidate.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        padding: 8,
                        borderRadius: designSystem.borderRadius.sm,
                        background: designSystem.colors.background.card,
                      }}
                    >
                      <span style={{ fontSize: getFontSize('bodySmall', isMobile) }}>
                        {candidate.brand} {formatProductModelLine({
                          model: candidate.model,
                          color: candidate.color,
                          model_year: candidate.modelYear,
                        })}
                        {candidate.variantCount != null ? ` · ${candidate.variantCount} 個 SKU` : ''}
                      </span>
                      {onOpenExistingProduct && (
                        <Button
                          variant="warning"
                          size="small"
                          data-track="product_create_open_existing"
                          onClick={() => handleOpenExistingProduct(candidate.id)}
                        >
                          加入 SKU
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                {identityNeedsDecision && (
                  <Button
                    variant="secondary"
                    size="small"
                    data-track="product_create_confirm_separate"
                    onClick={() => setConfirmedSeparateProduct(true)}
                    style={{ marginTop: 10 }}
                  >
                    確認是新商品
                  </Button>
                )}
                {confirmedSeparateProduct && (
                  <div style={{ marginTop: 8, fontSize: getFontSize('caption', isMobile) }}>
                    將建立新商品
                  </div>
                )}
              </div>
            )}
            {isNew && sameModelCandidates.length === 0 && brand.trim() && identityCandidates.length > 0 && (
              <div
                style={{
                  marginTop: 8,
                  fontSize: getFontSize('caption', isMobile),
                  color: designSystem.colors.text.secondary,
                  lineHeight: 1.5,
                }}
              >
                此品牌已有：{' '}
                {identityCandidates.slice(0, 5).map((candidate, index) => (
                  <span key={candidate.id}>
                    {index > 0 ? '、' : ''}
                    <button
                      type="button"
                      onClick={() => setModel(candidate.model)}
                      style={{
                        padding: 0,
                        border: 'none',
                        background: 'transparent',
                        color: designSystem.colors.info[700],
                        font: 'inherit',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                      }}
                    >
                      {candidate.model}
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div>
            <label style={labelStyle}>顏色（選填）</label>
            <input
              style={inputStyle}
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="黑"
              disabled={saving || readOnly}
              autoComplete="off"
            />
          </div>
          <div>
            <label style={labelStyle}>年份（選填）</label>
            <NumericTextInput
              style={inputStyle}
              value={modelYear}
              onChange={(value) => setModelYear(value)}
              placeholder="2025"
              disabled={saving || readOnly}
            />
          </div>
          {!mobileCreateWizard && <div style={{ gridColumn: isMobile ? 'auto' : '1 / -1' }}>
            <label style={labelStyle}>內部備註</label>
            <input
              style={inputStyle}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="備註"
              disabled={saving || readOnly}
            />
          </div>}
        </div>
        )}
      </section>}

      {/* SKU 列表 */}
      {(showSkuCoreSection || showAdvancedSection) && <section style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <h3
            style={{
              margin: 0,
              fontSize: getFontSize('h3', isMobile),
              fontWeight: 700,
              flex: 1,
              color: designSystem.colors.text.primary,
            }}
          >
            規格與庫存
          </h3>
          <Badge variant="info" size="small">
            {drafts.filter((d) => !d.pendingDelete).length}
          </Badge>
        </div>

        {mobileCreateWizard && createStep === 3 && (
          <div style={{ marginBottom: designSystem.spacing.lg }}>
            <label style={labelStyle}>內部備註</label>
            <input
              style={inputStyle}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="備註"
              disabled={saving}
            />
          </div>
        )}

        {(!mobileCreateWizard || createStep === 3) && useProductLevelCovers && (
          <div
            style={{
              marginBottom: designSystem.spacing.lg,
              paddingBottom: designSystem.spacing.lg,
              borderBottom: `1px solid ${designSystem.colors.border.light}`,
            }}
          >
            <h3
              style={{
                margin: `0 0 ${designSystem.spacing.sm} 0`,
                fontSize: getFontSize('h3', isMobile),
                fontWeight: 700,
                color: designSystem.colors.text.primary,
              }}
            >
              商品封面
            </h3>
            <CoverImageEditor
              images={productCoverImages}
              entityId={productEntityId}
              storageFolder="covers"
              brand={brand}
              model={model}
              disabled={saving || readOnly}
              onChange={setProductCoverImages}
              onUpload={trackUpload}
            />
          </div>
        )}

        {(!mobileCreateWizard || createStep === 3) && isMultiColorProduct && (
          <p
            style={{
              margin: `0 0 ${designSystem.spacing.md} 0`,
              fontSize: getFontSize('caption', isMobile),
              color: designSystem.colors.text.secondary,
              lineHeight: 1.4,
            }}
          >
            多色舊卡：封面在各規格
          </p>
        )}

        {(!mobileCreateWizard || createStep === 3) && (
          <div
            style={{
              marginBottom: designSystem.spacing.lg,
              paddingBottom: designSystem.spacing.lg,
              borderBottom: `1px solid ${designSystem.colors.border.light}`,
            }}
          >
            <h3
              style={{
                margin: `0 0 ${designSystem.spacing.sm} 0`,
                fontSize: getFontSize('h3', isMobile),
                fontWeight: 700,
                color: designSystem.colors.text.primary,
              }}
            >
              尺寸表
            </h3>
            <SizeChartPicker
              value={sizeChartId}
              brand={brand}
              currentUserEmail={currentUserEmail}
              disabled={saving || readOnly}
              onChange={setSizeChartId}
            />
            {!readOnly && (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: designSystem.spacing.sm,
                  fontSize: getFontSize('bodySmall', isMobile),
                  color: designSystem.colors.text.secondary,
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={applySizeChartToModel}
                  onChange={(event) => setApplySizeChartToModel(event.target.checked)}
                  disabled={saving}
                />
                同步套用到同年份、同型號的所有顏色
              </label>
            )}
          </div>
        )}

        {(!mobileCreateWizard || createStep === 3) && (
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: designSystem.spacing.lg,
              padding: isMobile ? '12px 0' : '4px 0',
              cursor: readOnly || saving ? 'not-allowed' : 'pointer',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              disabled={saving || readOnly}
              style={{
                width: 18,
                height: 18,
                cursor: 'inherit',
                accentColor: designSystem.colors.primary[500],
              }}
            />
            <span
              style={{
                fontSize: getFontSize('body', isMobile),
                fontWeight: 600,
                color: isPublic
                  ? designSystem.colors.text.primary
                  : designSystem.colors.text.disabled,
              }}
            >
              {isPublic ? '上架' : '未上架'}
            </span>
          </label>
        )}

        {visibleDrafts.map((d, idx) => (
          <VariantBlock
            key={d.clientKey}
            index={idx}
            draft={d}
            brand={brand}
            model={model}
            categoryId={category}
            schemaFields={getSkuFields(category)}
            isMobile={isMobile}
            focused={focusVariantId != null && d.id === focusVariantId}
            disabled={saving || readOnly}
            readOnly={readOnly}
            onChange={(patch) => updateDraft(idx, patch)}
            onAttributeChange={(key, val) => updateDraftAttribute(idx, key, val)}
            onRemove={() => handleRemoveVariant(idx)}
            onRestore={() => handleRestoreVariant(idx)}
            onImageUpload={trackUpload}
            showSkuCovers={isMultiColorProduct}
            otherSkuCount={drafts.filter((x, i) => i !== idx && !x.pendingDelete).length}
            applyingImages={applyingImagesIdx === idx}
            imagesBusy={applyingImagesIdx != null || duplicating}
            onApplyImagesToAllSizes={
              isMultiColorProduct ? () => void handleApplyImagesToAllSizes(idx) : undefined
            }
            discountPresets={discountPresets}
            onApplyDiscountToAllSizes={() => handleApplyDiscountToAllSizes(idx)}
            labelCodeGenerating={labelCodeGeneratingIdx === idx}
            onGenerateLabelCode={() => void handleGenerateLabelCode(idx)}
            sectionMode={mobileCreateWizard
              ? createStep === 2
                ? 'core'
                : 'advanced'
              : 'all'}
            expanded={mobileCreateWizard ? activeSkuIndex === idx : undefined}
            onToggleExpanded={mobileCreateWizard
              ? () => setActiveSkuIndex(current => current === idx ? null : idx)
              : undefined}
          />
        ))}

        {!readOnly && (!mobileCreateWizard || createStep === 2) && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="outline" size="small" data-track="product_sku_add" onClick={handleAddVariant} disabled={saving}>
              + 新增規格
            </Button>
            {drafts.some((d) => !d.pendingDelete) && (
              <span title="以最後一筆有效規格為範本（含封面與實品照，庫存歸 0）">
                <Button
                  variant="outline"
                  size="small"
                  data-track="product_sku_duplicate"
                  onClick={() => void handleDuplicateLast()}
                  disabled={saving || duplicating || applyingImagesIdx != null}
                >
                  {duplicating ? '複製中…' : '⎘ 複製上一筆'}
                </Button>
              </span>
            )}
          </div>
        )}
      </section>}

      {/* 危險區（編輯模式才有；唯讀模式隱藏） */}
      {!isNew && !readOnly && (
        <section
          style={{
            ...sectionStyle,
            marginTop: 8,
            marginBottom: 0,
          }}
        >
          <h3
            style={{
              margin: '0 0 12px 0',
              fontSize: getFontSize('h3', isMobile),
              fontWeight: 600,
              color: designSystem.colors.text.primary,
            }}
          >
            刪除
          </h3>
          <Button variant="danger" size="small" data-track="product_edit_delete_open" onClick={() => setConfirmDelete(true)} disabled={saving}>
            刪除整個商品
          </Button>
        </section>
      )}

      {confirmDelete && (
        <ConfirmModal
          isOpen={confirmDelete}
          title="刪除商品"
          message={`確定要刪除「${original?.brand ?? ''} ${original?.model ?? ''}」？\n\n會同時隱藏它的所有規格 (SKU)。`}
          confirmText="刪除"
          cancelText="取消"
          variant="danger"
          onConfirm={handleDeleteProduct}
          onClose={() => setConfirmDelete(false)}
          isLoading={saving}
        />
      )}

      {confirmZeroStock && (
        <ConfirmModal
          isOpen={confirmZeroStock}
          title="庫存仍是 0"
          message={zeroStockConfirmMessage}
          confirmText="仍要儲存"
          cancelText="回去填庫存"
          variant="warning"
          onConfirm={handleConfirmZeroStockSave}
          onClose={() => setConfirmZeroStock(false)}
          isLoading={saving}
        />
      )}
    </>
  )

  if (isMobile) {
    return (
      <div
        ref={mobileScrollRef}
        style={{
          paddingBottom: readOnly
            ? 24
            : 'calc(88px + env(safe-area-inset-bottom))',
        }}
      >
        {mainContent}
        {mobileFooterBar}
      </div>
    )
  }

  return <div style={{ paddingBottom: 40 }}>{mainContent}</div>
}

interface VariantBlockProps {
  index: number
  draft: DraftVariant
  brand: string
  model: string
  categoryId: string
  schemaFields: FieldDef[]
  isMobile: boolean
  /** 從列表點進來的目標 SKU：展開、封面可編、捲動對準 */
  focused?: boolean
  disabled: boolean
  /** 唯讀模式：隱藏「🗑 移除」「復原」按鈕，inputs 仍透過 disabled prop 鎖住 */
  readOnly?: boolean
  onChange: (patch: Partial<DraftVariant>) => void
  onAttributeChange: (key: string, value: string) => void
  onRemove: () => void
  onRestore: () => void
  onImageUpload: (path: string) => void
  /** false = 封面改在商品卡；SKU 只留實品照 */
  showSkuCovers?: boolean
  /** 本商品其他可套用的規格數（不含自己、不含待刪） */
  otherSkuCount?: number
  applyingImages?: boolean
  /** 任一 SKU 正在套用／複製圖片時，鎖住按鈕 */
  imagesBusy?: boolean
  onApplyImagesToAllSizes?: () => void
  discountPresets: DiscountPreset[]
  onApplyDiscountToAllSizes?: () => void
  labelCodeGenerating?: boolean
  onGenerateLabelCode?: () => void
  sectionMode?: VariantSectionMode
  expanded?: boolean
  onToggleExpanded?: () => void
}

function SectionLabel({
  children,
  isMobile,
  flush,
}: {
  children: React.ReactNode
  isMobile: boolean
  flush?: boolean
}) {
  return (
    <div
      style={{
        margin: flush ? '0 0 8px' : '14px 0 8px',
        paddingTop: flush ? 0 : 12,
        borderTop: flush ? 'none' : `1px solid ${designSystem.colors.border.light}`,
        fontSize: getFontSize('bodySmall', isMobile),
        fontWeight: 700,
        color: designSystem.colors.text.secondary,
      }}
    >
      {children}
    </div>
  )
}

function VariantBlock({
  index,
  draft,
  brand,
  model,
  categoryId,
  schemaFields,
  isMobile,
  focused = false,
  disabled,
  readOnly = false,
  onChange,
  onAttributeChange,
  onRemove,
  onRestore,
  onImageUpload,
  showSkuCovers = true,
  otherSkuCount = 0,
  applyingImages = false,
  imagesBusy = false,
  onApplyImagesToAllSizes,
  discountPresets,
  onApplyDiscountToAllSizes,
  labelCodeGenerating = false,
  onGenerateLabelCode,
  sectionMode = 'all',
  expanded,
  onToggleExpanded,
}: VariantBlockProps) {
  const blockRef = useRef<HTMLDivElement>(null)
  /** 手機編輯：常改欄位直接露出，不整塊收合 SKU */
  const dailyFirst = isMobile && sectionMode === 'all'
  // 折疊：手機上已有 SKU 預設收合；從列表點進來的目標 SKU 強制展開
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (focused) return false
    if (isMobile && sectionMode === 'all') return false
    return isMobile && draft.id != null && !draft.pendingDelete
  })
  const [specsOpen, setSpecsOpen] = useState(false)
  // 桌機強制展開（避免從手機切到桌機時內容被卡住看不到；桌機本來也沒折疊互動）
  const effectiveCollapsed = !dailyFirst && isMobile && (expanded !== undefined ? !expanded : collapsed)

  /** 規格摘要（給折疊狀態下的 header 顯示） */
  const summary = schemaFields
    .map((f) => {
      const v = draft.attributes[f.key]
      if (v == null || String(v).trim() === '') return null
      return f.displaySuffix ? `${v}${f.displaySuffix}` : String(v)
    })
    .filter((x): x is string => x !== null)
    .join(' / ')

  const blockStyle: React.CSSProperties = {
    border: focused ? `1px solid ${designSystem.colors.primary[500]}` : 'none',
    borderRadius: designSystem.borderRadius.md,
    padding: focused ? (isMobile ? 12 : 16) : isMobile ? '4px 0 16px' : '4px 0 20px',
    marginBottom: 8,
    background: 'transparent',
    opacity: draft.pendingDelete ? 0.55 : 1,
    position: 'relative',
    scrollMarginTop: isMobile ? 12 : 24,
  }
  const inputStyle: React.CSSProperties = {
    ...getInputStyle(isMobile),
    width: '100%',
    boxSizing: 'border-box',
    background: designSystem.colors.background.card,
  }
  const labelStyle: React.CSSProperties = {
    fontSize: getFontSize('caption', isMobile),
    color: designSystem.colors.text.secondary,
    marginBottom: 4,
    display: 'block',
  }

  /** 手機才允許 collapse；點 header 切換（編輯頁常改欄位已露出，不整塊收合） */
  const headerClickable = isMobile && !draft.pendingDelete && !dailyFirst
  const onHeaderClick = () => {
    if (!headerClickable) return
    if (onToggleExpanded) onToggleExpanded()
    else setCollapsed((c) => !c)
  }
  const stop = (e: React.MouseEvent) => e.stopPropagation()
  /** 封面：列表點進來或手機編輯（多色）直接展開 */
  const [coverExpanded, setCoverExpanded] = useState(focused || dailyFirst)

  useEffect(() => {
    if (!focused) return
    const timer = window.setTimeout(() => {
      blockRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 150)
    return () => window.clearTimeout(timer)
  }, [focused])

  const stockField = (
    <div style={isMobile ? { gridColumn: '1 / -1' } : undefined}>
      <label style={labelStyle}>現有庫存 *</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
        <NumericTextInput
          variant="course"
          value={draft.stock}
          disabled={disabled || draft.pendingDelete}
          placeholder="請輸入"
          isMobile={isMobile}
          onChange={(digits) =>
            onChange({
              stock: digits,
              acceptPreOrder:
                digits !== '' && Number(digits) > 0 ? false : draft.acceptPreOrder,
              pre_order_until:
                digits !== '' && Number(digits) > 0 ? null : draft.pre_order_until,
            })
          }
        />
        <span style={{ fontSize: getFontSize('body', isMobile), color: designSystem.colors.text.secondary, flexShrink: 0 }}>
          件
        </span>
      </div>
      {draft.reserved_qty > 0 && (
        <p style={{ fontSize: getFontSize('caption', isMobile), color: designSystem.colors.secondary[700], margin: '4px 0 0' }}>
          待結帳保留 {draft.reserved_qty} 件 · 可售現貨{' '}
          {Math.max(0, (Number(draft.stock) || 0) - draft.reserved_qty)} 件
        </p>
      )}
      {draft.last_stock_in_at && (
        <p
          style={{
            fontSize: getFontSize('caption', isMobile),
            color: designSystem.colors.text.secondary,
            margin: '4px 0 0',
          }}
        >
          最近入庫：{formatDateTime(draft.last_stock_in_at)}
        </p>
      )}
    </div>
  )

  const stockNum = Number(draft.stock) || 0
  const shopStatus = deriveVariantAvailability(stockNum, draft.acceptPreOrder)

  const preOrderField =
    stockNum > 0 ? (
      <div style={isMobile ? { gridColumn: '1 / -1' } : undefined}>
        <ShopStatusPill status={shopStatus} isMobile={isMobile} />
      </div>
    ) : (
      <div style={isMobile ? { gridColumn: '1 / -1' } : undefined}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            fontSize: getFontSize('body', isMobile),
            cursor: disabled || draft.pendingDelete ? 'default' : 'pointer',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <input
              type="checkbox"
              checked={draft.acceptPreOrder}
              onChange={(e) =>
                onChange({
                  acceptPreOrder: e.target.checked,
                  pre_order_until: e.target.checked ? draft.pre_order_until : null,
                })
              }
              disabled={disabled || draft.pendingDelete}
              style={{ width: 16, height: 16, flexShrink: 0 }}
            />
            <span style={{ fontWeight: 600 }}>開放預購</span>
          </span>
          <ShopStatusPill status={shopStatus} isMobile={isMobile} />
        </label>
        {draft.acceptPreOrder && (
          <label
            style={{
              display: 'block',
              marginTop: 8,
              fontSize: getFontSize('caption', isMobile),
              color: designSystem.colors.text.secondary,
            }}
          >
            到期日
            <input
              type="date"
              value={draft.pre_order_until ?? ''}
              disabled={disabled || draft.pendingDelete}
              onChange={(e) =>
                onChange({ pre_order_until: e.target.value.trim() || null })
              }
              style={{
                ...inputStyle,
                marginTop: 4,
                minHeight: 44,
                fontSize: 16,
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
          </label>
        )}
      </div>
    )

  const specFieldsGrid = (
    <div
      style={{
        display: 'grid',
        gap: 8,
        gridTemplateColumns: isMobile
          ? sectionMode === 'core'
            ? '1fr'
            : '1fr 1fr'
          : 'repeat(3, 1fr)',
      }}
    >
      <div style={{ gridColumn: isMobile && sectionMode !== 'core' ? '1 / -1' : 'auto' }}>
        <label style={labelStyle}>貨號</label>
        <input
          style={inputStyle}
          value={draft.vendor_code}
          onChange={(e) => onChange({ vendor_code: e.target.value })}
          placeholder="例如：F12303-CE"
          disabled={disabled || draft.pendingDelete}
        />
      </div>
      {schemaFields.map((f) => (
        <div key={f.key}>
          <label style={labelStyle}>
            {f.label}
            {f.required && <span style={{ color: designSystem.colors.danger[700] }}> *</span>}
          </label>
          {f.type === 'select' ? (
            <select
              style={inputStyle}
              value={
                f.key === 'gender'
                  ? (normalizeGenderValue(draft.attributes[f.key]) ??
                    draft.attributes[f.key] ??
                    '')
                  : (draft.attributes[f.key] ?? '')
              }
              onChange={(e) => onAttributeChange(f.key, e.target.value)}
              disabled={disabled || draft.pendingDelete}
            >
              <option value="">--</option>
              {(f.options ?? []).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : (
            <input
              style={inputStyle}
              value={draft.attributes[f.key] ?? ''}
              onChange={(e) => onAttributeChange(f.key, e.target.value)}
              placeholder={f.placeholder}
              disabled={disabled || draft.pendingDelete}
            />
          )}
        </div>
      ))}
    </div>
  )

  const discountPreview = resolveShopPrice(
    {
      price: draft.price.trim() === '' ? null : Number(draft.price),
      discount_preset_id: draft.discount_preset_id,
      stock: Number(draft.stock) || 0,
      availability: deriveVariantAvailability(Number(draft.stock) || 0, draft.acceptPreOrder),
      pre_order_until: draft.pre_order_until,
    },
    discountPresets,
  )
  const discountField = (
    <div style={{ marginTop: 8 }}>
      <label style={labelStyle}>檔期</label>
      <select
        style={inputStyle}
        value={draft.discount_preset_id ?? ''}
        disabled={disabled || draft.pendingDelete}
        onChange={(e) => onChange({ discount_preset_id: e.target.value.trim() || null })}
      >
        <option value="">無（原價／預購全館）</option>
        {activeTagPresets(discountPresets).map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} {foldLabel(p.percent)}
          </option>
        ))}
      </select>
      {isPreOrderOpen({
        stock: Number(draft.stock) || 0,
        availability: deriveVariantAvailability(Number(draft.stock) || 0, draft.acceptPreOrder),
        pre_order_until: draft.pre_order_until,
      }) ? (
        <div
          style={{
            marginTop: 4,
            fontSize: getFontSize('caption', isMobile),
            color: designSystem.colors.text.secondary,
            lineHeight: 1.4,
          }}
        >
          {TAG_ON_PREORDER_HINT}
        </div>
      ) : null}
      {discountPreview.hasDiscount && discountPreview.sale != null && (
        <div
          style={{
            marginTop: 4,
            fontSize: getFontSize('caption', isMobile),
            color: designSystem.colors.text.secondary,
          }}
        >
          店售 ${discountPreview.sale.toLocaleString()}
          {discountPreview.caption ? ` · ${discountPreview.caption}` : ''}
        </div>
      )}
      {!readOnly && otherSkuCount > 0 && onApplyDiscountToAllSizes && (
        <button
          type="button"
          disabled={disabled || draft.pendingDelete}
          onClick={onApplyDiscountToAllSizes}
          style={{
            marginTop: 6,
            border: 'none',
            background: 'none',
            padding: 0,
            minHeight: 44,
            color: designSystem.colors.text.primary,
            fontSize: getFontSize('caption', isMobile),
            fontWeight: 600,
            cursor: disabled ? 'default' : 'pointer',
          }}
        >
          套用到其他 {otherSkuCount} 個尺寸
        </button>
      )}
    </div>
  )

  const inventoryFieldsGrid = (
    <>
    <div
      style={{
        display: 'grid',
        gap: 8,
        gridTemplateColumns: isMobile
          ? sectionMode === 'core'
            ? '1fr'
            : '1fr 1fr'
          : 'repeat(3, 1fr)',
      }}
    >
      {isMobile ? (
        <>
          {preOrderField}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>售價</label>
            <NumericTextInput
              variant="course"
              value={draft.price}
              onChange={(price) => onChange({ price })}
              placeholder="待補"
              disabled={disabled || draft.pendingDelete}
            />
          </div>
          {isEsSeriesCategory(categoryId) && (
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>會員價</label>
              <NumericTextInput
                variant="course"
                value={draft.member_price}
                onChange={(member_price) => onChange({ member_price })}
                placeholder="選填"
                disabled={disabled || draft.pendingDelete}
              />
            </div>
          )}
          {stockField}
        </>
      ) : (
        <>
          {stockField}
          {preOrderField}
          <div>
            <label style={labelStyle}>售價</label>
            <NumericTextInput
              variant="course"
              value={draft.price}
              onChange={(price) => onChange({ price })}
              placeholder="待補"
              disabled={disabled || draft.pendingDelete}
            />
          </div>
          {isEsSeriesCategory(categoryId) && (
            <div>
              <label style={labelStyle}>會員價</label>
              <NumericTextInput
                variant="course"
                value={draft.member_price}
                onChange={(member_price) => onChange({ member_price })}
                placeholder="選填"
                disabled={disabled || draft.pendingDelete}
              />
            </div>
          )}
        </>
      )}
    </div>
    {discountField}
    </>
  )

  const productPhotoSection = (
    <div style={{ marginTop: 12 }}>
      <label style={{ ...labelStyle, marginBottom: 6 }}>實品照</label>
      <ImageUploader
        value={draft.image_url}
        path={draft.image_path}
        entityId={draft.id}
        storageFolder="variants"
        disabled={disabled || draft.pendingDelete}
        onChange={(next) => onChange({ image_url: next.url, image_path: next.path })}
        onUpload={onImageUpload}
        size={isMobile ? 80 : 96}
        emptyLabel="相簿／拍照"
      />
    </div>
  )

  const hasAnyImage = Boolean(draft.cover_images.length > 0 || draft.image_path)
  const applyImagesSection =
    !readOnly && onApplyImagesToAllSizes ? (
      <div style={{ marginTop: 10 }}>
        <span
          title={
            !hasAnyImage
              ? '請先上傳此規格的封面或實品照'
              : otherSkuCount === 0
                ? '沒有其他尺寸可套用'
                : '將此規格的封面與實品照複製到本商品其他尺寸'
          }
        >
          <Button
            variant="outline"
            size="small"
            data-track="product_sku_apply_images_all_sizes"
            disabled={disabled || draft.pendingDelete || imagesBusy || !hasAnyImage || otherSkuCount === 0}
            onClick={onApplyImagesToAllSizes}
          >
            {applyingImages
              ? '套用中…'
              : otherSkuCount > 0
                ? `套用圖片到其他 ${otherSkuCount} 個尺寸`
                : '套用圖片到其他尺寸'}
          </Button>
        </span>
      </div>
    ) : null

  // 標籤上的尺寸（含 schema 設定的單位後綴，如 cm/mm）
  const labelSizeField = schemaFields.find((f) => f.key === 'size')
  const labelSizeRaw = (draft.attributes.size ?? '').trim()
  const labelSizeDisplay = labelSizeRaw
    ? labelSizeField?.displaySuffix
      ? `${labelSizeRaw}${labelSizeField.displaySuffix}`
      : labelSizeRaw
    : ''

  const labelCodeSection = (
    <div
      style={{
        marginTop: 16,
        paddingTop: 16,
        borderTop: `1px solid ${designSystem.colors.border.light}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 4,
        }}
      >
        <div
          style={{
            fontSize: getFontSize('bodySmall', isMobile),
            fontWeight: 600,
            color: designSystem.colors.text.primary,
          }}
        >
          標籤代碼
        </div>
        <div
          style={{
            fontSize: getFontSize('caption', isMobile),
            color:
              draft.label_code.length >= LABEL_CODE_MAX_LEN
                ? designSystem.colors.danger[700]
                : designSystem.colors.text.disabled,
            flexShrink: 0,
          }}
        >
          {draft.label_code.length}/{LABEL_CODE_MAX_LEN}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        <input
          style={{ ...inputStyle, flex: 1 }}
          value={draft.label_code}
          onChange={(e) => onChange({ label_code: sanitizeLabelCodeInput(e.target.value) })}
          placeholder="ESFOLLOWVEST001"
          disabled={disabled || draft.pendingDelete}
          spellCheck={false}
          autoCapitalize="characters"
          autoCorrect="off"
          enterKeyHint="done"
          maxLength={LABEL_CODE_MAX_LEN}
        />
        {!readOnly && (
          <button
            type="button"
            data-track="product_label_code_generate"
            onClick={() => onGenerateLabelCode?.()}
            disabled={
              disabled ||
              draft.pendingDelete ||
              labelCodeGenerating ||
              !categoryId
            }
            title="依 ES + 品牌 + 類別 自動產生流水號代碼"
            style={{
              flexShrink: 0,
              padding: '0 14px',
              borderRadius: 8,
              border: `1px solid ${designSystem.colors.primary[500]}`,
              background: designSystem.colors.background.card,
              color: designSystem.colors.primary[500],
              fontSize: getFontSize('button', isMobile),
              fontWeight: 600,
              whiteSpace: 'nowrap',
              cursor:
                disabled || draft.pendingDelete || labelCodeGenerating || !categoryId
                  ? 'not-allowed'
                  : 'pointer',
              opacity:
                disabled || draft.pendingDelete || labelCodeGenerating || !categoryId
                  ? 0.5
                  : 1,
            }}
          >
            {labelCodeGenerating ? '產生中…' : '自動產生'}
          </button>
        )}
      </div>
      <div style={{ marginTop: 10 }}>
        <ProductLabelPreview
          labelCode={draft.label_code}
          productName={[brand, model].map((s) => s.trim()).filter(Boolean).join(' ')}
          price={draft.price}
          size={labelSizeDisplay}
          isMobile={isMobile}
        />
      </div>
    </div>
  )

  const primaryCoverUrl = draft.cover_images[0]?.url ?? null

  const coverEditor = (
    <CoverImageEditor
      compact
      images={draft.cover_images}
      entityId={draft.id}
      storageFolder="covers"
      brand={brand}
      model={model}
      vendorCode={draft.vendor_code}
      disabled={disabled || draft.pendingDelete}
      onChange={(cover_images) => onChange({ cover_images })}
      onUpload={onImageUpload}
    />
  )

  const collapsibleCoverSection = coverExpanded ? (
    <div style={{ marginTop: 12 }}>
      <button
        type="button"
        onClick={() => setCoverExpanded(false)}
        disabled={disabled || draft.pendingDelete}
        style={{
          marginBottom: 8,
          padding: '4px 0',
          border: 'none',
          background: 'transparent',
          color: designSystem.colors.info[700],
          fontSize: getFontSize('caption', isMobile),
          cursor: disabled || draft.pendingDelete ? 'not-allowed' : 'pointer',
        }}
      >
        收合封面 ▴
      </button>
      {coverEditor}
    </div>
  ) : (
    <button
      type="button"
      onClick={() => setCoverExpanded(true)}
      disabled={disabled || draft.pendingDelete}
      style={{
        marginTop: 12,
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        border: `1px solid ${designSystem.colors.border.light}`,
        borderRadius: designSystem.borderRadius.sm,
        background: designSystem.colors.secondary[50],
        cursor: disabled || draft.pendingDelete ? 'not-allowed' : 'pointer',
        textAlign: 'left',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          flexShrink: 0,
          borderRadius: 8,
          overflow: 'hidden',
          background: designSystem.colors.secondary[100],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: getFontSize('caption', isMobile),
          color: designSystem.colors.text.disabled,
        }}
      >
        {primaryCoverUrl ? (
          <img
            src={primaryCoverUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          '無'
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: getFontSize('bodySmall', isMobile),
            fontWeight: 600,
            color: designSystem.colors.text.primary,
          }}
        >
          {primaryCoverUrl
            ? draft.cover_images.length > 1
              ? `封面 ✓（${draft.cover_images.length} 張）`
              : '封面 ✓'
            : '封面 未設'}
        </div>
        {!isMobile && (
          <div
            style={{
              fontSize: getFontSize('caption', isMobile),
              color: designSystem.colors.text.secondary,
              marginTop: 2,
            }}
          >
            相簿／URL
          </div>
        )}
      </div>
      <span style={{ fontSize: getFontSize('bodySmall', isMobile), color: designSystem.colors.info[700], flexShrink: 0 }}>
        展開 ▾
      </span>
    </button>
  )

  return (
    <div ref={blockRef} style={blockStyle}>
      <div
        onClick={onHeaderClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: effectiveCollapsed ? 0 : 10,
          cursor: headerClickable ? 'pointer' : 'default',
          userSelect: 'none',
        }}
      >
        <span
          style={{
            fontWeight: 600,
            fontSize: getFontSize('bodySmall', isMobile),
            color: designSystem.colors.text.secondary,
            whiteSpace: 'nowrap',
          }}
        >
          SKU #{index + 1}
        </span>
        {/* 折疊／手機編輯：header 顯示規格摘要 */}
        {(effectiveCollapsed || dailyFirst) && (
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: getFontSize('bodySmall', isMobile),
              color: designSystem.colors.text.secondary,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {summary || draft.vendor_code || '（空白）'}
            {effectiveCollapsed && (
              <span style={{ marginLeft: 8, color: designSystem.colors.text.disabled }}>
                ·庫存 {draft.stock.trim() !== '' ? draft.stock : '未填'}
              </span>
            )}
          </span>
        )}
        {!effectiveCollapsed && !dailyFirst && <span style={{ flex: 1 }} />}
        {draft.pendingDelete ? (
          <span style={{ color: designSystem.colors.danger[700], fontSize: getFontSize('bodySmall', isMobile) }}>
            （將刪除）
          </span>
        ) : null}
        {headerClickable && (
          <span
            aria-hidden
            style={{
              fontSize: getFontSize('caption', isMobile),
              color: designSystem.colors.text.disabled,
              transition: 'transform 0.15s',
              transform: effectiveCollapsed ? 'rotate(0deg)' : 'rotate(180deg)',
            }}
          >
            ▾
          </span>
        )}
        {readOnly ? null : draft.pendingDelete ? (
          <span onClick={stop}>
            <Button variant="outline" size="small" data-track="product_sku_restore" onClick={onRestore} disabled={disabled}>
              復原
            </Button>
          </span>
        ) : (
          <button
            type="button"
            data-track="product_sku_remove"
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            disabled={disabled}
            aria-label="移除此規格"
            title="移除此規格"
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: 18,
              color: designSystem.colors.danger[700],
              cursor: disabled ? 'not-allowed' : 'pointer',
              padding: '4px 8px',
              opacity: disabled ? 0.4 : 1,
            }}
          >
            🗑
          </button>
        )}
      </div>

      {effectiveCollapsed ? null : dailyFirst ? (
        <>
          {showSkuCovers && (
            <>
              <SectionLabel isMobile={isMobile} flush>
                封面
              </SectionLabel>
              {coverEditor}
              {applyImagesSection}
            </>
          )}
          <SectionLabel isMobile={isMobile} flush={!showSkuCovers}>
            庫存與售價
          </SectionLabel>
          {inventoryFieldsGrid}
          <button
            type="button"
            onClick={() => setSpecsOpen((open) => !open)}
            style={{
              marginTop: 14,
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              padding: '12px 0 0',
              border: 'none',
              borderTop: `1px solid ${designSystem.colors.border.light}`,
              background: 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span
              style={{
                fontSize: getFontSize('bodySmall', isMobile),
                fontWeight: 700,
                color: designSystem.colors.text.secondary,
              }}
            >
              規格資料
            </span>
            <span
              style={{
                fontSize: getFontSize('caption', isMobile),
                color: designSystem.colors.info[700],
                flexShrink: 0,
              }}
            >
              {specsOpen ? '收合 ▴' : '展開 ▾'}
            </span>
          </button>
          {specsOpen && (
            <>
              <div style={{ marginTop: 8 }}>{specFieldsGrid}</div>
              {productPhotoSection}
              {labelCodeSection}
            </>
          )}
        </>
      ) : (
        <>
          {(sectionMode === 'all' || sectionMode === 'core') && (
            <>
              <SectionLabel isMobile={isMobile} flush>
                庫存與售價
              </SectionLabel>
              {inventoryFieldsGrid}
              <SectionLabel isMobile={isMobile}>規格資料</SectionLabel>
              {specFieldsGrid}
            </>
          )}
          {(sectionMode === 'all' || sectionMode === 'advanced') && (
            <>
              <SectionLabel isMobile={isMobile} flush={sectionMode === 'advanced'}>
                圖片與標籤
              </SectionLabel>
              {productPhotoSection}
              {labelCodeSection}
              {showSkuCovers && collapsibleCoverSection}
              {showSkuCovers && applyImagesSection}
            </>
          )}
        </>
      )}
    </div>
  )
}
