import { describe, expect, it } from 'vitest'
import { validateCoachReportSubmission } from '../coachReportSubmission'

const participant = {
  participant_name: '王小明',
  duration_min: 20,
  status: 'pending',
  member_id: 'member-id',
}

describe('validateCoachReportSubmission', () => {
  it('allows a coach to report no teaching participants', () => {
    expect(validateCoachReportSubmission('coach', [])).toEqual({
      valid: true,
      emptyParticipantCount: 0,
    })
  })

  it('allows blank participant rows to be confirmed and skipped', () => {
    expect(validateCoachReportSubmission('coach', [{
      ...participant,
      participant_name: ' ',
    }])).toEqual({
      valid: true,
      emptyParticipantCount: 1,
    })
  })

  it('rejects a reported participant with zero teaching minutes', () => {
    expect(validateCoachReportSubmission('coach', [{
      ...participant,
      duration_min: 0,
    }])).toEqual({
      valid: false,
      message: '「王小明」的時數必須大於 0',
    })
  })

  it('rejects a pending member participant without a selected member', () => {
    expect(validateCoachReportSubmission('coach', [{
      ...participant,
      member_id: null,
    }])).toEqual({
      valid: false,
      message: expect.stringContaining('王小明'),
    })
  })

  it('waits for designated-hour context before submitting a free designated lesson', () => {
    expect(validateCoachReportSubmission('coach', [{
      ...participant,
      lesson_type: 'designated_free',
      designated_hours_initialized: false,
    }])).toEqual({
      valid: false,
      message: '指定課資料仍在載入，請稍候再送出',
    })

    expect(validateCoachReportSubmission('coach', [{
      ...participant,
      lesson_type: 'designated_free',
      designated_hours_initialized: true,
    }])).toEqual({
      valid: true,
      emptyParticipantCount: 0,
    })
  })

  it('accepts a regular/gift split that matches the reported duration', () => {
    expect(validateCoachReportSubmission('coach', [{
      ...participant,
      duration_min: 60,
      lesson_type: 'designated_free',
      designated_hours_initialized: true,
      designated_hours_deduct: true,
      designated_hours_regular_minutes: 30,
      designated_hours_gift_minutes: 30,
    }])).toEqual({
      valid: true,
      emptyParticipantCount: 0,
    })
  })

  it('allows a designated deduction above the reported duration', () => {
    expect(validateCoachReportSubmission('coach', [{
      ...participant,
      duration_min: 60,
      lesson_type: 'designated_free',
      designated_hours_initialized: true,
      designated_hours_deduct: true,
      designated_hours_regular_minutes: 40,
      designated_hours_gift_minutes: 30,
    }]).valid).toBe(true)
  })

  it('rejects a designated deduction with zero total minutes', () => {
    expect(validateCoachReportSubmission('coach', [{
      ...participant,
      lesson_type: 'designated_free',
      designated_hours_initialized: true,
      designated_hours_deduct: true,
      designated_hours_regular_minutes: 0,
      designated_hours_gift_minutes: 0,
    }])).toEqual({
      valid: false,
      message: '「王小明」的指定課扣除分鐘必須大於 0',
    })
  })

  it.each(['driver', 'both'] as const)(
    'accepts %s reports without requiring positive driver minutes',
    (reportType) => {
      expect(validateCoachReportSubmission(reportType, [participant])).toEqual({
        valid: true,
        emptyParticipantCount: 0,
      })
    },
  )

  it('accepts a driver-only report with no participants', () => {
    expect(validateCoachReportSubmission('driver', [])).toEqual({
      valid: true,
      emptyParticipantCount: 0,
    })
  })
})
