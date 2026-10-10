import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAllInBatches, fetchAllPaginated } from '../utils/supabasePaginate'
import { designSystem, getFontSize } from '../styles/designSystem'

interface Props {
  isMobile: boolean
  selectedDate: string
  selectedCoachId: string
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

function dateRange(value: string): { start: string; end: string } {
  if (value.length === 10) return { start: value, end: value }
  const [year, monthNumber] = value.split('-').map(Number)
  const lastDay = new Date(year, monthNumber, 0).getDate()
  return {
    start: `${value}-01`,
    end: `${value}-${String(lastDay).padStart(2, '0')}`,
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

export function ProductSalesStatistics({ isMobile, selectedDate, selectedCoachId }: Props) {
  const [groups, setGroups] = useState<SalespersonGroup[]>([])
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(() => new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      setGroups([])
      setExpandedGroupIds(new Set())
      try {
        const range = dateRange(selectedDate)
        const settlementData = await fetchAllPaginated<SettlementRow>(async (from, to) => {
          const { data, error } = await supabase
            .from('shop_order_settlements')
            .select('id, amount_total, settled_at, items_snapshot, order:shop_orders(order_no, contact_name, cancelled_at)')
            .gte('settled_at', `${range.start}T00:00:00`)
            .lte('settled_at', `${range.end}T23:59:59`)
            .order('settled_at', { ascending: false })
            .range(from, to)
          return { data: data as unknown as SettlementRow[] | null, error }
        })
        const settlements = settlementData
          .map((row) => row as unknown as SettlementRow)
          .filter((row) => !row.order?.cancelled_at)
        const itemIds = [...new Set(
          settlements.flatMap((row) => row.items_snapshot.map((line) => line.item_id)),
        )]
        const meta = new Map<string, ItemMeta>()
        if (itemIds.length > 0) {
          const itemData = await fetchAllInBatches<{
            id: string
            salesperson_coach_id: string | null
            salesperson_name_snapshot: string | null
            variant: {
              vendor_code: string | null
              product: { brand: string; model: string; model_year: number | null } | null
            } | null
          }, string>(
            'shop_order_items',
            `
              id, salesperson_coach_id, salesperson_name_snapshot,
              variant:product_variants(
                vendor_code,
                product:products(brand, model, model_year)
              )
            `,
            'id',
            itemIds,
            'id',
          )
          for (const raw of itemData) {
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
        const coachFilter = selectedCoachId === 'all' ? undefined : selectedCoachId
        if (!cancelled) {
          setGroups(buildSalespersonGroups(settlements, meta, coachFilter))
          setExpandedGroupIds(new Set())
        }
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
  }, [selectedCoachId, selectedDate])

  const visibleGroups = groups
  const summary = useMemo(
    () => visibleGroups.reduce(
      (sum, group) => ({ qty: sum.qty + group.qty, total: sum.total + group.total }),
      { qty: 0, total: 0 },
    ),
    [visibleGroups],
  )
  const assignedGroups = visibleGroups.filter((group) => group.id !== 'unassigned')
  const unassignedGroup = visibleGroups.find((group) => group.id === 'unassigned')
  const maxAssignedTotal = Math.max(1, ...assignedGroups.map((group) => group.total))
  const toggleGroup = (groupId: string) => {
    setExpandedGroupIds((current) => {
      const next = new Set(current)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  return (
    <div>
      <h2 style={{
        margin: '0 0 4px',
        fontSize: getFontSize('h3', isMobile),
        fontWeight: 600,
        color: designSystem.colors.text.primary,
      }}>
        商品銷售
      </h2>
      <p style={{
        margin: '0 0 14px',
        fontSize: getFontSize('caption', isMobile),
        color: designSystem.colors.text.disabled,
      }}>
        依結帳日計算
      </p>

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: designSystem.colors.text.secondary }}>
          載入中...
        </div>
      ) : error ? (
        <div style={{ padding: 20, color: designSystem.colors.danger[700] }}>{error}</div>
      ) : visibleGroups.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: designSystem.colors.text.secondary }}>
          {selectedDate.length === 10 ? '當日無商品銷售' : '當月無商品銷售'}
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

          {assignedGroups.length > 0 && (
            <section style={{
              marginBottom: designSystem.spacing.xl,
              padding: isMobile ? 14 : designSystem.spacing.lg,
              background: designSystem.colors.background.card,
              borderRadius: designSystem.borderRadius.lg,
              border: `1px solid ${designSystem.colors.border.light}`,
            }}>
              <h3 style={{
                margin: `0 0 ${isMobile ? 12 : 16}px`,
                fontSize: getFontSize('h3', isMobile),
                fontWeight: 600,
                color: designSystem.colors.text.primary,
              }}>
                商品銷售對比
              </h3>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: isMobile ? 10 : 12,
              }}>
                {assignedGroups.map((group) => (
                  <div key={`comparison-${group.id}`}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      marginBottom: 4,
                    }}>
                      <span style={{
                        minWidth: 0,
                        fontSize: getFontSize('body', isMobile),
                        fontWeight: 600,
                        color: designSystem.colors.text.primary,
                        overflowWrap: 'anywhere',
                      }}>
                        {group.name}
                      </span>
                      <span style={{
                        flexShrink: 0,
                        fontSize: getFontSize('bodySmall', isMobile),
                        color: designSystem.colors.text.secondary,
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        ${group.total.toLocaleString()} ({group.qty}件)
                      </span>
                    </div>
                    <div style={{
                      width: '100%',
                      height: isMobile ? 6 : 8,
                      overflow: 'hidden',
                      borderRadius: designSystem.borderRadius.full,
                      background: designSystem.colors.background.hover,
                    }}>
                      <div style={{
                        width: `${(group.total / maxAssignedTotal) * 100}%`,
                        height: '100%',
                        borderRadius: designSystem.borderRadius.full,
                        background: designSystem.colors.primary[500],
                        transition: 'width 0.3s',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {assignedGroups.length > 0 && (
              <section>
                <h2 style={{
                  margin: '0 0 12px',
                  fontSize: getFontSize('h3', isMobile),
                  fontWeight: 600,
                  color: designSystem.colors.text.primary,
                }}>
                  教練銷售細帳
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: designSystem.spacing.md }}>
                  {assignedGroups.map((group) => (
                    <SalespersonStatRow
                      key={group.id}
                      group={group}
                      isMobile={isMobile}
                      expanded={expandedGroupIds.has(group.id)}
                      showName
                      onToggle={() => toggleGroup(group.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {unassignedGroup && (
              <section>
                {selectedCoachId === 'all' && (
                  <h3 style={{
                    margin: '0 0 10px',
                    fontSize: getFontSize('bodyLarge', isMobile),
                    color: designSystem.colors.text.primary,
                  }}>
                    未指定
                  </h3>
                )}
                <SalespersonStatRow
                  group={unassignedGroup}
                  isMobile={isMobile}
                  expanded={expandedGroupIds.has(unassignedGroup.id)}
                  showName={false}
                  onToggle={() => toggleGroup(unassignedGroup.id)}
                />
              </section>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function SalespersonStatRow({
  group,
  isMobile,
  expanded,
  showName,
  onToggle,
}: {
  group: SalespersonGroup
  isMobile: boolean
  expanded: boolean
  showName: boolean
  onToggle: () => void
}) {
  return (
    <div style={{
      overflow: 'hidden',
      border: expanded
        ? `1px solid ${designSystem.colors.border.dark}`
        : `1px solid ${designSystem.colors.border.light}`,
      borderRadius: designSystem.borderRadius.lg,
      background: designSystem.colors.background.card,
      transition: 'border-color 0.2s',
    }}>
      <button
        type="button"
        data-track={group.id === 'unassigned'
          ? 'product_sales_unassigned_detail_toggle'
          : 'product_sales_coach_detail_toggle'}
        aria-expanded={expanded}
        aria-label={`${expanded ? '收合' : '展開'} ${group.name} 銷售明細`}
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          alignItems: 'center',
          gap: isMobile ? 8 : 14,
          padding: isMobile ? '12px 14px' : '14px 18px',
          border: 0,
          background: expanded
            ? designSystem.colors.secondary[50]
            : designSystem.colors.background.card,
          color: designSystem.colors.text.primary,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{ minWidth: 0 }}>
          {showName && (
            <strong style={{
              display: 'block',
              marginBottom: 5,
              fontSize: getFontSize('body', isMobile),
              overflowWrap: 'anywhere',
            }}>
              {group.name}
            </strong>
          )}
          <span style={{
            color: designSystem.colors.text.secondary,
            fontSize: getFontSize('bodySmall', isMobile),
            fontVariantNumeric: 'tabular-nums',
          }}>
            銷售 ${group.total.toLocaleString()} · {group.qty} 件
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            aria-hidden
            style={{
              color: designSystem.colors.text.disabled,
              fontSize: getFontSize('caption', isMobile),
              transform: expanded ? 'rotate(90deg)' : 'none',
              transition: 'transform 0.2s',
            }}
          >
            ▶
          </span>
        </div>
      </button>

      {expanded && (
        <div style={{
          overflowX: 'auto',
          padding: isMobile ? '0 8px 10px' : '0 12px 12px',
          background: designSystem.colors.secondary[50],
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: getFontSize('bodySmall', isMobile),
          }}>
            <thead>
              <tr>
                {['結帳日', '訂單／客人', '商品', '件數', '金額'].map((label) => (
                  <th
                    key={label}
                    style={{
                      padding: 8,
                      textAlign: label === '件數' || label === '金額' ? 'right' : 'left',
                      borderBottom: `1px solid ${designSystem.colors.border.light}`,
                      color: designSystem.colors.text.secondary,
                      whiteSpace: 'nowrap',
                    }}
                  >
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
                    <div style={{ color: designSystem.colors.text.secondary }}>
                      {detail.customerName}
                    </div>
                  </td>
                  <td style={{ padding: 8 }}>{detail.productName}</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>{detail.qty}</td>
                  <td style={{ padding: 8, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    ${detail.total.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
