import { describe, expect, it } from 'vitest'
import { isCurrentReminderMapping } from '../lineReminderMappingStatus'

const now = new Date('2026-09-15T02:00:00.000Z').getTime()

describe('isCurrentReminderMapping', () => {
  it('keeps manual member mappings', () => {
    expect(isCurrentReminderMapping(
      { member_id: 'member-1', booking: null },
      false,
      now,
    )).toBe(true)
  })

  it('keeps only upcoming booking mappings for guests without a saved profile', () => {
    expect(isCurrentReminderMapping(
      { member_id: null, booking: { start_at: '2026-09-16T02:00:00.000Z' } },
      false,
      now,
    )).toBe(true)
    expect(isCurrentReminderMapping(
      { member_id: null, booking: { start_at: '2026-09-14T02:00:00.000Z' } },
      false,
      now,
    )).toBe(false)
  })

  it('hides booking mappings after the LINE contact is saved as a guest', () => {
    expect(isCurrentReminderMapping(
      { member_id: null, booking: { start_at: '2026-09-16T02:00:00.000Z' } },
      true,
      now,
    )).toBe(false)
  })
})
