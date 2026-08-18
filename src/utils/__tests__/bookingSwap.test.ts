import { describe, it, expect } from 'vitest'
import {
  applySwapHypothetical,
  canConsiderPair,
  swapModeLabel,
  type SwapBookingLike,
} from '../bookingSwap'

function makeBooking(partial: Partial<SwapBookingLike> & Pick<SwapBookingLike, 'id'>): SwapBookingLike {
  return {
    boat_id: 1,
    start_at: '2026-04-18T10:00:00',
    duration_min: 60,
    cleanup_minutes: 15,
    contact_name: `學生${partial.id}`,
    status: 'confirmed',
    boats: { id: 1, name: 'G21', is_active: true },
    coaches: [{ id: 'c1', name: '王' }],
    drivers: [],
    ...partial,
  }
}

describe('bookingSwap', () => {
  describe('applySwapHypothetical', () => {
    it('換船：時間不變，船與 cleanup 跟著對方', () => {
      const a = makeBooking({
        id: 1,
        boat_id: 1,
        boats: { id: 1, name: 'G21', is_active: true },
        cleanup_minutes: 15,
        start_at: '2026-04-18T10:00:00',
      })
      const b = makeBooking({
        id: 2,
        boat_id: 2,
        boats: { id: 2, name: '彈簧床', is_active: true },
        cleanup_minutes: 0,
        start_at: '2026-04-18T10:00:00',
      })
      const hypo = applySwapHypothetical(a, b, 'boat')
      expect(hypo.boat_id).toBe(2)
      expect(hypo.boats?.name).toBe('彈簧床')
      expect(hypo.cleanup_minutes).toBe(0)
      expect(hypo.start_at).toBe('2026-04-18T10:00:00')
      expect(hypo.duration_min).toBe(60)
    })

    it('換時段：船不變，開始時間換成對方', () => {
      const a = makeBooking({
        id: 1,
        start_at: '2026-04-18T10:00:00',
        duration_min: 45,
      })
      const b = makeBooking({
        id: 2,
        boat_id: 9,
        boats: { id: 9, name: 'G99', is_active: true },
        start_at: '2026-04-18T14:00:00',
        duration_min: 90,
      })
      const hypo = applySwapHypothetical(a, b, 'time')
      expect(hypo.boat_id).toBe(1)
      expect(hypo.start_at).toBe('2026-04-18T14:00:00')
      expect(hypo.duration_min).toBe(45)
    })

    it('船+時段：兩者都換', () => {
      const a = makeBooking({
        id: 1,
        boat_id: 1,
        boats: { id: 1, name: 'G21', is_active: true },
        start_at: '2026-04-18T10:00:00',
      })
      const b = makeBooking({
        id: 2,
        boat_id: 2,
        boats: { id: 2, name: 'G22', is_active: true },
        start_at: '2026-04-18T14:00:00',
      })
      const hypo = applySwapHypothetical(a, b, 'boat_and_time')
      expect(hypo.boat_id).toBe(2)
      expect(hypo.start_at).toBe('2026-04-18T14:00:00')
    })
  })

  describe('canConsiderPair', () => {
    it('同一筆拒絕', () => {
      const a = makeBooking({ id: 1 })
      expect(canConsiderPair(a, a).ok).toBe(false)
    })

    it('不同日拒絕', () => {
      const a = makeBooking({ id: 1, start_at: '2026-04-18T10:00:00' })
      const b = makeBooking({ id: 2, start_at: '2026-04-19T10:00:00', boat_id: 2 })
      expect(canConsiderPair(a, b).ok).toBe(false)
    })

    it('同時同船同時長拒絕', () => {
      const a = makeBooking({ id: 1 })
      const b = makeBooking({ id: 2, contact_name: '乙' })
      expect(canConsiderPair(a, b).ok).toBe(false)
    })

    it('同教練不同時段可考慮', () => {
      const a = makeBooking({ id: 1, start_at: '2026-04-18T10:00:00' })
      const b = makeBooking({ id: 2, start_at: '2026-04-18T14:00:00' })
      expect(canConsiderPair(a, b).ok).toBe(true)
    })
  })

  describe('swapModeLabel', () => {
    it('標籤正確', () => {
      expect(swapModeLabel('boat')).toBe('互換船隻')
      expect(swapModeLabel('time')).toBe('互換時段')
      expect(swapModeLabel('boat_and_time')).toBe('互換船隻+時段')
    })
  })
})
