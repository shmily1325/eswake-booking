import { useMemo, useState } from 'react'
import { designSystem, getFontSize } from '../styles/designSystem'
import type { CoachLedgerMetricRows } from './coachLedgerTypes'

interface ServiceRow {
  coachId: string
  coachName: string
  teachingMinutes: number
  teachingCount: number
  drivingMinutes: number
  drivingCount: number
}

interface Props {
  isMobile: boolean
  serviceRows: ServiceRow[]
  performanceRows: CoachLedgerMetricRows
}

interface OverviewRow {
  id: string
  name: string
  teaching: number
  teachingCount: number
  driving: number
  drivingCount: number
  lesson: number
  lessonCount: number
  credit: number
  regularCredit: number
  giftCredit: number
  product: number
  productCount: number
}

const emptyRow = (id: string, name: string): OverviewRow => ({
  id,
  name,
  teaching: 0,
  teachingCount: 0,
  driving: 0,
  drivingCount: 0,
  lesson: 0,
  lessonCount: 0,
  credit: 0,
  regularCredit: 0,
  giftCredit: 0,
  product: 0,
  productCount: 0,
})

// Exported for deterministic report aggregation tests.
// eslint-disable-next-line react-refresh/only-export-components
export function buildCoachLedgerOverview(
  serviceRows: ServiceRow[],
  performanceRows: CoachLedgerMetricRows,
): OverviewRow[] {
  const rows = new Map<string, OverviewRow>()
  const getRow = (id: string, name: string) => {
    const row = rows.get(id) ?? emptyRow(id, name)
    rows.set(id, row)
    return row
  }

  serviceRows.forEach((source) => {
    const row = getRow(source.coachId, source.coachName)
    row.teaching = source.teachingMinutes
    row.teachingCount = source.teachingCount
    row.driving = source.drivingMinutes
    row.drivingCount = source.drivingCount
  })
  performanceRows.designated_lesson.forEach((source) => {
    const row = getRow(source.id, source.name)
    row.lesson = source.value
    row.lessonCount = source.count
  })
  performanceRows.designated_credit.forEach((source) => {
    const row = getRow(source.id, source.name)
    row.credit = source.value
    row.regularCredit = source.regularValue ?? 0
    row.giftCredit = source.giftValue ?? 0
  })
  performanceRows.product.forEach((source) => {
    const row = getRow(source.id, source.name)
    row.product = source.value
    row.productCount = source.count
  })

  return [...rows.values()]
    .filter((row) => row.id !== 'unassigned')
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function CoachLedgerOverview({
  isMobile,
  serviceRows,
  performanceRows,
}: Props) {
  type SortKey = 'teaching' | 'driving' | 'lesson' | 'credit' | 'product'
  const [sort, setSort] = useState<{ key: SortKey | null; direction: 'asc' | 'desc' }>({
    key: null,
    direction: 'asc',
  })
  const rows = useMemo(
    () => {
      const next = buildCoachLedgerOverview(serviceRows, performanceRows)
      return next.sort((a, b) => {
        if (sort.key === null) {
          const result = a.name.localeCompare(b.name)
          return result
        }
        const result = a[sort.key] - b[sort.key]
        return sort.direction === 'asc' ? result : -result
      })
    },
    [performanceRows, serviceRows, sort],
  )

  const setSortKey = (key: SortKey) => {
    setSort((current) => ({
      key,
      direction: current.key === key
        ? current.direction === 'desc' ? 'asc' : 'desc'
        : 'desc',
    }))
  }
  const sortMark = (key: SortKey) => sort.key === key
    ? (sort.direction === 'desc' ? ' ↓' : ' ↑')
    : ' ↕'
  const value = (amount: number, suffix = '分') => amount === 0
    ? '—'
    : `${amount.toLocaleString()} ${suffix}`
  const SortButton = ({ sortKey, children }: { sortKey: SortKey; children: string }) => (
    <button
      type="button"
      data-track={`statistics_coach_overview_sort_${sortKey}`}
      onClick={() => setSortKey(sortKey)}
      aria-label={`${children}排序`}
      style={{
        width: 28,
        height: 28,
        padding: 0,
        border: `1px solid ${sort.key === sortKey
          ? designSystem.colors.border.dark
          : designSystem.colors.border.main}`,
        borderRadius: designSystem.borderRadius.sm,
        background: designSystem.colors.background.card,
        color: designSystem.colors.text.secondary,
        fontSize: getFontSize('bodySmall', isMobile),
        fontWeight: 600,
        cursor: 'pointer',
        lineHeight: 1,
      }}
    >
      {sortMark(sortKey).trim()}
    </button>
  )

  return (
    <section style={{ marginBottom: designSystem.spacing.xl }}>
      {rows.length === 0 ? (
        <div style={{
          padding: 32,
          textAlign: 'center',
          color: designSystem.colors.text.secondary,
          fontSize: getFontSize('body', isMobile),
        }}>
          此期間尚無教練數據
        </div>
      ) : isMobile ? (
        <div style={{ display: 'grid', gap: designSystem.spacing.md }}>
          {rows.map((row) => (
            <article
              key={row.id}
              style={{
                padding: designSystem.spacing.md,
                border: `1px solid ${designSystem.colors.border.light}`,
                borderRadius: designSystem.borderRadius.lg,
                background: designSystem.colors.background.card,
              }}
            >
              <h3 style={{
                margin: `0 0 ${designSystem.spacing.md}`,
                fontSize: getFontSize('bodyLarge', true),
                color: designSystem.colors.text.primary,
              }}>
                {row.name}
              </h3>
              {[
                {
                  label: '教學／駕駛',
                  first: ['教學', value(row.teaching)],
                  second: ['駕駛', value(row.driving)],
                },
                {
                  label: '指定課',
                  first: ['單堂', value(row.lesson)],
                  second: ['售出', value(row.credit)],
                },
              ].map((group) => (
                <div
                  key={group.label}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '88px 1fr 1fr',
                    gap: 8,
                    alignItems: 'baseline',
                    padding: '10px 0',
                    borderTop: `1px solid ${designSystem.colors.border.light}`,
                  }}
                >
                  <span style={{ color: designSystem.colors.text.secondary, fontSize: getFontSize('bodySmall', true) }}>
                    {group.label}
                  </span>
                  <span>
                    <span style={{ display: 'block', color: designSystem.colors.text.disabled, fontSize: getFontSize('caption', true) }}>{group.first[0]}</span>
                    <strong>{group.first[1]}</strong>
                  </span>
                  <span>
                    <span style={{ display: 'block', color: designSystem.colors.text.disabled, fontSize: getFontSize('caption', true) }}>{group.second[0]}</span>
                    <strong>{group.second[1]}</strong>
                  </span>
                </div>
              ))}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '88px 1fr',
                gap: 8,
                alignItems: 'baseline',
                padding: '10px 0 0',
                borderTop: `1px solid ${designSystem.colors.border.light}`,
              }}>
                <span style={{ color: designSystem.colors.text.secondary, fontSize: getFontSize('bodySmall', true) }}>商品</span>
                <strong>
                  {row.product === 0 ? '—' : `$${row.product.toLocaleString()}`}
                  <span style={{ marginLeft: 6, color: designSystem.colors.text.secondary, fontSize: getFontSize('caption', true), fontWeight: 400 }}>
                    {row.productCount === 0 ? '' : `${row.productCount} 件`}
                  </span>
                </strong>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div style={{
          overflowX: 'auto',
          border: `1px solid ${designSystem.colors.border.light}`,
          borderRadius: designSystem.borderRadius.lg,
          background: designSystem.colors.background.card,
        }}>
          <table style={{
            width: '100%',
            minWidth: 820,
            borderCollapse: 'collapse',
            fontSize: getFontSize('bodySmall', false),
          }}>
            <thead>
              <tr>
                <th style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  borderBottom: `1px solid ${designSystem.colors.border.main}`,
                  color: designSystem.colors.text.secondary,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}>
                  教練
                </th>
                {([
                  ['teaching', '教學'],
                  ['driving', '駕駛'],
                  ['lesson', '指定單堂'],
                  ['credit', '指定售出'],
                  ['product', '商品'],
                ] as Array<[SortKey, string]>).map(([key, label]) => (
                  <th key={key} style={{
                    padding: '8px 12px',
                    textAlign: 'right',
                    borderBottom: `1px solid ${designSystem.colors.border.main}`,
                    whiteSpace: 'nowrap',
                  }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: 6,
                      color: designSystem.colors.text.secondary,
                      fontWeight: 600,
                    }}>
                      {label}
                      <SortButton sortKey={key}>{label}</SortButton>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} style={{ borderBottom: `1px solid ${designSystem.colors.border.light}` }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: getFontSize('body', false) }}>{row.name}</th>
                  {[
                    [row.teaching, `${row.teachingCount} 筆`],
                    [row.driving, `${row.drivingCount} 筆`],
                    [row.lesson, `${row.lessonCount} 筆`],
                    [row.credit, row.giftCredit > 0 ? `另贈 ${row.giftCredit} 分（不計）` : ''],
                  ].map(([amount, detail], index) => (
                    <td key={index} style={{ padding: '12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      <strong>{value(Number(amount))}</strong>
                      {detail && (Number(amount) !== 0 || index === 3) && (
                        <span style={{ display: 'block', marginTop: 2, color: designSystem.colors.text.disabled, fontSize: getFontSize('caption', false) }}>
                          {detail}
                        </span>
                      )}
                    </td>
                  ))}
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    <strong>{row.product === 0 ? '—' : `$${row.product.toLocaleString()}`}</strong>
                    {row.productCount > 0 && (
                      <span style={{ display: 'block', marginTop: 2, color: designSystem.colors.text.disabled, fontSize: getFontSize('caption', false) }}>
                        {row.productCount} 件
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
