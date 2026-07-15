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
  rankingOnly?: boolean
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

function formatSalesCategoryName(categoryId: string): string {
  const category = getCategory(categoryId)
  if (!category) return '其他'
  return category.shopGroup
    ? `${category.shopGroup} · ${getCategoryShopName(category)}`
    : getCategoryShopName(category)
}

type SalesGroupBy = 'brand' | 'category'

interface VariantSalesMeta {
  brand: string
  category: string
  productId: string
  productName: string
}

export function ShopSettlementStatisticsTab({ isMobile, rankingOnly = false }: Props) {
  const toast = useToast()
  const [selectedDate, setSelectedDate] = useState(() => getVenueDateString().slice(0, 4))
  const [salesGroupBy, setSalesGroupBy] = useState<SalesGroupBy>('brand')
  const [loading, setLoading] = useState(false)
  const [settlements, setSettlements] = useState<ShopOrderSettlementWithDetails[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedSalesGroupId, setExpandedSalesGroupId] = useState<string | null>(null)
  const [expandedSalesItemIds, setExpandedSalesItemIds] = useState<Set<string>>(
    () => new Set(),
  )
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
            'id, vendor_code, attributes, product:products(id, brand, model, category)',
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
            product: { id: string; brand: string; model: string; category: string } | null
          }
          labels[row.id] = formatSettlementLineDisplay(
            { item_id: '', variant_id: row.id, qty: 0, unit_price: 0, line_total: 0 },
            row,
          )
          if (row.product) {
            salesMeta[row.id] = {
              brand: row.product.brand.trim() || '其他品牌',
              category: row.product.category || 'other',
              productId: row.product.id,
              productName: `${row.product.brand} ${row.product.model}`.trim(),
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
          SettlementLineDisplay & {
            id: string
            qty: number
            total: number
            details: Map<
              string,
              SettlementLineDisplay & { id: string; qty: number; total: number }
            >
          }
        >
      }
    >()

    for (const settlement of settlements) {
      for (const line of settlement.items_snapshot) {
        const meta = variantSalesMeta[line.variant_id]
        const display =
          variantDisplay[line.variant_id] ?? formatSettlementLineDisplay(line, null)
        const groupId = salesGroupBy === 'brand'
          ? meta?.brand ?? '其他品牌'
          : meta?.category ?? 'other'
        const groupName = salesGroupBy === 'brand'
          ? groupId
          : formatSalesCategoryName(groupId)
        const group = grouped.get(groupId) ?? {
          id: groupId,
          name: groupName,
          qty: 0,
          total: 0,
          items: new Map(),
        }
        const itemKey = meta
          ? salesGroupBy === 'brand'
            ? meta.category
            : meta.brand
          : line.variant_id || `${display.title}\u0000${display.subtitle}`
        const itemDisplay = meta
          ? {
              title: salesGroupBy === 'brand'
                ? formatSalesCategoryName(meta.category)
                : meta.brand,
              subtitle: '',
            }
          : display
        const item = group.items.get(itemKey) ?? {
          ...itemDisplay,
          id: itemKey,
          qty: 0,
          total: 0,
          details: new Map(),
        }
        const detailKey = meta?.productId
          ?? (line.variant_id || `${display.title}\u0000${display.subtitle}`)
        const detailDisplay = meta
          ? { title: meta.productName, subtitle: '' }
          : display
        const detail = item.details.get(detailKey) ?? {
          ...detailDisplay,
          id: detailKey,
          qty: 0,
          total: 0,
        }

        group.qty += line.qty
        group.total += line.line_total
        item.qty += line.qty
        item.total += line.line_total
        detail.qty += line.qty
        detail.total += line.line_total
        item.details.set(detailKey, detail)
        group.items.set(itemKey, item)
        grouped.set(groupId, group)
      }
    }

    return Array.from(grouped.values())
      .sort((a, b) => b.total - a.total || b.qty - a.qty || a.name.localeCompare(b.name))
      .map((group) => ({
        ...group,
        items: Array.from(group.items.values())
          .sort((a, b) => b.total - a.total || b.qty - a.qty || a.title.localeCompare(b.title))
          .map((item) => ({
            ...item,
            details: Array.from(item.details.values()).sort(
              (a, b) => b.total - a.total || b.qty - a.qty || a.title.localeCompare(b.title),
            ),
          })),
      }))
  }, [salesGroupBy, settlements, variantDisplay, variantSalesMeta])

  return (
    <div
      style={{
        color: colors.text.primary,
        fontSize: getFontSize('body', isMobile),
        lineHeight: 1.45,
      }}
    >
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
          trackPrefix="product_order_settle_stat_period"
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
          {!rankingOnly && (
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
          )}

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
                    fontWeight: 700,
                    lineHeight: 1.35,
                    color: colors.text.primary,
                  }}
                >
                  售出商品排行
                </h2>
                <p
                  style={{
                    margin: `${spacing.xs} 0 0`,
                    fontSize: getFontSize('caption', isMobile),
                    lineHeight: 1.4,
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
                  ['category', '品項'],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    data-track={`product_order_settle_stat_group_${value}`}
                    aria-pressed={salesGroupBy === value}
                    onClick={() => {
                      setSalesGroupBy(value)
                      setExpandedSalesGroupId(null)
                      setExpandedSalesItemIds(new Set())
                    }}
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
              const expanded = expandedSalesGroupId === group.id
              return (
                <section
                  key={group.id}
                  style={{
                    borderTop: groupIndex === 0 ? 'none' : `1px solid ${colors.border.main}`,
                  }}
                >
                  <button
                    type="button"
                    data-track="product_order_settle_stat_rank_group_expand"
                    aria-expanded={expanded}
                    aria-label={`${expanded ? '收合' : '展開'}第 ${groupIndex + 1} 名全部明細`}
                    onClick={() => {
                      if (expanded) {
                        setExpandedSalesGroupId(null)
                        setExpandedSalesItemIds(new Set())
                        return
                      }
                      setExpandedSalesGroupId(group.id)
                      setExpandedSalesItemIds(
                        new Set(group.items.map((item) => `${group.id}\u0000${item.id}`)),
                      )
                    }}
                    style={{
                      width: '100%',
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1fr) auto',
                      alignItems: 'center',
                      gap: spacing.md,
                      padding: isMobile ? '11px 14px' : '13px 20px',
                      background: colors.secondary[50],
                      border: 0,
                      color: 'inherit',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: spacing.sm }}>
                        <span
                          style={{
                            flexShrink: 0,
                            fontSize: getFontSize('caption', isMobile),
                            color: colors.text.disabled,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {String(groupIndex + 1).padStart(2, '0')}
                        </span>
                        <strong
                          style={{
                            minWidth: 0,
                            fontSize: getFontSize('body', isMobile),
                            fontWeight: 600,
                            color: colors.text.primary,
                            lineHeight: 1.35,
                            overflowWrap: 'anywhere',
                          }}
                        >
                          {group.name}
                        </strong>
                      </div>
                      {isMobile && (
                        <div
                          style={{
                            marginTop: 4,
                            paddingLeft: 25,
                            color: colors.text.secondary,
                            fontSize: getFontSize('bodySmall', true),
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {group.qty} 件 · {formatCurrency(group.total, false)} · {share}%
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: spacing.sm,
                      }}
                    >
                      <span
                        style={{
                          display: isMobile ? 'none' : undefined,
                          color: colors.text.secondary,
                          fontSize: getFontSize('bodySmall', isMobile),
                          fontVariantNumeric: 'tabular-nums',
                          textAlign: 'right',
                        }}
                      >
                        {group.qty} 件 · {formatCurrency(group.total, false)} · {share}%
                      </span>
                      <span
                        aria-hidden="true"
                        style={{
                          color: colors.text.disabled,
                          fontSize: getFontSize('caption', isMobile),
                          transform: expanded ? 'rotate(180deg)' : 'none',
                          transition: 'transform 160ms ease',
                        }}
                      >
                        ▼
                      </span>
                    </div>
                  </button>
                  {expanded && group.items.map((item, itemIndex) => {
                    const itemExpansionId = `${group.id}\u0000${item.id}`
                    const itemExpanded = expandedSalesItemIds.has(itemExpansionId)
                    return (
                      <div
                        key={item.id}
                        style={{
                          margin: isMobile
                            ? `4px 14px ${itemIndex === group.items.length - 1 ? '8px' : '0'} 39px`
                            : `5px 20px ${itemIndex === group.items.length - 1 ? '10px' : '0'} 52px`,
                        }}
                      >
                        <button
                          type="button"
                          data-track="product_order_settle_stat_rank_item_expand"
                          aria-expanded={itemExpanded}
                          onClick={() => {
                            setExpandedSalesItemIds((current) => {
                              const next = new Set(current)
                              if (next.has(itemExpansionId)) next.delete(itemExpansionId)
                              else next.add(itemExpansionId)
                              return next
                            })
                          }}
                          style={{
                            width: '100%',
                            display: 'grid',
                            gridTemplateColumns: 'minmax(0, 1fr) auto',
                            alignItems: 'center',
                            gap: spacing.md,
                            padding: isMobile ? '7px 9px' : '8px 10px',
                            background: colors.secondary[100],
                            border: 0,
                            borderRadius: borderRadius.md,
                            color: 'inherit',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <div
                            style={{
                              minWidth: 0,
                              display: 'flex',
                              alignItems: 'baseline',
                              gap: spacing.sm,
                            }}
                          >
                            <span
                              style={{
                                flexShrink: 0,
                                fontSize: getFontSize('caption', isMobile),
                                color: colors.text.disabled,
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {itemIndex + 1}.
                            </span>
                            <span
                              style={{
                                minWidth: 0,
                                fontSize: getFontSize('bodySmall', isMobile),
                                fontWeight: 500,
                                color: colors.text.primary,
                                lineHeight: 1.35,
                                overflowWrap: 'anywhere',
                              }}
                            >
                              {item.title}
                            </span>
                          </div>
                          <div
                            style={{
                              flexShrink: 0,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              color: colors.text.secondary,
                              fontSize: getFontSize('bodySmall', isMobile),
                              fontVariantNumeric: 'tabular-nums',
                              textAlign: 'right',
                            }}
                          >
                            <span>{item.qty} 件 · {formatCurrency(item.total, false)}</span>
                            <span
                              aria-hidden="true"
                              style={{
                                fontSize: getFontSize('caption', isMobile),
                                color: colors.text.disabled,
                                transform: itemExpanded ? 'rotate(180deg)' : 'none',
                                transition: 'transform 160ms ease',
                              }}
                            >
                              ▾
                            </span>
                          </div>
                        </button>
                        {itemExpanded && (
                          <div style={{ padding: '3px 8px 1px' }}>
                            {item.details.map((detail, detailIndex) => (
                              <div
                                key={detail.id}
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                                  gap: spacing.sm,
                                  padding: '4px 2px',
                                  borderTop:
                                    detailIndex > 0 ? `1px solid ${colors.border.light}` : 'none',
                                  color: colors.text.disabled,
                                  fontSize: getFontSize('caption', isMobile),
                                  lineHeight: 1.35,
                                }}
                              >
                                <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                                  {detail.title}
                                </span>
                                <span
                                  style={{
                                    flexShrink: 0,
                                    fontVariantNumeric: 'tabular-nums',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {detail.qty} 件 · {formatCurrency(detail.total, false)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </section>
              )
            })}
          </div>

          {!rankingOnly && (
            <>
              <h2
                style={{
                  margin: '0 0 16px',
                  fontSize: getFontSize('h3', isMobile),
                  fontWeight: 700,
                  lineHeight: 1.35,
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
                    borderRadius:
                      idx === 0 && isLast
                        ? borderRadius.lg
                        : idx === 0
                          ? `${borderRadius.lg} ${borderRadius.lg} 0 0`
                          : isLast
                            ? `0 0 ${borderRadius.lg} ${borderRadius.lg}`
                            : 0,
                    border: `1px solid ${colors.border.light}`,
                    borderTopWidth: idx === 0 ? 1 : 0,
                    boxShadow: expanded ? shadows.xs : 'none',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: isMobile ? 10 : 16,
                      padding: isMobile ? '13px 14px' : '15px 18px',
                      boxSizing: 'border-box',
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
                          title="在訂單中搜尋此訂單"
                          style={{
                            fontWeight: 600,
                            fontSize: getFontSize('body', isMobile),
                            lineHeight: 1.4,
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
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'baseline',
                          gap: '2px 6px',
                          fontSize: getFontSize('bodySmall', isMobile),
                          color: colors.text.secondary,
                          lineHeight: 1.45,
                        }}
                      >
                        <span>{row.contact_name}</span>
                        {row.charge_member_name && row.payment_method === 'balance' && (
                          <span style={{ color: colors.text.disabled }}>
                            扣款：{row.charge_member_name}
                          </span>
                        )}
                        <span style={{ color: colors.text.disabled }}>
                          · {extractDate(row.settled_at)} {extractTime(row.settled_at)}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-label={expanded ? '收合明細' : '展開明細'}
                      data-track="product_order_settle_stat_expand"
                      onClick={() => setExpandedId(expanded ? null : row.id)}
                      style={{
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: isMobile ? 6 : 10,
                        background: 'none',
                        border: 'none',
                        padding: isMobile ? '6px 0 6px 8px' : '6px 0 6px 12px',
                        cursor: 'pointer',
                        color: colors.text.primary,
                      }}
                    >
                      <span
                        style={{
                          fontSize: getFontSize('body', isMobile),
                          fontWeight: 700,
                          lineHeight: 1.4,
                          fontVariantNumeric: 'tabular-nums',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatCurrency(row.amount_total)}
                      </span>
                      <span
                        aria-hidden="true"
                        style={{
                          fontSize: getFontSize('caption', isMobile),
                          color: colors.text.disabled,
                          transform: expanded ? 'rotate(180deg)' : 'none',
                          transition: 'transform 160ms ease',
                        }}
                      >
                        ▼
                      </span>
                    </button>
                  </div>

                  {expanded && (
                    <div
                      style={{
                        padding: isMobile ? '0 14px 14px' : '14px 18px 16px',
                        borderTop: `1px solid ${colors.border.light}`,
                        overflowX: 'auto',
                      }}
                    >
                      {isMobile ? (
                        <div>
                          {row.items_snapshot.map((line, lineIdx) => {
                            const display =
                              variantDisplay[line.variant_id] ??
                              formatSettlementLineDisplay(line, null)
                            return (
                              <div
                                key={`${line.item_id}-${lineIdx}`}
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                                  gap: 12,
                                  padding: '12px 0',
                                  borderTop:
                                    lineIdx > 0 ? `1px solid ${colors.border.light}` : 'none',
                                }}
                              >
                                <div style={{ minWidth: 0 }}>
                                  <div
                                    style={{
                                      fontSize: getFontSize('body', true),
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
                                        marginTop: 2,
                                        fontSize: getFontSize('caption', true),
                                        color: colors.text.disabled,
                                        lineHeight: 1.4,
                                      }}
                                    >
                                      {display.subtitle}
                                    </div>
                                  )}
                                  <div
                                    style={{
                                      marginTop: 5,
                                      fontSize: getFontSize('bodySmall', true),
                                      color: colors.text.secondary,
                                      fontVariantNumeric: 'tabular-nums',
                                    }}
                                  >
                                    {line.qty} 件 × {formatCurrency(line.unit_price, false)}
                                  </div>
                                </div>
                                <strong
                                  style={{
                                    alignSelf: 'center',
                                    fontSize: getFontSize('body', true),
                                    color: colors.text.primary,
                                    fontVariantNumeric: 'tabular-nums',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {formatCurrency(line.line_total, false)}
                                </strong>
                              </div>
                            )
                          })}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'baseline',
                              paddingTop: 12,
                              borderTop: `1px solid ${colors.border.main}`,
                              fontSize: getFontSize('body', true),
                            }}
                          >
                            <span style={{ color: colors.text.secondary }}>合計</span>
                            <strong
                              style={{
                                color: colors.text.primary,
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {formatCurrency(row.amount_total, false)}
                            </strong>
                          </div>
                        </div>
                      ) : (
                        <table
                          style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            fontSize: getFontSize('bodySmall', false),
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
                      )}
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
          fontSize: getFontSize('body', isMobile),
          color: colors.text.secondary,
          fontWeight: 500,
          lineHeight: 1.4,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: getFontSize('body', isMobile),
          fontWeight: emphasize ? 700 : 600,
          color: colors.text.primary,
          textAlign: 'right',
          lineHeight: 1.4,
          fontVariantNumeric: 'tabular-nums',
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
