export type TomorrowReminderBindingRow = {
  member_id: string | null
  can_push: boolean
}

export type TomorrowReminderMappingRow = {
  id: string
  line_user_id: string
  member_id: string | null
  booking_id: number | null
  contact_name: string | null
  normalized_name: string | null
  contact_phone: string | null
  line_contact?: {
    display_name: string
    friend_status: 'friend' | 'blocked' | 'unknown'
  } | null
}

export type TomorrowReminderRecipientStatus =
  | 'pushable'
  | 'mapped'
  | 'suggested'
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
  bookingStudentNames?: string[]
  contactPhone?: string
  mappingId?: string
  mappingDisplayName?: string
  mappingCandidates?: Array<{
    id: string
    displayName: string
    friendStatus: 'friend' | 'blocked' | 'unknown'
  }>
}

export function buildTomorrowReminderRecipients(params: {
  studentNames: string[]
  memberIdsByName: Record<string, string[]>
  bindings: TomorrowReminderBindingRow[]
  bookingCountByName: Record<string, number>
  bookingIdsByMemberId?: Record<string, number[]>
  bookingStudentNamesByMemberId?: Record<string, string[]>
  bookingStudentNamesByName?: Record<string, string[]>
  bookingIdsByName?: Record<string, number[]>
  reminderMappings?: TomorrowReminderMappingRow[]
}): TomorrowReminderRecipient[] {
  const bindingByMember = new Map<string, boolean>()
  params.bindings.forEach((binding) => {
    if (binding.member_id) bindingByMember.set(binding.member_id, binding.can_push === true)
  })
  const activeMappings = (params.reminderMappings ?? []).filter(
    (mapping) => mapping.line_contact?.friend_status === 'friend',
  )

  return params.studentNames.flatMap<TomorrowReminderRecipient>((name) => {
    const memberIds = Array.from(new Set(params.memberIdsByName[name] || []))
    if (memberIds.length === 0) {
      const bookingStudentNames = params.bookingStudentNamesByName?.[name]
      const bookingIds = Array.from(new Set(params.bookingIdsByName?.[name] ?? []))
      const bookingGroups = bookingIds.length > 0 ? bookingIds.map((id) => [id]) : [[]]
      return bookingGroups.map((groupBookingIds) => {
        const bookingMapping = activeMappings.find(
          (mapping) =>
            !mapping.member_id &&
            !!mapping.booking_id &&
            groupBookingIds.includes(mapping.booking_id),
        )
        return {
          key: groupBookingIds.length > 0
            ? `guest:${name}:booking:${groupBookingIds[0]}`
            : `guest:${name}`,
          name,
          memberId: null,
          status: bookingMapping ? 'mapped' as const : 'guest' as const,
          bookingCount: groupBookingIds.length || params.bookingCountByName[name] || 0,
          bookingIds: groupBookingIds,
          ...(bookingMapping
            ? {
                mappingId: bookingMapping.id,
                mappingDisplayName: bookingMapping.line_contact?.display_name,
              }
            : {}),
          ...(bookingStudentNames?.length ? { bookingStudentNames } : {}),
        }
      })
    }

    return memberIds.map((memberId) => {
      const bookingIds = Array.from(new Set(params.bookingIdsByMemberId?.[memberId] || []))
      const bookingStudentNames = params.bookingStudentNamesByMemberId?.[memberId]
      const reminderMapping = activeMappings.find((mapping) => mapping.member_id === memberId)
      const hasFormalBinding = bindingByMember.has(memberId)
      const canPushFormally = bindingByMember.get(memberId) === true
      return {
        key: `member:${memberId}`,
        name,
        memberId,
        status: canPushFormally
          ? 'pushable' as const
          : reminderMapping
            ? 'mapped' as const
            : hasFormalBinding
              ? 'rebind' as const
              : 'unbound' as const,
        bookingCount: bookingIds.length || params.bookingCountByName[name] || 0,
        bookingIds,
        ...(reminderMapping
          ? {
              mappingId: reminderMapping.id,
              mappingDisplayName: reminderMapping.line_contact?.display_name,
            }
          : {}),
        ...(bookingStudentNames?.length ? { bookingStudentNames } : {}),
      }
    })
  })
}

export function getSelectedPushRecipients(
  recipients: TomorrowReminderRecipient[],
  selectedRecipientKeys: ReadonlySet<string>,
  sentRecipientKeys: ReadonlySet<string>,
): TomorrowReminderRecipient[] {
  return recipients.filter(
    (recipient) =>
      (recipient.status === 'pushable' || recipient.status === 'mapped') &&
      selectedRecipientKeys.has(recipient.key) &&
      !sentRecipientKeys.has(recipient.key),
  )
}

export function buildReminderSendPayload(
  recipients: TomorrowReminderRecipient[],
  messageForRecipient: (recipient: TomorrowReminderRecipient) => string,
): Array<{
  recipientKey: string
  memberId: string | null
  mappingId?: string
  contactName: string
  contactPhone?: string
  bookingIds: number[]
  message: string
}> {
  return recipients.map((recipient) => ({
    recipientKey: recipient.key,
    memberId: recipient.memberId,
    ...(recipient.mappingId ? { mappingId: recipient.mappingId } : {}),
    contactName: recipient.name,
    ...(recipient.contactPhone ? { contactPhone: recipient.contactPhone } : {}),
    bookingIds: recipient.bookingIds,
    message: messageForRecipient(recipient),
  }))
}
