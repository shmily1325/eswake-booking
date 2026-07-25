import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getBoardExpiryAlertStatus,
  getMembershipExpiryAlertStatus,
  getMembershipTypeBadgeVariant,
  getMembershipTypeLabel,
  isMembershipType,
  membershipAllowsDates,
  membershipCountsAsActive,
  membershipRequiresPartner,
} from '../membership'

describe('membership rules', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

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
    expect(getMembershipTypeBadgeVariant('guest')).toBe('warning')
    expect(getMembershipTypeBadgeVariant('es')).toBe('default')
    expect(getMembershipTypeBadgeVariant('dual')).toBe('info')
  })

  it('flags membership and board expiry only inside the reminder window', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-26T04:00:00Z'))

    expect(getMembershipExpiryAlertStatus('general', '2026-06-01')).toBe('expired')
    expect(getMembershipExpiryAlertStatus('general', '2026-08-10')).toBe('soon')
    expect(getMembershipExpiryAlertStatus('general', '2026-12-01')).toBeNull()
    expect(getMembershipExpiryAlertStatus('guest', '2026-06-01')).toBeNull()

    expect(getBoardExpiryAlertStatus(['2026-06-01', '2026-12-01'])).toBe('expired')
    expect(getBoardExpiryAlertStatus(['2026-08-10', '2026-12-01'])).toBe('soon')
    expect(getBoardExpiryAlertStatus(['2026-12-01'])).toBeNull()
  })
})
