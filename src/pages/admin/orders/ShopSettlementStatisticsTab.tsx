import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DateRangePicker } from '../../../components/DateRangePicker'
import { useToast } from '../../../components/ui'
import { formatCurrency, formatDateTime, extractDate, extractTime } from '../../../utils/formatters'
import { supabase } from '../../../lib/supabase'
import { fetchSettlementsInRange } from './api'
import { formatSettlementLineDisplay, type SettlementLineDisplay } from './settleUtils'
import type { OrderPaymentMethod, ShopOrderSettlementWithDetails } from './types'
import { PAYMENT_METHOD_LABELS } from './types'

interface Props {
  isMobile: boolean
}

const PAYMENT_METHODS: OrderPaymentMethod[] = ['balance', 'transfer', 'cash']

function dateRangeFromSelection(selectedDate: string): { start: string; end: string } {
  if (selectedDate.length === 10) {
    return { start: selectedDate, end: selectedDate }
  }
  const [year, month] = selectedDate.split('-')
  const lastDay = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate()
  return {
    start: `${year}-${month}-01`,
    end: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
  }
}

export function ShopSettlementStatisticsTab({ isMobile }: Props) {
  const toast = useToast()
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [loading, setLoading] = useState(false)
  const [settlements, setSettlements] = useState<ShopOrderSettlementWithDetails[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [paymentFilter, setPaymentFilter] = useState<OrderPaymentMethod | 'all'>('all')
  const [variantDisplay, setVariantDisplay] = useState<Record<string, SettlementLineDisplay>>({})

  useEffect(() => {
    setSettlements([])
    void loadData()
  }, [selectedDate])

  const loadData = async () => {
    if (!selectedDate) return
    setLoading(true)
    try {
      const { start, end } = dateRangeFromSelection(selectedDate)
      const rows = await fetchSettlementsInRange(start, end)
      setSettlements(rows)
      const variantIds = [
        ...new Set(rows.flatMap((r) => r.items_snapshot.map((l) => l.variant_id))),
      ]
      if (variantIds.length > 0) {
        const { data: variants, error: variantErr } = await supabase
          .from('product_variants')
          .select(
            'id, vendor_code, attributes, product:products(brand, model, category)',
          )
          .in('id', variantIds)
        if (variantErr) throw variantErr
        const labels: Record<string, SettlementLineDisplay> = {}
        variants?.forEach((v) => {
          const row = v as {
            id: string
            vendor_code: string | null
            attributes: Record<string, unknown> | null
            product: { brand: string; model: string; category: string } | null
          }
          labels[row.id] = formatSettlementLineDisplay(
            { item_id: '', variant_id: row.id, qty: 0, unit_price: 0, line_total: 0 },
            row,
          )
        })
        setVariantDisplay(labels)
      } else {
        setVariantDisplay({})
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '載入失敗'
      toast.error(msg)
      setSettlements([])
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    if (paymentFilter === 'all') return settlements
    return settlements.filter((s) => s.payment_method === paymentFilter)
  }, [settlements, paymentFilter])

  const summary = useMemo(() => {
    const byMethod: Record<OrderPaymentMethod, { count: number; total: number }> = {
      balance: { count: 0, total: 0 },
      transfer: { count: 0, total: 0 },
      cash: { count: 0, total: 0 },
    }
    let grandTotal = 0
    for (const s of filtered) {
      grandTotal += s.amount_total
      byMethod[s.payment_method].count += 1
      byMethod[s.payment_method].total += s.amount_total
    }
    return { count: filtered.length, grandTotal, byMethod }
  }, [filtered])

  const periodHint =
    selectedDate.length === 10 ? `查詢日：${selectedDate}` : `查詢月：${selectedDate}`

  return (
    <div>
      <div
        style={{
          background: 'white',
          borderRadius: 12,
          padding: isMobile ? 20 : 24,
          marginBottom: 24,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        <DateRangePicker
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          isMobile={isMobile}
          showTodayButton={!isMobile}
          label="查詢期間"
          simplified
        />
        <div style={{ marginTop: 16 }}>
          <label
            style={{
              display: 'block',
              marginBottom: 8,
              fontWeight: 600,
              fontSize: 15,
              color: '#333',
            }}
          >
            付款方式
          </label>
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as OrderPaymentMethod | 'all')}
            style={{
              width: '100%',
              maxWidth: isMobile ? '100%' : 280,
              padding: '12px 14px',
              border: '2px solid #e0e0e0',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              background: 'white',
            }}
          >
            <option value="all">全部方式</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </select>
        </div>
        <p style={{ margin: '12px 0 0', fontSize: 13, color: '#888' }}>{periodHint}</p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>載入中…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
          {selectedDate.length === 10 ? '當日無結帳紀錄' : '當月無結帳紀錄'}
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
              gap: 12,
              marginBottom: 24,
            }}
          >
            <SummaryCard
              label="結帳筆數"
              value={String(summary.count)}
              sub="筆"
              accent="#ffb74d"
              isMobile={isMobile}
            />
            <SummaryCard
              label="結帳總額"
              value={formatCurrency(summary.grandTotal, false)}
              sub="元"
              accent="#90caf9"
              isMobile={isMobile}
            />
            <SummaryCard
              label="扣儲值"
              value={formatCurrency(summary.byMethod.balance.total, false)}
              sub={`${summary.byMethod.balance.count} 筆`}
              accent="#7e57c2"
              isMobile={isMobile}
            />
            <SummaryCard
              label="匯款＋現金"
              value={formatCurrency(
                summary.byMethod.transfer.total + summary.byMethod.cash.total,
                false,
              )}
              sub={`${summary.byMethod.transfer.count + summary.byMethod.cash.count} 筆`}
              accent="#66bb6a"
              isMobile={isMobile}
            />
          </div>

          <h2
            style={{
              margin: '0 0 16px',
              fontSize: 18,
              fontWeight: 700,
              color: '#333',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 4,
                height: 22,
                background: '#ffb74d',
                borderRadius: 2,
              }}
            />
            結帳細帳
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map((row) => {
              const expanded = expandedId === row.id
              return (
                <div
                  key={row.id}
                  style={{
                    background: 'white',
                    borderRadius: 12,
                    padding: isMobile ? 16 : 20,
                    boxShadow: expanded
                      ? '0 4px 16px rgba(144, 202, 249, 0.25)'
                      : '0 2px 8px rgba(0,0,0,0.06)',
                    border: expanded ? '2px solid #90caf9' : 'none',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 12,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          gap: 8,
                          marginBottom: 6,
                        }}
                      >
                        <Link
                          to={`/products/orders?q=${encodeURIComponent(row.order_no)}`}
                          data-track="product_order_settle_stat_order_link"
                          title="在訂單開單搜尋此訂單"
                          style={{
                            fontWeight: 700,
                            fontSize: 16,
                            color: '#1565c0',
                            textDecoration: 'none',
                          }}
                        >
                          {row.order_no}
                        </Link>
                        <span
                          style={{
                            fontSize: 12,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: '#e3f2fd',
                            color: '#1565c0',
                            fontWeight: 600,
                          }}
                        >
                          {PAYMENT_METHOD_LABELS[row.payment_method]}
                        </span>
                      </div>
                      <div style={{ fontSize: 14, color: '#555', marginBottom: 4 }}>
                        {row.contact_name}
                        {row.charge_member_name && row.payment_method === 'balance' && (
                          <span style={{ color: '#888', marginLeft: 8 }}>
                            扣款：{row.charge_member_name}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 13, color: '#999' }}>
                        {extractDate(row.settled_at)} {extractTime(row.settled_at)}
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-label={expanded ? '收合明細' : '展開明細'}
                      data-track="product_order_settle_stat_expand"
                      onClick={() => setExpandedId(expanded ? null : row.id)}
                      style={{
                        textAlign: 'right',
                        flexShrink: 0,
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#2e7d32' }}>
                        {formatCurrency(row.amount_total)}
                      </div>
                      <div
                        style={{
                          fontSize: 18,
                          color: '#90caf9',
                          marginTop: 4,
                          transform: expanded ? 'rotate(90deg)' : 'none',
                          transition: 'transform 0.2s',
                        }}
                      >
                        ▶
                      </div>
                    </button>
                  </div>

                  {expanded && (
                    <div
                      style={{
                        marginTop: 16,
                        paddingTop: 16,
                        borderTop: '1px solid #eee',
                        overflowX: 'auto',
                      }}
                    >
                      <table
                        style={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          fontSize: 13,
                        }}
                      >
                        <thead>
                          <tr style={{ background: '#f5f5f5' }}>
                            <th style={thStyle()}>品項</th>
                            <th style={thStyle('center')}>數量</th>
                            <th style={thStyle('right')}>單價</th>
                            <th style={thStyle('right')}>小計</th>
                          </tr>
                        </thead>
                        <tbody>
                          {row.items_snapshot.map((line, idx) => {
                            const display =
                              variantDisplay[line.variant_id] ??
                              formatSettlementLineDisplay(line, null)
                            return (
                            <tr key={`${line.item_id}-${idx}`} style={{ borderBottom: '1px solid #f0f0f0' }}>
                              <td style={tdStyle()}>
                                <div style={{ fontWeight: 600, color: '#222', lineHeight: 1.35 }}>
                                  {display.title}
                                </div>
                                {display.subtitle && (
                                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                                    {display.subtitle}
                                  </div>
                                )}
                              </td>
                              <td style={tdStyle('center')}>{line.qty}</td>
                              <td style={tdStyle('right')}>
                                {formatCurrency(line.unit_price, false)}
                              </td>
                              <td style={tdStyle('right')}>
                                <strong>{formatCurrency(line.line_total, false)}</strong>
                              </td>
                            </tr>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={3} style={{ ...tdStyle('right'), fontWeight: 600 }}>
                              合計
                            </td>
                            <td style={{ ...tdStyle('right'), fontWeight: 700, color: '#2e7d32' }}>
                              {formatCurrency(row.amount_total, false)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                      {row.notes && (
                        <p style={{ margin: '12px 0 0', fontSize: 13, color: '#666' }}>
                          備註：{row.notes}
                        </p>
                      )}
                      <p style={{ margin: '8px 0 0', fontSize: 12, color: '#aaa' }}>
                        結帳時間：{formatDateTime(row.settled_at)}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  sub,
  accent,
  isMobile,
}: {
  label: string
  value: string
  sub: string
  accent: string
  isMobile: boolean
}) {
  return (
    <div
      style={{
        padding: isMobile ? 16 : 20,
        background: 'white',
        borderRadius: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        borderLeft: `4px solid ${accent}`,
      }}
    >
      <div style={{ fontSize: 13, color: '#666', marginBottom: 6, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: '#333' }}>{value}</div>
      <div style={{ fontSize: 13, color: '#999', marginTop: 4 }}>{sub}</div>
    </div>
  )
}

function thStyle(align: 'left' | 'center' | 'right' = 'left') {
  return {
    padding: 10,
    textAlign: align,
    borderBottom: '2px solid #e0e0e0',
    fontWeight: 600,
    color: '#666',
  } as const
}

function tdStyle(align: 'left' | 'center' | 'right' = 'left') {
  return { padding: 10, textAlign: align } as const
}
