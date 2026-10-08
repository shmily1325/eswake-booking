import { getLocalDateString } from '../../../utils/date'
import type { CoachDesignatedEntry } from './types'

function entryDateString(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value.slice(0, 10) : getLocalDateString(date)
}

export function selectCoachDesignatedLedgerRange(
  entries: CoachDesignatedEntry[],
  startDate: string,
  endDate: string,
): {
  entries: CoachDesignatedEntry[]
  balanceAtEnd: number
} {
  return {
    entries: entries
      .filter((entry) => {
        const date = entryDateString(entry.occurred_at)
        return date >= startDate && date <= endDate
      })
      .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()),
    balanceAtEnd: entries.reduce((total, entry) =>
      entryDateString(entry.occurred_at) <= endDate
        ? total + entry.delta_minutes
        : total, 0),
  }
}
