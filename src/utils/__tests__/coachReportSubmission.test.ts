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
