/**
 * Design thinking:
 * Current feel: ad-hoc #ccc / #7f8c8d / #c62828 chrome and loud orange lock banners feel like a raw admin form.
 * Hierarchy: title → quiet lock/void note → member & lines → calm footer (outline cancel, danger void, primary save).
 * Primary task: create/edit/void a shop order without decorative color noise competing with the form.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMemberSearch } from '../../../hooks/useMemberSearch'
import { useResponsive } from '../../../hooks/useResponsive'
import { MoneyInput, PrimaryNumericInput } from '../../../components/ui/numericInputs'
import { toast as globalToast } from '../../../utils/toast'
import {
  designSystem,
  getButtonStyle,
  getFontSize,
  getInputStyle,
  getLabelStyle,
} from '../../../styles/designSystem'
import {
  fetchAllProductsWithVariants,
  fetchVariantItemByLabelCode,
  flattenToVariantItems,
} from '../products/api'
import { LabelCodeCameraScanner } from '../products/LabelCodeCameraScanner'
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

interface CreateOrderDraftSnapshot {
  deliveryMethod: DeliveryMethod
  shippingInfo: string
  customerNote: string
  internalNotes: string
  lines: DraftLine[]
  variantSearch: string
  guestNameInput: string
  confirmedGuestName: string | null
  selectedMemberId: string | null
}

interface StoredCreateOrderDraft {
  version: 1
  savedAt: number
  snapshot: CreateOrderDraftSnapshot
}

const CREATE_ORDER_DRAFT_KEY = 'order_edit_dialog_create_draft_v1'
const CREATE_ORDER_DRAFT_TTL_MS = 2 * 60 * 60 * 1000

function saveCreateOrderDraft(snapshot: CreateOrderDraftSnapshot): void {
  try {
    const payload: StoredCreateOrderDraft = {
      version: 1,
      savedAt: Date.now(),
      snapshot,
    }
    window.sessionStorage.setItem(CREATE_ORDER_DRAFT_KEY, JSON.stringify(payload))
  } catch {
    // ignore storage errors
  }
}

function loadCreateOrderDraft(): CreateOrderDraftSnapshot | null {
  try {
    const raw = window.sessionStorage.getItem(CREATE_ORDER_DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredCreateOrderDraft
    if (!parsed || parsed.version !== 1 || !parsed.snapshot) return null
    if (Date.now() - parsed.savedAt > CREATE_ORDER_DRAFT_TTL_MS) {
      window.sessionStorage.removeItem(CREATE_ORDER_DRAFT_KEY)
      return null
    }
    return parsed.snapshot
  } catch {
    return null
  }
}

function clearCreateOrderDraft(): void {
  try {
    window.sessionStorage.removeItem(CREATE_ORDER_DRAFT_KEY)
  } catch {
    // ignore storage errors
  }
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
  const [scanOpen, setScanOpen] = useState(false)
  const [scanBusy, setScanBusy] = useState(false)
  const [scanStatus, setScanStatus] = useState<string | null>(null)

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
      .catch(() => setSaveError('載入商品失敗'))
  }, [open])

  useEffect(() => {
    if (!open) return
    setSaveError(null)
    if (order) {
      clearCreateOrderDraft()
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
      const restored = loadCreateOrderDraft()
      if (restored) {
        setDeliveryMethod(restored.deliveryMethod)
        setShippingInfo(restored.shippingInfo)
        setCustomerNote(restored.customerNote)
        setInternalNotes(restored.internalNotes)
        setLines(restored.lines)
        setVariantSearch(restored.variantSearch)
        setConfirmedGuestName(restored.confirmedGuestName)
        setGuestNameInput(restored.guestNameInput)
        if (restored.selectedMemberId) {
          const m = memberSearch.members.find((x) => x.id === restored.selectedMemberId)
          if (m) {
            memberSearch.selectMember(m)
          } else {
            memberSearch.reset()
          }
        } else {
          memberSearch.reset()
        }
      } else {
        setDeliveryMethod('pickup_es')
        setShippingInfo('')
        setCustomerNote('')
        setInternalNotes('')
        setLines([])
        setVariantSearch('')
        memberSearch.reset()
        setConfirmedGuestName(null)
        setGuestNameInput('')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, order?.id, memberSearch.members])

  useEffect(() => {
    if (!open || order) return
    saveCreateOrderDraft({
      deliveryMethod,
      shippingInfo,
      customerNote,
      internalNotes,
      lines,
      variantSearch,
      guestNameInput,
      confirmedGuestName,
      selectedMemberId: memberSearch.selectedMemberId,
    })
  }, [
    open,
    order,
    deliveryMethod,
    shippingInfo,
    customerNote,
    internalNotes,
    lines,
    variantSearch,
    guestNameInput,
    confirmedGuestName,
    memberSearch.selectedMemberId,
  ])

  useEffect(() => {
    if (!open || order || !prefillVariantId || variants.length === 0) return
    const item = variants.find((v) => v.variant.id === prefillVariantId)
    if (!item) return
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

  const labelCodeVariantMap = useMemo(() => {
    const map = new Map<string, VariantListItem>()
    for (const item of variants) {
      const code = item.variant.label_code?.trim().toUpperCase()
      if (code) map.set(code, item)
    }
    return map
  }, [variants])

  const addOrIncrementVariant = useCallback(
    (item: VariantListItem) => {
      if (locked) return false
      const label = lineLabel(item.product, item.variant)
      let incremented = false
      setLines((prev) => {
        const existing = prev.find((line) => line.variant_id === item.variant.id)
        if (existing) {
          incremented = true
          return prev.map((line) =>
            line.variant_id === item.variant.id ? { ...line, qty: line.qty + 1 } : line,
          )
        }
        return [
          ...prev,
          {
            key: `new-${item.variant.id}-${Date.now()}`,
            variant_id: item.variant.id,
            unit_price: item.variant.price ?? 0,
            qty: 1,
            label,
          },
        ]
      })
      setVariantSearch('')
      return incremented
    },
    [locked],
  )

  const handleLabelCodeScan = useCallback(
    async (labelCode: string) => {
      if (locked || scanBusy) return
      const normalized = labelCode.trim().toUpperCase()
      const localItem = labelCodeVariantMap.get(normalized)
      if (localItem) {
        const incremented = addOrIncrementVariant(localItem)
        const name = lineLabel(localItem.product, localItem.variant)
        const message = incremented ? `已加 1 件：${name}` : `已加入：${name}`
        setScanStatus(message)
        globalToast.success(message)
        return
      }

      setScanBusy(true)
      setScanStatus(`查詢 ${normalized}…`)
      try {
        const item = await fetchVariantItemByLabelCode(normalized)
        if (!item) {
          setScanStatus(`找不到標籤代碼：${normalized}`)
          globalToast.error(`找不到標籤代碼：${normalized}`)
          return
        }
        const incremented = addOrIncrementVariant(item)
        const name = lineLabel(item.product, item.variant)
        const message = incremented ? `已加 1 件：${name}` : `已加入：${name}`
        setScanStatus(message)
        globalToast.success(message)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : '查詢失敗'
        setScanStatus(msg)
        globalToast.error(msg)
      } finally {
        setScanBusy(false)
      }
    },
    [addOrIncrementVariant, labelCodeVariantMap, locked, scanBusy],
  )

  if (!open) return null

  const padX = isMobile ? 16 : 20
  const inputStyle = getInputStyle(isMobile)
  const mutedLabel = {
    fontSize: getFontSize('bodySmall', isMobile),
    color: designSystem.colors.text.secondary,
    marginBottom: 6,
    fontWeight: 500 as const,
  }

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
      setSaveError('請填寫訂購人')
      return
    }
    const payloadLines = lines.filter((l) => l.qty > 0 && l.variant_id)
    if (payloadLines.length === 0) {
      setSaveError('請至少加入一項商品')
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
        globalToast.success('已儲存')
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
        globalToast.success('已建立訂單')
        clearCreateOrderDraft()
      }
      onSaved()
      onClose()
    } catch (e: unknown) {
      const msg = formatSaveError(e)
      setSaveError(msg)
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
      setSaveError('訂單號不符')
      return
    }
    setSaveError(null)
    setSaving(true)
    try {
      await voidShopOrder(order.id, userEmail ?? null)
      globalToast.success('已作廢訂單')
      onSaved()
      onClose()
    } catch (e: unknown) {
      const msg = formatSaveError(e)
      setSaveError(msg)
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
          background: designSystem.colors.background.card,
          width: '100%',
          maxWidth: 640,
          maxHeight: isMobile ? '92vh' : '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: isMobile
            ? `${designSystem.borderRadius.lg} ${designSystem.borderRadius.lg} 0 0`
            : designSystem.borderRadius.lg,
          boxSizing: 'border-box',
          border: `1px solid ${designSystem.colors.border.light}`,
          boxShadow: designSystem.shadows.lg,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            flexShrink: 0,
            padding: `${isMobile ? 'calc(12px + env(safe-area-inset-top, 0px))' : '20px'} ${padX}px 12px`,
            borderBottom: `1px solid ${designSystem.colors.border.light}`,
            background: designSystem.colors.background.card,
          }}
        >
          <h2 style={{
            margin: '0 0 12px',
            fontSize: getFontSize('h3', isMobile),
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: designSystem.colors.text.primary,
          }}>
            {order
              ? isVoided
                ? `查看訂單 ${order.order_no}`
                : `編輯訂單 ${order.order_no}`
              : '新增訂單'}
          </h2>
          {isVoided && order && (
            <p
              style={{
                margin: 0,
                fontSize: getFontSize('bodySmall', isMobile),
                color: designSystem.colors.text.secondary,
                lineHeight: 1.5,
              }}
            >
              此訂單已作廢（{order.cancelled_at ? formatDateTime(order.cancelled_at) : ''}），僅供查閱。
            </p>
          )}
          {!isVoided && locked && (
            <p
              style={{
                margin: 0,
                fontSize: getFontSize('bodySmall', isMobile),
                color: designSystem.colors.warning[700],
                background: designSystem.colors.warning[50],
                borderRadius: designSystem.borderRadius.sm,
                padding: `${designSystem.spacing.sm} ${designSystem.spacing.md}`,
                lineHeight: 1.5,
              }}
            >
              已送結帳或已結清，品項鎖定；僅可改備註。
            </p>
          )}
        </div>

        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: `12px ${padX}px 16px`,
            WebkitOverflowScrolling: 'touch',
          }}
        >
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
            <span style={{ display: 'block', ...mutedLabel, marginBottom: 4 }}>交貨方式</span>
            <select
              value={deliveryMethod}
              disabled={locked}
              onChange={(e) => setDeliveryMethod(e.target.value as DeliveryMethod)}
              style={inputStyle}
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
            style={{ ...inputStyle, marginBottom: 12, resize: 'vertical' as const }}
          />
        )}

        {!locked && (
          <>
            <label style={{ ...getLabelStyle(isMobile), marginBottom: 6 }}>加入商品</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                value={variantSearch}
                onChange={(e) => setVariantSearch(e.target.value)}
                placeholder="搜尋品牌、型號、規格、貨號、標籤代碼"
                style={{
                  ...inputStyle,
                  flex: 1,
                  minWidth: 0,
                }}
              />
              <button
                type="button"
                data-track="product_order_scan_open"
                onClick={() => {
                  setScanStatus(null)
                  setScanOpen(true)
                }}
                style={{
                  ...getButtonStyle('outline', 'medium', isMobile),
                  flexShrink: 0,
                  minHeight: isMobile ? 44 : undefined,
                  whiteSpace: 'nowrap',
                }}
              >
                掃碼
              </button>
            </div>
            {filteredVariants.length > 0 && (
              <div style={{
                border: `1px solid ${designSystem.colors.border.light}`,
                borderRadius: designSystem.borderRadius.md,
                marginBottom: 12,
                maxHeight: 200,
                overflow: 'auto',
              }}>
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
                        borderBottom: `1px solid ${designSystem.colors.border.light}`,
                        background: designSystem.colors.background.card,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{
                        fontSize: getFontSize('body', isMobile),
                        fontWeight: 500,
                        lineHeight: 1.35,
                        color: designSystem.colors.text.primary,
                      }}>
                        {v.product.brand} {v.product.model}
                        {v.product.model_year != null ? ` · ${v.product.model_year}` : ''} ·{' '}
                        {formatAttributes(v.product.category, v.variant.attributes)}
                      </div>
                      {meta && (
                        <div style={{
                          fontSize: getFontSize('caption', isMobile),
                          color: designSystem.colors.text.secondary,
                          marginTop: 3,
                        }}>
                          {meta}
                        </div>
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
                borderRadius: isMobile ? designSystem.borderRadius.md : 0,
                background: isMobile ? designSystem.colors.background.main : 'transparent',
                border: isMobile ? `1px solid ${designSystem.colors.border.light}` : 'none',
                borderBottom:
                  !isMobile && idx < lines.length - 1
                    ? `1px solid ${designSystem.colors.border.light}`
                    : 'none',
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
                <span style={{
                  flex: 1,
                  fontSize: getFontSize('body', isMobile),
                  lineHeight: 1.4,
                  minWidth: 0,
                  color: designSystem.colors.text.primary,
                }}>
                  {line.label}
                </span>
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
                      color: designSystem.colors.danger[700],
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
                  <div style={mutedLabel}>數量</div>
                  <PrimaryNumericInput
                    value={line.qty}
                    min={1}
                    disabled={locked}
                    placeholder="1"
                    onChange={(qty) => {
                      setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, qty } : l)))
                    }}
                    suffix={
                      <span style={{
                        fontSize: getFontSize('body', isMobile),
                        color: designSystem.colors.text.secondary,
                      }}>
                        件
                      </span>
                    }
                  />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={mutedLabel}>單價</div>
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
                      color: designSystem.colors.danger[700],
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
          style={{ ...inputStyle, marginBottom: 8, resize: 'vertical' as const }}
        />
        <textarea
          value={internalNotes}
          onChange={(e) => setInternalNotes(e.target.value)}
          placeholder="店內備註"
          rows={2}
          style={{ ...inputStyle, marginBottom: 0, resize: 'vertical' as const }}
        />
        </div>

        <div
          style={{
            flexShrink: 0,
            background: designSystem.colors.background.card,
            borderTop: `1px solid ${designSystem.colors.border.light}`,
            padding: isMobile
              ? `12px ${padX}px calc(12px + env(safe-area-inset-bottom, 0px))`
              : `16px ${padX}px 20px`,
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
                fontSize: getFontSize('bodySmall', isMobile),
                color: designSystem.colors.danger[700],
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
              ...getButtonStyle('outline', 'medium', isMobile),
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
                ...getButtonStyle('outline', 'medium', isMobile),
                color: designSystem.colors.danger[700],
                borderColor: `${designSystem.colors.danger[500]}88`,
                background: designSystem.colors.background.card,
                minHeight: isMobile ? 44 : undefined,
                opacity: saving ? 0.6 : 1,
                cursor: saving ? 'not-allowed' : 'pointer',
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
                ...getButtonStyle('primary', 'medium', isMobile),
                minHeight: isMobile ? 44 : undefined,
                opacity: saving ? 0.7 : 1,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? '儲存中…' : '儲存'}
            </button>
          )}
        </div>
      </div>

      <LabelCodeCameraScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={handleLabelCodeScan}
        busy={scanBusy}
        statusMessage={scanStatus}
      />
    </div>
  )
}

function formatSaveError(e: unknown): string {
  return shopOrderErrorMessage(e, '儲存失敗')
}

function lineLabel(
  product: { brand: string; model: string; model_year?: number | null; category: string } | undefined,
  variant: { attributes: Record<string, string | number | null>; vendor_code?: string | null } | undefined,
): string {
  if (!product || !variant) return '商品'
  const base = `${product.brand} ${product.model}${product.model_year != null ? ` · ${product.model_year}` : ''} · ${formatAttributes(product.category, variant.attributes)}`
  const code = variant.vendor_code?.trim()
  return code ? `${base} · #${code}` : base
}

/** 選貨下拉第二行：貨號、牌價、可售（扣掉已送結帳保留量，與商品管理列表一致） */
function variantMetaLine(variant: {
  vendor_code?: string | null
  price?: number | null
  stock?: number
  reserved_qty?: number
}): string {
  const parts: string[] = []
  const code = variant.vendor_code?.trim()
  if (code) parts.push(`#${code}`)
  if (variant.price != null && variant.price > 0) {
    parts.push(`$${variant.price.toLocaleString()}`)
  }
  if (typeof variant.stock === 'number') {
    const reserved = variant.reserved_qty ?? 0
    const sellable = Math.max(0, variant.stock - reserved)
    parts.push(reserved > 0 ? `可售 ${sellable} · 留 ${reserved}` : `可售 ${sellable}`)
  }
  return parts.join(' · ')
}
