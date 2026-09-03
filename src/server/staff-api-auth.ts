import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { VercelRequest } from '@vercel/node'

const SUPER_ADMINS = new Set([
  'callumbao1122@gmail.com',
  'pjpan0511@gmail.com',
  'minlin1325@gmail.com',
])
const HIDDEN_ALLOWED_USERS = new Set(['yylai0@gmail.com'])
const DEFAULT_LINE_REMINDER_MANAGERS = new Set([
  'callumbao1122@gmail.com',
  'pjpan0511@gmail.com',
  'minlin1325@gmail.com',
  'stt884142000@gmail.com',
  'lynn8046356@gmail.com',
])

export type SupabaseAdmin = SupabaseClient

export function canManageLineReminderMappings(email: string): boolean {
  const configured = [
    process.env.LINE_REMINDER_MANAGERS,
    process.env.VITE_MEMBER_PHONE_ONLY_EDITORS,
  ]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.split(','))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
  return new Set([...DEFAULT_LINE_REMINDER_MANAGERS, ...configured])
    .has(email.trim().toLowerCase())
}

export async function hasStaffEditPermission(
  supabase: SupabaseAdmin,
  email: string,
): Promise<boolean> {
  const normalized = email.trim().toLowerCase()
  if (canManageLineReminderMappings(normalized) || SUPER_ADMINS.has(normalized)) return true
  const { data, error } = await supabase
    .from('editor_users')
    .select('email, can_schedule')
    .eq('email', normalized)
    .eq('can_schedule', true)
    .limit(1)
  if (error) throw error
  return Boolean(data?.length)
}

function bearerToken(req: VercelRequest): string | null {
  const header = req.headers.authorization
  if (typeof header !== 'string') return null
  return header.match(/^Bearer\s+(\S+)$/i)?.[1] ?? null
}

async function hasViewPermission(
  supabase: SupabaseAdmin,
  email: string,
): Promise<{ allowed: boolean; error: boolean }> {
  const normalized = email.trim().toLowerCase()
  if (
    SUPER_ADMINS.has(normalized) ||
    HIDDEN_ALLOWED_USERS.has(normalized) ||
    canManageLineReminderMappings(normalized)
  ) {
    return { allowed: true, error: false }
  }
  const results = await Promise.all(
    (['editor_users', 'view_users'] as const).map((table) =>
      supabase
      .from(table)
      .select('email')
      .eq('email', normalized)
      .limit(1),
    ),
  )
  if (results.some(({ error }) => Boolean(error))) {
    return { allowed: false, error: true }
  }
  return {
    allowed: results.some(({ data }) => Boolean(data?.length)),
    error: false,
  }
}

export async function authenticateStaff(
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
