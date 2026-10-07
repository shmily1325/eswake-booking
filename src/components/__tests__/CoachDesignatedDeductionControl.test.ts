import { describe, expect, it } from 'vitest'
import {
  defaultCoachDesignatedDeduction,
  shouldShowCoachDesignatedControl,
} from '../../pages/coach/designatedHours/deductionDefaults'

describe('coach designated deduction default', () => {
  it('does not deduct students who have no balance or existing deduction', () => {
    expect(defaultCoachDesignatedDeduction(0, null)).toBe(false)
  })

  it('defaults to deduct when the student has a non-zero balance', () => {
    expect(defaultCoachDesignatedDeduction(330, null)).toBe(true)
    expect(defaultCoachDesignatedDeduction(-30, null)).toBe(true)
  })

  it('preserves a previously saved deduction even when current balance is zero', () => {
    expect(defaultCoachDesignatedDeduction(0, 30)).toBe(true)
  })

  it('preserves an explicit no-deduction decision even when balance remains', () => {
    expect(defaultCoachDesignatedDeduction(330, null, true)).toBe(false)
  })

  it('hides the control when the student has no designated-hour records', () => {
    expect(shouldShowCoachDesignatedControl(false, false)).toBe(false)
    expect(shouldShowCoachDesignatedControl(true, false)).toBe(true)
    expect(shouldShowCoachDesignatedControl(false, true)).toBe(true)
  })
})
