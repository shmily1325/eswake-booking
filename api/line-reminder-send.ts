import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  authenticateStaff,
  canManageLineReminderMappings,
  hasStaffEditPermission,
} from '../src/server/staff-api-auth.js'
import { handleLineReminderMappingAction } from '../src/server/line-reminder-mapping-actions.js'

const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push'
const MAX_RECIPIENTS = 100
const MAX_MESSAGE_LENGTH = 5_000

type Recipient = {
  recipientKey: string
  memberId: string | null
  mappingId?: string
  contactName: string
  contactPhone?: string
  bookingIds: number[]
  message: string
}

type SendResult = {
  recipientKey: string
  memberId: string | null
  ok: boolean
  error?: string
}

function sendError(res: VercelResponse, status: number, error: string) {
  return res.status(status).json({ error })
}

function isValidDate(date: string): boolean {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  )
}

function parseBody(body: unknown):
  | { ok: true; date: string; recipients: Recipient[] }
  | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Invalid request body' }
  }

  const { date, recipients } = body as Record<string, unknown>
  if (typeof date !== 'string' || !isValidDate(date)) {
    return { ok: false, error: 'date must use YYYY-MM-DD format' }
  }
  if (!Array.isArray(recipients) || recipients.length === 0 || recipients.length > MAX_RECIPIENTS) {
    return { ok: false, error: `recipients must contain between 1 and ${MAX_RECIPIENTS} items` }
  }

  const parsed: Recipient[] = []
  const recipientKeys = new Set<string>()
  for (const value of recipients) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { ok: false, error: 'Each recipient must be an object' }
    }
    const recipient = value as Record<string, unknown>
    if (typeof recipient.recipientKey !== 'string' || recipient.recipientKey.trim() === '') {
      return { ok: false, error: 'Each recipient requires a recipientKey' }
    }
    if (recipient.memberId !== null && typeof recipient.memberId !== 'string') {
      return { ok: false, error: 'memberId must be a string or null' }
    }
    if (typeof recipient.contactName !== 'string' || recipient.contactName.trim() === '') {
      return { ok: false, error: 'Each recipient requires a contactName' }
    }
    if (
      recipient.mappingId !== undefined &&
      (typeof recipient.mappingId !== 'string' || recipient.mappingId.trim() === '')
    ) {
      return { ok: false, error: 'mappingId must be a nonempty string' }
    }
    if (
      recipient.contactPhone !== undefined &&
      (typeof recipient.contactPhone !== 'string' || !/^09\d{8}$/.test(recipient.contactPhone))
    ) {
      return { ok: false, error: 'contactPhone must be a Taiwan mobile number' }
    }
    if (
      !Array.isArray(recipient.bookingIds) ||
      recipient.bookingIds.some((id) => !Number.isInteger(id) || (id as number) <= 0)
    ) {
      return { ok: false, error: 'bookingIds must contain positive integers' }
    }
    if (
      typeof recipient.message !== 'string' ||
      recipient.message.trim() === '' ||
      recipient.message.length > MAX_MESSAGE_LENGTH
    ) {
      return {
        ok: false,
        error: `Each message must be nonempty and at most ${MAX_MESSAGE_LENGTH} characters`,
      }
    }

    const recipientKey = recipient.recipientKey.trim()
    if (recipientKeys.has(recipientKey)) {
      return { ok: false, error: 'recipientKey values must be unique' }
    }
    recipientKeys.add(recipientKey)
    parsed.push({
      recipientKey,
      memberId: typeof recipient.memberId === 'string' ? recipient.memberId.trim() : null,
      ...(typeof recipient.mappingId === 'string' ? { mappingId: recipient.mappingId.trim() } : {}),
      contactName: recipient.contactName.trim(),
      ...(typeof recipient.contactPhone === 'string'
        ? { contactPhone: recipient.contactPhone }
        : {}),
      bookingIds: Array.from(new Set(recipient.bookingIds as number[])),
      message: recipient.message,
    })
  }

  return { ok: true, date, recipients: parsed }
}

async function pushMessage(lineUserId: string, message: string, token: string): Promise<string | null> {
  try {
    const response = await fetch(LINE_PUSH_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{ type: 'text', text: message }],
      }),
    })
    if (!response.ok) return `LINE API returned HTTP ${response.status}`
    return null
  } catch (error) {
    console.error('LINE reminder push request failed:', error instanceof Error ? error.message : error)
    return 'LINE push request failed'
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return sendError(res, 405, 'Method not allowed')
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('LINE reminder send API is missing Supabase server credentials')
    return sendError(res, 500, 'Server configuration error')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const auth = await authenticateStaff(req, supabase)
    if (auth.ok === false) return sendError(res, auth.status, auth.error)

    const requestBody = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
      ? req.body as Record<string, unknown>
      : null
    if (typeof requestBody?.action === 'string') {
      const managerOnlyActions = new Set([
        'list',
        'save_guest',
        'set_guest_active',
        'delete_guest',
        'delete_mapping',
        'delete_contact',
        'upsert_mapping',
      ])
      if (
        managerOnlyActions.has(requestBody.action) &&
        !canManageLineReminderMappings(auth.user.email)
      ) {
        return sendError(res, 403, 'LINE reminder manager permission required')
      }
      if (
        requestBody.action === 'sync_booking_guests' &&
        !(await hasStaffEditPermission(supabase, auth.user.email))
      ) {
        return sendError(res, 403, 'Booking editor permission required')
      }
      return handleLineReminderMappingAction(requestBody, res, supabase, auth.user.email)
    }

    const parsed = parseBody(req.body)
    if (parsed.ok === false) return sendError(res, 400, parsed.error)

    const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
    if (!lineToken) {
      console.error('LINE reminder send API is missing LINE_CHANNEL_ACCESS_TOKEN')
      return sendError(res, 500, 'Server configuration error')
    }

    const memberIds = parsed.recipients
      .map(recipient => recipient.memberId)
      .filter((memberId): memberId is string => !!memberId)
    const mappingIds = parsed.recipients
      .map(recipient => recipient.mappingId)
      .filter((mappingId): mappingId is string => !!mappingId)
    const [bindingsResult, mappingsResult, formalLineBindingsResult] = await Promise.all([
      memberIds.length > 0
        ? supabase
            .from('line_bindings')
            .select('member_id, line_user_id')
            .in('member_id', memberIds)
            .eq('status', 'active')
            .eq('can_push', true)
        : Promise.resolve({ data: [], error: null }),
      mappingIds.length > 0
        ? supabase
            .from('line_reminder_mappings')
            .select('id, line_user_id, member_id, booking_id, guest_id, normalized_name, contact_phone, guest:guest_id(is_active), line_contact:line_user_id(friend_status)')
            .in('id', mappingIds)
        : Promise.resolve({ data: [], error: null }),
      mappingIds.length > 0
        ? supabase
            .from('line_bindings')
            .select('line_user_id')
            .eq('status', 'active')
            .eq('can_push', true)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (bindingsResult.error || mappingsResult.error || formalLineBindingsResult.error) {
      console.error(
        'LINE reminder recipient lookup failed:',
        bindingsResult.error?.message ||
          mappingsResult.error?.message ||
          formalLineBindingsResult.error?.message,
      )
      return sendError(res, 500, 'Unable to load LINE recipients')
    }

    const lineUserIdByMember = new Map<string, string>()
    for (const binding of bindingsResult.data ?? []) {
      if (
        typeof binding.member_id === 'string' &&
        typeof binding.line_user_id === 'string' &&
        binding.line_user_id
      ) {
        lineUserIdByMember.set(binding.member_id, binding.line_user_id)
      }
    }
    const formallyBoundLineUserIds = new Set(
      (formalLineBindingsResult.data ?? [])
        .map((binding) => binding.line_user_id)
        .filter((lineUserId): lineUserId is string => typeof lineUserId === 'string'),
    )

    const mappingById = new Map<string, {
      id: string
      line_user_id: string
      member_id: string | null
      booking_id: number | null
      guest_id: string | null
      normalized_name: string | null
      contact_phone: string | null
      guest?: { is_active?: boolean } | Array<{ is_active?: boolean }> | null
      line_contact?: { friend_status?: string } | Array<{ friend_status?: string }> | null
    }>()
    for (const value of mappingsResult.data ?? []) {
      const mapping = value as unknown as {
        id: string
        line_user_id: string
        member_id: string | null
        booking_id: number | null
        guest_id: string | null
        normalized_name: string | null
        contact_phone: string | null
        guest?: { is_active?: boolean } | Array<{ is_active?: boolean }> | null
        line_contact?: { friend_status?: string } | Array<{ friend_status?: string }> | null
      }
      mappingById.set(mapping.id, mapping)
    }

    const resultByRecipientKey = new Map<string, SendResult>()
    const resolved: Array<{
      recipient: Recipient
      lineUserId: string
    }> = []
    for (const recipient of parsed.recipients) {
      let lineUserId = recipient.memberId
        ? lineUserIdByMember.get(recipient.memberId)
        : undefined
      if (!lineUserId && recipient.mappingId) {
        const mapping = mappingById.get(recipient.mappingId)
        const contact = Array.isArray(mapping?.line_contact)
          ? mapping?.line_contact[0]
          : mapping?.line_contact
        const guest = Array.isArray(mapping?.guest)
          ? mapping?.guest[0]
          : mapping?.guest
        const identityMatches = recipient.memberId
          ? mapping?.member_id === recipient.memberId
          : mapping?.member_id === null &&
            typeof mapping.booking_id === 'number' &&
            recipient.bookingIds.includes(mapping.booking_id) &&
            mapping.normalized_name === recipient.contactName
              .trim()
              .replace(/\s+/g, ' ')
              .toLocaleLowerCase('zh-TW')
        const savedGuestIsActive = !mapping?.guest_id || guest?.is_active === true
        if (
          mapping &&
          contact?.friend_status === 'friend' &&
          !formallyBoundLineUserIds.has(mapping.line_user_id) &&
          savedGuestIsActive &&
          identityMatches
        ) {
          lineUserId = mapping.line_user_id
        }
      }
      if (!lineUserId) {
        resultByRecipientKey.set(recipient.recipientKey, {
          recipientKey: recipient.recipientKey,
          memberId: recipient.memberId,
          ok: false,
          error: 'No verified push-capable LINE recipient',
        })
        continue
      }
      resolved.push({ recipient, lineUserId })
    }

    const groups = new Map<string, Recipient[]>()
    for (const item of resolved) {
      const group = groups.get(item.lineUserId) ?? []
      group.push(item.recipient)
      groups.set(item.lineUserId, group)
    }
    for (const [lineUserId, group] of groups) {
      const messages = Array.from(new Set(group.map(recipient => recipient.message.trim())))
      const combinedMessage = messages.join('\n\n──────────\n\n')
      const pushError = combinedMessage.length > MAX_MESSAGE_LENGTH
        ? 'Combined LINE message exceeds 5000 characters'
        : await pushMessage(lineUserId, combinedMessage, lineToken)
      group.forEach((recipient) => {
        resultByRecipientKey.set(recipient.recipientKey, pushError
          ? {
              recipientKey: recipient.recipientKey,
              memberId: recipient.memberId,
              ok: false,
              error: pushError,
            }
          : {
              recipientKey: recipient.recipientKey,
              memberId: recipient.memberId,
              ok: true,
            })
      })
    }

    const results = parsed.recipients
      .map((recipient) => resultByRecipientKey.get(recipient.recipientKey))
      .filter((result): result is SendResult => !!result)
    return res.status(200).json({ results })
  } catch (error) {
    console.error(
      'LINE reminder send API failed:',
      error instanceof Error ? error.message : String(error),
    )
    return sendError(res, 500, 'Service temporarily unavailable')
  }
}
