import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useToast } from '../../../components/ui'
import { DecimalTextInput, MoneyInput } from '../../../components/ui/numericInputs'
import { useAuthUser } from '../../../contexts/AuthContext'
import { useMemberSearch } from '../../../hooks/useMemberSearch'
import { formatAttributes } from '../products/schema'
import { settleShopOrder, shopOrderErrorMessage } from './api'
import {
  applyDiscountToSubtotal,
  buildDefaultSettleDescription,
  listSubtotal,
  tryParseDiscountFactor,
} from './settleUtils'
import type { OrderPaymentMethod, ShopOrderWithItems } from './types'

interface SettleLineState {
  item_id: string
  qty: number
  unit_price: number
  line_total: number
  label: string
  thumb_src: string | null
  description: string
  discountInput: string
}

interface Props {
  order: ShopOrderWithItems
  isMobile: boolean
  onComplete: () => void
}

const PAYMENT_OPTIONS: { value: OrderPaymentMethod; label: string; icon: string }[] = [
  { value: 'balance', label: '扣儲值', icon: '💰' },
  { value: 'transfer', label: '匯款', icon: '🏦' },
  { value: 'cash', label: '現金', icon: '💵' },
]

function buildLineStates(order: ShopOrderWithItems): SettleLineState[] {
  return order.items
    .filter((it) => it.qty_pending_bill > 0)
    .map((it): SettleLineState => {
      const p = it.variant?.product
      const label = p
        ? `${p.brand} ${p.model} · ${formatAttributes(p.category, it.variant!.attributes)}`
        : '商品'
      const qty = it.qty_pending_bill
      const unit_price = it.unit_price
      return {
        item_id: it.id,
        qty,
        unit_price,
        line_total: listSubtotal(qty, unit_price),
        label,
        thumb_src: it.variant.image_url || it.variant.cover_image_url || null,
        description: buildDefaultSettleDescription(label, order.order_no),
        discountInput: '',
      }
    })
}

function memberLabel(m: { nickname: string | null; name: string }) {
  return m.nickname || m.name
}

export function PendingOrderSettleItem({ order, isMobile, onComplete }: Props) {
  const user = useAuthUser()
  const toast = useToast()
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<OrderPaymentMethod>('balance')
  const [chargeMemberId, setChargeMemberId] = useState<string | null>(order.member_id)
  const [chargeMemberName, setChargeMemberName] = useState(order.contact_name)
  const [memberBalance, setMemberBalance] = useState<number | null>(null)
  const [globalDiscountInput, setGlobalDiscountInput] = useState('')
  const [showMemberSearch, setShowMemberSearch] = useState(false)
  const [hasCheckedBillingRelation, setHasCheckedBillingRelation] = useState(false)
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const proxySearch = useMemberSearch()

  const pendingLines = useMemo(() => buildLineStates(order), [order])
  const [lines, setLines] = useState<SettleLineState[]>(pendingLines)

  const isProxyCharge =
    paymentMethod === 'balance' &&
    chargeMemberId != null &&
    (order.member_id == null || chargeMemberId !== order.member_id)

  useEffect(() => {
    setLines(pendingLines)
    setGlobalDiscountInput('')
  }, [pendingLines])

  useEffect(() => {
    if (!order.member_id || proxySearch.members.length === 0) return
    const member = proxySearch.members.find((m) => m.id === order.member_id)
    if (member) {
      proxySearch.selectMember(member)
      setChargeMemberId(member.id)
      setChargeMemberName(memberLabel(member))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.member_id, proxySearch.members])

  useEffect(() => {
    if (!chargeMemberId || paymentMethod !== 'balance') {
      setMemberBalance(null)
      return
    }
    void supabase
      .from('members')
      .select('balance')
      .eq('id', chargeMemberId)
      .single()
      .then(({ data }) => setMemberBalance(data?.balance ?? 0))
  }, [chargeMemberId, paymentMethod])

  useEffect(() => {
    if (!expanded || paymentMethod !== 'balance') {
      if (!expanded) setHasCheckedBillingRelation(false)
      return
    }
    if (hasCheckedBillingRelation) return

    const name = order.contact_name?.trim()
    if (!name) {
      setHasCheckedBillingRelation(true)
      return
    }

    let cancelled = false
    void (async () => {
      setHasCheckedBillingRelation(true)
      try {
        const { data, error } = await supabase
          .from('billing_relations')
          .select('billing_member_id, members:billing_member_id(id, name, nickname)')
          .eq('participant_name', name)
          .maybeSingle()

        if (cancelled || error || !data?.billing_member_id) return
        if (order.member_id && data.billing_member_id === order.member_id) return

        const member = data.members as { id: string; name: string; nickname: string | null } | null
        if (!member) return

        setChargeMemberId(data.billing_member_id)
        setChargeMemberName(memberLabel(member))
        proxySearch.selectMember({ id: member.id, name: member.name, nickname: member.nickname, phone: null })
      } catch {
        /* 無代扣設定時略過 */
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- proxySearch 物件不穩定
  }, [expanded, paymentMethod, hasCheckedBillingRelation, order.contact_name, order.member_id])

  useEffect(() => {
    if (!previewSrc) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewSrc(null)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [previewSrc])

  const total = lines.reduce((s, l) => s + l.line_total, 0)
  const listTotal = lines.reduce((s, l) => s + listSubtotal(l.qty, l.unit_price), 0)
  const updateLine = (idx: number, patch: Partial<SettleLineState>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }

  const applyDiscountToLine = (idx: number) => {
    const line = lines[idx]
    const factor = tryParseDiscountFactor(line.discountInput)
    if (factor === null) {
      toast.error('請填 9 或 85')
      return
    }
    updateLine(idx, {
      line_total: applyDiscountToSubtotal(listSubtotal(line.qty, line.unit_price), factor),
    })
  }

  const applyGlobalDiscount = () => {
    const factor = tryParseDiscountFactor(globalDiscountInput)
    if (factor === null) {
      toast.error('請填 9 或 85')
      return
    }
    setLines((prev) =>
      prev.map((l) => ({
        ...l,
        line_total: applyDiscountToSubtotal(listSubtotal(l.qty, l.unit_price), factor),
      })),
    )
  }

  const resetChargeToOrderMember = () => {
    if (order.member_id) {
      const member = proxySearch.members.find((m) => m.id === order.member_id)
      if (member) {
        proxySearch.selectMember(member)
        setChargeMemberId(member.id)
        setChargeMemberName(memberLabel(member))
        return
      }
    }
    setChargeMemberId(order.member_id)
    setChargeMemberName(order.contact_name)
    setHasCheckedBillingRelation(true)
    proxySearch.reset()
  }

  const selectChargeMember = (m: { id: string; name: string; nickname: string | null; phone: string | null }) => {
    proxySearch.selectMember(m)
    setChargeMemberId(m.id)
    setChargeMemberName(memberLabel(m))
    setShowMemberSearch(false)
    proxySearch.reset()
  }

  const settleLabel =
    paymentMethod === 'cash' ? '現金結清' : paymentMethod === 'transfer' ? '匯款結清' : '確認扣款'

  const handleSettle = async () => {
    if (paymentMethod === 'balance' && !chargeMemberId) {
      toast.error('請選扣款會員')
      return
    }
    for (const line of lines) {
      if (!line.description.trim()) {
        toast.error('請填入帳說明')
        return
      }
    }

    if (isProxyCharge && chargeMemberName) {
      if (!confirm(`由 ${chargeMemberName} 代扣 $${total.toLocaleString()}？`)) return
    } else if (!confirm(`${order.order_no} 結帳 $${total.toLocaleString()}？`)) {
      return
    }

    setLoading(true)
    try {
      await settleShopOrder(
        order.id,
        lines.map((l) => ({
          item_id: l.item_id,
          qty: l.qty,
          unit_price: l.unit_price,
          line_total: l.line_total,
          description: l.description.trim(),
        })),
        paymentMethod,
        paymentMethod === 'balance' ? chargeMemberId : null,
        user?.id,
        null,
        user?.email ?? null,
      )
      toast.success('已結帳')
      onComplete()
    } catch (e: unknown) {
      toast.error(shopOrderErrorMessage(e, '結帳失敗'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        background: 'white',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        border: expanded ? '2px solid #4a90e2' : '1px solid #e0e0e0',
      }}
    >
      <div
        role="button"
        tabIndex={0}
        data-track="product_order_settle_toggle"
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setExpanded((v) => !v)
          }
        }}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          userSelect: 'none',
          gap: 12,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '6px', color: '#222' }}>
            {expanded ? '▼' : '▶'} {order.contact_name}
            <span style={{ fontWeight: 400, color: '#999', fontSize: '12px' }}> · {order.order_no}</span>
          </div>
          <div style={{ fontSize: '13px', color: '#666' }}>
            {lines.length} 品項 · ${listTotal.toLocaleString()}
          </div>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e0e0e0' }}>
          <div style={{ marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {PAYMENT_OPTIONS.map((opt) => {
              const active = paymentMethod === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  data-track={`product_order_settle_payment_${opt.value}`}
                  onClick={() => setPaymentMethod(opt.value)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: active ? '2px solid #4a90e2' : '1px solid #ddd',
                    background: active ? '#e3f2fd' : '#fff',
                    color: active ? '#1565c0' : '#444',
                    fontSize: '13px',
                    fontWeight: active ? 600 : 500,
                    cursor: 'pointer',
                  }}
                >
                  {opt.icon} {opt.label}
                </button>
              )
            })}
          </div>

          {paymentMethod === 'balance' && (
            <div
              style={{
                marginBottom: '16px',
                padding: '12px',
                background: isProxyCharge ? '#fff3e0' : '#f5f5f5',
                borderRadius: '8px',
                border: isProxyCharge ? '2px solid #ffcc80' : '1px solid #e0e0e0',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>扣款帳戶：</div>
                  <div style={{ fontSize: '15px', fontWeight: 600 }}>
                    {isProxyCharge ? (
                      <div>
                        <span style={{ color: '#e65100' }}>
                          🔄 {chargeMemberName}
                          <span style={{ fontSize: '12px', color: '#999', marginLeft: '8px', fontWeight: 400 }}>
                            (代扣 {order.contact_name} 的費用)
                          </span>
                        </span>
                        {memberBalance !== null && (
                          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px', fontWeight: 400 }}>
                            💰 儲值 ${memberBalance.toLocaleString()}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <span>{chargeMemberName || order.contact_name}</span>
                        {memberBalance !== null && (
                          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px', fontWeight: 400 }}>
                            💰 儲值 ${memberBalance.toLocaleString()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {isProxyCharge ? (
                    <button
                      type="button"
                      data-track="product_order_settle_reset_charge"
                      onClick={resetChargeToOrderMember}
                      style={{
                        padding: '6px 12px',
                        background: '#757575',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      ✕ 取消代扣
                    </button>
                  ) : (
                    <button
                      type="button"
                      data-track="product_order_settle_switch_charge"
                      onClick={() => setShowMemberSearch(true)}
                      style={{
                        padding: '6px 12px',
                        background: '#ff9800',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      🔄 切換扣款會員
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {lines.length > 1 && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                alignItems: 'center',
                marginBottom: 14,
                padding: '8px 10px',
                background: '#f8f9fa',
                borderRadius: 8,
                border: '1px solid #e9ecef',
              }}
            >
              <span style={{ fontSize: 13, color: '#333', fontWeight: 500 }}>整單</span>
              <DecimalTextInput
                compact
                value={globalDiscountInput}
                onChange={setGlobalDiscountInput}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    applyGlobalDiscount()
                  }
                }}
              />
              <span style={{ fontSize: 12, color: '#888' }}>折</span>
              <button
                type="button"
                data-track="product_order_settle_apply_discount"
                onClick={applyGlobalDiscount}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid #90caf9',
                  background: '#e3f2fd',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#1565c0',
                  cursor: 'pointer',
                }}
              >
                套用
              </button>
            </div>
          )}

          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>結帳品項：</div>

          {lines.map((line, idx) => (
            <SettleLineRow
              key={line.item_id}
              index={idx + 1}
              line={line}
              isMobile={isMobile}
              showDescription={paymentMethod === 'balance'}
              onUpdate={(patch) => updateLine(idx, patch)}
              onApplyDiscount={() => applyDiscountToLine(idx)}
              onOpenPreview={(src) => setPreviewSrc(src)}
            />
          ))}

          <div
            style={{
              paddingTop: '16px',
              marginTop: '16px',
              borderTop: '2px solid #e0e0e0',
            }}
          >
            <div
              style={{
                marginBottom: 12,
                padding: '12px 14px',
                background: '#f8f9fa',
                borderRadius: 10,
                border: '1px solid #e9ecef',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: '#444' }}>合計</span>
              <div style={{ textAlign: 'right' }}>
                {listTotal !== total && (
                  <div style={{ fontSize: 12, color: '#888', textDecoration: 'line-through' }}>
                    ${listTotal.toLocaleString()}
                  </div>
                )}
                <div style={{ fontSize: isMobile ? 20 : 22, fontWeight: 700, color: '#111' }}>
                  ${total.toLocaleString()}
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={loading || (paymentMethod === 'balance' && !chargeMemberId)}
              data-track="product_order_settle_confirm"
              onClick={() => void handleSettle()}
              style={{
                width: '100%',
                padding: '10px',
                background:
                  paymentMethod === 'balance'
                    ? isProxyCharge
                      ? '#ff9800'
                      : '#4CAF50'
                    : '#0284c7',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontWeight: 600,
                fontSize: '14px',
                cursor: loading || (paymentMethod === 'balance' && !chargeMemberId) ? 'not-allowed' : 'pointer',
                opacity: loading || (paymentMethod === 'balance' && !chargeMemberId) ? 0.6 : 1,
              }}
            >
              {loading
                ? '處理中…'
                : isProxyCharge && chargeMemberName
                  ? `✅ ${settleLabel}（${chargeMemberName}）`
                  : `✅ ${settleLabel}`}
            </button>
          </div>
        </div>
      )}

      {previewSrc && (
        <div
          role="presentation"
          onClick={() => setPreviewSrc(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            background: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            boxSizing: 'border-box',
            cursor: 'pointer',
          }}
        >
          <img
            src={previewSrc}
            alt=""
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        </div>
      )}

      {showMemberSearch && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => {
            setShowMemberSearch(false)
            proxySearch.reset()
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              maxWidth: '400px',
              width: '100%',
              maxHeight: '80vh',
              overflow: 'hidden',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '16px',
                borderBottom: '1px solid #e0e0e0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '16px' }}>🔄 選擇代扣會員</h3>
              <button
                type="button"
                onClick={() => {
                  setShowMemberSearch(false)
                  proxySearch.reset()
                }}
                style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer', color: '#666' }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: '12px 16px', background: '#fff3e0', fontSize: '13px', color: '#e65100' }}>
              從所選會員扣款，訂單仍記在 {order.contact_name} 名下。
            </div>
            <div style={{ padding: '16px' }}>
              <input
                type="text"
                value={proxySearch.searchTerm}
                onChange={(e) => proxySearch.handleSearchChange(e.target.value)}
                placeholder="搜尋會員姓名、暱稱或電話…"
                autoFocus
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ maxHeight: '300px', overflowY: 'auto', borderTop: '1px solid #eee' }}>
              {proxySearch.filteredMembers.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#999', fontSize: '14px' }}>
                  {proxySearch.searchTerm.trim() ? '找不到會員' : '輸入關鍵字搜尋'}
                </div>
              ) : (
                proxySearch.filteredMembers.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    data-track="product_order_settle_pick_member"
                    onClick={() => selectChargeMember(m)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '14px 16px',
                      border: 'none',
                      borderBottom: '1px solid #f0f0f0',
                      background: 'white',
                      cursor: 'pointer',
                      fontSize: '15px',
                    }}
                  >
                    {memberLabel(m)}
                    {m.phone ? <span style={{ color: '#999', marginLeft: 8 }}>{m.phone}</span> : null}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SettleLineRow({
  index,
  line,
  isMobile,
  showDescription,
  onUpdate,
  onApplyDiscount,
  onOpenPreview,
}: {
  index: number
  line: SettleLineState
  isMobile: boolean
  showDescription: boolean
  onUpdate: (patch: Partial<SettleLineState>) => void
  onApplyDiscount: () => void
  onOpenPreview: (src: string) => void
}) {
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const subtotal = listSubtotal(line.qty, line.unit_price)
  const hasDiscount = line.line_total !== subtotal

  return (
    <div
      style={{
        background: index % 2 === 0 ? 'linear-gradient(to bottom, #f8fcff, #f0f8ff)' : 'linear-gradient(to bottom, #ffffff, #f8f9fa)',
        borderRadius: '12px',
        padding: '14px',
        marginBottom: '10px',
        border: index % 2 === 0 ? '2px solid #bae6fd' : '2px solid #e0e0e0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          marginBottom: '10px',
          paddingBottom: '8px',
          borderBottom: '1px solid #e8ecef',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontWeight: 500,
            color: '#9ca3af',
            background: '#f3f4f6',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {index}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 600, lineHeight: 1.4, color: '#222' }}>{line.label}</div>
          <div style={{ fontSize: '13px', color: '#666', marginTop: 2 }}>× {line.qty}</div>
        </div>
        {!isMobile && line.thumb_src && (
          <button
            type="button"
            data-track="product_order_settle_image_preview"
            onClick={() => onOpenPreview(line.thumb_src!)}
            style={{
              width: 34,
              height: 46,
              border: '1px solid #ddd',
              borderRadius: 6,
              background: '#f6f6f7',
              overflow: 'hidden',
              padding: 0,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <img
              src={line.thumb_src}
              alt=""
              loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </button>
        )}
      </div>

      <div style={{ marginBottom: showDescription ? '12px' : 0 }}>
        <div style={{ fontSize: '13px', color: '#7f8c8d', marginBottom: '8px', fontWeight: 500 }}>扣款金額：</div>
        <MoneyInput
          value={line.line_total}
          onChange={(line_total) => onUpdate({ line_total })}
        />
        <div
          style={{
            marginTop: '8px',
            fontSize: '13px',
            color: '#666',
            background: '#f5f5f5',
            padding: '8px 12px',
            borderRadius: '6px',
            lineHeight: 1.5,
          }}
        >
          <div>
            📝 ${line.unit_price.toLocaleString()} × {line.qty} = <strong>${subtotal.toLocaleString()}</strong>
            {hasDiscount && (
              <>
                {' '}
                → 折後 <strong>${line.line_total.toLocaleString()}</strong>
              </>
            )}
          </div>
          <div
            style={{
              marginTop: '8px',
              paddingTop: '8px',
              borderTop: '1px dashed #ddd',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <DecimalTextInput
              compact
              value={line.discountInput}
              onChange={(v) => onUpdate({ discountInput: v })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  onApplyDiscount()
                }
              }}
            />
            <span style={{ fontSize: 12, color: '#888' }}>折</span>
            <button
              type="button"
              data-track="product_order_settle_line_discount"
              onClick={onApplyDiscount}
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid #90caf9',
                background: '#e3f2fd',
                fontSize: 12,
                fontWeight: 600,
                color: '#1565c0',
                cursor: 'pointer',
              }}
            >
              套用
            </button>
          </div>
        </div>
      </div>

      {showDescription && (
        <div style={{ marginBottom: 0 }}>
          <div
            style={{
              fontSize: '13px',
              color: '#7f8c8d',
              marginBottom: '8px',
              fontWeight: 500,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>說明：</span>
            <button
              type="button"
              data-track="product_order_settle_edit_description"
              onClick={() => setIsEditingDescription((v) => !v)}
              style={{
                padding: '4px 10px',
                background: 'none',
                border: '1px solid #e0e0e0',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#666',
                cursor: 'pointer',
              }}
            >
              {isEditingDescription ? '收起' : '✏️ 編輯'}
            </button>
          </div>
          {isEditingDescription ? (
            <textarea
              value={line.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="輸入說明…"
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'white',
                border: '2px solid #e9ecef',
                borderRadius: '8px',
                fontSize: '14px',
                minHeight: 56,
                resize: 'vertical',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          ) : (
            <div
              style={{
                padding: '10px 12px',
                background: '#f8f9fa',
                border: '1px solid #e9ecef',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#495057',
                lineHeight: 1.45,
              }}
            >
              {line.description}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
