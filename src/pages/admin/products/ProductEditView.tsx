import { useEffect, useMemo, useState } from 'react'
import { Button, Badge, useToast, ConfirmModal } from '../../../components/ui'
import { useResponsive } from '../../../hooks/useResponsive'
import { ImageUploader } from './ImageUploader'
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

interface ProductEditViewProps {
  /** 編輯模式：傳入 productId；新增模式：傳 null */
  productId: string | null
  /** 預設類別（新增時用，從目前 Tab 帶入） */
  defaultCategory?: string
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
  }
}

export function ProductEditView({ productId, defaultCategory, onClose, currentUserEmail }: ProductEditViewProps) {
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
  const [drafts, setDrafts] = useState<DraftVariant[]>(() => (isNew ? [emptyDraft()] : []))
  const [confirmDelete, setConfirmDelete] = useState(false)

  const cat = useMemo(() => getCategory(category), [category])

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

  const handleRemoveVariant = (idx: number) => {
    const target = drafts[idx]
    if (!target) return
    if (target.id) {
      // 已存在於 DB 的 SKU：標記 pendingDelete，儲存時刪除
      setDrafts((prev) => prev.map((d, i) => (i === idx ? { ...d, pendingDelete: true } : d)))
    } else {
      // 新增中尚未存檔：直接從 UI 拿掉，並順手把已上傳的圖片清掉
      if (target.image_path) void removeProductImage(target.image_path)
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
          created_by: currentUserEmail ?? null,
        })
        pid = created.id
      } else {
        await updateProduct(productId!, {
          category,
          brand,
          model,
          description: description.trim() || null,
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

      toast.success(isNew ? '商品已新增' : '已儲存變更')
      onClose(true)
    } catch (e) {
      console.error('[ProductEditView] save failed', e)
      toast.error(e instanceof Error ? e.message : '儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteProduct = async () => {
    if (!productId) return
    setSaving(true)
    try {
      await deleteProduct(productId)
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
        <Button variant="outline" size="small" onClick={() => onClose(false)} disabled={saving}>
          ← 返回
        </Button>
        <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 22, flex: 1 }}>
          {isNew ? '新增商品' : '編輯商品'}
          {original && (
            <span style={{ fontSize: 13, color: '#888', marginLeft: 8, fontWeight: 400 }}>
              {original.brand} {original.model}
            </span>
          )}
        </h2>
        {!isMobile && (
          <Button variant="primary" onClick={handleSave} disabled={saving}>
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
              disabled={saving}
            >
              {Object.values(CATEGORY_SCHEMAS).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
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
              disabled={saving}
            />
          </div>
          <div>
            <label style={labelStyle}>型號 *</label>
            <input
              style={inputStyle}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="例如：Signal Ladies"
              disabled={saving}
            />
          </div>
          <div style={{ gridColumn: isMobile ? 'auto' : '1 / -1' }}>
            <label style={labelStyle}>備註</label>
            <input
              style={inputStyle}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="（可選）此商品的補充說明"
              disabled={saving}
            />
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
            schemaFields={cat?.fields ?? []}
            isMobile={isMobile}
            disabled={saving}
            onChange={(patch) => updateDraft(idx, patch)}
            onAttributeChange={(key, val) => updateDraftAttribute(idx, key, val)}
            onRemove={() => handleRemoveVariant(idx)}
            onRestore={() => handleRestoreVariant(idx)}
          />
        ))}

        <Button variant="outline" size="small" onClick={handleAddVariant} disabled={saving}>
          + 新增規格 (SKU)
        </Button>
      </section>

      {/* 危險區（編輯模式才有） */}
      {!isNew && (
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
          <Button variant="danger" size="small" onClick={() => setConfirmDelete(true)} disabled={saving}>
            刪除整個商品
          </Button>
        </section>
      )}

      {/* 手機版底部固定儲存按鈕 */}
      {isMobile && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            padding: '12px 16px calc(12px + env(safe-area-inset-bottom))',
            background: '#fff',
            borderTop: '1px solid #eee',
            zIndex: 50,
            display: 'flex',
            gap: 10,
          }}
        >
          <Button variant="outline" onClick={() => onClose(false)} disabled={saving} style={{ flex: 1 }}>
            取消
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving} style={{ flex: 2 }}>
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
  schemaFields: FieldDef[]
  isMobile: boolean
  disabled: boolean
  onChange: (patch: Partial<DraftVariant>) => void
  onAttributeChange: (key: string, value: string) => void
  onRemove: () => void
  onRestore: () => void
}

function VariantBlock({
  index,
  draft,
  schemaFields,
  isMobile,
  disabled,
  onChange,
  onAttributeChange,
  onRemove,
  onRestore,
}: VariantBlockProps) {
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

  return (
    <div style={blockStyle}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: '#555', flex: 1 }}>
          SKU #{index + 1}
          {draft.pendingDelete && (
            <span style={{ marginLeft: 8, color: '#c62828', fontSize: 12 }}>（將刪除）</span>
          )}
        </span>
        {draft.pendingDelete ? (
          <Button variant="outline" size="small" onClick={onRestore} disabled={disabled}>
            復原
          </Button>
        ) : (
          <button
            type="button"
            onClick={onRemove}
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

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <ImageUploader
          value={draft.image_url}
          path={draft.image_path}
          variantId={draft.id}
          disabled={disabled || draft.pendingDelete}
          onChange={(next) => onChange({ image_url: next.url, image_path: next.path })}
          size={isMobile ? 80 : 96}
        />

        <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 8, gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)' }}>
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
      </div>
    </div>
  )
}
