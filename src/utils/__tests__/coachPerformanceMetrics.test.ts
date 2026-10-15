import { describe, expect, it } from 'vitest'
import {
  aggregateDesignatedCreditMetrics,
  aggregateDesignatedLessonMetrics,
} from '../coachPerformanceMetrics'

describe('coach performance dashboard metrics', () => {
  it('aggregates paid designated lesson minutes by coach', () => {
    expect(aggregateDesignatedLessonMetrics([
      {
        coach_id: 'coach-1',
        duration_min: 30,
        coaches: { name: 'Jerry' },
      },
      {
        coach_id: 'coach-1',
        duration_min: 60,
        coaches: { name: 'Jerry' },
      },
      {
        coach_id: 'coach-2',
        duration_min: 45,
        coaches: { name: 'ED' },
      },
    ])).toEqual([
      { id: 'coach-1', name: 'Jerry', value: 90, count: 2 },
      { id: 'coach-2', name: 'ED', value: 45, count: 1 },
    ])
  })

  it('counts purchased designated credit and excludes gifted minutes', () => {
    expect(aggregateDesignatedCreditMetrics([
      {
        id: 1,
        coach_id: 'coach-1',
        coach_name: 'Jerry',
        member_id: 'member-1',
        member_name: '會員',
        regular_minutes: 300,
        gift_minutes: 30,
        total_minutes: 330,
        occurred_at: '2026-10-01T10:00:00+08:00',
        note: null,
      },
      {
        id: 2,
        coach_id: 'coach-2',
        coach_name: 'ED',
        member_id: 'member-2',
        member_name: '會員二',
        regular_minutes: 0,
        gift_minutes: 60,
        total_minutes: 60,
        occurred_at: '2026-10-02T10:00:00+08:00',
        note: null,
      },
    ])).toEqual([
      { id: 'coach-1', name: 'Jerry', value: 300, count: 1 },
    ])
  })
})
