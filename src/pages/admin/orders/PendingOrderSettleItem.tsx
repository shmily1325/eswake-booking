import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useToast } from '../../../components/ui'
import { useAuthUser } from '../../../contexts/AuthContext'
import { useMemberSearch } from '../../../hooks/useMemberSearch'
import { getButtonStyle, getCardStyle } from '../../../styles/designSystem'
import { formatAttributes } from '../products/schema'
import { settleShopOrder } from './api'
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
        description: buildDefaultSettleDescription(label, order.order_no),
        discountInput: '',
      }
    })
}

export function PendingOrderSettleItem({ order, isMobile, onComplete }: Props) {
  const user = useAuthUser()
  const toast = useToast()
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<OrderPaymentMethod>('balance')
  const [chargeMemberId, setChargeMemberId] = useState<string | null>(order.member_id)
  const [memberBalance, setMemberBalance] = useState<number | null>(null)
  const [globalDiscountInput, setGlobalDiscountInput] = useState('')
  const proxySearch = useMemberSearch()

  const pendingLines = useMemo(() => buildLineStates(order), [order])
  const [lines, setLines] = useState<SettleLineState[]>(pendingLines)

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
  const listTotal = lines.reduce((s, l) => s + listSubtotal(l.qty, l.unit_price), 0)
  const isCashSettlement = paymentMethod === 'cash' || paymentMethod === 'transfer'

  const updateLine = (idx: number, patch: Partial<SettleLineState>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }

  const applyDiscountToLine = (idx: number) => {
    const line = lines[idx]
    const factor = tryParseDiscountFactor(line.discountInput)
    if (factor === null) {
      toast.error('請輸入有效折數，例如 9、85 或 0.9')
      return
    }
    updateLine(idx, {
      line_total: applyDiscountToSubtotal(listSubtotal(line.qty, line.unit_price), factor),
    })
  }

  const applyGlobalDiscount = () => {
    const factor = tryParseDiscountFactor(globalDiscountInput)
    if (factor === null) {
      toast.error('請輸入有效折數，例如 9、85 或 0.9')
      return
    }
    setLines((prev) =>
      prev.map((l) => ({
        ...l,
        line_total: applyDiscountToSubtotal(listSubtotal(l.qty, l.unit_price), factor),
      })),
    )
  }

  const settleLabel =
    paymentMethod === 'cash' ? '現金結清' : paymentMethod === 'transfer' ? '匯款結清' : '確認扣款'

  const handleSettle = async () => {
    if (paymentMethod === 'balance' && !chargeMemberId) {
      toast.error('扣儲值需選擇會員')
      return
    }
    for (const line of lines) {
      if (!line.description.trim()) {
        toast.error('每個品項請填寫入帳說明')
        return
      }
    }

    const confirmMsg = isCashSettlement
      ? `確認${settleLabel} ${order.order_no}？\n總額 ${total.toLocaleString()} 元`
      : `確認扣款 ${order.order_no}？\n共 ${lines.length} 筆、總額 ${total.toLocaleString()} 元`
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
          description: l.description.trim(),
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
            <div style={{ fontSize: 16, fontWeight: 600, color: '#222' }}>
              {expanded ? '▼' : '▶'}{' '}
              {order.contact_name}
              <span style={{ fontWeight: 400, color: '#999', fontSize: 12 }}> · {order.order_no}</span>
            </div>
          </div>
          <div
            style={{
              flexShrink: 0,
              padding: '6px 12px',
              background: '#f3f4f6',
              borderRadius: 8,
              fontSize: isMobile ? 15 : 16,
              fontWeight: 700,
              color: '#111',
              whiteSpace: 'nowrap',
            }}
          >
            ${listTotal.toLocaleString()}
          </div>
        </div>
      </button>

      {expanded && (
        <div style={{ padding: isMobile ? 16 : 20, borderTop: '1px solid #e0e0e0' }}>
          {lines.length > 1 && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                alignItems: 'center',
                marginBottom: 14,
                padding: '10px 12px',
                background: '#f8f9fa',
                borderRadius: 8,
                border: '1px solid #e9ecef',
              }}
            >
              <span style={{ fontSize: 13, color: '#666' }}>全部套用</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="9"
                value={globalDiscountInput}
                onChange={(e) => setGlobalDiscountInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    applyGlobalDiscount()
                  }
                }}
                style={{
                  width: 56,
                  padding: '8px 10px',
                  border: '1px solid #ddd',
                  borderRadius: 8,
                  fontSize: 15,
                  textAlign: 'center',
                  boxSizing: 'border-box',
                }}
              />
              <span style={{ fontSize: 13, color: '#888' }}>折</span>
              <button
                type="button"
                onClick={applyGlobalDiscount}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #ccc',
                  background: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                套用
              </button>
            </div>
          )}

          {lines.map((line, idx) => (
            <SettleLineRow
              key={line.item_id}
              index={idx + 1}
              line={line}
              showBalanceHint={paymentMethod === 'balance'}
              onUpdate={(patch) => updateLine(idx, patch)}
              onApplyDiscount={() => applyDiscountToLine(idx)}
            />
          ))}

          <div
            style={{
              marginBottom: 16,
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

          <div style={{ marginBottom: 16 }}>
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
                      border: active ? '2px solid #2196f3' : '1px solid #ddd',
                      background: active ? '#e3f2fd' : '#fff',
                      color: active ? '#1565c0' : '#444',
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

          {paymentMethod === 'balance' ? (
            <>
              <div
                style={{
                  marginBottom: 16,
                  padding: 12,
                  background: chargeMemberId ? '#fff8e1' : '#f5f5f5',
                  borderRadius: 8,
                  border: chargeMemberId ? '1px solid #ffcc80' : '1px solid #e0e0e0',
                }}
              >
                <input
                  type="text"
                  inputMode="search"
                  value={proxySearch.searchTerm}
                  onChange={(e) => {
                    proxySearch.handleSearchChange(e.target.value)
                    setChargeMemberId(null)
                  }}
                  placeholder="扣款帳戶"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #ddd',
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
                    餘額 ${memberBalance.toLocaleString()}
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={() => void handleSettle()}
                style={{
                  ...getButtonStyle('success', 'medium', isMobile),
                  width: '100%',
                }}
              >
                {loading ? '處理中…' : `✅ ${settleLabel}`}
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleSettle()}
              style={{
                ...getButtonStyle('primary', 'medium', isMobile),
                width: '100%',
              }}
            >
              {loading ? '處理中…' : `✅ ${settleLabel}`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function SettleLineRow({
  index,
  line,
  showBalanceHint,
  onUpdate,
  onApplyDiscount,
}: {
  index: number
  line: SettleLineState
  showBalanceHint: boolean
  onUpdate: (patch: Partial<SettleLineState>) => void
  onApplyDiscount: () => void
}) {
  const [isAmountFocused, setIsAmountFocused] = useState(false)
  const subtotal = listSubtotal(line.qty, line.unit_price)
  const hasDiscount = line.line_total !== subtotal

  return (
    <div
      style={{
        background: index % 2 === 0 ? '#f8fcff' : '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        border: '1px solid #e5e7eb',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          marginBottom: 12,
          paddingBottom: 10,
          borderBottom: '1px solid #eee',
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: '#9ca3af',
            background: '#f3f4f6',
            width: 20,
            height: 20,
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
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4, color: '#222' }}>{line.label}</div>
          <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>× {line.qty}</div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
          marginBottom: showBalanceHint ? 12 : 0,
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: '1 1 160px', minWidth: 0 }}>
          <span style={{ fontSize: 16, color: '#666', fontWeight: 500 }}>$</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={
              isAmountFocused
                ? line.line_total > 0
                  ? String(line.line_total)
                  : ''
                : line.line_total.toLocaleString()
            }
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '')
              onUpdate({ line_total: digits === '' ? 0 : parseInt(digits, 10) })
            }}
            onFocus={() => setIsAmountFocused(true)}
            onBlur={() => setIsAmountFocused(false)}
            style={{
              flex: 1,
              minWidth: 0,
              padding: '12px 14px',
              border: '2px solid #667eea',
              borderRadius: 8,
              fontSize: 18,
              fontWeight: 600,
              background: '#f8f9ff',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <input
            type="text"
            inputMode="decimal"
            placeholder="9"
            value={line.discountInput}
            onChange={(e) => onUpdate({ discountInput: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onApplyDiscount()
              }
            }}
            style={{
              width: 52,
              padding: '8px 10px',
              border: '1px solid #ddd',
              borderRadius: 8,
              fontSize: 15,
              textAlign: 'center',
            }}
          />
          <span style={{ fontSize: 13, color: '#888' }}>折</span>
          <button
            type="button"
            onClick={onApplyDiscount}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid #ccc',
              background: '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            套用
          </button>
        </div>
      </div>
      {hasDiscount && (
        <div style={{ marginBottom: 12, fontSize: 12, color: '#888' }}>
          牌價 ${subtotal.toLocaleString()} → ${line.line_total.toLocaleString()}
        </div>
      )}

      {showBalanceHint && (
        <textarea
          value={line.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="入帳說明"
          style={{
            width: '100%',
            padding: '10px 12px',
            background: '#fff',
            border: '1px solid #e9ecef',
            borderRadius: 8,
            fontSize: 14,
            minHeight: 56,
            resize: 'vertical',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />
      )}
    </div>
  )
}
