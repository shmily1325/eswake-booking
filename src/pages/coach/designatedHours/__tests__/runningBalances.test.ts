import { describe, expect, it } from 'vitest'
import { buildCoachDesignatedRunningBalances } from '../runningBalances'
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
    booking_participant_id: deltaMinutes >= 0 ? null : id,
  }
}

describe('buildCoachDesignatedRunningBalances', () => {
  it('calculates each post-entry balance chronologically while preserving display order', () => {
    const entries = [
      entry(4, '2026-10-11T08:00:00+08:00', -60),
      entry(3, '2026-10-10T12:00:00+08:00', 30),
      entry(2, '2026-10-10T08:00:00+08:00', -70),
      entry(1, '2026-10-01T12:00:00+08:00', 100),
    ]

    const balances = buildCoachDesignatedRunningBalances(entries)

    expect(balances.get(1)).toBe(100)
    expect(balances.get(2)).toBe(30)
    expect(balances.get(3)).toBe(60)
    expect(balances.get(4)).toBe(0)
    expect(entries.map((item) => item.id)).toEqual([4, 3, 2, 1])
  })

  it('shows the deduction that makes the running balance negative', () => {
    const balances = buildCoachDesignatedRunningBalances([
      entry(3, '2026-10-03T08:00:00+08:00', -50),
      entry(2, '2026-10-02T08:00:00+08:00', -80),
      entry(1, '2026-10-01T12:00:00+08:00', 100),
    ])

    expect(balances.get(2)).toBe(20)
    expect(balances.get(3)).toBe(-30)
  })
})
