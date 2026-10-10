import { describe, expect, it } from 'vitest'
import {
  buildDesignatedCreditGroups,
  buildDesignatedLessonGroups,
  type DesignatedLessonParticipant,
} from '../PerformanceStatistics'
import type { CoachDesignatedCreditReportEntry } from '../../pages/coach/designatedHours/types'

describe('performance report aggregation', () => {
  it('uses designated charge evidence and keeps missing charges visible', () => {
    const participants: DesignatedLessonParticipant[] = [
      {
        id: 1,
        coach_id: 'coach-1',
        duration_min: 30,
        participant_name: '原名',
        coaches: { name: 'Papa' },
        members: { name: '王小明', nickname: '小明' },
        bookings: { start_at: '2026-10-10T09:00:00+08:00' },
      },
      {
        id: 2,
        coach_id: 'coach-1',
        duration_min: 60,
        participant_name: '訪客',
        coaches: { name: 'Papa' },
        members: null,
        bookings: { start_at: '2026-10-11T09:00:00+08:00' },
      },
    ]

    const groups = buildDesignatedLessonGroups(participants, [
      {
        booking_participant_id: 1,
        category: 'balance',
        description: '【指定課】教練費',
        payment_method: 'balance',
      },
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ minutes: 90 })
    expect(groups[0].details.find((row) => row.id === 1)).toMatchObject({
      memberName: '小明',
      hasTransaction: true,
      paymentMethod: '扣儲值',
    })
    expect(groups[0].details.find((row) => row.id === 2)).toMatchObject({
      hasTransaction: false,
    })
  })

  it('separates purchased and gifted designated credit minutes by coach', () => {
    const entries: CoachDesignatedCreditReportEntry[] = [
      {
        id: 1,
        coach_id: 'coach-1',
        coach_name: 'Papa',
        member_id: 'member-1',
        member_name: '小明',
        regular_minutes: 300,
        gift_minutes: 30,
        total_minutes: 330,
        occurred_at: '2026-10-10T10:00:00+08:00',
        note: null,
      },
      {
        id: 2,
        coach_id: 'coach-1',
        coach_name: 'Papa',
        member_id: 'member-2',
        member_name: '小華',
        regular_minutes: 60,
        gift_minutes: 0,
        total_minutes: 60,
        occurred_at: '2026-10-11T10:00:00+08:00',
        note: null,
      },
    ]

    expect(buildDesignatedCreditGroups(entries)).toMatchObject([
      {
        coachId: 'coach-1',
        regularMinutes: 360,
        giftMinutes: 30,
        totalMinutes: 390,
      },
    ])
  })
})
