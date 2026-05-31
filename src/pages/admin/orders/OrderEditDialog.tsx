import { useEffect, useMemo, useState } from 'react'
import { useMemberSearch } from '../../../hooks/useMemberSearch'
import { toast } from '../../../utils/toast'
import { fetchAllProductsWithVariants, flattenToVariantItems } from '../products/api'
import { formatAttributes } from '../products/schema'
import type { VariantListItem } from '../products/types'
import { createShopOrder, deleteShopOrder, updateShopOrder } from './api'
import { OrderMemberPicker, resolveContactName } from './OrderMemberPicker'
import type { DeliveryMethod, ShopOrderWithItems } from './types'

interface DraftLine {
  key: string
  variant_id: string
  unit_price: number
  qty: number
  label: string
}

interface Props {
  open: boolean
  order: ShopOrderWithItems | null
  userEmail?: string
  onClose: () => void
  onSaved: () => void
}

export function OrderEditDialog({ open, order, userEmail, onClose, onSaved }: Props) {
  const memberSearch = useMemberSearch()
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('pickup_es')
  const [shippingInfo, setShippingInfo] = useState('')
  const [customerNote, setCustomerNote] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([])
  const [variantSearch, setVariantSearch] = useState('')
  const [variants, setVariants] = useState<VariantListItem[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const locked = useMemo(
    () => Boolean(order?.items.some((it) => it.qty_pending_bill > 0 || it.qty_paid > 0)),
    [order],
  )

  useEffect(() => {
    if (!open) return
    fetchAllProductsWithVariants()
      .then((list) => setVariants(flattenToVariantItems(list)))
      .catch(() => toast.error('載入商品失敗'))
  }, [open])

  useEffect(() => {
    if (!open) return
    setSaveError(null)
    if (order) {
      setDeliveryMethod(order.delivery_method)
      setShippingInfo(order.shipping_info || '')
      setCustomerNote(order.customer_note || '')
      setInternalNotes(order.internal_notes || '')
      setLines(
        order.items.map((it) => ({
          key: it.id,
          variant_id: it.variant_id,
          unit_price: it.unit_price,
          qty: it.qty,
          label: lineLabel(it.variant?.product, it.variant),
        })),
      )
      if (order.member_id) {
        const m = memberSearch.members.find((x) => x.id === order.member_id)
        if (m) memberSearch.selectMember(m)
        else memberSearch.handleSearchChange(order.contact_name)
      } else {
        memberSearch.handleSearchChange(order.contact_name)
      }
    } else {
      setDeliveryMethod('pickup_es')
      setShippingInfo('')
      setCustomerNote('')
      setInternalNotes('')
      setLines([])
      memberSearch.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, order?.id])

  const filteredVariants = useMemo(() => {
    const q = variantSearch.trim().toLowerCase()
    if (!q) return []
    return variants
      .filter((v) => {
        const text = `${v.product.brand} ${v.product.model} ${formatAttributes(v.product.category, v.variant.attributes)} ${v.variant.vendor_code || ''}`.toLowerCase()
        return text.includes(q)
      })
      .slice(0, 12)
  }, [variants, variantSearch])

  if (!open) return null

  const addVariant = (item: VariantListItem) => {
    if (locked) return
    setLines((prev) => [
      ...prev,
      {
        key: `new-${item.variant.id}-${Date.now()}`,
        variant_id: item.variant.id,
        unit_price: item.variant.price ?? 0,
        qty: 1,
        label: lineLabel(item.product, item.variant),
      },
    ])
    setVariantSearch('')
  }

  const handleSave = async () => {
    const contactName = resolveContactName(
      memberSearch.selectedMemberId,
      memberSearch.searchTerm,
      memberSearch.manualName,
      memberSearch.members,
    )
    if (!contactName) {
      toast.error('請填寫訂購人')
      return
    }
    const payloadLines = lines.filter((l) => l.qty > 0 && l.variant_id)
    if (payloadLines.length === 0) {
      toast.error('請至少加入一項商品')
      return
    }

    setSaveError(null)

    setSaving(true)
    try {
      if (order) {
        if (!locked) {
          await updateShopOrder(order.id, {
            member_id: memberSearch.selectedMemberId,
            contact_name: contactName,
            delivery_method: deliveryMethod,
            shipping_info: shippingInfo,
            customer_note: customerNote,
            internal_notes: internalNotes,
            lines: payloadLines.map(({ variant_id, unit_price, qty }) => ({
              variant_id,
              unit_price,
              qty,
            })),
            updated_by: userEmail ?? null,
          })
        } else {
          await updateShopOrder(order.id, {
            customer_note: customerNote,
            internal_notes: internalNotes,
            updated_by: userEmail ?? null,
          })
        }
        toast.success('已儲存')
      } else {
        await createShopOrder({
          member_id: memberSearch.selectedMemberId,
          contact_name: contactName,
          delivery_method: deliveryMethod,
          shipping_info: shippingInfo,
          customer_note: customerNote,
          internal_notes: internalNotes,
          lines: payloadLines.map(({ variant_id, unit_price, qty }) => ({
            variant_id,
            unit_price,
            qty,
          })),
          created_by: userEmail ?? null,
        })
        toast.success('已建立訂單')
      }
      onSaved()
      onClose()
    } catch (e: unknown) {
      const msg = formatSaveError(e)
      setSaveError(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!order) return
    if (!confirm(`確定刪除訂單 ${order.order_no}？\n此操作無法復原。`)) return
    setSaveError(null)
    setSaving(true)
    try {
      await deleteShopOrder(order.id)
      toast.success('已刪除訂單')
      onSaved()
      onClose()
    } catch (e: unknown) {
      const msg = formatSaveError(e)
      setSaveError(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          width: '100%',
          maxWidth: 640,
          maxHeight: '92vh',
          overflow: 'auto',
          borderRadius: '16px 16px 0 0',
          padding: 20,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 16px', fontSize: 20 }}>
          {order ? `編輯訂單 ${order.order_no}` : '新增訂單'}
        </h2>
        {locked && (
          <div style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 13 }}>
            已送報帳或已結帳，品項鎖定；僅可改備註。
          </div>
        )}

        <OrderMemberPicker
          searchTerm={memberSearch.searchTerm}
          onSearchChange={memberSearch.handleSearchChange}
          showDropdown={memberSearch.showDropdown}
          setShowDropdown={memberSearch.setShowDropdown}
          filteredMembers={memberSearch.filteredMembers}
          onSelectMember={memberSearch.selectMember}
          disabled={locked}
        />

        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <label style={{ flex: 1 }}>
            <span style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>交貨方式</span>
            <select
              value={deliveryMethod}
              disabled={locked}
              onChange={(e) => setDeliveryMethod(e.target.value as DeliveryMethod)}
              style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ccc' }}
            >
              <option value="pickup_es">ES 面交</option>
              <option value="shipping">寄送</option>
            </select>
          </label>
        </div>

        {deliveryMethod === 'shipping' && (
          <textarea
            value={shippingInfo}
            disabled={locked}
            onChange={(e) => setShippingInfo(e.target.value)}
            placeholder="地址、宅配單號"
            rows={2}
            style={{ width: '100%', marginBottom: 12, padding: 8, borderRadius: 8, border: '1px solid #ccc', boxSizing: 'border-box' }}
          />
        )}

        {!locked && (
          <>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>加入商品</label>
            <input
              value={variantSearch}
              onChange={(e) => setVariantSearch(e.target.value)}
              placeholder="搜尋品牌、型號、規格"
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ccc', marginBottom: 8, boxSizing: 'border-box' }}
            />
            {filteredVariants.length > 0 && (
              <div style={{ border: '1px solid #eee', borderRadius: 8, marginBottom: 12, maxHeight: 160, overflow: 'auto' }}>
                {filteredVariants.map((v) => (
                  <button
                    key={v.variant.id}
                    type="button"
                    onClick={() => addVariant(v)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: 10, border: 'none', borderBottom: '1px solid #f0f0f0', background: '#fff', cursor: 'pointer' }}
                  >
                    {v.product.brand} {v.product.model} · {formatAttributes(v.product.category, v.variant.attributes)}
                    <span style={{ color: '#666', marginLeft: 8 }}>現貨 {v.variant.stock}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        <div style={{ marginBottom: 12 }}>
          {lines.map((line, idx) => (
            <div key={line.key} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ flex: '1 1 200px', fontSize: 14 }}>{line.label}</span>
              <input
                type="number"
                min={1}
                value={line.qty}
                disabled={locked}
                onChange={(e) => {
                  const qty = Math.max(1, parseInt(e.target.value, 10) || 1)
                  setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, qty } : l)))
                }}
                style={{ width: 56, padding: 6, borderRadius: 6, border: '1px solid #ccc' }}
              />
              <input
                type="number"
                min={0}
                value={line.unit_price}
                disabled={locked}
                onChange={(e) => {
                  const unit_price = Math.max(0, parseInt(e.target.value, 10) || 0)
                  setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, unit_price } : l)))
                }}
                style={{ width: 80, padding: 6, borderRadius: 6, border: '1px solid #ccc' }}
              />
              {!locked && (
                <button type="button" onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#c00' }}>×</button>
              )}
            </div>
          ))}
        </div>

        <textarea
          value={customerNote}
          onChange={(e) => setCustomerNote(e.target.value)}
          placeholder="給客人看的備註（LIFF 後用）"
          rows={2}
          style={{ width: '100%', marginBottom: 8, padding: 8, borderRadius: 8, border: '1px solid #ccc', boxSizing: 'border-box' }}
        />
        <textarea
          value={internalNotes}
          onChange={(e) => setInternalNotes(e.target.value)}
          placeholder="店內備註"
          rows={2}
          style={{ width: '100%', marginBottom: 16, padding: 8, borderRadius: 8, border: '1px solid #ccc', boxSizing: 'border-box' }}
        />

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {saveError && (
            <p
              style={{
                flex: '1 1 100%',
                margin: 0,
                fontSize: 13,
                color: '#c62828',
              }}
            >
              {saveError}
            </p>
          )}
          <button type="button" onClick={onClose} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #ccc', background: '#fff' }}>取消</button>
          {order && (
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleDelete()}
              style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #c62828', background: '#fff', color: '#c62828' }}
            >
              刪除
            </button>
          )}
          <button type="button" disabled={saving} onClick={() => void handleSave()} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#333', color: '#fff' }}>
            {saving ? '儲存中…' : '儲存'}
          </button>
        </div>
      </div>
    </div>
  )
}

function formatSaveError(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
    return (e as { message: string }).message
  }
  return '儲存失敗'
}

function lineLabel(
  product: { brand: string; model: string; category: string } | undefined,
  variant: { attributes: Record<string, string | number | null>; vendor_code?: string | null } | undefined,
): string {
  if (!product || !variant) return '商品'
  return `${product.brand} ${product.model} · ${formatAttributes(product.category, variant.attributes)}`
}
