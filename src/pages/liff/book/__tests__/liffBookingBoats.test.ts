import { describe, expect, it } from 'vitest'
import { canUseSmallBoat, onBoatTotal } from '../liffBookingBoats'

describe('onBoatTotal / canUseSmallBoat', () => {
  it('counts follow-boat seats toward aboard total', () => {
    expect(onBoatTotal(12, 5)).toBe(17)
  })

  it('allows small boat up to 12 on board', () => {
    expect(canUseSmallBoat(12)).toBe(true)
    expect(canUseSmallBoat(13)).toBe(false)
  })
})
