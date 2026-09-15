/**
 * 商品營運第一版聚焦三件事：期間實收、前期變化、完整品牌／貨品排行。
 * 不呈現待處理資料，並以留白與 grouped list 取代密集卡片牆。
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthUser } from '../../../../contexts/AuthContext'
import { useResponsive } from '../../../../hooks/useResponsive'
import { supabase } from '../../../../lib/supabase'
import { designSystem, getFontSize } from '../../../../styles/designSystem'
import { getCalendarDateString, getVenueDateString } from '../../../../utils/date'
import { formatCurrency } from '../../../../utils/formatters'
import { trackClickDedupedWithin } from '../../../../utils/trackClick'
import { fetchSettlementsInRange } from '../../orders/api'
import type { ShopOrderSettlementWithDetails } from '../../orders/types'
import {
  compareProductPeriods,
  getProductPeriodRange,
  summarizeProductOperations,
  type ProductOperationsSummary,
  type ProductPeriodMode,
  type ProductRankingRow,
  type ProductVariantMetadata,
} from '../productSummary'

interface ProductTabProps {
  refreshToken: number
  onLoadComplete: () => void
}

const { colors, borderRadius, shadows, spacing } = designSystem
const EMPTY_SUMMARY: ProductOperationsSummary = {
  amount: 0,
  orderCount: 0,
  qty: 0,
  averagePerOrder: 0,
  brands: [],
  products: [],
  monthlyAmounts: Array.from({ length: 12 }, () => 0),
}

function periodButtonStyle(active: boolean, isMobile: boolean) {
  return {
    flex: 1,
    minHeight: 44,
    padding: '9px 16px',
    border: 'none',
    borderRadius: borderRadius.md,
    background: active ? colors.background.card : 'transparent',
    color: active ? colors.primary[600] : colors.text.secondary,
    fontSize: getFontSize('button', isMobile),
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
    boxShadow: active ? shadows.sm : 'none',
  } as const
}

function choiceButtonStyle(active: boolean, isMobile: boolean) {
  return {
    minHeight: 44,
    padding: '9px 14px',
    borderRadius: borderRadius.md,
    border: `1px solid ${active ? colors.primary[500] : colors.border.main}`,
    background: active ? colors.primary[500] : colors.background.card,
    color: active ? 'white' : colors.text.secondary,
    fontSize: getFontSize('button', isMobile),
    fontWeight: active ? 600 : 500,
    cursor: 'pointer',
  } as const
}

function comparisonText(current: number, previous: number, periodLabel: string): string {
  const comparison = compareProductPeriods(current, previous)
  if (comparison.direction === 'same') return `與${periodLabel}持平`
  if (comparison.percentage === null) {
    return current > 0 ? `${periodLabel}無實收，本期新增收入` : `${periodLabel}與本期皆無實收`
  }
  const sign = comparison.direction === 'up' ? '+' : ''
  return `較${periodLabel} ${sign}${comparison.percentage.toFixed(1)}%`
}

export function ProductTab({ refreshToken, onLoadComplete }: ProductTabProps) {
  const user = useAuthUser()
  const { isMobile } = useResponsive()
  const today = getVenueDateString()
  const currentYear = Number(today.slice(0, 4))
  const [periodMode, setPeriodMode] = useState<ProductPeriodMode>('monthly')
  const [selectedMonth, setSelectedMonth] = useState(today.slice(0, 7))
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [summary, setSummary] = useState(EMPTY_SUMMARY)
  const [previousAmount, setPreviousAmount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const quickMonths = useMemo(() => (
    Array.from({ length: 6 }, (_, index) => {
      const [year, month] = today.split('-').map(Number)
      const date = getCalendarDateString(year, month - 1 - index, 1)
      const value = date.slice(0, 7)
      const [optionYear, optionMonth] = value.split('-').map(Number)
      return {
        value,
        label: optionYear === currentYear ? `${optionMonth}月` : `${optionYear}/${optionMonth}月`,
      }
    })
  ), [currentYear, today])

  useEffect(() => {
    trackClickDedupedWithin('dashboard_product_view', user?.email, 1_000)
  }, [user?.email])

  useEffect(() => {
    let active = true
    const range = getProductPeriodRange(periodMode, selectedMonth, selectedYear)
    setLoading(true)
    setError('')

    void Promise.all([
      fetchSettlementsInRange(range.current.start, range.current.end),
      fetchSettlementsInRange(range.previous.start, range.previous.end),
    ])
      .then(async ([currentRows, previousRows]) => {
        const variantIds = Array.from(new Set(
          [...currentRows, ...previousRows].flatMap((settlement) =>
            settlement.items_snapshot.map((line) => line.variant_id).filter(Boolean),
          ),
        ))
        const metadata: Record<string, ProductVariantMetadata> = {}

        if (variantIds.length > 0) {
          const { data, error: metadataError } = await supabase
            .from('product_variants')
            .select('id, product:products(id, brand, model, model_year)')
            .in('id', variantIds)
          if (metadataError) throw metadataError

          data?.forEach((variant) => {
            metadata[variant.id] = {
              variantId: variant.id,
              productId: variant.product?.id ?? null,
              brand: variant.product?.brand ?? null,
              model: variant.product?.model ?? null,
              modelYear: variant.product?.model_year ?? null,
            }
          })
        }

        if (!active) return
        setSummary(summarizeProductOperations(
          currentRows as ShopOrderSettlementWithDetails[],
          metadata,
          periodMode === 'annual' ? selectedYear : undefined,
        ))
        setPreviousAmount(summarizeProductOperations(
          previousRows as ShopOrderSettlementWithDetails[],
          metadata,
        ).amount)
      })
      .catch((loadError: unknown) => {
        if (!active) return
        setSummary(EMPTY_SUMMARY)
        setPreviousAmount(0)
        setError(loadError instanceof Error ? loadError.message : '載入商品營運資料失敗')
      })
      .finally(() => {
        if (!active) return
        setLoading(false)
        onLoadComplete()
      })

    return () => {
      active = false
    }
    // onLoadComplete 只回報完成，不應因父層 render 觸發重抓。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodMode, refreshToken, selectedMonth, selectedYear])

  const isMonthly = periodMode === 'monthly'
  const periodLabel = isMonthly ? '上月' : '上年'

  return (
    <div style={{ color: colors.text.primary, fontSize: getFontSize('body', isMobile) }}>
      <section style={{
        padding: spacing.md,
        marginBottom: spacing.lg,
        background: colors.background.card,
        border: `1px solid ${colors.border.light}`,
        borderRadius: borderRadius.lg,
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}>
          <div style={{
            display: 'flex',
            width: isMobile ? '100%' : 220,
            padding: 4,
            background: colors.background.hover,
            borderRadius: borderRadius.lg,
          }}>
            <button
              type="button"
              data-track="dashboard_product_period_monthly"
              aria-pressed={isMonthly}
              onClick={() => setPeriodMode('monthly')}
              style={periodButtonStyle(isMonthly, isMobile)}
            >
              按月
            </button>
            <button
              type="button"
              data-track="dashboard_product_period_annual"
              aria-pressed={!isMonthly}
              onClick={() => setPeriodMode('annual')}
              style={periodButtonStyle(!isMonthly, isMobile)}
            >
              按年
            </button>
          </div>

          {isMonthly ? (
            <>
              {quickMonths.slice(0, isMobile ? 4 : 6).map((month) => (
                <button
                  key={month.value}
                  type="button"
                  data-track={`dashboard_product_month_shortcut_${month.value}`}
                  onClick={() => setSelectedMonth(month.value)}
                  style={choiceButtonStyle(selectedMonth === month.value, isMobile)}
                >
                  {month.label}
                </button>
              ))}
              <input
                type="month"
                aria-label="選擇商品統計月份"
                data-track="dashboard_product_month_input"
                value={selectedMonth}
                max={today.slice(0, 7)}
                onChange={(event) => event.target.value && setSelectedMonth(event.target.value)}
                style={{
                  minWidth: 0,
                  minHeight: 44,
                  padding: '9px 12px',
                  boxSizing: 'border-box',
                  border: `1px solid ${colors.border.main}`,
                  borderRadius: borderRadius.md,
                  background: colors.background.card,
                  color: colors.text.secondary,
                  fontSize: getFontSize('button', isMobile),
                }}
              />
            </>
          ) : (
            Array.from({ length: 4 }, (_, index) => currentYear - index).map((year) => (
              <button
                key={year}
                type="button"
                data-track={`dashboard_product_year_${year}`}
                onClick={() => setSelectedYear(year)}
                style={choiceButtonStyle(selectedYear === year, isMobile)}
              >
                {year}年
              </button>
            ))
          )}
        </div>
      </section>

      {loading ? (
        <StatusMessage>載入商品營運資料中…</StatusMessage>
      ) : error ? (
        <StatusMessage>
          <strong style={{ display: 'block', marginBottom: spacing.xs }}>無法載入商品營運資料</strong>
          <span>{error}</span>
        </StatusMessage>
      ) : (
        <>
          <section style={{ marginBottom: spacing.xl }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile
                ? 'repeat(2, minmax(0, 1fr))'
                : 'repeat(4, minmax(0, 1fr))',
              gap: isMobile ? spacing.sm : spacing.md,
            }}>
              <Metric label="實收總額" value={formatCurrency(summary.amount, false)} isMobile={isMobile} />
              <Metric label="訂單數" value={`${summary.orderCount} 筆`} isMobile={isMobile} />
              <Metric label="售出件數" value={`${summary.qty} 件`} isMobile={isMobile} />
              <Metric label="平均每單" value={formatCurrency(summary.averagePerOrder, false)} isMobile={isMobile} />
            </div>
            <p style={{
              margin: `${spacing.sm} 0 0`,
              color: colors.text.secondary,
              fontSize: getFontSize('bodySmall', isMobile),
              fontVariantNumeric: 'tabular-nums',
            }}>
              {comparisonText(summary.amount, previousAmount, periodLabel)}
              {' · '}{periodLabel} {formatCurrency(previousAmount, false)}
            </p>
          </section>

          {summary.orderCount === 0 ? (
            <StatusMessage>此期間尚無商品實收資料</StatusMessage>
          ) : (
            <>
              {!isMonthly && (
                <AnnualTrend amounts={summary.monthlyAmounts} isMobile={isMobile} />
              )}
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))',
                gap: spacing.lg,
                minWidth: 0,
              }}>
                <RankingList title="品牌排行" rows={summary.brands} track="dashboard_product_brand_row" isMobile={isMobile} />
                <RankingList title="貨品排行" rows={summary.products} track="dashboard_product_product_row" isMobile={isMobile} />
              </div>
              <Link
                to="/order-settle?tab=statistics"
                data-track="dashboard_product_full_statistics_link"
                style={{
                  display: 'inline-flex',
                  minHeight: 44,
                  alignItems: 'center',
                  marginTop: spacing.lg,
                  color: colors.text.primary,
                  fontSize: getFontSize('button', isMobile),
                  fontWeight: 600,
                  textDecoration: 'underline',
                  textUnderlineOffset: 4,
                }}
              >
                查看完整統計
              </Link>
            </>
          )}
        </>
      )}
    </div>
  )
}

function Metric({ label, value, isMobile }: { label: string; value: string; isMobile: boolean }) {
  return (
    <div style={{
      minWidth: 0,
      padding: isMobile ? spacing.md : spacing.lg,
      background: colors.background.card,
      border: `1px solid ${colors.border.light}`,
      borderRadius: borderRadius.lg,
    }}>
      <div style={{ color: colors.text.secondary, fontSize: getFontSize('bodySmall', isMobile) }}>
        {label}
      </div>
      <strong style={{
        display: 'block',
        marginTop: spacing.sm,
        color: colors.text.primary,
        fontSize: getFontSize('h3', isMobile),
        fontVariantNumeric: 'tabular-nums',
        overflowWrap: 'anywhere',
      }}>
        {value}
      </strong>
    </div>
  )
}

function AnnualTrend({ amounts, isMobile }: { amounts: number[]; isMobile: boolean }) {
  const max = Math.max(...amounts, 0)
  return (
    <section style={{ marginBottom: spacing.xl, minWidth: 0 }}>
      <h2 style={{ margin: `0 0 ${spacing.md}`, fontSize: getFontSize('h3', isMobile) }}>
        每月實收趨勢
      </h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(6, minmax(0, 1fr))' : 'repeat(12, minmax(0, 1fr))',
        gap: isMobile ? spacing.xs : spacing.sm,
        minWidth: 0,
      }}>
        {amounts.map((amount, index) => (
          <div key={index} style={{ minWidth: 0, textAlign: 'center' }}>
            <div style={{
              height: 104,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              background: colors.background.card,
              borderBottom: `1px solid ${colors.border.main}`,
            }}>
              <span
                title={`${index + 1}月 ${formatCurrency(amount, false)}`}
                style={{
                  width: '60%',
                  minHeight: amount > 0 ? 4 : 0,
                  height: max > 0 ? `${(amount / max) * 100}%` : 0,
                  background: colors.secondary[700],
                  borderRadius: `${borderRadius.sm} ${borderRadius.sm} 0 0`,
                }}
              />
            </div>
            <span style={{
              display: 'block',
              marginTop: spacing.xs,
              color: colors.text.secondary,
              fontSize: getFontSize('caption', isMobile),
            }}>
              {index + 1}月
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

function RankingList({
  title,
  rows,
  track,
  isMobile,
}: {
  title: string
  rows: ProductRankingRow[]
  track: string
  isMobile: boolean
}) {
  return (
    <section style={{
      minWidth: 0,
      overflow: 'hidden',
      background: colors.background.card,
      border: `1px solid ${colors.border.light}`,
      borderRadius: borderRadius.lg,
    }}>
      <div style={{ padding: `${spacing.lg} ${spacing.lg} ${spacing.sm}` }}>
        <h2 style={{ margin: 0, fontSize: getFontSize('h3', isMobile) }}>{title}</h2>
        <p style={{
          margin: `${spacing.xs} 0 0`,
          color: colors.text.secondary,
          fontSize: getFontSize('caption', isMobile),
        }}>
          依實收金額排序
        </p>
      </div>
      {rows.map((row, index) => (
        <Link
          key={row.id}
          to="/order-settle?tab=statistics"
          data-track={track}
          style={{
            minHeight: 52,
            display: 'grid',
            gridTemplateColumns: 'auto minmax(0, 1fr)',
            alignItems: 'center',
            gap: spacing.md,
            padding: `${spacing.sm} ${spacing.lg}`,
            boxSizing: 'border-box',
            borderTop: `1px solid ${colors.border.light}`,
            color: 'inherit',
            textDecoration: 'none',
          }}
        >
          <span style={{
            color: colors.text.disabled,
            fontSize: getFontSize('caption', isMobile),
            fontVariantNumeric: 'tabular-nums',
          }}>
            {String(index + 1).padStart(2, '0')}
          </span>
          <div style={{ minWidth: 0 }}>
            <strong style={{
              display: 'block',
              color: colors.text.primary,
              fontSize: getFontSize('body', isMobile),
              fontWeight: 600,
              overflowWrap: 'anywhere',
            }}>
              {row.name}
            </strong>
            <span style={{
              display: 'block',
              marginTop: spacing.xs,
              color: colors.text.secondary,
              fontSize: getFontSize('bodySmall', isMobile),
              fontVariantNumeric: 'tabular-nums',
              overflowWrap: 'anywhere',
            }}>
              {row.qty} 件 · {formatCurrency(row.amount, false)} · {row.share.toFixed(1)}%
            </span>
          </div>
        </Link>
      ))}
    </section>
  )
}

function StatusMessage({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: spacing.xl,
      textAlign: 'center',
      color: colors.text.secondary,
      background: colors.background.card,
      border: `1px solid ${colors.border.light}`,
      borderRadius: borderRadius.lg,
    }}>
      {children}
    </div>
  )
}
