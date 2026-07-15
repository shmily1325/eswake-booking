import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { validateBookings, validateBoats } from '../safetyHelpers'

describe('safetyHelpers', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('validateBookings', () => {
    it('過濾無效預約', () => {
      const bookings = [
        { id: 1, boat_id: 1, start_at: '2025-01-20T10:00', duration_min: 60 },
        { id: 'invalid' },
        { id: 2, boat_id: 2, start_at: '2025-01-20T11:00', duration_min: 90 },
        null,
      ]

      expect(validateBookings(bookings)).toEqual([bookings[0], bookings[2]])
    })

    it('null 輸入返回空陣列', () => {
      expect(validateBookings(null)).toEqual([])
    })
  })

  describe('validateBoats', () => {
    it('過濾無效船隻', () => {
      const boats = [
        { id: 1, name: 'G23' },
        { id: 'invalid' },
        { id: 2, name: 'G24' },
        null,
      ]

      expect(validateBoats(boats)).toEqual([boats[0], boats[2]])
    })

    it('null 輸入返回空陣列', () => {
      expect(validateBoats(null)).toEqual([])
    })
  })
})
