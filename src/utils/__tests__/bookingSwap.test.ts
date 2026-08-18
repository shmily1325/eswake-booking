import { describe, it, expect } from 'vitest'
import {
  applySwapHypothetical,
  canConsiderPair,
  checkSwapPairMutualConflict,
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
    it('整組對調：船、開始時間、cleanup 都換成對方，時長各自保留', () => {
      const a = makeBooking({
        id: 1,
        boat_id: 1,
        boats: { id: 1, name: 'G21', is_active: true },
        cleanup_minutes: 15,
        start_at: '2026-04-18T10:00:00',
        duration_min: 45,
      })
      const b = makeBooking({
        id: 2,
        boat_id: 2,
        boats: { id: 2, name: '彈簧床', is_active: true },
        cleanup_minutes: 0,
        start_at: '2026-04-18T14:00:00',
        duration_min: 90,
      })
      const hypo = applySwapHypothetical(a, b)
      expect(hypo.boat_id).toBe(2)
      expect(hypo.boats?.name).toBe('彈簧床')
      expect(hypo.cleanup_minutes).toBe(0)
      expect(hypo.start_at).toBe('2026-04-18T14:00:00')
      expect(hypo.duration_min).toBe(45)
    })

    it('只差時間：船不變、開始時間換成對方', () => {
      const a = makeBooking({ id: 1, start_at: '2026-04-18T10:00:00', duration_min: 45 })
      const b = makeBooking({ id: 2, start_at: '2026-04-18T14:00:00', duration_min: 90 })
      const hypo = applySwapHypothetical(a, b)
      expect(hypo.boat_id).toBe(1)
      expect(hypo.start_at).toBe('2026-04-18T14:00:00')
      expect(hypo.duration_min).toBe(45)
    })
  })

  describe('checkSwapPairMutualConflict', () => {
    it('同船時長導致互換後互撞', () => {
      const a = makeBooking({
        id: 1,
        boat_id: 1,
        start_at: '2026-04-18T10:00:00',
        duration_min: 90,
        cleanup_minutes: 15,
      })
      const b = makeBooking({
        id: 2,
        boat_id: 1,
        start_at: '2026-04-18T10:30:00',
        duration_min: 60,
        cleanup_minutes: 15,
        coaches: [{ id: 'c2', name: '李' }],
      })
      const hypoA = applySwapHypothetical(a, b)
      const hypoB = applySwapHypothetical(b, a)
      // A→10:30/90, B→10:00/60 → 重疊
      expect(checkSwapPairMutualConflict(hypoA, hypoB).ok).toBe(false)
    })

    it('同船錯開時段可互換', () => {
      const a = makeBooking({
        id: 1,
        boat_id: 1,
        start_at: '2026-04-18T10:00:00',
        duration_min: 60,
        cleanup_minutes: 15,
      })
      const b = makeBooking({
        id: 2,
        boat_id: 1,
        start_at: '2026-04-18T14:00:00',
        duration_min: 60,
        cleanup_minutes: 15,
        coaches: [{ id: 'c2', name: '李' }],
      })
      const hypoA = applySwapHypothetical(a, b)
      const hypoB = applySwapHypothetical(b, a)
      expect(checkSwapPairMutualConflict(hypoA, hypoB).ok).toBe(true)
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
    it('永遠是「互換」', () => {
      expect(swapModeLabel()).toBe('互換')
      expect(swapModeLabel('swap')).toBe('互換')
    })
  })
})
