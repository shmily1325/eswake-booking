/**
 * Design thinking:
 * Current feel: gradient save CTA and tight bordered section cards feel like Material form chrome.
 * Hierarchy: product fields → SKU list → save; section frames stay quiet hairlines.
 * Primary task: edit product / SKU and save without loud decorative CTAs.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Badge, useToast } from '../../../components/ui'
import { ConfirmModal } from '../../../components/ui/Modal'
import { NumericTextInput } from '../../../components/ui/numericInputs'
import { designSystem, getButtonStyle, getFontSize, getInputStyle } from '../../../styles/designSystem'
import { useResponsive } from '../../../hooks/useResponsive'
import { CoverImageEditor } from './CoverImageEditor'
import { ImageUploader } from './ImageUploader'
import {
  CATEGORY_SCHEMAS,
  formatAttributes,
  getSkuFields,
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
  fetchProductWithVariants,
  findLabelCodeConflict,
  generateLabelCode,
  updateProduct,
  updateVariant,
} from './api'
import type { ProductVariantRow, ProductWithVariants } from './types'
import {
  acceptPreOrderFromVariant,
  deriveVariantAvailability,
} from './availabilityHelpers'
import { ShopStatusPill, ShopVisibilityPill } from './ShopStatusPill'
import { collectZeroStockWarnings } from './productSaveWarnings'
import { ProductLabelPreview } from './ProductLabelPreview'
import {
  findDuplicateLabelCodes,
  isLabelCodeDirty,
  LABEL_CODE_MAX_LEN,
  LABEL_CODE_RULE_HINT,
  normalizeLabelCode,
  sanitizeLabelCodeInput,
  validateLabelCodeFormat,
} from './labelCode'
import { copyProductImage, removeProductImage } from '../../../utils/imageUpload'
import { trackClick } from '../../../utils/trackClick'
import { formatDateTime } from '../../../utils/formatters'

interface ProductEditViewProps {
  /** 編輯模式：傳入 productId；新增模式：傳 null */
  productId: string | null
  /** 從庫存列表點進來時，自動展開並捲到這個 SKU */
  focusVariantId?: string
  /** 預設類別（新增時用，從目前 Tab 帶入） */
  defaultCategory?: string
  /** 已存在的商品（給品牌 / 型號 autocomplete 用） */
  existingProducts?: ReadonlyArray<{ category: string; brand: string; model: string }>
  /** 可選的唯讀呈現（目前商品入口不使用） */
  readOnly?: boolean
  onClose: (changed: boolean) => void
  currentUserEmail?: string | null
}

interface DraftVariant {
  /** 已存在於 DB 的 SKU id；新加的尚未儲存則為 null */
  id: string | null
  label_code: string
  /** DB 已儲存的標籤代碼（「儲存標籤」dirty 判斷用） */
  savedLabelCode: string
  vendor_code: string
  attributes: Record<string, string>
  price: string
  stock: string
  /** 已送結帳、待結帳的保留量（唯讀提示用；不可在此頁編輯） */
  reserved_qty: number
  /** 無庫存時是否開放預購（有庫存時忽略，自動為現貨） */
  acceptPreOrder: boolean
  last_stock_in_at: string | null
  cover_image_url: string | null
  cover_image_path: string | null
  originalCoverImagePath: string | null
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
  return {
    id: v.id,
    label_code: v.label_code ?? '',
    savedLabelCode: v.label_code ?? '',
    vendor_code: v.vendor_code ?? '',
    attributes: attrs,
    // price 為 null 時保留空字串（UI 顯示「待補」），不要強制變成 "0"
    price: v.price == null ? '' : String(v.price),
    stock: String(v.stock ?? 0),
    reserved_qty: v.reserved_qty ?? 0,
    acceptPreOrder: acceptPreOrderFromVariant(v),
    last_stock_in_at: v.last_stock_in_at ?? null,
    cover_image_url: v.cover_image_url ?? null,
    cover_image_path: v.cover_image_path ?? null,
    originalCoverImagePath: v.cover_image_path ?? null,
    image_url: v.image_url,
    image_path: v.image_path,
    originalImagePath: v.image_path,
  }
}

function emptyDraft(): DraftVariant {
  return {
    id: null,
    label_code: '',
    savedLabelCode: '',
    vendor_code: '',
    attributes: {},
    price: '',
    stock: '',
    reserved_qty: 0,
    acceptPreOrder: false,
    last_stock_in_at: null,
    cover_image_url: null,
    cover_image_path: null,
    originalCoverImagePath: null,
    image_url: null,
    image_path: null,
    originalImagePath: null,
  }
}

export function ProductEditView({
  productId,
  focusVariantId,
  defaultCategory,
  existingProducts = [],
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
  const [labelCodeSavingId, setLabelCodeSavingId] = useState<string | null>(null)
  const [labelCodeGeneratingIdx, setLabelCodeGeneratingIdx] = useState<number | null>(null)
  const [original, setOriginal] = useState<ProductWithVariants | null>(null)

  const [category, setCategory] = useState<string>(defaultCategory ?? Object.keys(CATEGORY_SCHEMAS)[0] ?? 'lifejacket')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [description, setDescription] = useState('')
  /**
   * 是否上架到商城（/shop 對外可見）。
   * - 新商品預設 true（上架到商城）
   * - 既有商品由 DB 載入
   */
  const [isPublic, setIsPublic] = useState<boolean>(isNew)
  const [drafts, setDrafts] = useState<DraftVariant[]>(() => (isNew ? [emptyDraft()] : []))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmZeroStock, setConfirmZeroStock] = useState(false)

  /**
   * 這個編輯 session 內所有「上傳到 storage 的新檔路徑」。
   * 用來在 save / cancel 時判斷哪些是孤兒、要不要刪。
   * - save 成功後：只保留每個 variant 最終的 image_path，其餘的全刪
   * - cancel 時：DB 沒寫入，所有 session uploads 都是孤兒，全刪
   */
  const sessionUploadsRef = useRef<Set<string>>(new Set())
  const trackUpload = (path: string) => {
    sessionUploadsRef.current.add(path)
  }

  /** 同類別下已出現過的品牌（autocomplete 用） */
  const brandSuggestions = useMemo(() => {
    const set = new Set<string>()
    for (const p of existingProducts) {
      if (p.category === category && p.brand.trim()) set.add(p.brand.trim())
    }
    return Array.from(set).sort()
  }, [existingProducts, category])

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
        setDescription(p.description ?? '')
        setIsPublic(p.is_public)
        setDrafts(p.variants.length > 0 ? p.variants.map(variantRowToDraft) : [emptyDraft()])
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
    setDrafts((prev) => [...prev, emptyDraft()])
  }

  /**
   * 複製最後一筆有效（非 pendingDelete）SKU 當新規格的範本。
   * 封面與實品照會複製成 Storage 新檔，避免多個 variant 共用同一 path。
   */
  const handleDuplicateLast = async () => {
    const lastActive = [...drafts].reverse().find((d) => !d.pendingDelete)
    if (!lastActive) {
      handleAddVariant()
      return
    }

    const copyOne = async (
      sourcePath: string | null,
      storageFolder: 'variants' | 'covers',
    ): Promise<{ url: string; path: string } | null> => {
      if (!sourcePath) return null
      try {
        const copied = await copyProductImage(sourcePath, { storageFolder })
        trackUpload(copied.path)
        return { url: copied.publicUrl, path: copied.path }
      } catch (e) {
        console.error('[ProductEditView] duplicate image copy failed', sourcePath, e)
        return null
      }
    }

    setDuplicating(true)
    try {
      const [cover, photo] = await Promise.all([
        copyOne(lastActive.cover_image_path, 'covers'),
        copyOne(lastActive.image_path, 'variants'),
      ])

      if (
        (lastActive.cover_image_path && !cover) ||
        (lastActive.image_path && !photo)
      ) {
        toast.error('部分圖片複製失敗，其餘欄位已帶入')
      }

      setDrafts((prev) => [
        ...prev,
        {
          id: null,
          label_code: '',
          savedLabelCode: '',
          vendor_code: lastActive.vendor_code,
          attributes: { ...lastActive.attributes },
          price: lastActive.price,
          stock: '',
          reserved_qty: 0,
          acceptPreOrder: lastActive.acceptPreOrder,
          last_stock_in_at: null,
          cover_image_url: cover?.url ?? null,
          cover_image_path: cover?.path ?? null,
          originalCoverImagePath: null,
          image_url: photo?.url ?? null,
          image_path: photo?.path ?? null,
          originalImagePath: null,
        },
      ])
    } finally {
      setDuplicating(false)
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
      '以下規格庫存仍是 0，儲存後會變成「已售完」（商城不顯示）：',
      '',
      ...lines,
      '',
      '若剛到貨，請先填庫存再儲存。',
    ].join('\n')
  }, [zeroStockWarnings, category])

  const validate = (): string | null => {
    if (!brand.trim()) return '品牌為必填'
    if (!model.trim()) return '型號為必填'
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
      if (d.stock.trim() === '') return `規格 #${i + 1}：庫存為必填`
      const stockNum = Number(d.stock)
      if (!Number.isFinite(stockNum) || stockNum < 0) return `規格 #${i + 1}：庫存需為非負整數`
      if (d.reserved_qty > 0 && stockNum < d.reserved_qty) {
        return `規格 #${i + 1}：庫存不可少於已送結帳保留量（保留 ${d.reserved_qty} 件），請先撤回送結帳或作廢訂單`
      }
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
      toast.success('已產生標籤代碼，可直接修改後再儲存')
    } catch (e) {
      console.error('[ProductEditView] generate label_code failed', e)
      toast.error(e instanceof Error ? e.message : '自動產生失敗')
    } finally {
      setLabelCodeGeneratingIdx(null)
    }
  }

  const handleSaveLabelCode = async (idx: number) => {
    const d = drafts[idx]
    if (!d?.id) {
      toast.error('請先儲存商品，再存標籤代碼')
      return
    }
    const formatErr = validateLabelCodeFormat(d.label_code)
    if (formatErr) {
      toast.error(formatErr)
      return
    }
    const normalized = normalizeLabelCode(d.label_code)
    if (normalized) {
      const clash = drafts.some(
        (row, i) =>
          i !== idx &&
          !row.pendingDelete &&
          normalizeLabelCode(row.label_code) === normalized,
      )
      if (clash) {
        toast.error(`標籤代碼「${normalized}」在此商品內重複`)
        return
      }
      const conflict = await findLabelCodeConflict(normalized, d.id)
      if (conflict) {
        const who = [conflict.brand, conflict.model].filter(Boolean).join(' ')
        toast.error(
          who
            ? `標籤代碼「${normalized}」已被「${who}」使用`
            : `標籤代碼「${normalized}」已被其他商品使用`,
        )
        return
      }
    }
    setLabelCodeSavingId(d.id)
    try {
      await updateVariant(d.id, { label_code: normalized })
      setDrafts((prev) =>
        prev.map((row, i) =>
          i === idx ? { ...row, savedLabelCode: normalized ?? '' } : row,
        ),
      )
      toast.success('標籤代碼已儲存')
    } catch (e: unknown) {
      console.error('[ProductEditView] save label_code failed', e)
      const code = (e as { code?: string })?.code
      if (code === '23505') {
        toast.error('此標籤代碼已被其他 SKU 使用')
      } else {
        toast.error('標籤代碼儲存失敗')
      }
    } finally {
      setLabelCodeSavingId(null)
    }
  }

  const performSave = async () => {
    setSaving(true)
    try {
      let pid = productId
      if (isNew) {
        const created = await createProduct({
          category,
          brand,
          model,
          description: description.trim() || null,
          is_public: isPublic,
          created_by: currentUserEmail ?? null,
        })
        pid = created.id
      } else {
        await updateProduct(productId!, {
          category,
          brand,
          model,
          description: description.trim() || null,
          is_public: isPublic,
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
      for (const d of drafts) {
        if (d.pendingDelete) {
          if (d.id) {
            await deleteVariant(d.id)
            // 軟刪不清圖（保留以防誤刪復原），如要清圖：if (d.image_path) await removeProductImage(d.image_path)
          }
          continue
        }
        const stockNum = Number(d.stock)
        const availability = deriveVariantAvailability(stockNum, d.acceptPreOrder)
        const payload = {
          label_code: normalizeLabelCode(d.label_code),
          vendor_code: d.vendor_code,
          attributes: normalizeVariantAttributes(d.attributes),
          price: d.price.trim() === '' ? null : Number(d.price),
          stock: stockNum,
          availability,
          pre_order_eta: null,
          cover_image_url: d.cover_image_url,
          cover_image_path: d.cover_image_path,
          image_url: d.image_url,
          image_path: d.image_path,
        }
        if (d.id) {
          await updateVariant(d.id, payload)
        } else {
          await createVariant({ product_id: pid!, ...payload })
        }
      }

      // ===== Storage 清理：刪掉這個 session 內不再被引用的舊圖 =====
      // 1) 收集所有「最終會被 DB 引用」的 path
      const finalPaths = new Set<string>()
      for (const d of drafts) {
        if (d.pendingDelete) {
          // 軟刪不清圖：原始 path 保留，以防誤刪復原
          if (d.originalCoverImagePath) finalPaths.add(d.originalCoverImagePath)
          if (d.originalImagePath) finalPaths.add(d.originalImagePath)
        } else {
          if (d.cover_image_path) finalPaths.add(d.cover_image_path)
          if (d.image_path) finalPaths.add(d.image_path)
        }
      }
      // 2) 蒐集「應該被刪掉」的 path：
      //    - 每個 variant 的 originalImagePath（若跟新 image_path 不同且不再被引用）
      //    - 這個 session 上傳但最終沒被任何 variant 採用的（中途又換掉的中間檔）
      const toRemove = new Set<string>()
      for (const d of drafts) {
        if (d.pendingDelete) continue
        if (d.originalCoverImagePath && d.originalCoverImagePath !== d.cover_image_path) {
          if (!finalPaths.has(d.originalCoverImagePath)) toRemove.add(d.originalCoverImagePath)
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
  const sectionStyle: React.CSSProperties = {
    background: designSystem.colors.background.card,
    borderRadius: designSystem.borderRadius.lg,
    padding: isMobile ? 16 : 20,
    marginBottom: 16,
    border: `1px solid ${designSystem.colors.border.light}`,
  }

  /** 與 AddMemberDialog / NewBookingDialog 相同：手機版底部按鈕欄（flex 底欄，非 fixed） */
  const mobileFooterBar =
    isMobile && !readOnly ? (
      <div
        style={{
          padding: '12px 0 0',
          paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
          borderTop: `1px solid ${designSystem.colors.border.light}`,
          background: designSystem.colors.background.main,
          display: 'flex',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          data-track="product_edit_cancel"
          onClick={handleCancel}
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
          取消
        </button>
        <button
          type="button"
          data-track="product_edit_save"
          onClick={() => void handleSave()}
          disabled={saving}
          style={{
            ...getButtonStyle('primary', 'large', isMobile),
            flex: 2,
            opacity: saving ? 0.7 : 1,
            cursor: saving ? 'not-allowed' : 'pointer',
            touchAction: 'manipulation',
            minHeight: 48,
            background: saving
              ? designSystem.colors.secondary[300]
              : designSystem.colors.primary[500],
          }}
        >
          {saving ? '儲存中…' : '儲存'}
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
        <Button variant="outline" size="small" data-track="product_edit_back" onClick={handleCancel} disabled={saving}>
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
          <Button variant="primary" data-track="product_edit_save" onClick={handleSave} disabled={saving}>
            {saving ? '儲存中…' : '儲存'}
          </Button>
        )}
      </div>

      {/* 商品基本資訊 */}
      <section style={sectionStyle}>
        <h3
          style={{
            margin: '0 0 16px 0',
            fontSize: getFontSize('body', isMobile),
            fontWeight: 700,
            color: designSystem.colors.text.primary,
          }}
        >
          商品資訊
        </h3>
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
            <input
              style={inputStyle}
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="例如：Follow"
              disabled={saving || readOnly}
              list="product-brand-suggestions"
              autoComplete="off"
            />
            <datalist id="product-brand-suggestions">
              {brandSuggestions.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
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
          </div>
          <div style={{ gridColumn: isMobile ? 'auto' : '1 / -1' }}>
            <label style={labelStyle}>備註</label>
            <input
              style={inputStyle}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="（可選）此商品的補充說明"
              disabled={saving || readOnly}
            />
          </div>
        </div>
      </section>

      {/* SKU 列表 */}
      <section style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <h3
            style={{
              margin: 0,
              fontSize: getFontSize('body', isMobile),
              fontWeight: 700,
              flex: 1,
              color: designSystem.colors.text.primary,
            }}
          >
            規格與庫存 (SKU)
          </h3>
          <Badge variant="info" size="small">
            {drafts.filter((d) => !d.pendingDelete).length}
          </Badge>
        </div>

        {visibleDrafts.map((d, idx) => (
          <VariantBlock
            key={d.id ?? `new-${idx}`}
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
            labelCodeSaving={d.id != null && labelCodeSavingId === d.id}
            onSaveLabelCode={() => void handleSaveLabelCode(idx)}
            labelCodeGenerating={labelCodeGeneratingIdx === idx}
            onGenerateLabelCode={() => void handleGenerateLabelCode(idx)}
          />
        ))}

        {!readOnly && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="outline" size="small" data-track="product_sku_add" onClick={handleAddVariant} disabled={saving}>
              + 新增規格 (SKU)
            </Button>
            {drafts.some((d) => !d.pendingDelete) && (
              <span title="以最後一筆有效規格為範本（含封面與實品照，庫存歸 0）">
                <Button
                  variant="outline"
                  size="small"
                  data-track="product_sku_duplicate"
                  onClick={() => void handleDuplicateLast()}
                  disabled={saving || duplicating}
                >
                  {duplicating ? '複製中…' : '⎘ 複製上一筆'}
                </Button>
              </span>
            )}
          </div>
        )}

        {/* 商城顯示：保留在同一個建檔群組中，作為完成規格後的次要設定 */}
        <div
          style={{
            marginTop: designSystem.spacing.lg,
            paddingTop: designSystem.spacing.lg,
            borderTop: `1px solid ${designSystem.colors.border.light}`,
          }}
        >
        <h3
          style={{
            margin: `0 0 ${designSystem.spacing.md} 0`,
            fontSize: getFontSize('body', isMobile),
            fontWeight: 700,
            color: designSystem.colors.text.primary,
          }}
        >
          Shop 上架
        </h3>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 14px',
            background: isPublic
              ? designSystem.colors.warning[50]
              : designSystem.colors.secondary[50],
            border: `1px solid ${
              isPublic ? designSystem.colors.warning[500] : designSystem.colors.border.light
            }`,
            borderRadius: designSystem.borderRadius.md,
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
              accentColor: designSystem.colors.warning[500],
            }}
          />
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: getFontSize('body', isMobile),
                fontWeight: 600,
                color: designSystem.colors.text.primary,
              }}
            >
              上架 Shop
            </span>
            <ShopVisibilityPill isPublic={isPublic} />
          </div>
        </label>
        <p
          style={{
            margin: '10px 2px 0',
            fontSize: getFontSize('caption', isMobile),
            color: designSystem.colors.text.secondary,
          }}
        >
          每個 SKU 的 Shop 封面可在上方規格卡底部展開設定。
        </p>
        </div>
      </section>

      {/* 危險區（編輯模式才有；唯讀模式隱藏） */}
      {!isNew && !readOnly && (
        <section
          style={{
            ...sectionStyle,
            marginTop: 16,
            marginBottom: 0,
            border: `1px solid ${designSystem.colors.danger[50]}`,
          }}
        >
          <h3
            style={{
              margin: '0 0 12px 0',
              fontSize: getFontSize('body', isMobile),
              fontWeight: 700,
              color: designSystem.colors.danger[700],
            }}
          >
            危險區
            {!isMobile && (
              <span
                style={{
                  fontSize: getFontSize('caption', isMobile),
                  fontWeight: 400,
                  color: designSystem.colors.text.secondary,
                  marginLeft: 8,
                }}
              >
                軟刪除，可恢復
              </span>
            )}
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
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          maxHeight: '100dvh',
        }}
      >
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            WebkitOverflowScrolling: 'touch',
            paddingBottom: 8,
          }}
        >
          {mainContent}
        </div>
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
  labelCodeSaving?: boolean
  onSaveLabelCode?: () => void
  labelCodeGenerating?: boolean
  onGenerateLabelCode?: () => void
}

function SectionLabel({ children, isMobile }: { children: React.ReactNode; isMobile: boolean }) {
  return (
    <div
      style={{
        margin: '14px 0 8px',
        paddingTop: 12,
        borderTop: `1px solid ${designSystem.colors.border.light}`,
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
  labelCodeSaving = false,
  onSaveLabelCode,
  labelCodeGenerating = false,
  onGenerateLabelCode,
}: VariantBlockProps) {
  const blockRef = useRef<HTMLDivElement>(null)
  // 折疊：手機上已有 SKU 預設收合；從列表點進來的目標 SKU 強制展開
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (focused) return false
    return isMobile && draft.id != null && !draft.pendingDelete
  })
  // 桌機強制展開（避免從手機切到桌機時內容被卡住看不到；桌機本來也沒折疊互動）
  const effectiveCollapsed = collapsed && isMobile

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
    border: focused
      ? `1.5px solid ${designSystem.colors.primary[500]}`
      : `1px solid ${designSystem.colors.border.light}`,
    borderRadius: designSystem.borderRadius.lg,
    padding: isMobile ? 12 : 16,
    marginBottom: 12,
    background: draft.pendingDelete
      ? designSystem.colors.secondary[50]
      : focused
        ? designSystem.colors.secondary[50]
        : designSystem.colors.background.card,
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

  /** 手機才允許 collapse；點 header 切換 */
  const headerClickable = isMobile && !draft.pendingDelete
  const onHeaderClick = () => {
    if (headerClickable) setCollapsed((c) => !c)
  }
  const stop = (e: React.MouseEvent) => e.stopPropagation()
  /** 封面：列表點進來的 SKU 直接展開，省一次點擊 */
  const [coverExpanded, setCoverExpanded] = useState(focused)

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
        <ShopStatusPill status={shopStatus} />
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
              onChange={(e) => onChange({ acceptPreOrder: e.target.checked })}
              disabled={disabled || draft.pendingDelete}
              style={{ width: 16, height: 16, flexShrink: 0 }}
            />
            <span style={{ fontWeight: 600 }}>開放預購</span>
          </span>
          <ShopStatusPill status={shopStatus} />
        </label>
      </div>
    )

  const specFieldsGrid = (
    <div
      style={{
        display: 'grid',
        gap: 8,
        gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)',
      }}
    >
      <div style={{ gridColumn: isMobile ? '1 / -1' : 'auto' }}>
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

  const inventoryFieldsGrid = (
    <div
      style={{
        display: 'grid',
        gap: 8,
        gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)',
      }}
    >
      {stockField}
      {preOrderField}
      <div>
        <label style={labelStyle}>
          售價
          <span style={{ color: designSystem.colors.text.disabled, fontWeight: 400, marginLeft: 4 }}>
            (留空＝待補)
          </span>
        </label>
        <NumericTextInput
          variant="course"
          value={draft.price}
          onChange={(price) => onChange({ price })}
          placeholder="待補"
          disabled={disabled || draft.pendingDelete}
        />
      </div>
    </div>
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
      <div
        style={{
          fontSize: getFontSize('caption', isMobile),
          color: designSystem.colors.text.disabled,
          marginBottom: 10,
          lineHeight: 1.4,
        }}
      >
        {LABEL_CODE_RULE_HINT}
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
      {!readOnly && (
        <div style={{ marginTop: 10 }}>
          <Button
            variant="primary"
            size="small"
            data-track="product_label_code_save"
            disabled={
              disabled ||
              draft.pendingDelete ||
              !draft.id ||
              !isLabelCodeDirty(draft.label_code, draft.savedLabelCode) ||
              labelCodeSaving
            }
            onClick={() => onSaveLabelCode?.()}
          >
            {labelCodeSaving ? '儲存中…' : '儲存標籤'}
          </Button>
          {!draft.id && (
            <p
              style={{
                fontSize: getFontSize('caption', isMobile),
                color: designSystem.colors.text.secondary,
                margin: '8px 0 0',
                textAlign: isMobile ? 'center' : 'left',
              }}
            >
              新建 SKU：可修改代碼後，與商品一起按「儲存」
            </p>
          )}
          {draft.id && isLabelCodeDirty(draft.label_code, draft.savedLabelCode) && (
            <p
              style={{
                fontSize: getFontSize('caption', isMobile),
                color: designSystem.colors.info[700],
                margin: '6px 0 0',
                textAlign: isMobile ? 'center' : 'left',
              }}
            >
              標籤代碼尚未儲存
            </p>
          )}
        </div>
      )}
    </div>
  )

  const coverEditor = (
    <CoverImageEditor
      compact
      value={draft.cover_image_url}
      path={draft.cover_image_path}
      entityId={draft.id}
      storageFolder="covers"
      brand={brand}
      model={model}
      vendorCode={draft.vendor_code}
      disabled={disabled || draft.pendingDelete}
      onChange={(next) => onChange({ cover_image_url: next.url, cover_image_path: next.path })}
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
        {draft.cover_image_url ? (
          <img
            src={draft.cover_image_url}
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
          {draft.cover_image_url ? '封面 ✓' : '封面 未設'}
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
        {/* 折疊狀態下顯示摘要：規格 + 庫存 / 貨號 */}
        {effectiveCollapsed && (
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
            <span style={{ marginLeft: 8, color: designSystem.colors.text.disabled }}>
              ·庫存 {draft.stock.trim() !== '' ? draft.stock : '未填'}
            </span>
          </span>
        )}
        {!effectiveCollapsed && <span style={{ flex: 1 }} />}
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

      {effectiveCollapsed ? null : (
        <>
          <SectionLabel isMobile={isMobile}>規格資料</SectionLabel>
          {specFieldsGrid}
          {productPhotoSection}
          <SectionLabel isMobile={isMobile}>庫存與售價</SectionLabel>
          {inventoryFieldsGrid}
          {labelCodeSection}
          {collapsibleCoverSection}
        </>
      )}
    </div>
  )
}
