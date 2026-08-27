import { createClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push'
const MAX_RECIPIENTS = 100
const MAX_MESSAGE_LENGTH = 5_000

const SUPER_ADMINS = new Set([
  'callumbao1122@gmail.com',
  'pjpan0511@gmail.com',
  'minlin1325@gmail.com',
])
const HIDDEN_ALLOWED_USERS = new Set(['yylai0@gmail.com'])

type Recipient = {
  memberId: string
  message: string
}

type SendResult = {
  memberId: string
  ok: boolean
  error?: string
}

type SupabaseAdmin = ReturnType<typeof createClient<Record<string, never>>>

function sendError(res: VercelResponse, status: number, error: string) {
  return res.status(status).json({ error })
}

function bearerToken(req: VercelRequest): string | null {
  const header = req.headers.authorization
  if (typeof header !== 'string') return null
  const match = header.match(/^Bearer\s+(\S+)$/i)
  return match?.[1] ?? null
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
  const memberIds = new Set<string>()
  for (const value of recipients) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { ok: false, error: 'Each recipient must be an object' }
    }
    const recipient = value as Record<string, unknown>
    if (typeof recipient.memberId !== 'string' || recipient.memberId.trim() === '') {
      return { ok: false, error: 'Each recipient requires a memberId' }
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

    const memberId = recipient.memberId.trim()
    if (memberIds.has(memberId)) {
      return { ok: false, error: 'memberId values must be unique' }
    }
    memberIds.add(memberId)
    parsed.push({ memberId, message: recipient.message })
  }

  return { ok: true, date, recipients: parsed }
}

async function hasViewPermission(
  supabase: SupabaseAdmin,
  email: string,
): Promise<{ allowed: boolean; error: boolean }> {
  const normalizedEmail = email.trim().toLowerCase()
  if (SUPER_ADMINS.has(normalizedEmail) || HIDDEN_ALLOWED_USERS.has(normalizedEmail)) {
    return { allowed: true, error: false }
  }

  for (const table of ['editor_users', 'view_users'] as const) {
    const { data, error } = await supabase
      .from(table)
      .select('email')
      .eq('email', normalizedEmail)
      .limit(1)
    if (error) {
      console.error(`LINE reminder permission lookup failed for ${table}:`, error.message)
      return { allowed: false, error: true }
    }
    if (data && data.length > 0) return { allowed: true, error: false }
  }

  return { allowed: false, error: false }
}

async function authenticate(
  req: VercelRequest,
  supabase: SupabaseAdmin,
): Promise<
  | { ok: true; user: User & { email: string } }
  | { ok: false; status: number; error: string }
> {
  const token = bearerToken(req)
  if (!token) return { ok: false, status: 401, error: 'Authentication required' }

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user?.email) {
    return { ok: false, status: 401, error: 'Invalid or expired authentication' }
  }

  const permission = await hasViewPermission(supabase, user.email)
  if (permission.error) return { ok: false, status: 500, error: 'Permission check failed' }
  if (!permission.allowed) return { ok: false, status: 403, error: 'Insufficient permission' }
  return { ok: true, user: user as User & { email: string } }
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
    const auth = await authenticate(req, supabase)
    if (auth.ok === false) return sendError(res, auth.status, auth.error)

    const parsed = parseBody(req.body)
    if (parsed.ok === false) return sendError(res, 400, parsed.error)

    const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
    if (!lineToken) {
      console.error('LINE reminder send API is missing LINE_CHANNEL_ACCESS_TOKEN')
      return sendError(res, 500, 'Server configuration error')
    }

    const memberIds = parsed.recipients.map(recipient => recipient.memberId)
    const { data: bindings, error: bindingsError } = await supabase
      .from('line_bindings')
      .select('member_id, line_user_id')
      .in('member_id', memberIds)
      .eq('status', 'active')
      .eq('can_push', true)

    if (bindingsError) {
      console.error('LINE reminder binding lookup failed:', bindingsError.message)
      return sendError(res, 500, 'Unable to load LINE recipients')
    }

    const lineUserIdByMember = new Map<string, string>()
    for (const binding of bindings ?? []) {
      if (
        typeof binding.member_id === 'string' &&
        typeof binding.line_user_id === 'string' &&
        binding.line_user_id
      ) {
        lineUserIdByMember.set(binding.member_id, binding.line_user_id)
      }
    }

    const results: SendResult[] = []
    for (const recipient of parsed.recipients) {
      const lineUserId = lineUserIdByMember.get(recipient.memberId)
      if (!lineUserId) {
        results.push({
          memberId: recipient.memberId,
          ok: false,
          error: 'No active push-capable LINE binding',
        })
        continue
      }

      const pushError = await pushMessage(lineUserId, recipient.message, lineToken)
      results.push(pushError
        ? { memberId: recipient.memberId, ok: false, error: pushError }
        : { memberId: recipient.memberId, ok: true })
    }

    return res.status(200).json({ results })
  } catch (error) {
    console.error(
      'LINE reminder send API failed:',
      error instanceof Error ? error.message : String(error),
    )
    return sendError(res, 500, 'Service temporarily unavailable')
  }
}
