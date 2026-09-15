export type ReminderMappingStatusInput = {
  member_id: string | null
  booking?: {
    start_at: string
  } | null
}

export function isCurrentReminderMapping(
  mapping: ReminderMappingStatusInput,
  hasSavedGuest: boolean,
  now = Date.now(),
): boolean {
  if (mapping.member_id) return true
  if (hasSavedGuest || !mapping.booking?.start_at) return false

  const startAt = new Date(mapping.booking.start_at).getTime()
  return Number.isFinite(startAt) && startAt >= now
}
