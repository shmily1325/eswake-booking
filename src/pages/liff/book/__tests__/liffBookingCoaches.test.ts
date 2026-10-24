import { describe, expect, it } from 'vitest'
import {
  coachDisplayName,
  designatedCoachPrice20,
  isLiffBookCoachVisible,
} from '../liffBookingCoaches'
import type { CoachOption } from '../types'

function coach(name: string): CoachOption {
  return { id: name, name, designated_lesson_price_30min: null }
}

describe('LIFF booking coaches', () => {
  it.each([
    ['Casper', 'Casper'],
    ['木鳥', 'Harry'],
    ['Jerry', 'Jerry'],
    ['許書源', 'Johnny'],
    ['巨陽尼', 'Johnny'],
    ['小胖', 'Pang'],
    ['義揚', 'YiYang'],
    ['ED', 'ED'],
    ['智凱', 'Kevin'],
    ['Kevin', 'Kevin'],
  ])('shows %s as %s in English', (name, expected) => {
    expect(coachDisplayName(name, 'en')).toBe(expected)
    expect(coachDisplayName(name, 'zh')).toBe(name)
  })

  it('allows Casper for wakeboard and wakesurf at the same rate', () => {
    expect(designatedCoachPrice20(coach('Casper'), 'WB')).toBe(400)
    expect(designatedCoachPrice20(coach('Casper'), 'WS')).toBe(400)
  })

  it('treats 許書源 as the wakeboard-only 巨陽尼 alias', () => {
    const johnny = {
      ...coach('許書源'),
      designated_lesson_price_30min: 900,
    }
    expect(designatedCoachPrice20(johnny, 'WB')).toBe(500)
    expect(designatedCoachPrice20(johnny, 'WS')).toBeNull()
  })

  it('hides Anita from LIFF booking', () => {
    expect(isLiffBookCoachVisible('Anita')).toBe(false)
  })
})
