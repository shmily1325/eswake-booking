import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useToast } from '../../../components/ui'
import { useAuthUser } from '../../../contexts/AuthContext'
import { useMemberSearch } from '../../../hooks/useMemberSearch'
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
  onComplete: () => void
}

const PAYMENT_OPTIONS: { value: OrderPaymentMethod; label: string }[] = [
  { value: 'balance', label: '扣儲值' },
  { value: 'transfer', label: '匯款' },
  { value: 'cash', label: '現金' },
]

export function PendingOrderSettleItem({ order, onComplete }: Props) {
  const user = useAuthUser()
  const toast = useToast()
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<OrderPaymentMethod>('balance')
  const [chargeMemberId, setChargeMemberId] = useState<string | null>(order.member_id)
  const [memberBalance, setMemberBalance] = useState<number | null>(null)
  const proxySearch = useMemberSearch()

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
    if (!chargeMemberId) {
      setMemberBalance(null)
      return
    }
    void supabase
      .from('members')
      .select('balance')
      .eq('id', chargeMemberId)
      .single()
      .then(({ data }) => setMemberBalance(data?.balance ?? 0))
  }, [chargeMemberId])

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

  const handleSettle = async () => {
    if (paymentMethod === 'balance' && !chargeMemberId) {
      toast.error('扣儲值需選擇會員')
      return
    }
    if (!confirm(`確認結帳 ${order.order_no}？\n總額 ${total.toLocaleString()} 元`)) return

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
      toast.success('已結帳')
      onComplete()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '結帳失敗')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ background: '#fff', borderRadius: 12, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: 16,
          border: 'none',
          background: '#fafafa',
          cursor: 'pointer',
        }}
      >
        <strong>{order.order_no}</strong>
        <span style={{ marginLeft: 10 }}>{order.contact_name}</span>
        <span style={{ float: 'right', color: '#666' }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div style={{ padding: 16 }}>
          {lines.map((line, idx) => (
            <div key={line.item_id} style={{ marginBottom: 10, fontSize: 14 }}>
              <div style={{ marginBottom: 4 }}>{line.label} × {line.qty}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ fontSize: 13 }}>
                  單價
                  <input
                    type="number"
                    min={0}
                    value={line.unit_price}
                    onChange={(e) => updateLine(idx, { unit_price: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                    style={{ width: 72, marginLeft: 4, padding: 4, borderRadius: 4, border: '1px solid #ccc' }}
                  />
                </label>
                <label style={{ fontSize: 13 }}>
                  小計
                  <input
                    type="number"
                    min={0}
                    value={line.line_total}
                    onChange={(e) => updateLine(idx, { line_total: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                    style={{ width: 80, marginLeft: 4, padding: 4, borderRadius: 4, border: '1px solid #ccc' }}
                  />
                </label>
              </div>
            </div>
          ))}

          <div style={{ marginBottom: 12, fontWeight: 600 }}>合計 {total.toLocaleString()} 元</div>

          <div style={{ marginBottom: 12 }}>
            <span style={{ marginRight: 8 }}>付款</span>
            {PAYMENT_OPTIONS.map((opt) => (
              <label key={opt.value} style={{ marginRight: 12, fontSize: 14 }}>
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

          {paymentMethod === 'balance' && (
            <div style={{ marginBottom: 12 }}>
              <input
                type="text"
                value={proxySearch.searchTerm}
                onChange={(e) => proxySearch.handleSearchChange(e.target.value)}
                placeholder="扣款會員（可代扣）"
                style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ccc', boxSizing: 'border-box' }}
              />
              {proxySearch.showDropdown && proxySearch.filteredMembers.length > 0 && (
                <div style={{ border: '1px solid #ddd', borderRadius: 8, marginTop: 4, background: '#fff' }}>
                  {proxySearch.filteredMembers.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        proxySearch.selectMember(m)
                        setChargeMemberId(m.id)
                      }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: 8, border: 'none', background: 'transparent', cursor: 'pointer' }}
                    >
                      {m.nickname || m.name}
                    </button>
                  ))}
                </div>
              )}
              {memberBalance !== null && (
                <p style={{ fontSize: 13, color: '#666', margin: '6px 0 0' }}>儲值餘額 {memberBalance.toLocaleString()} 元</p>
              )}
            </div>
          )}

          <button
            type="button"
            disabled={loading}
            onClick={() => void handleSettle()}
            style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer' }}
          >
            {loading ? '處理中…' : '確認結帳'}
          </button>
        </div>
      )}
    </div>
  )
}
