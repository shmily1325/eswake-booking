/**
 * Design thinking:
 * Current feel: sparse monthly data split into category cards reads like raw report output.
 * Hierarchy: period first, quiet totals second, then a ranked grouped list before settlement detail.
 * Primary task: understand which brands/categories drive sales, then audit individual settlements.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DateRangePicker } from '../../../components/DateRangePicker'
import { useToast } from '../../../components/ui'
import { getVenueDateString } from '../../../utils/date'
import { formatCurrency, formatDateTime, extractDate, extractTime } from '../../../utils/formatters'
import { supabase } from '../../../lib/supabase'
import { designSystem, getButtonStyle, getFontSize } from '../../../styles/designSystem'
import { getCategory, getCategoryShopName } from '../products/schema'
import { fetchSettlementsInRange } from './api'
import { formatSettlementLineDisplay, type SettlementLineDisplay } from './settleUtils'
import type { OrderPaymentMethod, ShopOrderSettlementWithDetails } from './types'
import { PAYMENT_METHOD_LABELS } from './types'

interface Props {
  isMobile: boolean
}

const { colors, borderRadius, shadows, spacing } = designSystem

function dateRangeFromSelection(selectedDate: string): { start: string; end: string } {
  if (selectedDate.length === 4) {
    const currentYear = getVenueDateString().slice(0, 4)
    return {
      start: `${selectedDate}-01-01`,
      end: selectedDate === currentYear ? getVenueDateString() : `${selectedDate}-12-31`,
    }
  }
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

type SalesGroupBy = 'brand' | 'category'

interface VariantSalesMeta {
  brand: string
  category: string
}

export function ShopSettlementStatisticsTab({ isMobile }: Props) {
  const toast = useToast()
  const [selectedDate, setSelectedDate] = useState(() => getVenueDateString().slice(0, 4))
  const [salesGroupBy, setSalesGroupBy] = useState<SalesGroupBy>('brand')
  const [loading, setLoading] = useState(false)
  const [settlements, setSettlements] = useState<ShopOrderSettlementWithDetails[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [variantDisplay, setVariantDisplay] = useState<Record<string, SettlementLineDisplay>>({})
  const [variantSalesMeta, setVariantSalesMeta] = useState<Record<string, VariantSalesMeta>>({})

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
        const salesMeta: Record<string, VariantSalesMeta> = {}
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
          if (row.product) {
            salesMeta[row.id] = {
              brand: row.product.brand.trim() || '其他品牌',
              category: row.product.category || 'other',
            }
          }
        })
        setVariantDisplay(labels)
        setVariantSalesMeta(salesMeta)
      } else {
        setVariantDisplay({})
        setVariantSalesMeta({})
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '載入失敗'
      toast.error(msg)
      setSettlements([])
    } finally {
      setLoading(false)
    }
  }

  const summary = useMemo(() => {
    const byMethod: Record<OrderPaymentMethod, { count: number; total: number }> = {
      balance: { count: 0, total: 0 },
      transfer: { count: 0, total: 0 },
      cash: { count: 0, total: 0 },
    }
    let grandTotal = 0
    for (const s of settlements) {
      grandTotal += s.amount_total
      byMethod[s.payment_method].count += 1
      byMethod[s.payment_method].total += s.amount_total
    }
    return { count: settlements.length, grandTotal, byMethod }
  }, [settlements])

  const salesGroups = useMemo(() => {
    const grouped = new Map<
      string,
      {
        id: string
        name: string
        qty: number
        total: number
        items: Map<
          string,
          SettlementLineDisplay & { qty: number; total: number }
        >
      }
    >()

    for (const settlement of settlements) {
      for (const line of settlement.items_snapshot) {
        const meta = variantSalesMeta[line.variant_id]
        const groupId = salesGroupBy === 'brand'
          ? meta?.brand ?? '其他品牌'
          : meta?.category ?? 'other'
        const groupName = salesGroupBy === 'brand'
          ? groupId
          : getCategory(groupId)
            ? getCategoryShopName(getCategory(groupId)!)
            : '其他'
        const group = grouped.get(groupId) ?? {
          id: groupId,
          name: groupName,
          qty: 0,
          total: 0,
          items: new Map(),
        }
        const display =
          variantDisplay[line.variant_id] ?? formatSettlementLineDisplay(line, null)
        const itemKey = line.variant_id || `${display.title}\u0000${display.subtitle}`
        const item = group.items.get(itemKey) ?? {
          ...display,
          qty: 0,
          total: 0,
        }

        group.qty += line.qty
        group.total += line.line_total
        item.qty += line.qty
        item.total += line.line_total
        group.items.set(itemKey, item)
        grouped.set(groupId, group)
      }
    }

    return Array.from(grouped.values())
      .sort((a, b) => b.total - a.total || b.qty - a.qty || a.name.localeCompare(b.name))
      .map((group) => ({
        ...group,
        items: Array.from(group.items.values()).sort(
          (a, b) => b.total - a.total || b.qty - a.qty || a.title.localeCompare(b.title),
        ),
      }))
  }, [salesGroupBy, settlements, variantDisplay, variantSalesMeta])

  const maxSalesItemTotal = useMemo(
    () => Math.max(0, ...salesGroups.flatMap((group) => group.items.map((item) => item.total))),
    [salesGroups],
  )

  return (
    <div>
      <div
        style={{
          background: colors.background.card,
          borderRadius: borderRadius.lg,
          padding: isMobile ? 20 : 24,
          marginBottom: 24,
          border: `1px solid ${colors.border.light}`,
          boxShadow: shadows.elevation[1],
        }}
      >
        <DateRangePicker
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          isMobile={isMobile}
          showTodayButton={!isMobile}
          label="查詢期間"
          simplified
          showYearButtons
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: colors.text.disabled }}>載入中…</div>
      ) : settlements.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: colors.text.disabled }}>
          {selectedDate.length === 10
            ? '當日無結帳紀錄'
            : selectedDate.length === 4
              ? '此年度尚無結帳紀錄'
              : '當月無結帳紀錄'}
        </div>
      ) : (
        <>
          <div
            style={{
              background: colors.background.card,
              borderRadius: borderRadius.lg,
              border: `1px solid ${colors.border.light}`,
              padding: isMobile ? `${spacing.md} ${spacing.lg}` : `${spacing.lg} ${spacing.xl}`,
              marginBottom: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: spacing.sm,
            }}
          >
            <SummaryRow
              label="結帳筆數"
              value={`${summary.count} 筆`}
              isMobile={isMobile}
            />
            <SummaryRow
              label="結帳總額"
              value={formatCurrency(summary.grandTotal, false)}
              isMobile={isMobile}
              emphasize
            />
            <SummaryRow
              label="扣儲值"
              value={`${formatCurrency(summary.byMethod.balance.total, false)} · ${summary.byMethod.balance.count} 筆`}
              isMobile={isMobile}
            />
            <SummaryRow
              label="匯款＋現金"
              value={`${formatCurrency(
                summary.byMethod.transfer.total + summary.byMethod.cash.total,
                false,
              )} · ${summary.byMethod.transfer.count + summary.byMethod.cash.count} 筆`}
              isMobile={isMobile}
            />
          </div>

          <div
            style={{
              background: colors.background.card,
              border: `1px solid ${colors.border.light}`,
              borderRadius: borderRadius.lg,
              overflow: 'hidden',
              marginBottom: 24,
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: isMobile ? 'stretch' : 'center',
                justifyContent: 'space-between',
                gap: spacing.md,
                padding: isMobile ? '16px' : '18px 20px',
                borderBottom: `1px solid ${colors.border.light}`,
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: getFontSize('h3', isMobile),
                    fontWeight: 600,
                    color: colors.text.primary,
                  }}
                >
                  售出商品排行
                </h2>
                <p
                  style={{
                    margin: `${spacing.xs} 0 0`,
                    fontSize: getFontSize('caption', isMobile),
                    color: colors.text.secondary,
                  }}
                >
                  依銷售金額排序
                </p>
              </div>
              <div
                role="group"
                aria-label="商品排行分組方式"
                style={{
                  display: 'flex',
                  gap: spacing.sm,
                }}
              >
                {([
                  ['brand', '品牌'],
                  ['category', '分類'],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={salesGroupBy === value}
                    onClick={() => setSalesGroupBy(value)}
                    style={{
                      ...getButtonStyle(
                        salesGroupBy === value ? 'primary' : 'secondary',
                        'small',
                        isMobile,
                      ),
                      flex: isMobile ? 1 : undefined,
                      boxShadow: 'none',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {salesGroups.map((group, groupIndex) => {
              const share = summary.grandTotal > 0
                ? Math.round((group.total / summary.grandTotal) * 100)
                : 0
              return (
                <section
                  key={group.id}
                  style={{
                    borderTop: groupIndex === 0 ? 'none' : `1px solid ${colors.border.main}`,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      gap: spacing.md,
                      padding: isMobile ? '12px 16px' : '13px 20px',
                      background: colors.secondary[50],
                    }}
                  >
                    <div style={{ minWidth: 0, display: 'flex', alignItems: 'baseline', gap: spacing.sm }}>
                      <span
                        style={{
                          fontSize: getFontSize('caption', isMobile),
                          color: colors.text.disabled,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {String(groupIndex + 1).padStart(2, '0')}
                      </span>
                      <strong style={{ color: colors.text.primary }}>{group.name}</strong>
                    </div>
                    <span
                      style={{
                        flexShrink: 0,
                        color: colors.text.secondary,
                        fontSize: getFontSize('bodySmall', isMobile),
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {group.qty} 件 · {formatCurrency(group.total, false)} · {share}%
                    </span>
                  </div>
                  {group.items.map((item, itemIndex) => {
                    const width = maxSalesItemTotal > 0
                      ? Math.max(3, (item.total / maxSalesItemTotal) * 100)
                      : 0
                    return (
                      <div
                        key={`${item.title}-${item.subtitle}`}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(0, 1fr) auto',
                          alignItems: 'center',
                          gap: spacing.lg,
                          padding: isMobile ? '12px 16px' : '12px 20px',
                          borderTop: `1px solid ${colors.border.light}`,
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: itemIndex === 0 ? 600 : 500, color: colors.text.primary }}>
                            {item.title}
                          </div>
                          {item.subtitle && (
                            <div
                              style={{
                                marginTop: 2,
                                fontSize: getFontSize('caption', isMobile),
                                color: colors.text.disabled,
                              }}
                            >
                              {item.subtitle}
                            </div>
                          )}
                        <div
                          style={{
                            height: 3,
                            marginTop: spacing.sm,
                            background: colors.secondary[100],
                            borderRadius: borderRadius.full,
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${width}%`,
                              height: '100%',
                              background: colors.secondary[400],
                              borderRadius: borderRadius.full,
                            }}
                          />
                        </div>
                      </div>
                        <div
                          style={{
                            flexShrink: 0,
                            textAlign: 'right',
                            color: colors.text.secondary,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          <div>{item.qty} 件</div>
                          <div style={{ fontSize: getFontSize('caption', isMobile), marginTop: 2 }}>
                            {formatCurrency(item.total, false)}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </section>
              )
            })}
          </div>

          <h2
            style={{
              margin: '0 0 16px',
              fontSize: getFontSize('h3', isMobile),
              fontWeight: 600,
              color: colors.text.primary,
            }}
          >
            結帳細帳
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {settlements.map((row, idx) => {
              const expanded = expandedId === row.id
              const isLast = idx === settlements.length - 1
              return (
                <div
                  key={row.id}
                  style={{
                    background: colors.background.card,
                    borderRadius: idx === 0 ? `${borderRadius.lg} ${borderRadius.lg} 0 0` : isLast && !expanded ? `0 0 ${borderRadius.lg} ${borderRadius.lg}` : 0,
                    padding: isMobile ? 16 : 20,
                    border: `1px solid ${colors.border.light}`,
                    borderTopWidth: idx === 0 ? 1 : 0,
                    boxShadow: expanded ? shadows.xs : 'none',
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
                            fontWeight: 600,
                            fontSize: getFontSize('bodyLarge', isMobile),
                            color: colors.text.primary,
                            textDecoration: 'none',
                          }}
                        >
                          {row.order_no}
                        </Link>
                        <span
                          style={{
                            fontSize: getFontSize('caption', isMobile),
                            padding: '2px 8px',
                            borderRadius: borderRadius.sm,
                            background: colors.secondary[100],
                            color: colors.text.secondary,
                            fontWeight: 500,
                          }}
                        >
                          {PAYMENT_METHOD_LABELS[row.payment_method]}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: getFontSize('body', isMobile),
                          color: colors.text.secondary,
                          marginBottom: 4,
                        }}
                      >
                        {row.contact_name}
                        {row.charge_member_name && row.payment_method === 'balance' && (
                          <span style={{ color: colors.text.disabled, marginLeft: 8 }}>
                            扣款：{row.charge_member_name}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: getFontSize('bodySmall', isMobile), color: colors.text.disabled }}>
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
                      <div
                        style={{
                          fontSize: getFontSize('h3', isMobile),
                          fontWeight: 700,
                          color: colors.text.primary,
                        }}
                      >
                        {formatCurrency(row.amount_total)}
                      </div>
                      <div
                        style={{
                          fontSize: getFontSize('bodySmall', isMobile),
                          color: colors.text.disabled,
                          marginTop: 4,
                        }}
                      >
                        {expanded ? '收合' : '明細'}
                      </div>
                    </button>
                  </div>

                  {expanded && (
                    <div
                      style={{
                        marginTop: 16,
                        paddingTop: 16,
                        borderTop: `1px solid ${colors.border.light}`,
                        overflowX: 'auto',
                      }}
                    >
                      <table
                        style={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          fontSize: getFontSize('bodySmall', isMobile),
                        }}
                      >
                        <thead>
                          <tr style={{ background: colors.secondary[50] }}>
                            <th style={thStyle()}>品項</th>
                            <th style={thStyle('center')}>數量</th>
                            <th style={thStyle('right')}>單價</th>
                            <th style={thStyle('right')}>小計</th>
                          </tr>
                        </thead>
                        <tbody>
                          {row.items_snapshot.map((line, lineIdx) => {
                            const display =
                              variantDisplay[line.variant_id] ??
                              formatSettlementLineDisplay(line, null)
                            return (
                              <tr
                                key={`${line.item_id}-${lineIdx}`}
                                style={{ borderBottom: `1px solid ${colors.border.light}` }}
                              >
                                <td style={tdStyle()}>
                                  <div
                                    style={{
                                      fontWeight: 600,
                                      color: colors.text.primary,
                                      lineHeight: 1.35,
                                    }}
                                  >
                                    {display.title}
                                  </div>
                                  {display.subtitle && (
                                    <div
                                      style={{
                                        fontSize: getFontSize('caption', isMobile),
                                        color: colors.text.disabled,
                                        marginTop: 2,
                                      }}
                                    >
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
                            <td
                              style={{
                                ...tdStyle('right'),
                                fontWeight: 700,
                                color: colors.text.primary,
                              }}
                            >
                              {formatCurrency(row.amount_total, false)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                      {row.notes && (
                        <p
                          style={{
                            margin: '12px 0 0',
                            fontSize: getFontSize('bodySmall', isMobile),
                            color: colors.text.secondary,
                          }}
                        >
                          備註：{row.notes}
                        </p>
                      )}
                      <p
                        style={{
                          margin: '8px 0 0',
                          fontSize: getFontSize('caption', isMobile),
                          color: colors.text.disabled,
                        }}
                      >
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

function SummaryRow({
  label,
  value,
  isMobile,
  emphasize,
}: {
  label: string
  value: string
  isMobile: boolean
  emphasize?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 12,
        padding: `${spacing.xs} 0`,
        borderBottom: `1px solid ${colors.border.light}`,
      }}
    >
      <span
        style={{
          fontSize: getFontSize('bodySmall', isMobile),
          color: colors.text.secondary,
          fontWeight: 500,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: emphasize ? getFontSize('h3', isMobile) : getFontSize('body', isMobile),
          fontWeight: emphasize ? 700 : 600,
          color: colors.text.primary,
          textAlign: 'right',
        }}
      >
        {value}
      </span>
    </div>
  )
}

function thStyle(align: 'left' | 'center' | 'right' = 'left') {
  return {
    padding: 10,
    textAlign: align,
    borderBottom: `1px solid ${colors.border.main}`,
    fontWeight: 600,
    color: colors.text.secondary,
  } as const
}

function tdStyle(align: 'left' | 'center' | 'right' = 'left') {
  return { padding: 10, textAlign: align, color: colors.text.primary } as const
}
