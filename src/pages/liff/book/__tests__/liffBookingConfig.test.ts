import { describe, expect, it } from 'vitest'
import { syncBookingPeople, toggleActivitySelection } from '../liffBookingConfig'
import type { LiffBookingFormState } from '../types'

const base: LiffBookingFormState = {
  activity: 'WS',
  boatPreference: 'big',
  skillLevel: 'first_time',
  headcount: 1,
  beginnerCount: 1,
  coachChoice: 'none',
  coachId: null,
  preferredDates: [],
  contactName: '',
  contactPhone: '',
  notes: '',
  followBoatCount: 0,
}

describe('syncBookingPeople', () => {
  it('defaults beginner count to all riders when headcount changes', () => {
    const next = syncBookingPeople({ ...base, beginnerCount: 1 }, { headcount: 3 })
    expect(next.headcount).toBe(3)
    expect(next.beginnerCount).toBe(3)
    expect(next.skillLevel).toBe('first_time')
  })

  it('keeps explicit beginner count when provided', () => {
    const next = syncBookingPeople({ ...base, headcount: 3, beginnerCount: 3 }, { beginnerCount: 1 })
    expect(next.beginnerCount).toBe(1)
    expect(next.skillLevel).toBe('experienced')
  })
})

describe('toggleActivitySelection', () => {
  it('selects a single activity', () => {
    expect(toggleActivitySelection(null, 'WS')).toBe('WS')
    expect(toggleActivitySelection(null, 'WB')).toBe('WB')
  })

  it('combines into BOTH when both are selected', () => {
    expect(toggleActivitySelection('WS', 'WB')).toBe('BOTH')
    expect(toggleActivitySelection('WB', 'WS')).toBe('BOTH')
  })

  it('deselects back to single or null', () => {
    expect(toggleActivitySelection('BOTH', 'WS')).toBe('WB')
    expect(toggleActivitySelection('BOTH', 'WB')).toBe('WS')
    expect(toggleActivitySelection('WS', 'WS')).toBeNull()
  })
})
