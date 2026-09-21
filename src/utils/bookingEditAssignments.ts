export interface BookingEditCleanupInput {
  scheduleChanged: boolean
  boatChanged: boolean
  contactNameChanged: boolean
  coachesChanged: boolean
  requiresDriver: boolean
  hasPersonConflict: boolean
}

export function shouldClearBookingEditAssignments(
  input: BookingEditCleanupInput,
): boolean {
  return (
    input.scheduleChanged ||
    input.boatChanged ||
    input.contactNameChanged ||
    input.coachesChanged ||
    !input.requiresDriver ||
    input.hasPersonConflict
  )
}

export function bookingEditDriverIds(
  assignedDriverIds: string[],
  shouldClearAssignments: boolean,
): string[] {
  return shouldClearAssignments ? [] : assignedDriverIds
}
