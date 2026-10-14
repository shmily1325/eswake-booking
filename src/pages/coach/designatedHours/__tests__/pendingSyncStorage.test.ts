import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearPendingDesignatedSync,
  readPendingDesignatedSync,
  savePendingDesignatedSync,
  type PendingDesignatedSync,
} from '../pendingSyncStorage'

const pending: PendingDesignatedSync = {
  bookingId: 123,
  coachId: 'coach-1',
  actorEmail: 'coach@example.com',
  savedAt: Date.now(),
  items: [{
    participant_id: 456,
    deduct: true,
    minutes: 30,
    regular_minutes: 30,
    gift_minutes: 0,
  }],
}

describe('pending designated sync storage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.useRealTimers()
  })

  it('restores a pending sync for the same signed-in user', () => {
    savePendingDesignatedSync(pending)

    expect(readPendingDesignatedSync('COACH@example.com')).toEqual(pending)
  })

  it('does not restore another user or an expired retry', () => {
    savePendingDesignatedSync(pending)
    expect(readPendingDesignatedSync('other@example.com')).toBeNull()

    savePendingDesignatedSync({
      ...pending,
      savedAt: Date.now() - (8 * 24 * 60 * 60 * 1000),
    })
    expect(readPendingDesignatedSync(pending.actorEmail)).toBeNull()
  })

  it('clears the retry after a successful sync', () => {
    savePendingDesignatedSync(pending)
    clearPendingDesignatedSync()

    expect(readPendingDesignatedSync(pending.actorEmail)).toBeNull()
  })
})
