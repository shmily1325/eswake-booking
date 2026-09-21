import { describe, expect, it } from 'vitest'
import {
  formatRestrictionAudience,
  formatRestrictionDisplay,
} from '../restrictionDisplay'

describe('restriction display', () => {
  it('formats a dated coach restriction for announcement pages', () => {
    expect(formatRestrictionDisplay({
      startDate: '2026-09-23',
      startTime: '11:30:00',
      endDate: '2026-09-23',
      endTime: '12:30:00',
      scope: 'coaches',
      coachNames: ['小胖', '阿寶', '木鳥'],
    })).toBe('預約限制：9/23 11:30–12:30｜教練：小胖、阿寶、木鳥')
  })

  it('formats all-day and all-booking restrictions', () => {
    expect(formatRestrictionDisplay({
      startDate: '2026-09-23',
      endDate: '2026-09-23',
      scope: 'all',
    })).toBe('預約限制：9/23 全天｜全部預約')
  })

  it('supports compact day-view metadata', () => {
    expect(formatRestrictionAudience('coaches', ['小胖', '阿寶']))
      .toBe('教練：小胖、阿寶')
    expect(formatRestrictionAudience('all', [])).toBe('全部預約')
  })
})
