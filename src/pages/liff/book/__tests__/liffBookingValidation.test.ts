import { describe, expect, it } from 'vitest'
import { getStepBlockReason } from '../liffBookingValidation'
import type { LiffBookingFormState } from '../types'

const v = {
  pickActivity: 'pick activity',
  pickExperience: 'pick experience',
  pickBoat: 'pick boat',
  pickDate: 'pick date',
  pickCoach: 'pick coach',
  fillName: 'fill name',
  fillPhone: 'fill phone',
  connectingLine: 'connecting',
} as const

const baseForm: LiffBookingFormState = {
  activity: 'WB',
  boatPreference: 'small',
  skillLevel: 'first_time',
  headcount: 2,
  beginnerCount: 2,
  coachChoice: 'none',
  coachId: null,
  preferredDates: [{ date: '2026-06-10', timePreference: 'morning' }],
  contactName: 'Test',
  contactPhone: '0912345678',
  notes: '',
  followBoatCount: 0,
}

describe('getStepBlockReason', () => {
  it('blocks step 1 without activity', () => {
    expect(getStepBlockReason(1, { ...baseForm, activity: null }, '', v)).toBe(v.pickActivity)
  })

  it('blocks step 4 when LINE profile is not ready', () => {
    expect(getStepBlockReason(4, baseForm, '', v, null)).toBe(v.connectingLine)
    expect(getStepBlockReason(4, baseForm, '', v, undefined)).toBe(v.connectingLine)
  })

  it('allows step 4 when profile and contact fields are ready', () => {
    expect(getStepBlockReason(4, baseForm, '', v, 'U123')).toBeNull()
  })

  it('blocks step 4 for missing contact before checking LINE', () => {
    expect(getStepBlockReason(4, { ...baseForm, contactName: '' }, '', v, 'U123')).toBe(v.fillName)
  })
})
