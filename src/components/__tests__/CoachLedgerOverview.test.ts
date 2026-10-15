import { describe, expect, it } from 'vitest'
import { buildCoachLedgerOverview } from '../CoachLedgerOverview'

describe('buildCoachLedgerOverview', () => {
  it('combines all ledger metrics by coach without mixing their units', () => {
    const rows = buildCoachLedgerOverview(
      [{
        coachId: 'coach-1',
        coachName: 'Pierre',
        teachingMinutes: 120,
        teachingCount: 2,
        drivingMinutes: 30,
        drivingCount: 1,
      }],
      {
        designated_lesson: [{
          id: 'coach-1',
          name: 'Pierre',
          value: 60,
          count: 1,
        }],
        designated_credit: [{
          id: 'coach-1',
          name: 'Pierre',
          value: 300,
          count: 1,
          regularValue: 300,
          giftValue: 30,
        }],
        product: [{
          id: 'coach-1',
          name: 'Pierre',
          value: 4800,
          count: 2,
        }],
      },
    )

    expect(rows).toEqual([expect.objectContaining({
      id: 'coach-1',
      teaching: 120,
      driving: 30,
      lesson: 60,
      credit: 300,
      regularCredit: 300,
      giftCredit: 30,
      product: 4800,
      productCount: 2,
    })])
  })

  it('keeps coaches that only have performance activity', () => {
    const rows = buildCoachLedgerOverview([], {
      designated_lesson: [],
      designated_credit: [],
      product: [{ id: 'coach-2', name: 'Jerry', value: 900, count: 1 }],
    })

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ id: 'coach-2', teaching: 0, product: 900 })
  })
})
