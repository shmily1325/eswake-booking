import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getLocalDateString } from '../utils/date'
import { designSystem, getFontSize, getInputStyle } from '../styles/designSystem'

interface Props {
  isMobile: boolean
  coachId?: string
}

interface SnapshotLine {
  item_id: string
  qty: number
  line_total: number
}

interface SettlementRow {
  id: string
  amount_total: number
  settled_at: string
  items_snapshot: SnapshotLine[]
  order: { order_no: string; contact_name: string; cancelled_at: string | null } | null
}

interface ItemMeta {
  salespersonCoachId: string | null
  salespersonName: string
  productName: string
}

interface SalesDetail {
  id: string
  date: string
  orderNo: string
  customerName: string
  productName: string
  qty: number
  total: number
}

interface SalespersonGroup {
  id: string
  name: string
  qty: number
  total: number
  details: SalesDetail[]
}

function monthRange(month: string): { start: string; end: string } {
  const [year, monthNumber] = month.split('-').map(Number)
  const lastDay = new Date(year, monthNumber, 0).getDate()
  return {
    start: `${month}-01`,
    end: `${month}-${String(lastDay).padStart(2, '0')}`,
  }
}

function allocatedLineTotals(lines: SnapshotLine[], amountTotal: number): number[] {
  const sourceTotal = lines.reduce((sum, line) => sum + Number(line.line_total || 0), 0)
  if (lines.length === 0) return []
  if (sourceTotal <= 0) {
    const base = Math.floor(amountTotal / lines.length)
    return lines.map((_, index) =>
      index === lines.length - 1 ? amountTotal - base * (lines.length - 1) : base,
    )
  }
  let allocated = 0
  return lines.map((line, index) => {
    if (index === lines.length - 1) return amountTotal - allocated
    const value = Math.round((Number(line.line_total || 0) / sourceTotal) * amountTotal)
    allocated += value
    return value
  })
}

// Exported for deterministic allocation/grouping tests.
// eslint-disable-next-line react-refresh/only-export-components
export function buildSalespersonGroups(
  settlements: SettlementRow[],
  itemMeta: ReadonlyMap<string, ItemMeta>,
  coachId?: string,
): SalespersonGroup[] {
  const groups = new Map<string, SalespersonGroup>()
  for (const settlement of settlements) {
    const totals = allocatedLineTotals(settlement.items_snapshot, Number(settlement.amount_total))
    settlement.items_snapshot.forEach((line, index) => {
      const meta = itemMeta.get(line.item_id)
      const salespersonCoachId = meta?.salespersonCoachId ?? null
      if (coachId && salespersonCoachId !== coachId) return
      const groupId = salespersonCoachId ?? 'unassigned'
      const group = groups.get(groupId) ?? {
        id: groupId,
        name: meta?.salespersonName || '未指定',
        qty: 0,
        total: 0,
        details: [],
      }
      const total = totals[index] ?? 0
      group.qty += Number(line.qty || 0)
      group.total += total
      group.details.push({
        id: `${settlement.id}-${line.item_id}-${index}`,
        date: settlement.settled_at.slice(0, 10),
        orderNo: settlement.order?.order_no ?? '—',
        customerName: settlement.order?.contact_name ?? '—',
        productName: meta?.productName || '商品',
        qty: Number(line.qty || 0),
        total,
      })
      groups.set(groupId, group)
    })
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      details: group.details.sort((a, b) => b.date.localeCompare(a.date)),
    }))
    .sort((a, b) => b.total - a.total || b.qty - a.qty || a.name.localeCompare(b.name))
}

export function ProductSalesStatistics({ isMobile, coachId }: Props) {
  const [selectedMonth, setSelectedMonth] = useState(() => getLocalDateString().slice(0, 7))
  const [groups, setGroups] = useState<SalespersonGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const range = monthRange(selectedMonth)
        const { data: settlementData, error: settlementError } = await supabase
          .from('shop_order_settlements')
          .select('id, amount_total, settled_at, items_snapshot, order:shop_orders(order_no, contact_name, cancelled_at)')
          .gte('settled_at', `${range.start}T00:00:00`)
          .lte('settled_at', `${range.end}T23:59:59`)
          .order('settled_at', { ascending: false })
        if (settlementError) throw settlementError

        const settlements = (settlementData ?? [])
          .map((row) => row as unknown as SettlementRow)
          .filter((row) => !row.order?.cancelled_at)
        const itemIds = [...new Set(
          settlements.flatMap((row) => row.items_snapshot.map((line) => line.item_id)),
        )]
        const meta = new Map<string, ItemMeta>()
        if (itemIds.length > 0) {
          const { data: itemData, error: itemError } = await supabase
            .from('shop_order_items')
            .select(`
              id, salesperson_coach_id, salesperson_name_snapshot,
              variant:product_variants(
                vendor_code,
                product:products(brand, model, model_year)
              )
            `)
            .in('id', itemIds)
          if (itemError) throw itemError
          for (const raw of itemData ?? []) {
            const row = raw as unknown as {
              id: string
              salesperson_coach_id: string | null
              salesperson_name_snapshot: string | null
              variant: {
                vendor_code: string | null
                product: { brand: string; model: string; model_year: number | null } | null
              } | null
            }
            const product = row.variant?.product
            meta.set(row.id, {
              salespersonCoachId: row.salesperson_coach_id,
              salespersonName: row.salesperson_name_snapshot?.trim() || '未指定',
              productName: product
                ? `${product.brand} ${product.model}${product.model_year ? ` · ${product.model_year}` : ''}`
                : row.variant?.vendor_code || '商品',
            })
          }
        }
        if (!cancelled) setGroups(buildSalespersonGroups(settlements, meta, coachId))
      } catch (cause) {
        if (!cancelled) {
          setGroups([])
          setError(cause instanceof Error ? cause.message : '載入商品銷售失敗')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [coachId, selectedMonth])

  const summary = useMemo(
    () => groups.reduce(
      (sum, group) => ({ qty: sum.qty + group.qty, total: sum.total + group.total }),
      { qty: 0, total: 0 },
    ),
    [groups],
  )

  return (
    <div>
      <label style={{ display: 'block', marginBottom: 16 }}>
        <span style={{
          display: 'block',
          marginBottom: 6,
          color: designSystem.colors.text.secondary,
          fontSize: getFontSize('bodySmall', isMobile),
          fontWeight: 500,
        }}>
          查詢月份
        </span>
        <input
          type="month"
          value={selectedMonth}
          onChange={(event) => setSelectedMonth(event.target.value)}
          style={{ ...getInputStyle(isMobile), maxWidth: 260 }}
        />
      </label>

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: designSystem.colors.text.secondary }}>
          載入中...
        </div>
      ) : error ? (
        <div style={{ padding: 20, color: designSystem.colors.danger[700] }}>{error}</div>
      ) : groups.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: designSystem.colors.text.secondary }}>
          本月無商品銷售
        </div>
      ) : (
        <>
          <div style={{
            marginBottom: 18,
            paddingBottom: 14,
            borderBottom: `1px solid ${designSystem.colors.border.light}`,
            color: designSystem.colors.text.primary,
            fontSize: getFontSize('bodyLarge', isMobile),
            fontWeight: 600,
          }}>
            銷售 ${summary.total.toLocaleString()} 元 · {summary.qty} 件
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {groups.map((group) => (
              <section
                key={group.id}
                style={{
                  padding: isMobile ? 12 : 16,
                  border: `1px solid ${designSystem.colors.border.light}`,
                  borderRadius: designSystem.borderRadius.lg,
                  background: designSystem.colors.background.card,
                }}
              >
                {!coachId && (
                  <h3 style={{
                    margin: '0 0 10px',
                    fontSize: getFontSize('bodyLarge', isMobile),
                    color: designSystem.colors.text.primary,
                  }}>
                    {group.name} · ${group.total.toLocaleString()} · {group.qty} 件
                  </h3>
                )}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: getFontSize('bodySmall', isMobile) }}>
                    <thead>
                      <tr>
                        {['結帳日', '訂單／客人', '商品', '件數', '金額'].map((label) => (
                          <th key={label} style={{ padding: 8, textAlign: label === '件數' || label === '金額' ? 'right' : 'left', borderBottom: `1px solid ${designSystem.colors.border.light}`, whiteSpace: 'nowrap' }}>
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {group.details.map((detail) => (
                        <tr key={detail.id}>
                          <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{detail.date}</td>
                          <td style={{ padding: 8 }}>
                            <div>{detail.orderNo}</div>
                            <div style={{ color: designSystem.colors.text.secondary }}>{detail.customerName}</div>
                          </td>
                          <td style={{ padding: 8 }}>{detail.productName}</td>
                          <td style={{ padding: 8, textAlign: 'right' }}>{detail.qty}</td>
                          <td style={{ padding: 8, textAlign: 'right', whiteSpace: 'nowrap' }}>${detail.total.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
