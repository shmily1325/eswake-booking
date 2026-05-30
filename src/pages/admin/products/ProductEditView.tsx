import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Badge, useToast, ConfirmModal } from '../../../components/ui'
import { useResponsive } from '../../../hooks/useResponsive'
import { CoverImageEditor } from './CoverImageEditor'
import { CATEGORY_SCHEMAS, getCategory, validateAttributes, type FieldDef } from './schema'
import {
  createProduct,
  createVariant,
  deleteProduct,
  deleteVariant,
  fetchProductWithVariants,
  updateProduct,
  updateVariant,
} from './api'
import type { ProductVariantRow, ProductWithVariants } from './types'
import { removeProductImage } from '../../../utils/imageUpload'
import { trackClick } from '../../../utils/trackClick'

interface ProductEditViewProps {
  /** 編輯模式：傳入 productId；新增模式：傳 null */
  productId: string | null
  /** 預設類別（新增時用，從目前 Tab 帶入） */
  defaultCategory?: string
  /** 已存在的商品（給品牌 / 型號 autocomplete 用） */
  existingProducts?: ReadonlyArray<{ category: string; brand: string; model: string }>
  /** 唯讀模式（can_products_view 進來的人）：所有 input/按鈕 disabled、儲存/刪除/SKU 編輯入口隱藏 */
  readOnly?: boolean
  onClose: (changed: boolean) => void
  currentUserEmail?: string | null
}

interface DraftVariant {
  /** 已存在於 DB 的 SKU id；新加的尚未儲存則為 null */
  id: string | null
  vendor_code: string
  attributes: Record<string, string>
  price: string
  stock: string
  image_url: string | null
  image_path: string | null
  /**
   * 編輯前 DB 的原始 image_path。
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
    attrs[k] = val == null ? '' : String(val)
  }
  return {
    id: v.id,
    vendor_code: v.vendor_code ?? '',
    attributes: attrs,
    // price 為 null 時保留空字串（UI 顯示「待補」），不要強制變成 "0"
    price: v.price == null ? '' : String(v.price),
    stock: String(v.stock ?? 0),
    image_url: v.image_url,
    image_path: v.image_path,
    originalImagePath: v.image_path,
  }
}

function emptyDraft(): DraftVariant {
  return {
    id: null,
    vendor_code: '',
    attributes: {},
    price: '',
    stock: '0',
    image_url: null,
    image_path: null,
    originalImagePath: null,
  }
}

export function ProductEditView({ productId, defaultCategory, existingProducts = [], readOnly = false, onClose, currentUserEmail }: ProductEditViewProps) {
  const toast = useToast()
  const { isMobile } = useResponsive()
  const isNew = productId == null

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
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

  const cat = useMemo(() => getCategory(category), [category])

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
   * 複製最後一筆有效（非 pendingDelete）SKU 當新規格的範本，
   * 圖片不複製（避免兩個 variant 引用同一張，造成刪檔複雜化）。
   */
  const handleDuplicateLast = () => {
    const lastActive = [...drafts].reverse().find((d) => !d.pendingDelete)
    if (!lastActive) {
      handleAddVariant()
      return
    }
    setDrafts((prev) => [
      ...prev,
      {
        id: null,
        vendor_code: lastActive.vendor_code,
        attributes: { ...lastActive.attributes },
        price: lastActive.price,
        stock: '0',
        image_url: null,
        image_path: null,
        originalImagePath: null,
      },
    ])
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
      const stockNum = Number(d.stock)
      if (!Number.isFinite(stockNum) || stockNum < 0) return `規格 #${i + 1}：庫存需為非負整數`
    }
    return null
  }

  const handleSave = async () => {
    const err = validate()
    if (err) {
      toast.error(err)
      return
    }
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

      // SKU：依狀態 dispatch
      for (const d of drafts) {
        if (d.pendingDelete) {
          if (d.id) {
            await deleteVariant(d.id)
            // 軟刪不清圖（保留以防誤刪復原），如要清圖：if (d.image_path) await removeProductImage(d.image_path)
          }
          continue
        }
        const payload = {
          vendor_code: d.vendor_code,
          attributes: d.attributes,
          // 空字串 = NULL（售價待補）；其他則轉成數字
          price: d.price.trim() === '' ? null : Number(d.price),
          stock: Number(d.stock),
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
          // 軟刪不清圖：原始 image_path 保留，以防誤刪復原
          if (d.originalImagePath) finalPaths.add(d.originalImagePath)
        } else if (d.image_path) {
          finalPaths.add(d.image_path)
        }
      }
      // 2) 蒐集「應該被刪掉」的 path：
      //    - 每個 variant 的 originalImagePath（若跟新 image_path 不同且不再被引用）
      //    - 這個 session 上傳但最終沒被任何 variant 採用的（中途又換掉的中間檔）
      const toRemove = new Set<string>()
      for (const d of drafts) {
        if (d.pendingDelete) continue
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
      <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>載入中…</div>
    )
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#444',
    marginBottom: 6,
  }
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    fontSize: 15,
    border: '1px solid #d8d8d8',
    borderRadius: 8,
    boxSizing: 'border-box',
    background: '#fff',
  }

  return (
    <div style={{ paddingBottom: isMobile ? 80 : 40 }}>
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
        <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 22, flex: 1 }}>
          {readOnly ? '查看商品' : isNew ? '新增商品' : '編輯商品'}
          {original && (
            <span style={{ fontSize: 13, color: '#888', marginLeft: 8, fontWeight: 400 }}>
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
      <section
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: isMobile ? 16 : 20,
          marginBottom: 16,
          border: '1px solid #eee',
        }}
      >
        <h3 style={{ margin: '0 0 16px 0', fontSize: 15, fontWeight: 700 }}>商品資訊</h3>
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
          {/* 上架到商城 toggle（is_public） */}
          <div style={{ gridColumn: isMobile ? 'auto' : '1 / -1' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 14px',
                background: isPublic ? '#fff7ed' : '#fafafa',
                border: `1px solid ${isPublic ? '#fdba74' : '#e5e7eb'}`,
                borderRadius: 8,
                cursor: readOnly || saving ? 'not-allowed' : 'pointer',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                disabled={saving || readOnly}
                style={{ width: 18, height: 18, cursor: 'inherit', accentColor: '#f97316' }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
                  {isPublic ? '上架到商城' : '不上架（後台可見、商城隱藏）'}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  {isPublic
                    ? '客人可在 /shop 看到這個商品並透過 LINE 詢問'
                    : '只有員工後台看得到，編輯中、停售但保留歷史的商品請維持關閉'}
                </div>
              </div>
            </label>
          </div>
        </div>
      </section>

      {/* SKU 列表 */}
      <section
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: isMobile ? 16 : 20,
          border: '1px solid #eee',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, flex: 1 }}>規格與庫存 (SKU)</h3>
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
            schemaFields={cat?.fields ?? []}
            isMobile={isMobile}
            disabled={saving || readOnly}
            readOnly={readOnly}
            onChange={(patch) => updateDraft(idx, patch)}
            onAttributeChange={(key, val) => updateDraftAttribute(idx, key, val)}
            onRemove={() => handleRemoveVariant(idx)}
            onRestore={() => handleRestoreVariant(idx)}
            onImageUpload={trackUpload}
          />
        ))}

        {!readOnly && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="outline" size="small" data-track="product_sku_add" onClick={handleAddVariant} disabled={saving}>
              + 新增規格 (SKU)
            </Button>
            {drafts.some((d) => !d.pendingDelete) && (
              <span title="以最後一筆有效規格為範本（不複製圖、庫存歸 0）">
                <Button variant="outline" size="small" data-track="product_sku_duplicate" onClick={handleDuplicateLast} disabled={saving}>
                  ⎘ 複製上一筆
                </Button>
              </span>
            )}
          </div>
        )}
      </section>

      {/* 危險區（編輯模式才有；唯讀模式隱藏） */}
      {!isNew && !readOnly && (
        <section
          style={{
            background: '#fff',
            borderRadius: 12,
            padding: isMobile ? 16 : 20,
            marginTop: 16,
            border: '1px solid #f3d6d6',
          }}
        >
          <h3 style={{ margin: '0 0 8px 0', fontSize: 15, fontWeight: 700, color: '#c62828' }}>危險區</h3>
          <p style={{ margin: '0 0 12px 0', fontSize: 13, color: '#666' }}>
            刪除商品會把它和所有規格從清單中隱藏（軟刪除，可由資料庫恢復）。
          </p>
          <Button variant="danger" size="small" data-track="product_edit_delete_open" onClick={() => setConfirmDelete(true)} disabled={saving}>
            刪除整個商品
          </Button>
        </section>
      )}

      {/* 手機版底部固定儲存按鈕（唯讀模式隱藏） */}
      {isMobile && !readOnly && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            padding: '12px 16px',
            paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
            background: '#fff',
            borderTop: '1px solid #eee',
            zIndex: 50,
            display: 'flex',
            gap: 10,
          }}
        >
          <Button variant="outline" data-track="product_edit_cancel" onClick={handleCancel} disabled={saving} style={{ flex: 1 }}>
            取消
          </Button>
          <Button variant="primary" data-track="product_edit_save" onClick={handleSave} disabled={saving} style={{ flex: 2 }}>
            {saving ? '儲存中…' : '儲存'}
          </Button>
        </div>
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
    </div>
  )
}

interface VariantBlockProps {
  index: number
  draft: DraftVariant
  brand: string
  model: string
  schemaFields: FieldDef[]
  isMobile: boolean
  disabled: boolean
  /** 唯讀模式：隱藏「🗑 移除」「復原」按鈕，inputs 仍透過 disabled prop 鎖住 */
  readOnly?: boolean
  onChange: (patch: Partial<DraftVariant>) => void
  onAttributeChange: (key: string, value: string) => void
  onRemove: () => void
  onRestore: () => void
  onImageUpload: (path: string) => void
}

function VariantBlock({
  index,
  draft,
  brand,
  model,
  schemaFields,
  isMobile,
  disabled,
  readOnly = false,
  onChange,
  onAttributeChange,
  onRemove,
  onRestore,
  onImageUpload,
}: VariantBlockProps) {
  // 折疊：預設新建（id=null）或標記刪除的展開、已有 SKU 在手機上預設折疊
  const [collapsed, setCollapsed] = useState<boolean>(isMobile && draft.id != null && !draft.pendingDelete)
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
    border: '1px solid #ececec',
    borderRadius: 12,
    padding: isMobile ? 12 : 16,
    marginBottom: 12,
    background: draft.pendingDelete ? '#fafafa' : '#fff',
    opacity: draft.pendingDelete ? 0.55 : 1,
    position: 'relative',
  }
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    fontSize: 14,
    border: '1px solid #d8d8d8',
    borderRadius: 6,
    boxSizing: 'border-box',
    background: '#fff',
  }
  const labelStyle: React.CSSProperties = { fontSize: 12, color: '#666', marginBottom: 4, display: 'block' }

  /** 手機才允許 collapse；點 header 切換 */
  const headerClickable = isMobile && !draft.pendingDelete
  const onHeaderClick = () => {
    if (headerClickable) setCollapsed((c) => !c)
  }
  const stop = (e: React.MouseEvent) => e.stopPropagation()

  return (
    <div style={blockStyle}>
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
        <span style={{ fontWeight: 600, fontSize: 13, color: '#555', whiteSpace: 'nowrap' }}>
          SKU #{index + 1}
        </span>
        {/* 折疊狀態下顯示摘要：規格 + 庫存 / 貨號 */}
        {effectiveCollapsed && (
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 12,
              color: '#777',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {summary || draft.vendor_code || '（空白）'}
            <span style={{ marginLeft: 8, color: '#999' }}>·庫存 {draft.stock || 0}</span>
          </span>
        )}
        {!effectiveCollapsed && <span style={{ flex: 1 }} />}
        {draft.pendingDelete ? (
          <span style={{ color: '#c62828', fontSize: 12 }}>（將刪除）</span>
        ) : null}
        {headerClickable && (
          <span
            aria-hidden
            style={{
              fontSize: 11,
              color: '#aaa',
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
              color: '#c62828',
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
        <CoverImageEditor
          compact
          value={draft.image_url}
          path={draft.image_path}
          entityId={draft.id}
          brand={brand}
          model={model}
          vendorCode={draft.vendor_code}
          disabled={disabled || draft.pendingDelete}
          onChange={(next) => onChange({ image_url: next.url, image_path: next.path })}
          onUpload={onImageUpload}
        />

        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', marginTop: 12 }}>
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
                {f.required && <span style={{ color: '#c62828' }}> *</span>}
              </label>
              {f.type === 'select' ? (
                <select
                  style={inputStyle}
                  value={draft.attributes[f.key] ?? ''}
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
                  inputMode={f.type === 'number' ? 'numeric' : 'text'}
                  value={draft.attributes[f.key] ?? ''}
                  onChange={(e) => onAttributeChange(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  disabled={disabled || draft.pendingDelete}
                />
              )}
            </div>
          ))}
          <div>
            <label style={labelStyle}>
              售價
              <span style={{ color: '#999', fontWeight: 400, marginLeft: 4 }}>(留空＝待補)</span>
            </label>
            <input
              style={inputStyle}
              inputMode="numeric"
              value={draft.price}
              onChange={(e) => onChange({ price: e.target.value.replace(/\D/g, '') })}
              placeholder="待補"
              disabled={disabled || draft.pendingDelete}
            />
          </div>
          <div>
            <label style={labelStyle}>庫存 *</label>
            <input
              style={inputStyle}
              inputMode="numeric"
              value={draft.stock}
              onChange={(e) => onChange({ stock: e.target.value.replace(/\D/g, '') })}
              placeholder="0"
              disabled={disabled || draft.pendingDelete}
            />
          </div>
        </div>
      </>
      )}
    </div>
  )
}
