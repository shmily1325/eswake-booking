export type CoachLedgerSection =
  | 'service'
  | 'designated_lesson'
  | 'designated_credit'
  | 'product'

export type PerformanceLedgerSection = Exclude<CoachLedgerSection, 'service'>

export interface CoachLedgerMetricRow {
  id: string
  name: string
  value: number
  count: number
  regularValue?: number
  giftValue?: number
}

export type CoachLedgerMetricRows = Record<PerformanceLedgerSection, CoachLedgerMetricRow[]>
