import { describe, expect, it } from 'vitest'
import { selectCoachDesignatedLedgerRange } from '../ledgerRange'
import type { CoachDesignatedEntry } from '../types'

function entry(
  id: number,
  occurredAt: string,
  deltaMinutes: number,
): CoachDesignatedEntry {
  return {
    id,
    entry_type: deltaMinutes >= 0 ? 'credit' : 'report_deduction',
    minutes: Math.abs(deltaMinutes),
    delta_minutes: deltaMinutes,
    occurred_at: occurredAt,
    note: null,
    booking_participant_id: null,
  }
}

describe('designated-hour ledger image range', () => {
  const entries = [
    entry(3, '2026-10-09T12:00:00+08:00', -30),
    entry(2, '2026-10-01T12:00:00+08:00', 330),
    entry(1, '2026-09-27T15:30:00+08:00', -15),
  ]

  it('shows only entries inside the inclusive range in chronological order', () => {
    const result = selectCoachDesignatedLedgerRange(
      entries,
      '2026-09-01',
      '2026-10-08',
    )

    expect(result.entries.map((item) => item.id)).toEqual([1, 2])
    expect(result.balanceAtEnd).toBe(315)
  })

  it('calculates the ending balance from all active entries through the end date', () => {
    const result = selectCoachDesignatedLedgerRange(
      entries,
      '2026-10-01',
      '2026-10-01',
    )

    expect(result.entries.map((item) => item.id)).toEqual([2])
    expect(result.balanceAtEnd).toBe(315)
  })
})
