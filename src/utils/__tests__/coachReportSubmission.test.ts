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
    expect(validateCoachReportSubmission('coach', 0, [])).toEqual({
      valid: true,
      emptyParticipantCount: 0,
    })
  })

  it('allows blank participant rows to be confirmed and skipped', () => {
    expect(validateCoachReportSubmission('coach', 0, [{
      ...participant,
      participant_name: ' ',
    }])).toEqual({
      valid: true,
      emptyParticipantCount: 1,
    })
  })

  it('rejects a reported participant with zero teaching minutes', () => {
    expect(validateCoachReportSubmission('coach', 0, [{
      ...participant,
      duration_min: 0,
    }])).toEqual({
      valid: false,
      message: '「王小明」的時數必須大於 0',
    })
  })

  it('rejects a pending member participant without a selected member', () => {
    expect(validateCoachReportSubmission('coach', 0, [{
      ...participant,
      member_id: null,
    }])).toEqual({
      valid: false,
      message: expect.stringContaining('王小明'),
    })
  })

  it.each(['driver', 'both'] as const)(
    'requires positive driver minutes for %s reports',
    (reportType) => {
      expect(validateCoachReportSubmission(reportType, 0, [participant])).toEqual({
        valid: false,
        message: '駕駛時數必須大於 0',
      })
    },
  )

  it('accepts a driver report with positive driver minutes', () => {
    expect(validateCoachReportSubmission('driver', 20, [])).toEqual({
      valid: true,
      emptyParticipantCount: 0,
    })
  })
})
