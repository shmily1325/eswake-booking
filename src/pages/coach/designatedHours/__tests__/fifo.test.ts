import { describe, expect, it } from 'vitest'
import { buildCoachDesignatedBatches } from '../fifo'
import type { CoachDesignatedEntry } from '../types'

function entry(
  id: number,
  entryType: CoachDesignatedEntry['entry_type'],
  minutes: number,
  occurredAt: string,
): CoachDesignatedEntry {
  return {
    id,
    entry_type: entryType,
    minutes,
    delta_minutes: entryType === 'credit' ? minutes : -minutes,
    occurred_at: occurredAt,
    note: null,
    booking_participant_id: entryType === 'report_deduction' ? id : null,
  }
}

describe('buildCoachDesignatedBatches', () => {
  it('splits one lesson across the oldest and next credit', () => {
    const result = buildCoachDesignatedBatches([
      entry(1, 'credit', 10, '2026-08-07T00:00:00Z'),
      entry(2, 'credit', 330, '2026-09-22T00:00:00Z'),
      entry(3, 'report_deduction', 30, '2026-09-26T00:00:00Z'),
    ])

    const oldest = result.batches.find((batch) => batch.credit.id === 1)!
    const newest = result.batches.find((batch) => batch.credit.id === 2)!
    expect(oldest.allocations[0].minutes).toBe(10)
    expect(oldest.remaining).toBe(0)
    expect(newest.allocations[0].minutes).toBe(20)
    expect(newest.remaining).toBe(310)
  })

  it('keeps excess deduction as pending minutes', () => {
    const result = buildCoachDesignatedBatches([
      entry(1, 'credit', 20, '2026-09-22T00:00:00Z'),
      entry(2, 'report_deduction', 30, '2026-09-20T00:00:00Z'),
    ])

    expect(result.batches[0].remaining).toBe(0)
    expect(result.unallocatedDeductions[0].minutes).toBe(10)
  })

  it('builds regular and gift batches independently', () => {
    const credit = {
      ...entry(1, 'credit', 330, '2026-09-22T00:00:00Z'),
      regular_minutes: 300,
      gift_minutes: 30,
    }
    const deduction = {
      ...entry(2, 'report_deduction', 30, '2026-09-26T00:00:00Z'),
      regular_minutes: 20,
      gift_minutes: 10,
    }

    const regular = buildCoachDesignatedBatches([credit, deduction], 'regular')
    const gift = buildCoachDesignatedBatches([credit, deduction], 'gift')

    expect(regular.batches[0]).toMatchObject({ minutes: 300, remaining: 280 })
    expect(regular.batches[0].allocations[0].minutes).toBe(20)
    expect(gift.batches[0]).toMatchObject({ minutes: 30, remaining: 20 })
    expect(gift.batches[0].allocations[0].minutes).toBe(10)
  })
})
