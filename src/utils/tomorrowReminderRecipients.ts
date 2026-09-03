export type TomorrowReminderBindingRow = {
  member_id: string | null
  can_push: boolean
}

export type TomorrowReminderMappingRow = {
  id: string
  line_user_id: string
  member_id: string | null
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

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('zh-TW')
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
  bookingPhonesByName?: Record<string, string[]>
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
      const phones = Array.from(new Set((params.bookingPhonesByName?.[name] ?? []).filter(Boolean)))
      const phoneMappings = activeMappings.filter(
        (mapping) => !mapping.member_id && !!mapping.contact_phone && phones.includes(mapping.contact_phone),
      )
      const nameMappings = activeMappings.filter(
        (mapping) => !mapping.member_id && mapping.normalized_name === normalizeName(name),
      )
      const candidates = phoneMappings.length > 0 ? phoneMappings : nameMappings
      const uniqueByLineUser = Array.from(
        new Map(candidates.map((mapping) => [mapping.line_user_id, mapping])).values(),
      )
      const exactPhoneMapping = phones.length === 1 && uniqueByLineUser.length === 1
        ? uniqueByLineUser[0]
        : null
      return [{
        key: `guest:${name}`,
        name,
        memberId: null,
        status: exactPhoneMapping
          ? 'mapped' as const
          : uniqueByLineUser.length > 0
            ? 'suggested' as const
            : 'guest' as const,
        bookingCount: params.bookingCountByName[name] || 0,
        bookingIds,
        ...(phones.length === 1 ? { contactPhone: phones[0] } : {}),
        ...(exactPhoneMapping
          ? {
              mappingId: exactPhoneMapping.id,
              mappingDisplayName: exactPhoneMapping.line_contact?.display_name,
            }
          : {}),
        ...(uniqueByLineUser.length > 0
          ? {
              mappingCandidates: uniqueByLineUser.map((mapping) => ({
                id: mapping.id,
                displayName: mapping.line_contact?.display_name || 'LINE 使用者',
                friendStatus: mapping.line_contact?.friend_status || 'unknown',
              })),
            }
          : {}),
        ...(bookingStudentNames?.length ? { bookingStudentNames } : {}),
      }]
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
