import { useEffect, useMemo, useState } from 'react'
import { useMemberSearch } from '../../../hooks/useMemberSearch'
import { useResponsive } from '../../../hooks/useResponsive'
import { MoneyInput, PrimaryNumericInput } from '../../../components/ui/numericInputs'
import { toast } from '../../../utils/toast'
import { fetchAllProductsWithVariants, flattenToVariantItems } from '../products/api'
import { formatAttributes } from '../products/schema'
import { buildVariantSearchHaystack } from '../products/productSearchHaystack'
import type { VariantListItem } from '../products/types'
import {
  countOrderTransactions,
  createShopOrder,
  shopOrderErrorMessage,
  updateShopOrder,
  voidShopOrder,
} from './api'
import { formatDateTime } from '../../../utils/formatters'
import { confirmVoidOrder } from './orderUtils'
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
  prefillVariantId?: string | null
  userEmail?: string
  onClose: () => void
  onSaved: () => void
}

export function OrderEditDialog({ open, order, prefillVariantId, userEmail, onClose, onSaved }: Props) {
  const { isMobile } = useResponsive()
  const memberSearch = useMemberSearch()
  const [confirmedGuestName, setConfirmedGuestName] = useState<string | null>(null)
  const [guestNameInput, setGuestNameInput] = useState('')
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('pickup_es')
  const [shippingInfo, setShippingInfo] = useState('')
  const [customerNote, setCustomerNote] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([])
  const [variantSearch, setVariantSearch] = useState('')
  const [variants, setVariants] = useState<VariantListItem[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const isVoided = Boolean(order?.cancelled_at)

  const locked = useMemo(
    () =>
      isVoided ||
      Boolean(order?.items.some((it) => it.qty_pending_bill > 0 || it.qty_paid > 0)),
    [order, isVoided],
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
      setGuestNameInput('')
      if (order.member_id) {
        const m = memberSearch.members.find((x) => x.id === order.member_id)
        if (m) memberSearch.selectMember(m)
        else memberSearch.handleSearchChange(order.contact_name)
        setConfirmedGuestName(null)
      } else {
        memberSearch.reset()
        setConfirmedGuestName(order.contact_name)
      }
    } else {
      setDeliveryMethod('pickup_es')
      setShippingInfo('')
      setCustomerNote('')
      setInternalNotes('')
      setLines([])
      memberSearch.reset()
      setConfirmedGuestName(null)
      setGuestNameInput('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, order?.id])

  useEffect(() => {
    if (!open || order || !prefillVariantId || variants.length === 0) return
    const item = variants.find((v) => v.variant.id === prefillVariantId)
    if (!item) {
      toast.error('找不到此 SKU')
      return
    }
    setLines((prev) => {
      if (prev.some((l) => l.variant_id === prefillVariantId)) return prev
      return [
        ...prev,
        {
          key: `new-${item.variant.id}-${Date.now()}`,
          variant_id: item.variant.id,
          unit_price: item.variant.price ?? 0,
          qty: 1,
          label: lineLabel(item.product, item.variant),
        },
      ]
    })
  }, [open, order, prefillVariantId, variants])

  const filteredVariants = useMemo(() => {
    const q = variantSearch.trim().toLowerCase()
    if (!q) return []
    return variants
      .filter((v) => buildVariantSearchHaystack(v).includes(q))
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

  const selectedMemberLabel = memberSearch.selectedMemberId
    ? (() => {
        const m = memberSearch.members.find((x) => x.id === memberSearch.selectedMemberId)
        return m ? m.nickname || m.name : memberSearch.searchTerm
      })()
    : null

  const handleSave = async () => {
    if (isVoided) return
    const contactName = resolveContactName(
      memberSearch.selectedMemberId,
      selectedMemberLabel,
      confirmedGuestName,
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

  const handleVoid = async () => {
    if (!order || isVoided) return
    const txCount = await countOrderTransactions(order.id)
    const confirmResult = confirmVoidOrder(order, txCount)
    if (confirmResult === 'cancelled') return
    if (confirmResult === 'mismatch') {
      toast.error('訂單號不符，已取消作廢')
      return
    }
    setSaveError(null)
    setSaving(true)
    try {
      await voidShopOrder(order.id, userEmail ?? null)
      toast.success('已作廢訂單')
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
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        padding: isMobile ? 0 : 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          width: '100%',
          maxWidth: 640,
          maxHeight: isMobile ? '92vh' : '90vh',
          overflow: 'auto',
          borderRadius: isMobile ? '16px 16px 0 0' : 16,
          padding: isMobile ? '16px 16px 0' : 20,
          boxSizing: 'border-box',
          WebkitOverflowScrolling: 'touch',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 16px', fontSize: isMobile ? 18 : 20 }}>
          {order
            ? isVoided
              ? `查看訂單 ${order.order_no}`
              : `編輯訂單 ${order.order_no}`
            : '新增訂單'}
        </h2>
        {isVoided && order && (
          <div style={{ background: '#f5f5f5', border: '1px solid #ccc', borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 13, color: '#666' }}>
            此訂單已作廢（{order.cancelled_at ? formatDateTime(order.cancelled_at) : ''}），僅供查閱。
          </div>
        )}
        {!isVoided && locked && (
          <div style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 13 }}>
            已送結帳或已結清，品項鎖定；僅可改備註。
          </div>
        )}

        <OrderMemberPicker
          selectedMemberId={memberSearch.selectedMemberId}
          selectedMemberLabel={selectedMemberLabel}
          onClearMember={() => {
            memberSearch.reset()
          }}
          searchTerm={memberSearch.searchTerm}
          onSearchChange={memberSearch.handleSearchChange}
          showDropdown={memberSearch.showDropdown}
          setShowDropdown={memberSearch.setShowDropdown}
          filteredMembers={memberSearch.filteredMembers}
          onSelectMember={(m) => {
            memberSearch.selectMember(m)
            setConfirmedGuestName(null)
            setGuestNameInput('')
          }}
          guestName={guestNameInput}
          onGuestNameChange={setGuestNameInput}
          onConfirmGuest={() => {
            const name = guestNameInput.trim()
            if (!name) return
            setConfirmedGuestName(name)
            setGuestNameInput('')
            memberSearch.reset()
          }}
          confirmedGuestName={confirmedGuestName}
          onClearGuest={() => {
            setConfirmedGuestName(null)
            setGuestNameInput('')
          }}
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
              placeholder="搜尋品牌、型號、規格、貨號"
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ccc', marginBottom: 8, boxSizing: 'border-box' }}
            />
            {filteredVariants.length > 0 && (
              <div style={{ border: '1px solid #eee', borderRadius: 8, marginBottom: 12, maxHeight: 200, overflow: 'auto' }}>
                {filteredVariants.map((v) => {
                  const meta = variantMetaLine(v.variant)
                  return (
                    <button
                      key={v.variant.id}
                      type="button"
                      data-track="product_order_line_add"
                      onClick={() => addVariant(v)}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 12px',
                        border: 'none',
                        borderBottom: '1px solid #f0f0f0',
                        background: '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.35 }}>
                        {v.product.brand} {v.product.model} ·{' '}
                        {formatAttributes(v.product.category, v.variant.attributes)}
                      </div>
                      {meta && (
                        <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>{meta}</div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}

        <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: isMobile ? 10 : 0 }}>
          {lines.map((line, idx) => (
            <div
              key={line.key}
              style={{
                padding: isMobile ? 12 : '0 0 10px',
                marginBottom: isMobile ? 0 : 10,
                borderRadius: isMobile ? 10 : 0,
                background: isMobile ? '#fafafa' : 'transparent',
                border: isMobile ? '1px solid #ececec' : 'none',
                borderBottom:
                  !isMobile && idx < lines.length - 1 ? '1px solid #f0f0f0' : 'none',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  marginBottom: isMobile ? 10 : 8,
                }}
              >
                <span style={{ flex: 1, fontSize: 14, lineHeight: 1.4, minWidth: 0 }}>{line.label}</span>
                {!locked && isMobile && (
                  <button
                    type="button"
                    data-track="product_order_line_remove"
                    aria-label="移除此品項"
                    onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                    style={{
                      flexShrink: 0,
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      color: '#c62828',
                      fontSize: 22,
                      lineHeight: 1,
                      minWidth: 44,
                      minHeight: 44,
                      margin: -10,
                      padding: 10,
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? 'minmax(96px, 1fr) minmax(0, 2fr)' : '140px 1fr auto',
                  gap: 10,
                  alignItems: 'end',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: '#7f8c8d', marginBottom: 6, fontWeight: 500 }}>
                    數量
                  </div>
                  <PrimaryNumericInput
                    value={line.qty}
                    min={1}
                    disabled={locked}
                    placeholder="1"
                    onChange={(qty) => {
                      setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, qty } : l)))
                    }}
                    suffix={<span style={{ fontSize: 14, color: '#666' }}>件</span>}
                  />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: '#7f8c8d', marginBottom: 6, fontWeight: 500 }}>
                    單價
                  </div>
                  <MoneyInput
                    value={line.unit_price}
                    disabled={locked}
                    placeholder="請輸入金額"
                    onChange={(unit_price) => {
                      setLines((prev) =>
                        prev.map((l, i) => (i === idx ? { ...l, unit_price } : l)),
                      )
                    }}
                  />
                </div>
                {!locked && !isMobile && (
                  <button
                    type="button"
                    data-track="product_order_line_remove"
                    aria-label="移除此品項"
                    onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      color: '#c62828',
                      fontSize: 22,
                      minWidth: 44,
                      minHeight: 44,
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
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

        <div
          style={{
            position: 'sticky',
            bottom: 0,
            background: '#fff',
            borderTop: '1px solid #eee',
            margin: isMobile ? '0 -16px' : '0 -20px',
            padding: isMobile ? '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))' : '16px 20px 0',
            display: 'flex',
            gap: 10,
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
          }}
        >
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
          <button
            type="button"
            data-track="product_order_edit_cancel"
            onClick={onClose}
            style={{
              padding: isMobile ? '12px 16px' : '10px 16px',
              borderRadius: 8,
              border: '1px solid #ccc',
              background: '#fff',
              minHeight: isMobile ? 44 : undefined,
            }}
          >
            {isVoided ? '關閉' : '取消'}
          </button>
          {order && !isVoided && (
            <button
              type="button"
              disabled={saving}
              data-track="product_order_void"
              onClick={() => void handleVoid()}
              style={{
                padding: isMobile ? '12px 16px' : '10px 16px',
                borderRadius: 8,
                border: '1px solid #c62828',
                background: '#fff',
                color: '#c62828',
                minHeight: isMobile ? 44 : undefined,
              }}
            >
              作廢
            </button>
          )}
          {!isVoided && (
            <button
              type="button"
              disabled={saving}
              data-track={order ? 'product_order_save' : 'product_order_create'}
              onClick={() => void handleSave()}
              style={{
                padding: isMobile ? '12px 20px' : '10px 20px',
                borderRadius: 8,
                border: 'none',
                background: '#333',
                color: '#fff',
                minHeight: isMobile ? 44 : undefined,
                fontWeight: 600,
              }}
            >
              {saving ? '儲存中…' : '儲存'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function formatSaveError(e: unknown): string {
  return shopOrderErrorMessage(e, '儲存失敗')
}

function lineLabel(
  product: { brand: string; model: string; category: string } | undefined,
  variant: { attributes: Record<string, string | number | null>; vendor_code?: string | null } | undefined,
): string {
  if (!product || !variant) return '商品'
  const base = `${product.brand} ${product.model} · ${formatAttributes(product.category, variant.attributes)}`
  const code = variant.vendor_code?.trim()
  return code ? `${base} · #${code}` : base
}

/** 選貨下拉第二行：貨號、牌價、現貨（與商品管理列表一致） */
function variantMetaLine(variant: {
  vendor_code?: string | null
  price?: number | null
  stock?: number
}): string {
  const parts: string[] = []
  const code = variant.vendor_code?.trim()
  if (code) parts.push(`#${code}`)
  if (variant.price != null && variant.price > 0) {
    parts.push(`$${variant.price.toLocaleString()}`)
  }
  if (typeof variant.stock === 'number') parts.push(`現貨 ${variant.stock}`)
  return parts.join(' · ')
}
