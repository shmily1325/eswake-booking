import { describe, expect, it } from 'vitest'
import {
  filterStandardCoachList,
  isExcludedFromStandardCoachList,
} from '../coachSelection'

describe('standard coach list', () => {
  it('excludes 火隆 and 侑曄 consistently', () => {
    expect(isExcludedFromStandardCoachList('火隆')).toBe(true)
    expect(isExcludedFromStandardCoachList(' 侑曄 ')).toBe(true)
    expect(
      filterStandardCoachList([
        { id: '1', name: '小胖' },
        { id: '2', name: '火隆' },
        { id: '3', name: '侑曄' },
      ]),
    ).toEqual([{ id: '1', name: '小胖' }])
  })
})
