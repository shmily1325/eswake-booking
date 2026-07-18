import { describe, expect, it } from 'vitest'
import {
  getMembershipTypeLabel,
  isMembershipType,
  membershipAllowsDates,
  membershipCountsAsActive,
  membershipRequiresPartner,
} from '../membership'

describe('membership rules', () => {
  it('recognizes only supported membership types', () => {
    expect(['general', 'dual', 'guest', 'es'].every(isMembershipType)).toBe(true)
    expect(isMembershipType('board')).toBe(false)
    expect(isMembershipType(null)).toBe(false)
  })

  it('keeps ES aligned with general membership rules', () => {
    expect(membershipAllowsDates('general')).toBe(true)
    expect(membershipAllowsDates('es')).toBe(true)
    expect(membershipRequiresPartner('general')).toBe(false)
    expect(membershipRequiresPartner('es')).toBe(false)
    expect(membershipCountsAsActive('es')).toBe(true)
  })

  it('treats guests and dual memberships according to their distinct shapes', () => {
    expect(membershipAllowsDates('guest')).toBe(false)
    expect(membershipCountsAsActive('guest')).toBe(false)
    expect(membershipRequiresPartner('dual')).toBe(true)
    expect(getMembershipTypeLabel('dual')).toBe('雙人會員')
  })
})
