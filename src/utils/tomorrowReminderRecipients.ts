export type TomorrowReminderBindingRow = {
  member_id: string | null
  can_push: boolean
}

export type TomorrowReminderRecipientStatus =
  | 'pushable'
  | 'rebind'
  | 'unbound'
  | 'guest'

export type TomorrowReminderRecipient = {
  key: string
  name: string
  memberId: string | null
  status: TomorrowReminderRecipientStatus
  bookingCount: number
  bookingIds: number[]
}

export function buildTomorrowReminderRecipients(params: {
  studentNames: string[]
  memberIdsByName: Record<string, string[]>
  bindings: TomorrowReminderBindingRow[]
  bookingCountByName: Record<string, number>
  bookingIdsByMemberId?: Record<string, number[]>
}): TomorrowReminderRecipient[] {
  const bindingByMember = new Map<string, boolean>()
  params.bindings.forEach((binding) => {
    if (binding.member_id) bindingByMember.set(binding.member_id, binding.can_push === true)
  })

  return params.studentNames.flatMap<TomorrowReminderRecipient>((name) => {
    const memberIds = Array.from(new Set(params.memberIdsByName[name] || []))
    if (memberIds.length === 0) {
      return [{
        key: `guest:${name}`,
        name,
        memberId: null,
        status: 'guest' as const,
        bookingCount: params.bookingCountByName[name] || 0,
        bookingIds: [],
      }]
    }

    return memberIds.map((memberId) => {
      const bookingIds = Array.from(new Set(params.bookingIdsByMemberId?.[memberId] || []))
      return {
        key: `member:${memberId}`,
        name,
        memberId,
        status: !bindingByMember.has(memberId)
          ? 'unbound' as const
          : bindingByMember.get(memberId)
            ? 'pushable' as const
            : 'rebind' as const,
        bookingCount: bookingIds.length || params.bookingCountByName[name] || 0,
        bookingIds,
      }
    })
  })
}

export function getSelectedPushRecipients(
  recipients: TomorrowReminderRecipient[],
  selectedMemberIds: ReadonlySet<string>,
  sentMemberIds: ReadonlySet<string>,
): TomorrowReminderRecipient[] {
  return recipients.filter(
    (recipient) =>
      recipient.status === 'pushable' &&
      !!recipient.memberId &&
      selectedMemberIds.has(recipient.memberId) &&
      !sentMemberIds.has(recipient.memberId),
  )
}

export function buildReminderSendPayload(
  recipients: TomorrowReminderRecipient[],
  messageForRecipient: (recipient: TomorrowReminderRecipient) => string,
): Array<{ memberId: string; message: string }> {
  return recipients.flatMap((recipient) =>
    recipient.memberId
      ? [{ memberId: recipient.memberId, message: messageForRecipient(recipient) }]
      : [],
  )
}
