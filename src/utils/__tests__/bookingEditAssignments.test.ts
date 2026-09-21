import { describe, expect, it } from 'vitest'
import {
  bookingEditDriverIds,
  shouldClearBookingEditAssignments,
} from '../bookingEditAssignments'

const unchangedEdit = {
  scheduleChanged: false,
  boatChanged: false,
  contactNameChanged: false,
  coachesChanged: false,
  requiresDriver: true,
  hasPersonConflict: false,
}

describe('booking edit assignments', () => {
  it('preserves existing drivers for notes-only edits', () => {
    const shouldClear = shouldClearBookingEditAssignments(unchangedEdit)

    expect(shouldClear).toBe(false)
    expect(bookingEditDriverIds(['driver-1'], shouldClear)).toEqual(['driver-1'])
  })

  it.each([
    ['schedule changes', { scheduleChanged: true }],
    ['boat changes', { boatChanged: true }],
    ['contact changes', { contactNameChanged: true }],
    ['coach changes', { coachesChanged: true }],
    ['driver is no longer required', { requiresDriver: false }],
    ['an assigned person conflicts', { hasPersonConflict: true }],
  ])('clears drivers when %s', (_label, change) => {
    const shouldClear = shouldClearBookingEditAssignments({
      ...unchangedEdit,
      ...change,
    })

    expect(shouldClear).toBe(true)
    expect(bookingEditDriverIds(['driver-1'], shouldClear)).toEqual([])
  })
})
