import { describe, expect, it } from 'vitest'
import {
  BOAT_OPERATIONS_ALLOWED_EMAILS,
  canAccessBoatOperations,
} from '../utils/boatOperationsAccess'

describe('boat operations access', () => {
  it('shares the expected hard-code allowlist', () => {
    expect(BOAT_OPERATIONS_ALLOWED_EMAILS).toEqual([
      'minlin1325@gmail.com',
      'pjpan0511@gmail.com',
    ])
    expect(canAccessBoatOperations('minlin1325@gmail.com')).toBe(true)
    expect(canAccessBoatOperations('hsulittlepang2015@gmail.com')).toBe(false)
    expect(canAccessBoatOperations('callumbao1122@gmail.com')).toBe(false)
    expect(canAccessBoatOperations('other@example.com')).toBe(false)
  })
})
