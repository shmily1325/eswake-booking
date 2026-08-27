import { describe, expect, it } from 'vitest'
import {
  buildReminderSendPayload,
  buildTomorrowReminderRecipients,
  getSelectedPushRecipients,
  type TomorrowReminderRecipient,
} from '../tomorrowReminderRecipients'

describe('buildTomorrowReminderRecipients', () => {
  it('separates pushable, legacy, unbound, and guest recipients', () => {
    const recipients = buildTomorrowReminderRecipients({
      studentNames: ['Push', 'Legacy', 'Unbound', 'Guest'],
      memberIdsByName: {
        Push: ['member-push'],
        Legacy: ['member-legacy'],
        Unbound: ['member-unbound'],
      },
      bindings: [
        { member_id: 'member-push', can_push: true },
        { member_id: 'member-legacy', can_push: false },
      ],
      bookingCountByName: {
        Push: 2,
        Legacy: 1,
        Unbound: 1,
        Guest: 1,
      },
    })

    expect(recipients).toEqual([
      { key: 'member:member-push', name: 'Push', memberId: 'member-push', status: 'pushable', bookingCount: 2, bookingIds: [] },
      { key: 'member:member-legacy', name: 'Legacy', memberId: 'member-legacy', status: 'rebind', bookingCount: 1, bookingIds: [] },
      { key: 'member:member-unbound', name: 'Unbound', memberId: 'member-unbound', status: 'unbound', bookingCount: 1, bookingIds: [] },
      { key: 'guest:Guest', name: 'Guest', memberId: null, status: 'guest', bookingCount: 1, bookingIds: [] },
    ])
  })

  it('treats duplicate binding rows by their latest supplied push capability', () => {
    const [recipient] = buildTomorrowReminderRecipients({
      studentNames: ['Member'],
      memberIdsByName: { Member: ['member-1'] },
      bindings: [
        { member_id: 'member-1', can_push: false },
        { member_id: 'member-1', can_push: true },
      ],
      bookingCountByName: { Member: 1 },
    })

    expect(recipient.status).toBe('pushable')
  })

  it('keeps members with the same display name as separate recipients', () => {
    const recipients = buildTomorrowReminderRecipients({
      studentNames: ['Alex'],
      memberIdsByName: { Alex: ['member-1', 'member-2'] },
      bindings: [
        { member_id: 'member-1', can_push: true },
        { member_id: 'member-2', can_push: true },
      ],
      bookingCountByName: { Alex: 1 },
      bookingIdsByMemberId: {
        'member-1': [101],
        'member-2': [202],
      },
    })

    expect(recipients.map((recipient) => recipient.memberId)).toEqual(['member-1', 'member-2'])
    expect(recipients.map((recipient) => recipient.bookingIds)).toEqual([[101], [202]])
  })

  it('sends only selected, unsent, pushable recipients', () => {
    const recipients: TomorrowReminderRecipient[] = [
      { key: 'member:m1', name: 'Selected', memberId: 'm1', status: 'pushable', bookingCount: 1, bookingIds: [] },
      { key: 'member:m2', name: 'Cancelled', memberId: 'm2', status: 'pushable', bookingCount: 1, bookingIds: [] },
      { key: 'member:m3', name: 'Already sent', memberId: 'm3', status: 'pushable', bookingCount: 1, bookingIds: [] },
      { key: 'member:m4', name: 'Legacy', memberId: 'm4', status: 'rebind', bookingCount: 1, bookingIds: [] },
    ]

    expect(
      getSelectedPushRecipients(
        recipients,
        new Set(['m1', 'm3', 'm4']),
        new Set(['m3']),
      ).map((recipient) => recipient.name),
    ).toEqual(['Selected'])
  })

  it('keeps each manually edited message in the send payload', () => {
    const recipients: TomorrowReminderRecipient[] = [
      { key: 'member:m1', name: 'A', memberId: 'm1', status: 'pushable', bookingCount: 1, bookingIds: [] },
      { key: 'member:m2', name: 'B', memberId: 'm2', status: 'pushable', bookingCount: 1, bookingIds: [] },
    ]
    const messages = { A: 'A 的修改內容', B: 'B 的修改內容' }

    expect(buildReminderSendPayload(recipients, (recipient) => messages[recipient.name as 'A' | 'B'])).toEqual([
      { memberId: 'm1', message: 'A 的修改內容' },
      { memberId: 'm2', message: 'B 的修改內容' },
    ])
  })
})
