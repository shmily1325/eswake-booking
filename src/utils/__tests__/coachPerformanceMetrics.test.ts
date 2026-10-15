import { describe, expect, it } from 'vitest'
import {
  aggregateDesignatedCreditMetrics,
  aggregateDesignatedLessonMetrics,
  aggregateProductSalesMetrics,
} from '../coachPerformanceMetrics'

describe('coach performance dashboard metrics', () => {
  it('aggregates paid designated lesson minutes by coach', () => {
    expect(aggregateDesignatedLessonMetrics([
      {
        coach_id: 'coach-1',
        duration_min: 30,
        participant_name: '小明',
        member_id: 'member-1',
        coaches: { name: 'Jerry' },
        members: { name: '王小明', nickname: '小明' },
      },
      {
        coach_id: 'coach-1',
        duration_min: 60,
        participant_name: '小明',
        member_id: 'member-1',
        coaches: { name: 'Jerry' },
        members: { name: '王小明', nickname: '小明' },
      },
      {
        coach_id: 'coach-2',
        duration_min: 45,
        participant_name: '訪客',
        member_id: null,
        coaches: { name: 'ED' },
        members: null,
      },
    ])).toMatchObject([
      {
        id: 'coach-1',
        name: 'Jerry',
        value: 90,
        count: 2,
        breakdown: [{ id: 'member-1', name: '小明', value: 90, count: 2 }],
      },
      {
        id: 'coach-2',
        name: 'ED',
        value: 45,
        count: 1,
        breakdown: [{ name: '訪客', value: 45, count: 1 }],
      },
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
    ])).toMatchObject([
      {
        id: 'coach-1',
        name: 'Jerry',
        value: 300,
        count: 1,
        breakdown: [{ id: 'member-1', name: '會員', value: 300, count: 1 }],
      },
    ])
  })

  it('groups product details by item and excludes unassigned salespeople', () => {
    expect(aggregateProductSalesMetrics([
      {
        id: 'coach-1',
        name: 'Jerry',
        qty: 3,
        total: 4800,
        details: [
          {
            id: 'detail-1',
            date: '2026-10-01',
            orderNo: 'SO-1',
            customerName: '客人',
            productName: '商品 A',
            qty: 1,
            total: 1800,
          },
          {
            id: 'detail-2',
            date: '2026-10-02',
            orderNo: 'SO-2',
            customerName: '客人二',
            productName: '商品 A',
            qty: 2,
            total: 3000,
          },
        ],
      },
      {
        id: 'unassigned',
        name: '未指定',
        qty: 1,
        total: 500,
        details: [],
      },
    ])).toMatchObject([
      {
        id: 'coach-1',
        value: 4800,
        count: 3,
        breakdown: [{ name: '商品 A', value: 4800, count: 3 }],
      },
    ])
  })
})
