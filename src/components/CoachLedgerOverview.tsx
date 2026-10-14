import { useMemo } from 'react'
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
  selectedCoachId: string
  onSelectCoach: (coachId: string) => void
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
  selectedCoachId,
  onSelectCoach,
}: Props) {
  const rows = useMemo(
    () => buildCoachLedgerOverview(serviceRows, performanceRows),
    [performanceRows, serviceRows],
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
      ) : (
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
        gap: isMobile ? 10 : 14,
      }}>
        {rows.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => onSelectCoach(row.id)}
            style={{
              minHeight: 150,
              padding: isMobile ? 14 : 16,
              border: `1px solid ${selectedCoachId === row.id
                ? designSystem.colors.border.dark
                : designSystem.colors.border.light}`,
              borderRadius: designSystem.borderRadius.lg,
              background: selectedCoachId === row.id
                ? designSystem.colors.secondary[50]
                : designSystem.colors.background.card,
              color: designSystem.colors.text.primary,
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <strong style={{
              display: 'block',
              marginBottom: 14,
              fontSize: getFontSize('bodyLarge', isMobile),
            }}>
              {row.name}
            </strong>
            <div style={{ display: 'grid', gap: 10 }}>
              <div>
                <span style={{ color: designSystem.colors.text.secondary, fontSize: getFontSize('caption', isMobile) }}>教學／駕駛</span>
                <strong style={{ display: 'block', marginTop: 2 }}>{row.teaching} 分／{row.driving} 分</strong>
              </div>
              <div>
                <span style={{ color: designSystem.colors.text.secondary, fontSize: getFontSize('caption', isMobile) }}>指定課</span>
                <strong style={{ display: 'block', marginTop: 2 }}>單堂 {row.lesson}／售出 {row.credit} 分</strong>
              </div>
              <div>
                <span style={{ color: designSystem.colors.text.secondary, fontSize: getFontSize('caption', isMobile) }}>商品</span>
                <strong style={{ display: 'block', marginTop: 2 }}>${row.product.toLocaleString()}・{row.productCount} 件</strong>
              </div>
            </div>
          </button>
        ))}
      </div>
      )}
    </section>
  )
}
