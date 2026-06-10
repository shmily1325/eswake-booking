import { describe, expect, it } from 'vitest'
import { computePriceEstimate } from '../liffBookingPricing'
import type { CoachOption, LiffBookingFormState } from '../types'

const coach: CoachOption = {
  id: 'coach-1',
  name: '巨陽尼',
  designated_lesson_price_30min: null,
}

const baseForm: LiffBookingFormState = {
  activity: 'WB',
  boatPreference: 'small',
  skillLevel: 'experienced',
  headcount: 2,
  beginnerCount: 0,
  coachChoice: 'designated',
  coachId: 'coach-1',
  preferredDates: [{ date: '2026-06-10', timePreference: 'morning' }],
  contactName: 'Test',
  contactPhone: '0912345678',
  notes: '',
  followBoatCount: 0,
}

describe('computePriceEstimate designated coach', () => {
  it('multiplies 20-min coach rate by all riders on water', () => {
    const estimate = computePriceEstimate(baseForm, [coach], null, 'zh')
    expect(estimate).not.toBeNull()
    expect(estimate!.coachLine).toEqual({ coachName: '巨陽尼', amount: 1000 })
    expect(estimate!.detailLines.some(l => l.includes('教練 巨陽尼') && l.includes('500'))).toBe(true)
  })

  it('includes designated coach fee for all beginners', () => {
    const estimate = computePriceEstimate(
      { ...baseForm, beginnerCount: 2, skillLevel: 'first_time' },
      [coach],
      null,
      'zh',
    )
    expect(estimate).not.toBeNull()
    expect(estimate!.coachLine).toEqual({ coachName: '巨陽尼', amount: 1000 })
    expect(estimate!.detailLines.some(l => l.includes('教練 巨陽尼') && l.includes('2×'))).toBe(true)
  })
})
