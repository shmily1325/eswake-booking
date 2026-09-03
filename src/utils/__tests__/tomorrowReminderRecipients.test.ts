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

  it('keeps the source student for an additional reminder recipient', () => {
    const [recipient] = buildTomorrowReminderRecipients({
      studentNames: ['澤澤'],
      memberIdsByName: { 澤澤: ['member-zhe'] },
      bindings: [{ member_id: 'member-zhe', can_push: true }],
      bookingCountByName: {},
      bookingIdsByMemberId: { 'member-zhe': [101] },
      bookingStudentNamesByMemberId: { 'member-zhe': ['Fish'] },
    })

    expect(recipient).toMatchObject({
      memberId: 'member-zhe',
      bookingIds: [101],
      bookingStudentNames: ['Fish'],
    })
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
        new Set(['member:m1', 'member:m3', 'member:m4']),
        new Set(['member:m3']),
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
      {
        recipientKey: 'member:m1',
        memberId: 'm1',
        contactName: 'A',
        bookingIds: [],
        message: 'A 的修改內容',
      },
      {
        recipientKey: 'member:m2',
        memberId: 'm2',
        contactName: 'B',
        bookingIds: [],
        message: 'B 的修改內容',
      },
    ])
  })

  it('links new guests to concrete bookings and keeps same-name bookings separate', () => {
    const recipients = buildTomorrowReminderRecipients({
      studentNames: ['Guest'],
      memberIdsByName: {},
      bindings: [],
      bookingCountByName: { Guest: 2 },
      bookingIdsByName: { Guest: [101, 202] },
      reminderMappings: [{
        id: 'booking-map',
        line_user_id: 'line-1',
        member_id: null,
        booking_id: 101,
        contact_name: 'Guest',
        normalized_name: 'guest',
        contact_phone: null,
        line_contact: { display_name: 'LINE Guest', friend_status: 'friend' },
      }],
    })

    expect(recipients[0]).toMatchObject({
      status: 'mapped',
      mappingId: 'booking-map',
      bookingIds: [101],
    })
    expect(recipients[1]).toMatchObject({
      status: 'guest',
      bookingIds: [202],
    })
  })

  it('maps multiple saved guests independently on the same booking', () => {
    const recipients = buildTomorrowReminderRecipients({
      studentNames: ['吳穎', '同行朋友'],
      memberIdsByName: {},
      bindings: [],
      bookingCountByName: { 吳穎: 1, 同行朋友: 1 },
      bookingIdsByName: { 吳穎: [101], 同行朋友: [101] },
      reminderMappings: [
        {
          id: 'saved-map-1',
          line_user_id: 'line-1',
          member_id: null,
          booking_id: 101,
          guest_id: 'guest-1',
          contact_name: '吳穎',
          normalized_name: '吳穎',
          contact_phone: null,
          guest: { is_active: true },
          line_contact: { display_name: 'LINE 吳迪', friend_status: 'friend' },
        },
        {
          id: 'saved-map-2',
          line_user_id: 'line-2',
          member_id: null,
          booking_id: 101,
          guest_id: 'guest-2',
          contact_name: '同行朋友',
          normalized_name: '同行朋友',
          contact_phone: null,
          guest: { is_active: true },
          line_contact: { display_name: 'LINE 朋友', friend_status: 'friend' },
        },
      ],
    })

    expect(recipients.find((recipient) => recipient.name === '吳穎')?.status).toBe('mapped')
    expect(recipients.find((recipient) => recipient.name === '同行朋友')?.status).toBe('mapped')
  })

  it('keeps a same-name guest when another booking links that name to a member', () => {
    const recipients = buildTomorrowReminderRecipients({
      studentNames: ['Alex'],
      memberIdsByName: { Alex: ['member-1'] },
      bindings: [{ member_id: 'member-1', can_push: true }],
      bookingCountByName: { Alex: 2 },
      bookingIdsByMemberId: { 'member-1': [101] },
      bookingIdsByName: { Alex: [101, 202] },
      reminderMappings: [{
        id: 'guest-map',
        line_user_id: 'line-guest',
        member_id: null,
        booking_id: 202,
        guest_id: 'guest-1',
        contact_name: 'Alex',
        normalized_name: 'alex',
        contact_phone: null,
        guest: { is_active: true },
        line_contact: { display_name: 'Guest Alex', friend_status: 'friend' },
      }],
    })

    expect(recipients).toHaveLength(2)
    expect(recipients.find((recipient) => recipient.memberId === 'member-1'))
      .toMatchObject({ status: 'pushable', bookingIds: [101] })
    expect(recipients.find((recipient) => recipient.memberId === null))
      .toMatchObject({ status: 'mapped', bookingIds: [202], mappingId: 'guest-map' })
  })

  it('does not use a disabled saved guest', () => {
    const [recipient] = buildTomorrowReminderRecipients({
      studentNames: ['吳穎'],
      memberIdsByName: {},
      bindings: [],
      bookingCountByName: { 吳穎: 1 },
      bookingIdsByName: { 吳穎: [101] },
      reminderMappings: [{
        id: 'saved-map',
        line_user_id: 'line-1',
        member_id: null,
        booking_id: 101,
        guest_id: 'guest-1',
        contact_name: '吳穎',
        normalized_name: '吳穎',
        contact_phone: null,
        guest: { is_active: false },
        line_contact: { display_name: 'LINE 吳迪', friend_status: 'friend' },
      }],
    })

    expect(recipient.status).toBe('guest')
  })

  it('uses a reminder-only member mapping when formal push binding is unavailable', () => {
    const [recipient] = buildTomorrowReminderRecipients({
      studentNames: ['Member'],
      memberIdsByName: { Member: ['member-1'] },
      bindings: [{ member_id: 'member-1', can_push: false }],
      bookingCountByName: { Member: 1 },
      reminderMappings: [{
        id: 'member-map',
        line_user_id: 'line-1',
        member_id: 'member-1',
        booking_id: null,
        contact_name: null,
        normalized_name: null,
        contact_phone: null,
        line_contact: { display_name: 'Mapped Member', friend_status: 'friend' },
      }],
    })

    expect(recipient).toMatchObject({
      status: 'mapped',
      mappingId: 'member-map',
      mappingDisplayName: 'Mapped Member',
    })
  })
})
