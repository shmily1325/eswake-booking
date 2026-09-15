/**
 * Design thinking:
 * Current dashboard feel:
 * 1. Too many equally weighted controls make sparse first-year data feel operationally dense.
 * 2. Nested brand → product panels organize around data structure instead of quick comparison.
 * 3. Decorative ranking treatments and repeated frames compete with the actual amounts and progress.
 * Information hierarchy: period and scope first, quiet totals second, compact brand context third,
 * then one product ranking with order-level detail available only on demand.
 * Primary task: compare sales or preorder progress quickly, then audit a specific product or settlement.
 * Visual direction: premium, calm grouped lists; restrained color, numeric ranks, generous touch targets,
 * and shallow expansion that stays readable on mobile.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { DateRangePicker } from '../../../components/DateRangePicker'
import { useToast } from '../../../components/ui'
import { useAuthUser } from '../../../contexts/AuthContext'
import { getVenueDateString } from '../../../utils/date'
import { formatCurrency, formatDateTime, extractDate, extractTime } from '../../../utils/formatters'
import { trackClickDedupedWithin } from '../../../utils/trackClick'
import { supabase } from '../../../lib/supabase'
import { designSystem, getButtonStyle, getFontSize } from '../../../styles/designSystem'
import { getCategory, getCategoryShopName } from '../products/schema'
import { fetchPreorderReportInRange, fetchSettlementsInRange } from './api'
import {
  summarizePreorderReport,
  type PreorderReportScope,
} from './preorderReport'
import { allocateSettlementAmount } from './settlementAllocation'
import {
  filterSettlementsBySearch,
  formatSettlementLineDisplay,
  settlementBatchMeta,
  settlementListTotal,
  type SettlementLineDisplay,
} from './settleUtils'
import type {
  OrderPaymentMethod,
  ShopOrderSettlementWithDetails,
  ShopPreorderReportLine,
} from './types'
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
type StatisticsSubtab = 'sales' | 'preorder' | 'details'
type DetailPaymentFilter = 'all' | OrderPaymentMethod

interface VariantSalesMeta {
  brand: string
  category: string
  productId: string
  productName: string
}

export function ShopSettlementStatisticsTab({ isMobile, rankingOnly = false }: Props) {
  const toast = useToast()
  const user = useAuthUser()
  const [selectedDate, setSelectedDate] = useState(() => getVenueDateString().slice(0, 4))
  const [preorderDate, setPreorderDate] = useState(() => getVenueDateString().slice(0, 4))
  const [detailDate, setDetailDate] = useState(() => getVenueDateString().slice(0, 4))
  const [activeSubtab, setActiveSubtab] = useState<StatisticsSubtab>('sales')
  const [salesGroupBy, setSalesGroupBy] = useState<SalesGroupBy>('brand')
  const [salesLoading, setSalesLoading] = useState(false)
  const [preorderLoading, setPreorderLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [settlements, setSettlements] = useState<ShopOrderSettlementWithDetails[]>([])
  const [detailRows, setDetailRows] = useState<ShopOrderSettlementWithDetails[]>([])
  const [preorderLines, setPreorderLines] = useState<ShopPreorderReportLine[]>([])
  const [detailSearch, setDetailSearch] = useState('')
  const [detailPaymentMethod, setDetailPaymentMethod] =
    useState<DetailPaymentFilter>('all')
  const [detailBrand, setDetailBrand] = useState('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedSalesGroupIds, setExpandedSalesGroupIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [expandedSalesItemIds, setExpandedSalesItemIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [variantDisplay, setVariantDisplay] = useState<Record<string, SettlementLineDisplay>>({})
  const [variantSalesMeta, setVariantSalesMeta] = useState<Record<string, VariantSalesMeta>>({})
  const loadedSalesDate = useRef('')
  const loadedPreorderDate = useRef('')
  const loadedDetailDate = useRef('')

  useEffect(() => {
    if (rankingOnly) return
    trackClickDedupedWithin(
      `product_order_settle_stat_view_${activeSubtab}`,
      user?.email,
      1_000,
    )
  }, [activeSubtab, rankingOnly, user?.email])

  useEffect(() => {
    if (!rankingOnly && activeSubtab !== 'sales') return
    if (loadedSalesDate.current === selectedDate) return
    let active = true
    setSalesLoading(true)
    const { start, end } = dateRangeFromSelection(selectedDate)
    void fetchSettlementsInRange(start, end)
      .then((rows) => {
        if (active) {
          setSettlements(rows)
          loadedSalesDate.current = selectedDate
        }
      })
      .catch((e: unknown) => {
        if (!active) return
        toast.error(e instanceof Error ? e.message : '載入銷售分析失敗')
        setSettlements([])
        loadedSalesDate.current = selectedDate
      })
      .finally(() => {
        if (active) setSalesLoading(false)
      })
    return () => {
      active = false
    }
  }, [activeSubtab, rankingOnly, selectedDate, toast])

  useEffect(() => {
    if (!rankingOnly && activeSubtab !== 'preorder') return
    const reportDate = rankingOnly ? selectedDate : preorderDate
    if (loadedPreorderDate.current === reportDate) return
    let active = true
    setPreorderLoading(true)
    const { start, end } = dateRangeFromSelection(reportDate)
    void fetchPreorderReportInRange(start, end)
      .then((rows) => {
        if (active) {
          setPreorderLines(rows)
          loadedPreorderDate.current = reportDate
        }
      })
      .catch((e: unknown) => {
        if (!active) return
        toast.error(e instanceof Error ? e.message : '載入預購進度失敗')
        setPreorderLines([])
        loadedPreorderDate.current = reportDate
      })
      .finally(() => {
        if (active) setPreorderLoading(false)
      })
    return () => {
      active = false
    }
  }, [activeSubtab, preorderDate, rankingOnly, selectedDate, toast])

  useEffect(() => {
    if (rankingOnly || activeSubtab !== 'details') return
    if (loadedDetailDate.current === detailDate) return
    let active = true
    setDetailLoading(true)
    const { start, end } = dateRangeFromSelection(detailDate)
    void fetchSettlementsInRange(start, end)
      .then((rows) => {
        if (active) {
          setDetailRows(rows)
          loadedDetailDate.current = detailDate
        }
      })
      .catch((e: unknown) => {
        if (!active) return
        toast.error(e instanceof Error ? e.message : '載入結帳明細失敗')
        setDetailRows([])
        loadedDetailDate.current = detailDate
      })
      .finally(() => {
        if (active) setDetailLoading(false)
      })
    return () => {
      active = false
    }
  }, [activeSubtab, detailDate, rankingOnly, toast])

  useEffect(() => {
    let active = true
    const variantIds = [
      ...new Set(
        [...settlements, ...detailRows].flatMap((row) =>
          row.items_snapshot.map((line) => line.variant_id),
        ),
      ),
    ]
    const loadVariantMetadata = async () => {
      if (variantIds.length > 0) {
        const { data: variants, error: variantErr } = await supabase
          .from('product_variants')
          .select(
            'id, vendor_code, attributes, product:products(id, brand, model, model_year, color, category)',
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
        if (active) {
          setVariantDisplay(labels)
          setVariantSalesMeta(salesMeta)
        }
      } else {
        setVariantDisplay({})
        setVariantSalesMeta({})
      }
    }
    void loadVariantMetadata().catch((e: unknown) => {
      if (active) toast.error(e instanceof Error ? e.message : '載入商品資料失敗')
    })
    return () => {
      active = false
    }
  }, [detailRows, settlements, toast])

  const summary = useMemo(() => {
    const byMethod: Record<OrderPaymentMethod, { count: number; total: number }> = {
      balance: { count: 0, total: 0 },
      transfer: { count: 0, total: 0 },
      cash: { count: 0, total: 0 },
    }
    let grandTotal = 0
    let qty = 0
    const orderIds = new Set<string>()
    for (const s of settlements) {
      grandTotal += s.amount_total
      orderIds.add(s.order_id)
      qty += s.items_snapshot.reduce((sum, line) => sum + line.qty, 0)
      byMethod[s.payment_method].count += 1
      byMethod[s.payment_method].total += s.amount_total
    }
    const orderCount = orderIds.size
    return {
      orderCount,
      qty,
      grandTotal,
      averagePerOrder: orderCount > 0 ? grandTotal / orderCount : 0,
      byMethod,
    }
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
      const allocatedTotals = allocateSettlementAmount(
        settlement.items_snapshot,
        settlement.amount_total,
      )
      for (const [lineIndex, line] of settlement.items_snapshot.entries()) {
        const allocatedTotal = allocatedTotals[lineIndex]
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
        group.total += allocatedTotal
        item.qty += line.qty
        item.total += allocatedTotal
        detail.qty += line.qty
        detail.total += allocatedTotal
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

  const allSalesGroupsExpanded =
    salesGroups.length > 0 && salesGroups.every((group) => expandedSalesGroupIds.has(group.id))
  const detailBrandOptions = useMemo(
    () => Array.from(new Set(
      detailRows.flatMap((row) =>
        row.items_snapshot.flatMap((line) => {
          const brand = variantSalesMeta[line.variant_id]?.brand
          return brand ? [brand] : []
        }),
      ),
    )).sort((a, b) => a.localeCompare(b)),
    [detailRows, variantSalesMeta],
  )
  const detailSettlements = useMemo(
    () => filterSettlementsBySearch(detailRows, detailSearch).filter((row) => {
      if (detailPaymentMethod !== 'all' && row.payment_method !== detailPaymentMethod) {
        return false
      }
      if (
        detailBrand !== 'all' &&
        !row.items_snapshot.some(
          (line) => variantSalesMeta[line.variant_id]?.brand === detailBrand,
        )
      ) {
        return false
      }
      return true
    }),
    [detailBrand, detailPaymentMethod, detailRows, detailSearch, variantSalesMeta],
  )
  const batchMeta = useMemo(() => settlementBatchMeta(detailRows), [detailRows])
  const activeDate =
    activeSubtab === 'preorder' ? preorderDate : activeSubtab === 'details' ? detailDate : selectedDate
  const activeLoading = rankingOnly
    ? salesLoading ||
      preorderLoading ||
      loadedSalesDate.current !== selectedDate ||
      loadedPreorderDate.current !== selectedDate
    : activeSubtab === 'sales'
      ? salesLoading || loadedSalesDate.current !== selectedDate
      : activeSubtab === 'preorder'
        ? preorderLoading || loadedPreorderDate.current !== preorderDate
        : detailLoading || loadedDetailDate.current !== detailDate
  const activeHasData = rankingOnly
    ? settlements.length > 0 || preorderLines.length > 0
    : activeSubtab === 'sales'
      ? settlements.length > 0
      : activeSubtab === 'preorder'
        ? preorderLines.length > 0
        : detailRows.length > 0

  return (
    <div
      style={{
        color: colors.text.primary,
        fontSize: getFontSize('body', isMobile),
        lineHeight: 1.45,
      }}
    >
      {!rankingOnly && (
        <div
          role="tablist"
          aria-label="商品訂單統計"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: isMobile ? 6 : spacing.sm,
            marginBottom: spacing.md,
          }}
        >
          {([
            ['sales', '銷售分析'],
            ['preorder', '預購進度'],
            ['details', '結帳明細'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              data-track={`product_order_settle_stat_tab_${value}`}
              aria-selected={activeSubtab === value}
              aria-controls={`product-order-stat-panel-${value}`}
              onClick={() => setActiveSubtab(value)}
              style={{
                ...getButtonStyle(
                  activeSubtab === value ? 'primary' : 'secondary',
                  isMobile ? 'small' : 'medium',
                  isMobile,
                ),
                minWidth: 0,
                paddingInline: isMobile ? 6 : undefined,
                boxShadow: 'none',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
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
          selectedDate={rankingOnly ? selectedDate : activeDate}
          onDateChange={
            rankingOnly || activeSubtab === 'sales'
              ? setSelectedDate
              : activeSubtab === 'preorder'
                ? setPreorderDate
                : setDetailDate
          }
          isMobile={isMobile}
          showTodayButton={!isMobile}
          label=""
          simplified
          showYearButtons
          trackPrefix={
            rankingOnly
              ? 'product_order_settle_stat_ranking_period'
              : activeSubtab === 'sales'
                ? 'product_order_settle_stat_sales_period'
                : activeSubtab === 'preorder'
                  ? 'product_order_settle_stat_preorder_period'
                  : 'product_order_settle_stat_details_period'
          }
        />
      </div>

      {activeLoading ? (
        <div style={{ textAlign: 'center', padding: 40, color: colors.text.disabled }}>載入中…</div>
      ) : !activeHasData ? (
        <div style={{ textAlign: 'center', padding: 40, color: colors.text.disabled }}>
          {activeDate.length === 10 ? '當日沒有紀錄' : activeDate.length === 4 ? '此年度尚無紀錄' : '當月沒有紀錄'}
        </div>
      ) : (
        <>
          {!rankingOnly && activeSubtab === 'sales' && settlements.length > 0 && (
            <div
              id="product-order-stat-panel-sales"
              role="tabpanel"
              style={{
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile
                    ? 'repeat(2, minmax(0, 1fr))'
                    : 'repeat(4, minmax(0, 1fr))',
                  gap: isMobile ? 8 : spacing.md,
                }}
              >
                <MetricCard
                  label="實收總額"
                  value={formatCurrency(summary.grandTotal, false)}
                  isMobile={isMobile}
                  emphasize
                />
                <MetricCard label="訂單數" value={`${summary.orderCount} 筆`} isMobile={isMobile} />
                <MetricCard label="售出件數" value={`${summary.qty} 件`} isMobile={isMobile} />
                <MetricCard
                  label="平均每單"
                  value={formatCurrency(summary.averagePerOrder, false)}
                  isMobile={isMobile}
                />
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
                  gap: isMobile ? 6 : spacing.md,
                  marginTop: spacing.sm,
                  padding: isMobile ? '10px 12px' : '11px 16px',
                  border: `1px solid ${colors.border.light}`,
                  borderRadius: borderRadius.md,
                  background: colors.secondary[50],
                  color: colors.text.secondary,
                  fontSize: getFontSize('bodySmall', isMobile),
                }}
              >
                <span>
                  扣儲值：{formatCurrency(summary.byMethod.balance.total, false)}
                  {' · '}{summary.byMethod.balance.count} 批
                </span>
                <span>
                  匯款＋現金：{formatCurrency(
                    summary.byMethod.transfer.total + summary.byMethod.cash.total,
                    false,
                  )}
                  {' · '}{summary.byMethod.transfer.count + summary.byMethod.cash.count} 批
                </span>
              </div>
            </div>
          )}

          {(rankingOnly || activeSubtab === 'sales') && settlements.length > 0 && (
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
                  依實收金額排序；折扣按每次結帳的品項原價小計比例分攤
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                <div
                  role="group"
                  aria-label="商品排行分組方式"
                  style={{
                    display: 'flex',
                    gap: spacing.sm,
                    flex: isMobile ? 1 : undefined,
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
                        setExpandedSalesGroupIds(new Set())
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
                {!isMobile && salesGroups.length > 1 && (
                  <button
                    type="button"
                    data-track="product_order_settle_stat_expand_all"
                    onClick={() => {
                      if (allSalesGroupsExpanded) {
                        setExpandedSalesGroupIds(new Set())
                        setExpandedSalesItemIds(new Set())
                        return
                      }
                      setExpandedSalesGroupIds(new Set(salesGroups.map((group) => group.id)))
                      setExpandedSalesItemIds(new Set(
                        salesGroups.flatMap((group) =>
                          group.items.map((item) => `${group.id}\u0000${item.id}`),
                        ),
                      ))
                    }}
                    style={{
                      ...getButtonStyle('secondary', 'small', false),
                      boxShadow: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {allSalesGroupsExpanded ? '全部收合' : '全部展開'}
                  </button>
                )}
              </div>
            </div>

            {salesGroups.map((group, groupIndex) => {
              const share = summary.grandTotal > 0
                ? Math.round((group.total / summary.grandTotal) * 100)
                : 0
              const expanded = expandedSalesGroupIds.has(group.id)
              const rankMark = ['🥇', '🥈', '🥉'][groupIndex]
              const rankBackground = ['#fff8e8', '#f5f7fa', '#fff3eb'][groupIndex]
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
                        setExpandedSalesGroupIds((current) => {
                          const next = new Set(current)
                          next.delete(group.id)
                          return next
                        })
                        setExpandedSalesItemIds((current) => {
                          const next = new Set(current)
                          group.items.forEach((item) => next.delete(`${group.id}\u0000${item.id}`))
                          return next
                        })
                        return
                      }
                      setExpandedSalesGroupIds((current) => new Set(current).add(group.id))
                      setExpandedSalesItemIds((current) => {
                        const next = new Set(current)
                        group.items.forEach((item) => next.add(`${group.id}\u0000${item.id}`))
                        return next
                      })
                    }}
                    style={{
                      width: '100%',
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1fr) auto',
                      alignItems: 'center',
                      gap: spacing.md,
                      padding: isMobile ? '11px 14px' : '13px 20px',
                      background: rankBackground || colors.background.card,
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
                          {rankMark || String(groupIndex + 1).padStart(2, '0')}
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
                          {group.qty} 件 ·{' '}
                          <strong style={{ color: colors.text.primary, fontWeight: 700 }}>
                            {formatCurrency(group.total, false)}
                          </strong>
                          {' '}· {share}%
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
                        {group.qty} 件 ·{' '}
                        <strong style={{ color: colors.text.primary, fontWeight: 700 }}>
                          {formatCurrency(group.total, false)}
                        </strong>
                        {' '}· {share}%
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
                    <span
                      aria-hidden="true"
                      style={{
                        gridColumn: '1 / -1',
                        display: 'block',
                        height: isMobile ? 4 : 5,
                        overflow: 'hidden',
                        borderRadius: borderRadius.full,
                        background: colors.secondary[100],
                      }}
                    >
                      <span
                        style={{
                          display: 'block',
                          width: `${share}%`,
                          height: '100%',
                          borderRadius: 'inherit',
                          background: colors.secondary[800],
                          transition: 'width 180ms ease',
                        }}
                      />
                    </span>
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
          )}

          {(rankingOnly || activeSubtab === 'preorder') && (
            <div
              id="product-order-stat-panel-preorder"
              role={rankingOnly ? undefined : 'tabpanel'}
            >
              <PreorderReportCard lines={preorderLines} isMobile={isMobile} />
            </div>
          )}

          {!rankingOnly && activeSubtab === 'details' && detailRows.length > 0 && (
            <>
              <div
                id="product-order-stat-panel-details"
                role="tabpanel"
                style={{
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  alignItems: isMobile ? 'stretch' : 'center',
                  justifyContent: 'space-between',
                  gap: spacing.md,
                  marginBottom: 16,
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
                    結帳明細
                  </h2>
                  {detailSearch.trim() && (
                    <div
                      style={{
                        marginTop: 4,
                        color: colors.text.secondary,
                        fontSize: getFontSize('caption', isMobile),
                      }}
                    >
                      找到 {detailSettlements.length} 筆
                    </div>
                  )}
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr 1fr' : '140px 140px minmax(220px, 280px)',
                    gap: 8,
                    width: isMobile ? '100%' : 'auto',
                  }}
                >
                  <select
                    value={detailPaymentMethod}
                    onChange={(event) =>
                      setDetailPaymentMethod(event.target.value as DetailPaymentFilter)}
                    aria-label="付款方式"
                    data-track="product_order_settle_stat_detail_payment"
                    style={detailControlStyle(isMobile)}
                  >
                    <option value="all">全部付款</option>
                    {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <select
                    value={detailBrand}
                    onChange={(event) => setDetailBrand(event.target.value)}
                    aria-label="商品品牌"
                    data-track="product_order_settle_stat_detail_brand"
                    style={detailControlStyle(isMobile)}
                  >
                    <option value="all">全部品牌</option>
                    {detailBrandOptions.map((brand) => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                  <input
                    type="search"
                    value={detailSearch}
                    onChange={(event) => setDetailSearch(event.target.value)}
                    placeholder="搜尋訂單號或訂購人"
                    aria-label="搜尋結帳明細"
                    data-track="product_order_settle_stat_detail_search"
                    style={{
                      ...detailControlStyle(isMobile),
                      gridColumn: isMobile ? '1 / -1' : undefined,
                    }}
                  />
                </div>
              </div>

              {detailSettlements.length === 0 ? (
                <div
                  style={{
                    padding: 32,
                    textAlign: 'center',
                    color: colors.text.disabled,
                    background: colors.background.card,
                    border: `1px solid ${colors.border.light}`,
                    borderRadius: borderRadius.lg,
                  }}
                >
                  找不到符合的結帳紀錄
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {detailSettlements.map((row, idx) => {
              const expanded = expandedId === row.id
              const isLast = idx === detailSettlements.length - 1
              const listTotal = settlementListTotal(row.items_snapshot)
              const batch = batchMeta[row.id]
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
                        {batch?.total > 1 && (
                          <span
                            style={{
                              fontSize: getFontSize('caption', isMobile),
                              padding: '2px 8px',
                              borderRadius: borderRadius.sm,
                              background: colors.info[50],
                              color: colors.info[700],
                              fontWeight: 500,
                            }}
                          >
                            同單第 {batch.index}/{batch.total} 批
                          </span>
                        )}
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
                            <span style={{ color: colors.text.secondary }}>結帳前小計</span>
                            <strong
                              style={{
                                color: colors.text.primary,
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {formatCurrency(listTotal, false)}
                            </strong>
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'baseline',
                              paddingTop: 8,
                              fontSize: getFontSize('body', true),
                            }}
                          >
                            <span style={{ color: colors.text.secondary }}>結帳金額</span>
                            <strong
                              style={{
                                color: colors.success[700],
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
                              結帳前小計
                            </td>
                            <td
                              style={{
                                ...tdStyle('right'),
                                fontWeight: 600,
                                color: colors.text.primary,
                              }}
                            >
                              {formatCurrency(listTotal, false)}
                            </td>
                          </tr>
                          <tr>
                            <td colSpan={3} style={{ ...tdStyle('right'), fontWeight: 600 }}>
                              結帳金額
                            </td>
                            <td
                              style={{
                                ...tdStyle('right'),
                                fontWeight: 700,
                                color: colors.success[700],
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
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

function PreorderReportCard({
  lines,
  isMobile,
}: {
  lines: readonly ShopPreorderReportLine[]
  isMobile: boolean
}) {
  const [scope, setScope] = useState<PreorderReportScope>('unfinished')
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(() => new Set())
  const summary = useMemo(
    () => summarizePreorderReport(lines, { scope }),
    [lines, scope],
  )

  return (
    <section
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
          padding: isMobile ? 16 : '18px 20px',
          borderBottom: `1px solid ${colors.border.light}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'stretch' : 'flex-start',
            justifyContent: 'space-between',
            gap: spacing.md,
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: getFontSize('h3', isMobile),
                fontWeight: 700,
                lineHeight: 1.35,
              }}
            >
              預購進度
            </h2>
            <p
              style={{
                margin: `${spacing.xs} 0 0`,
                color: colors.text.secondary,
                fontSize: getFontSize('caption', isMobile),
              }}
            >
              依開單日期統計；金額為訂單金額，不是實收金額；不含作廢訂單
            </p>
          </div>
          <div
            role="group"
            aria-label="預購顯示範圍"
            style={{ display: 'flex', gap: 6, minWidth: isMobile ? 0 : 176 }}
          >
            {([
              ['unfinished', '未完成'],
              ['all', '全部'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                data-track={`product_order_settle_stat_preorder_scope_${value}`}
                aria-pressed={scope === value}
                onClick={() => setScope(value)}
                style={{
                  ...getButtonStyle(scope === value ? 'primary' : 'secondary', 'small', isMobile),
                  flex: 1,
                  minHeight: 44,
                  boxShadow: 'none',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {summary.orderCount > 0 && (
          <>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: isMobile ? '4px 12px' : '4px 18px',
                marginTop: spacing.md,
                color: colors.text.primary,
                fontSize: getFontSize('body', isMobile),
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <strong>{summary.orderCount} 筆訂單</strong>
              <strong>{summary.qty} 件</strong>
              <strong>{formatCurrency(summary.amount, false)} 訂單金額</strong>
            </div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '4px 12px',
                marginTop: spacing.sm,
                color: colors.text.secondary,
                fontSize: getFontSize('bodySmall', isMobile),
              }}
            >
              <span>等貨 {summary.waiting} 件</span>
              <span>待付款 {summary.pending} 件</span>
              <span>已完成 {summary.paid} 件</span>
            </div>
          </>
        )}
      </div>

      {summary.products.length === 0 ? (
        <div style={{ padding: 28, textAlign: 'center', color: colors.text.disabled }}>
          {scope === 'unfinished' ? '此期間沒有未完成預購' : '此期間沒有預購訂單'}
        </div>
      ) : (
        <>
          <div style={{ padding: isMobile ? '16px 14px 10px' : '18px 20px 10px' }}>
            <h3
              style={{
                margin: 0,
                fontSize: getFontSize('body', isMobile),
                fontWeight: 700,
                color: colors.text.primary,
              }}
            >
              品牌排行
            </h3>
            <p
              style={{
                margin: `${spacing.xs} 0 0`,
                color: colors.text.disabled,
                fontSize: getFontSize('caption', isMobile),
              }}
            >
              依訂單金額排序
            </p>
          </div>
          <div style={{ padding: isMobile ? '0 14px 16px' : '0 20px 18px' }}>
            {summary.brands.map((brand, index) => {
              const share = summary.amount > 0
                ? Math.round((brand.amount / summary.amount) * 100)
                : 0
              return (
                <div
                  key={brand.brand}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    gap: '6px 12px',
                    padding: '9px 0',
                    borderTop: index > 0 ? `1px solid ${colors.border.light}` : 'none',
                  }}
                >
                  <span
                    style={{
                      minWidth: 0,
                      color: colors.text.primary,
                      fontSize: getFontSize('bodySmall', isMobile),
                      fontWeight: 600,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {brand.brand}
                  </span>
                  <span
                    style={{
                      color: colors.text.secondary,
                      fontSize: getFontSize('bodySmall', isMobile),
                      fontVariantNumeric: 'tabular-nums',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {brand.qty} 件 · {formatCurrency(brand.amount, false)} · {share}%
                  </span>
                  <span
                    aria-hidden="true"
                    style={{
                      gridColumn: '1 / -1',
                      height: 3,
                      overflow: 'hidden',
                      borderRadius: borderRadius.full,
                      background: colors.secondary[100],
                    }}
                  >
                    <span
                      style={{
                        display: 'block',
                        width: `${share}%`,
                        height: '100%',
                        borderRadius: 'inherit',
                        background: colors.secondary[600],
                      }}
                    />
                  </span>
                </div>
              )
            })}
          </div>

          <div
            style={{
              padding: isMobile ? '14px 14px 8px' : '16px 20px 8px',
              borderTop: `1px solid ${colors.border.light}`,
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: getFontSize('body', isMobile),
                fontWeight: 700,
                color: colors.text.primary,
              }}
            >
              貨品排行
            </h3>
            <p
              style={{
                margin: `${spacing.xs} 0 0`,
                color: colors.text.disabled,
                fontSize: getFontSize('caption', isMobile),
              }}
            >
              相同商品款式合併，依訂單金額排序
            </p>
          </div>

          {summary.products.map((product, index) => {
            const expanded = expandedProducts.has(product.id)
            const share = summary.amount > 0
              ? Math.round((product.amount / summary.amount) * 100)
              : 0
            return (
              <div
                key={product.id}
                style={{
                  borderTop: index > 0 ? `1px solid ${colors.border.light}` : 'none',
                }}
              >
                <button
                  type="button"
                  data-track="product_order_settle_stat_preorder_product_expand"
                  aria-expanded={expanded}
                  aria-label={`${expanded ? '收合' : '展開'} ${product.title} 規格與訂單`}
                  onClick={() =>
                    setExpandedProducts((current) => {
                      const next = new Set(current)
                      if (next.has(product.id)) next.delete(product.id)
                      else next.add(product.id)
                      return next
                    })
                  }
                  style={{
                    width: '100%',
                    minHeight: 56,
                    display: 'grid',
                    gridTemplateColumns: 'auto minmax(0, 1fr) auto',
                    alignItems: 'center',
                    gap: isMobile ? 9 : 12,
                    padding: isMobile ? '11px 14px' : '12px 20px',
                    background: colors.background.card,
                    border: 0,
                    color: 'inherit',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span
                    style={{
                      color: colors.text.disabled,
                      fontSize: getFontSize('caption', isMobile),
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        color: colors.text.primary,
                        fontSize: getFontSize('body', isMobile),
                        fontWeight: 600,
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {product.title}
                    </div>
                    <div
                      style={{
                        marginTop: 3,
                        color: colors.text.secondary,
                        fontSize: getFontSize('caption', isMobile),
                      }}
                    >
                      等貨 {product.waiting} · 待付款 {product.pending} · 已完成 {product.paid}
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      color: colors.text.secondary,
                      fontSize: getFontSize('bodySmall', isMobile),
                      fontVariantNumeric: 'tabular-nums',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span>
                      {product.qty} 件 · <strong>{formatCurrency(product.amount, false)}</strong> · {share}%
                    </span>
                    <span
                      aria-hidden="true"
                      style={{
                        color: colors.text.disabled,
                        transform: expanded ? 'rotate(180deg)' : 'none',
                        transition: 'transform 160ms ease',
                      }}
                    >
                      ▾
                    </span>
                  </div>
                </button>

                {expanded && (
                  <div
                    style={{
                      padding: isMobile ? '0 14px 10px' : '0 20px 12px 52px',
                      background: colors.secondary[50],
                    }}
                  >
                    {product.variants.map((variant, variantIndex) => (
                      <div
                        key={variant.id}
                        style={{
                          padding: '10px 0 6px',
                          borderTop:
                            variantIndex > 0 ? `1px solid ${colors.border.light}` : 'none',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 10,
                            color: colors.text.secondary,
                            fontSize: getFontSize('bodySmall', isMobile),
                          }}
                        >
                          <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                            {variant.subtitle || '一般規格'}
                          </span>
                          <span style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
                            {variant.qty} 件 · {formatCurrency(variant.amount, false)}
                          </span>
                        </div>
                        {variant.orders.map((order) => (
                          <div
                            key={order.orderId}
                            style={{
                              minHeight: 44,
                              display: 'grid',
                              gridTemplateColumns: 'minmax(0, 1fr) auto',
                              alignItems: 'center',
                              gap: 10,
                              padding: isMobile ? '6px 0' : '6px 0 6px 12px',
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <Link
                                to={`/products/orders?q=${encodeURIComponent(order.orderNo)}`}
                                data-track="product_order_settle_stat_preorder_order_link"
                                style={{
                                  color: colors.text.primary,
                                  fontWeight: 600,
                                  textDecoration: 'none',
                                }}
                              >
                                {order.orderNo}
                              </Link>
                              <div
                                style={{
                                  marginTop: 2,
                                  color: colors.text.secondary,
                                  fontSize: getFontSize('caption', isMobile),
                                }}
                              >
                                {order.contactName} · {extractDate(order.createdAt)}
                              </div>
                            </div>
                            <span
                              style={{
                                color: colors.text.secondary,
                                fontSize: getFontSize('caption', isMobile),
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {order.qty} 件 · {formatCurrency(order.amount, false)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}
    </section>
  )
}

function MetricCard({
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
        minWidth: 0,
        minHeight: isMobile ? 86 : 96,
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: spacing.sm,
        padding: isMobile ? '12px' : '15px 16px',
        border: `1px solid ${emphasize ? colors.secondary[300] : colors.border.light}`,
        borderRadius: borderRadius.md,
        background: emphasize ? colors.secondary[100] : colors.background.card,
      }}
    >
      <span
        style={{
          fontSize: getFontSize('bodySmall', isMobile),
          color: colors.text.secondary,
          fontWeight: 500,
          lineHeight: 1.4,
        }}
      >
        {label}
      </span>
      <span
        style={{
          minWidth: 0,
          fontSize: emphasize
            ? getFontSize(isMobile ? 'body' : 'h3', isMobile)
            : getFontSize('body', isMobile),
          fontWeight: 700,
          color: colors.text.primary,
          lineHeight: 1.4,
          fontVariantNumeric: 'tabular-nums',
          overflowWrap: 'anywhere',
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

function detailControlStyle(isMobile: boolean) {
  return {
    width: '100%',
    minWidth: 0,
    minHeight: isMobile ? 44 : 40,
    boxSizing: 'border-box',
    padding: '9px 10px',
    border: `1px solid ${colors.border.main}`,
    borderRadius: borderRadius.md,
    background: colors.background.card,
    color: colors.text.primary,
    fontSize: getFontSize('bodySmall', isMobile),
    outline: 'none',
  } as const
}
