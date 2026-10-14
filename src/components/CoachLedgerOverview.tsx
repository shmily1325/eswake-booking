import { useMemo } from 'react'
import { designSystem, getFontSize } from '../styles/designSystem'
import type {
  CoachLedgerMetricRows,
  CoachLedgerSection,
} from './coachLedgerTypes'

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
  section: CoachLedgerSection
  serviceRows: ServiceRow[]
  performanceRows: CoachLedgerMetricRows
  onSelect: (section: CoachLedgerSection, coachId?: string) => void
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

  return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export function CoachLedgerOverview({
  isMobile,
  section,
  serviceRows,
  performanceRows,
  onSelect,
}: Props) {
  const rows = useMemo(
    () => buildCoachLedgerOverview(serviceRows, performanceRows),
    [performanceRows, serviceRows],
  )
  const totals = rows.reduce((sum, row) => ({
    teaching: sum.teaching + row.teaching,
    driving: sum.driving + row.driving,
    lesson: sum.lesson + row.lesson,
    credit: sum.credit + row.credit,
    product: sum.product + row.product,
  }), { teaching: 0, driving: 0, lesson: 0, credit: 0, product: 0 })

  const summaries: Array<{
    label: string
    value: string
    target: CoachLedgerSection
  }> = [
    { label: '教學', value: `${totals.teaching} 分`, target: 'service' },
    { label: '駕駛', value: `${totals.driving} 分`, target: 'service' },
    { label: '指定單堂', value: `${totals.lesson} 分`, target: 'designated_lesson' },
    { label: '指定售出', value: `${totals.credit} 分`, target: 'designated_credit' },
    { label: '商品', value: `$${totals.product.toLocaleString()}`, target: 'product' },
  ]

  const metricButton = (
    target: CoachLedgerSection,
    coachId: string,
    main: string,
    detail: string,
  ) => (
    <button
      type="button"
      onClick={() => onSelect(target, coachId)}
      style={{
        width: '100%',
        padding: 0,
        border: 0,
        background: 'transparent',
        color: designSystem.colors.text.primary,
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <strong style={{ display: 'block', fontVariantNumeric: 'tabular-nums' }}>{main}</strong>
      <span style={{ color: designSystem.colors.text.secondary, fontSize: getFontSize('caption', isMobile) }}>
        {detail}
      </span>
    </button>
  )

  return (
    <section style={{ marginBottom: designSystem.spacing.xl }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(5, minmax(0, 1fr))',
        gap: 8,
        marginBottom: 16,
      }}>
        {summaries.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => onSelect(item.target)}
            style={{
              minHeight: 68,
              padding: '10px 12px',
              border: `1px solid ${section === item.target
                ? designSystem.colors.border.dark
                : designSystem.colors.border.light}`,
              borderRadius: designSystem.borderRadius.md,
              background: section === item.target
                ? designSystem.colors.secondary[50]
                : designSystem.colors.background.card,
              color: designSystem.colors.text.primary,
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <span style={{ display: 'block', color: designSystem.colors.text.secondary, fontSize: getFontSize('bodySmall', isMobile) }}>
              {item.label}
            </span>
            <strong style={{ display: 'block', marginTop: 3, fontSize: getFontSize('bodyLarge', isMobile) }}>
              {item.value}
            </strong>
          </button>
        ))}
      </div>

      {rows.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            minWidth: isMobile ? 760 : undefined,
            borderCollapse: 'collapse',
            fontSize: getFontSize('bodySmall', isMobile),
          }}>
            <thead>
              <tr style={{ background: designSystem.colors.background.hover }}>
                {['教練', '教學', '駕駛', '指定單堂', '指定售出', '商品'].map((label) => (
                  <th key={label} style={{
                    padding: 10,
                    textAlign: 'left',
                    borderBottom: `1px solid ${designSystem.colors.border.light}`,
                    color: designSystem.colors.text.secondary,
                    whiteSpace: 'nowrap',
                  }}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} style={{ borderBottom: `1px solid ${designSystem.colors.border.light}` }}>
                  <th style={{ padding: 10, textAlign: 'left', whiteSpace: 'nowrap' }}>{row.name}</th>
                  <td style={{ padding: 10 }}>{metricButton('service', row.id, `${row.teaching} 分`, `${row.teachingCount} 筆`)}</td>
                  <td style={{ padding: 10 }}>{metricButton('service', row.id, `${row.driving} 分`, `${row.drivingCount} 筆`)}</td>
                  <td style={{ padding: 10 }}>{metricButton('designated_lesson', row.id, `${row.lesson} 分`, `${row.lessonCount} 筆`)}</td>
                  <td style={{ padding: 10 }}>{metricButton('designated_credit', row.id, `${row.credit} 分`, `購 ${row.regularCredit}・贈 ${row.giftCredit}`)}</td>
                  <td style={{ padding: 10 }}>{metricButton('product', row.id, `$${row.product.toLocaleString()}`, `${row.productCount} 件`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
