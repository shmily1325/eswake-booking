import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../../lib/supabase'
import { useToast } from '../../../components/ui'
import { useAuthUser } from '../../../contexts/AuthContext'
import { useMemberSearch } from '../../../hooks/useMemberSearch'
import { getButtonStyle, getCardStyle } from '../../../styles/designSystem'
import { formatAttributes } from '../products/schema'
import { settleShopOrder } from './api'
import { formatDiscountLabel, parseDiscountFactor } from './orderUtils'
import type { OrderPaymentMethod, ShopOrderWithItems } from './types'

interface SettleLineState {
  item_id: string
  qty: number
  unit_price: number
  line_total: number
  label: string
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

const MONEY_INPUT_MAX_WIDTH = 280

const moneyInputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  maxWidth: MONEY_INPUT_MAX_WIDTH,
  width: '100%',
  padding: '10px 12px',
  border: '2px solid #667eea',
  borderRadius: 8,
  fontSize: 16,
  fontWeight: 600,
  background: '#f8f9ff',
  boxSizing: 'border-box',
  outline: 'none',
}

function MoneyInput({
  value,
  fieldKey,
  focusedField,
  onFocus,
  onBlur,
  onChange,
  placeholder = '0',
}: {
  value: number
  fieldKey: string
  focusedField: string | null
  onFocus: () => void
  onBlur: () => void
  onChange: (next: number) => void
  placeholder?: string
}) {
  const focused = focusedField === fieldKey
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        maxWidth: MONEY_INPUT_MAX_WIDTH,
        width: '100%',
      }}
    >
      <span style={{ fontSize: 16, color: '#666', fontWeight: 500, flexShrink: 0 }}>$</span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder={placeholder}
        value={focused ? (value > 0 ? String(value) : '') : value.toLocaleString()}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '')
          onChange(digits === '' ? 0 : parseInt(digits, 10))
        }}
        onFocus={onFocus}
        onBlur={onBlur}
        style={moneyInputStyle}
      />
    </div>
  )
}

export function PendingOrderSettleItem({ order, isMobile, onComplete }: Props) {
  const user = useAuthUser()
  const toast = useToast()
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<OrderPaymentMethod>('balance')
  const [chargeMemberId, setChargeMemberId] = useState<string | null>(order.member_id)
  const [memberBalance, setMemberBalance] = useState<number | null>(null)
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [discountInput, setDiscountInput] = useState('')
  const [appliedFactor, setAppliedFactor] = useState<number | null>(null)
  const proxySearch = useMemberSearch()

  const isCashSettlement = paymentMethod === 'cash' || paymentMethod === 'transfer'

  const pendingLines = useMemo(() => {
    return order.items
      .filter((it) => it.qty_pending_bill > 0)
      .map((it): SettleLineState => {
        const p = it.variant?.product
        const label = p
          ? `${p.brand} ${p.model} · ${formatAttributes(p.category, it.variant.attributes)}`
          : '商品'
        const qty = it.qty_pending_bill
        const unit_price = it.unit_price
        return {
          item_id: it.id,
          qty,
          unit_price,
          line_total: qty * unit_price,
          label,
        }
      })
  }, [order.items])

  const [lines, setLines] = useState<SettleLineState[]>(pendingLines)

  useEffect(() => {
    setLines(pendingLines)
    setDiscountInput('')
    setAppliedFactor(null)
  }, [pendingLines])

  useEffect(() => {
    if (!order.member_id || proxySearch.members.length === 0) return
    const member = proxySearch.members.find((m) => m.id === order.member_id)
    if (member) {
      proxySearch.selectMember(member)
      setChargeMemberId(member.id)
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

  const total = lines.reduce((s, l) => s + l.line_total, 0)
  const pendingTotal = pendingLines.reduce((s, l) => s + l.line_total, 0)
  const subtotalAtListPrice = lines.reduce((s, l) => s + l.qty * l.unit_price, 0)
  const hasLineDiscount = lines.some((l) => l.line_total !== l.qty * l.unit_price)

  const applyDiscountToAll = () => {
    const factor = parseDiscountFactor(discountInput)
    if (factor === null) {
      toast.error('請輸入有效折數，例如 9、85 或 0.9')
      return
    }
    setAppliedFactor(factor)
    setLines((prev) =>
      prev.map((l) => ({
        ...l,
        line_total: Math.round(l.qty * l.unit_price * factor),
      })),
    )
  }

  const updateLine = (idx: number, patch: Partial<SettleLineState>, opts?: { fromLineTotal?: boolean }) => {
    if ('unit_price' in patch || 'qty' in patch || 'line_total' in patch) {
      setAppliedFactor(null)
    }
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l
        const next = { ...l, ...patch }
        if (opts?.fromLineTotal) {
          return next
        }
        if ('unit_price' in patch || 'qty' in patch) {
          next.line_total = next.qty * next.unit_price
        }
        return next
      }),
    )
  }

  const settleLabel =
    paymentMethod === 'cash' ? '現金結清' : paymentMethod === 'transfer' ? '匯款結清' : '確認扣款'

  const handleSettle = async () => {
    if (paymentMethod === 'balance' && !chargeMemberId) {
      toast.error('扣儲值需選擇會員')
      return
    }

    const confirmMsg = isCashSettlement
      ? `確認${settleLabel} ${order.order_no}？\n總額 ${total.toLocaleString()} 元`
      : `確認扣款 ${order.order_no}？\n總額 ${total.toLocaleString()} 元`
    if (!confirm(confirmMsg)) return

    setLoading(true)
    try {
      await settleShopOrder(
        order.id,
        lines.map((l) => ({
          item_id: l.item_id,
          qty: l.qty,
          unit_price: l.unit_price,
          line_total: l.line_total,
        })),
        paymentMethod,
        paymentMethod === 'balance' ? chargeMemberId : null,
        user?.id,
        null,
        user?.email ?? null,
      )
      toast.success(`${settleLabel}完成`)
      onComplete()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '結帳失敗')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ ...getCardStyle(isMobile), marginBottom: 16, padding: 0, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: isMobile ? '14px 16px' : '16px 20px',
          border: 'none',
          background: '#fafafa',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: isMobile ? 15 : 16, fontWeight: 600, marginBottom: 4 }}>
              {expanded ? '▼' : '▶'} {order.order_no} · {order.contact_name}
            </div>
            <div style={{ fontSize: 13, color: '#666' }}>
              {lines.length} 品項待結帳
            </div>
          </div>
          <div
            style={{
              flexShrink: 0,
              padding: '6px 12px',
              background: '#eef2ff',
              borderRadius: 8,
              fontSize: isMobile ? 15 : 16,
              fontWeight: 700,
              color: '#4338ca',
              whiteSpace: 'nowrap',
            }}
          >
            ${pendingTotal.toLocaleString()}
          </div>
        </div>
      </button>

      {expanded && (
        <div style={{ padding: isMobile ? 16 : 20, borderTop: '1px solid #e0e0e0', maxWidth: 720 }}>
          {lines.map((line, idx) => (
            <div
              key={line.item_id}
              style={{
                marginBottom: 16,
                padding: 14,
                background: '#f9fafb',
                borderRadius: 10,
                border: '1px solid #e5e7eb',
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, lineHeight: 1.4 }}>
                {line.label}
                <span style={{ marginLeft: 8, color: '#666', fontWeight: 500 }}>× {line.qty}</span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                  gap: 12,
                  alignItems: 'start',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, color: '#7f8c8d', marginBottom: 6, fontWeight: 500 }}>單價</div>
                  <MoneyInput
                    value={line.unit_price}
                    fieldKey={`${line.item_id}-unit`}
                    focusedField={focusedField}
                    onFocus={() => setFocusedField(`${line.item_id}-unit`)}
                    onBlur={() => setFocusedField(null)}
                    onChange={(unit_price) => updateLine(idx, { unit_price })}
                  />
                </div>

                <div>
                  <div style={{ fontSize: 13, color: '#7f8c8d', marginBottom: 6, fontWeight: 500 }}>
                    小計（可改折扣）
                  </div>
                  <MoneyInput
                    value={line.line_total}
                    fieldKey={`${line.item_id}-total`}
                    focusedField={focusedField}
                    onFocus={() => setFocusedField(`${line.item_id}-total`)}
                    onBlur={() => setFocusedField(null)}
                    onChange={(line_total) => updateLine(idx, { line_total }, { fromLineTotal: true })}
                  />
                  {line.qty * line.unit_price !== line.line_total && (
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 12,
                        color: '#666',
                        background: '#f5f5f5',
                        padding: '6px 10px',
                        borderRadius: 6,
                      }}
                    >
                      原價 ${(line.qty * line.unit_price).toLocaleString()} → 折後 $
                      {line.line_total.toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          <div
            style={{
              marginBottom: 16,
              padding: 14,
              background: 'linear-gradient(135deg, #f8f9ff 0%, #eef2ff 100%)',
              borderRadius: 10,
              border: '2px solid #c7d2fe',
            }}
          >
            <div style={{ fontSize: 13, color: '#7f8c8d', marginBottom: 8, fontWeight: 500 }}>整單折數</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                inputMode="decimal"
                placeholder="例：9、85"
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    applyDiscountToAll()
                  }
                }}
                style={{
                  width: isMobile ? '100%' : 120,
                  maxWidth: '100%',
                  padding: '10px 12px',
                  border: '2px solid #667eea',
                  borderRadius: 8,
                  fontSize: 16,
                  fontWeight: 600,
                  background: '#fff',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
              <span style={{ fontSize: 15, color: '#666', fontWeight: 500, flexShrink: 0 }}>折</span>
              <button
                type="button"
                onClick={applyDiscountToAll}
                style={{
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'linear-gradient(135deg, #667eea 0%, #5a67d8 100%)',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                套用
              </button>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
              9＝九折、85＝八五折；各品項小計依牌價×數量×折數（四捨五入）
            </div>
            {(appliedFactor !== null || hasLineDiscount) && subtotalAtListPrice !== total && (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 13,
                  color: '#4338ca',
                  background: '#fff',
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #c7d2fe',
                }}
              >
                {appliedFactor !== null && (
                  <span style={{ fontWeight: 600, marginRight: 8 }}>{formatDiscountLabel(appliedFactor)}</span>
                )}
                原價 ${subtotalAtListPrice.toLocaleString()} → 折後 ${total.toLocaleString()}
              </div>
            )}
          </div>

          <div
            style={{
              marginBottom: 16,
              padding: '14px 16px',
              background: 'linear-gradient(135deg, #f8f9ff 0%, #eef2ff 100%)',
              borderRadius: 10,
              border: '2px solid #c7d2fe',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 600, color: '#4338ca' }}>合計</span>
            <span style={{ fontSize: isMobile ? 20 : 22, fontWeight: 700, color: '#312e81' }}>
              ${total.toLocaleString()}
            </span>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: '#7f8c8d', marginBottom: 8, fontWeight: 500 }}>付款方式</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {PAYMENT_OPTIONS.map((opt) => {
                const active = paymentMethod === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPaymentMethod(opt.value)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: active ? '2px solid #667eea' : '1px solid #ddd',
                      background: active ? '#eef2ff' : '#fff',
                      color: active ? '#4338ca' : '#444',
                      fontSize: 14,
                      fontWeight: active ? 600 : 500,
                      cursor: 'pointer',
                    }}
                  >
                    {opt.icon} {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {isCashSettlement ? (
            <div
              style={{
                padding: 16,
                background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                borderRadius: 12,
                border: '2px solid #bae6fd',
                marginBottom: 16,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#0369a1', marginBottom: 4 }}>
                  {paymentMethod === 'cash' ? '💵 現金結清' : '🏦 匯款結清'}
                </div>
                <div style={{ fontSize: 13, color: '#075985' }}>
                  不扣儲值，僅寫入結帳紀錄
                </div>
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleSettle()}
                style={{
                  padding: '10px 20px',
                  background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                  border: 'none',
                  borderRadius: 8,
                  color: 'white',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {loading ? '處理中…' : `✅ ${settleLabel}`}
              </button>
            </div>
          ) : (
            <>
              <div
                style={{
                  marginBottom: 16,
                  padding: 12,
                  background: chargeMemberId ? '#fff3e0' : '#f5f5f5',
                  borderRadius: 8,
                  border: chargeMemberId ? '2px solid #ffcc80' : '1px solid #e0e0e0',
                }}
              >
                <div style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>扣款帳戶</div>
                <input
                  type="text"
                  inputMode="search"
                  value={proxySearch.searchTerm}
                  onChange={(e) => {
                    proxySearch.handleSearchChange(e.target.value)
                    setChargeMemberId(null)
                  }}
                  placeholder="搜尋會員或代扣對象"
                  style={{
                    width: '100%',
                    maxWidth: 360,
                    padding: '10px 12px',
                    border: '2px solid #e0e0e0',
                    borderRadius: 8,
                    fontSize: 15,
                    boxSizing: 'border-box',
                  }}
                />
                {proxySearch.showDropdown && proxySearch.filteredMembers.length > 0 && (
                  <div
                    style={{
                      border: '1px solid #ddd',
                      borderRadius: 8,
                      marginTop: 4,
                      background: '#fff',
                      maxHeight: 200,
                      overflowY: 'auto',
                    }}
                  >
                    {proxySearch.filteredMembers.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          proxySearch.selectMember(m)
                          setChargeMemberId(m.id)
                        }}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          padding: '10px 12px',
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          fontSize: 14,
                        }}
                      >
                        {m.nickname || m.name}
                        {m.phone ? ` · ${m.phone}` : ''}
                      </button>
                    ))}
                  </div>
                )}
                {memberBalance !== null && (
                  <div style={{ fontSize: 13, color: '#666', marginTop: 8 }}>
                    💰 儲值餘額 ${memberBalance.toLocaleString()}（不足仍會扣，與回報管理相同）
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={() => void handleSettle()}
                style={{
                  ...getButtonStyle('success', 'medium', isMobile),
                  width: isMobile ? '100%' : undefined,
                  background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                  border: 'none',
                }}
              >
                {loading ? '處理中…' : `✅ ${settleLabel}`}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
