import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useToast } from '../../../components/ui'
import { useAuthUser } from '../../../contexts/AuthContext'
import { useMemberSearch } from '../../../hooks/useMemberSearch'
import { getButtonStyle, getCardStyle, getInputStyle } from '../../../styles/designSystem'
import { formatAttributes } from '../products/schema'
import { settleShopOrder } from './api'
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

const PAYMENT_OPTIONS: { value: OrderPaymentMethod; label: string }[] = [
  { value: 'balance', label: '扣儲值' },
  { value: 'transfer', label: '匯款' },
  { value: 'cash', label: '現金' },
]

export function PendingOrderSettleItem({ order, isMobile, onComplete }: Props) {
  const user = useAuthUser()
  const toast = useToast()
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<OrderPaymentMethod>('balance')
  const [chargeMemberId, setChargeMemberId] = useState<string | null>(order.member_id)
  const [memberBalance, setMemberBalance] = useState<number | null>(null)
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
  }, [pendingLines])

  useEffect(() => {
    if (!order.member_id || proxySearch.members.length === 0) return
    const member = proxySearch.members.find((m) => m.id === order.member_id)
    if (member) {
      proxySearch.selectMember(member)
      setChargeMemberId(member.id)
    }
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

  const updateLine = (idx: number, patch: Partial<SettleLineState>) => {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l
        const next = { ...l, ...patch }
        if ('unit_price' in patch || 'qty' in patch) {
          next.line_total = next.qty * next.unit_price
        }
        if ('line_total' in patch && patch.line_total !== undefined) {
          next.line_total = patch.line_total
        }
        return next
      }),
    )
  }

  const settleLabel =
    paymentMethod === 'cash'
      ? '現金結清'
      : paymentMethod === 'transfer'
        ? '匯款結清'
        : '確認扣款'

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
      )
      toast.success(`${settleLabel}完成`)
      onComplete()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '結帳失敗')
    } finally {
      setLoading(false)
    }
  }

  const pendingTotal = pendingLines.reduce((s, l) => s + l.line_total, 0)

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
          fontSize: isMobile ? 14 : 15,
        }}
      >
        <strong>{order.order_no}</strong>
        <span style={{ marginLeft: 10, color: '#444' }}>{order.contact_name}</span>
        <span style={{ marginLeft: 10, color: '#666' }}>{pendingTotal.toLocaleString()} 元</span>
        <span style={{ float: 'right', color: '#666' }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div style={{ padding: isMobile ? 16 : 20 }}>
          {lines.map((line, idx) => (
            <div key={line.item_id} style={{ marginBottom: 12, fontSize: 14 }}>
              <div style={{ marginBottom: 6, fontWeight: 500 }}>{line.label} × {line.qty}</div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  單價
                  <input
                    type="number"
                    min={0}
                    value={line.unit_price}
                    onChange={(e) => updateLine(idx, { unit_price: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                    style={{ ...getInputStyle(isMobile), width: 80 }}
                  />
                </label>
                <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  小計
                  <input
                    type="number"
                    min={0}
                    value={line.line_total}
                    onChange={(e) => updateLine(idx, { line_total: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                    style={{ ...getInputStyle(isMobile), width: 96 }}
                  />
                </label>
              </div>
            </div>
          ))}

          <div style={{ marginBottom: 16, fontWeight: 600, fontSize: isMobile ? 15 : 16 }}>
            合計 {total.toLocaleString()} 元
          </div>

          <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 500, alignSelf: 'center' }}>付款</span>
            {PAYMENT_OPTIONS.map((opt) => (
              <label key={opt.value} style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="radio"
                  name={`pay-${order.id}`}
                  checked={paymentMethod === opt.value}
                  onChange={() => setPaymentMethod(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>

          {isCashSettlement ? (
            <div
              style={{
                padding: 16,
                background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                borderRadius: 12,
                border: '2px solid #bae6fd',
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 600, color: '#0369a1', marginBottom: 4 }}>
                {paymentMethod === 'cash' ? '💵 現金結清' : '🏦 匯款結清'}
              </div>
              <div style={{ fontSize: 13, color: '#075985', marginBottom: 12 }}>
                不扣儲值，僅寫入結帳紀錄（與回報管理相同）。
                {order.member_id ? ` 訂單會員：${order.contact_name}` : ''}
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleSettle()}
                style={{
                  ...getButtonStyle('info', 'medium', isMobile),
                  width: isMobile ? '100%' : undefined,
                }}
              >
                {loading ? '處理中…' : settleLabel}
              </button>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <input
                  type="text"
                  value={proxySearch.searchTerm}
                  onChange={(e) => {
                    proxySearch.handleSearchChange(e.target.value)
                    setChargeMemberId(null)
                  }}
                  placeholder="扣款會員（可代扣，預設訂單會員）"
                  style={{ ...getInputStyle(isMobile), width: '100%', boxSizing: 'border-box' }}
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
                      </button>
                    ))}
                  </div>
                )}
                {memberBalance !== null && (
                  <p style={{ fontSize: 13, color: '#666', margin: '8px 0 0' }}>
                    儲值餘額 {memberBalance.toLocaleString()} 元（不足仍會扣，與回報管理相同）
                  </p>
                )}
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={() => void handleSettle()}
                style={{
                  ...getButtonStyle('success', 'medium', isMobile),
                  width: isMobile ? '100%' : undefined,
                }}
              >
                {loading ? '處理中…' : settleLabel}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
