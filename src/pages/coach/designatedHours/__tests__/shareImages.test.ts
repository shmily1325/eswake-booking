import { describe, expect, it } from 'vitest'
import {
  coachDesignatedImageFilename,
  paginateCoachDesignatedRows,
  type CoachDesignatedShareRow,
} from '../shareImages'

function rows(count: number): CoachDesignatedShareRow[] {
  return Array.from({ length: count }, (_, index) => ({
    date: `10/${String(index + 1).padStart(2, '0')}`,
    detail: `第 ${index + 1} 堂`,
    minutes: -30,
  }))
}

describe('designated-hour share images', () => {
  it('keeps one empty page and splits long histories every 12 rows', () => {
    expect(paginateCoachDesignatedRows([])).toEqual([[]])
    expect(paginateCoachDesignatedRows(rows(25)).map((page) => page.length)).toEqual([12, 12, 1])
  })

  it('creates a safe, numbered PNG filename', () => {
    expect(coachDesignatedImageFilename('Jerry/學生:A', 2)).toBe(
      'ESWake-Jerry-學生-A-指定課-2.png',
    )
  })
})
