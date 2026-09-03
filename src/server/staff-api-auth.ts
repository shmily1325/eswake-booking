import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { VercelRequest } from '@vercel/node'

const SUPER_ADMINS = new Set([
  'callumbao1122@gmail.com',
  'pjpan0511@gmail.com',
  'minlin1325@gmail.com',
])
const HIDDEN_ALLOWED_USERS = new Set(['yylai0@gmail.com'])

export type SupabaseAdmin = SupabaseClient

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
  if (SUPER_ADMINS.has(normalized) || HIDDEN_ALLOWED_USERS.has(normalized)) {
    return { allowed: true, error: false }
  }
  for (const table of ['editor_users', 'view_users'] as const) {
    const { data, error } = await supabase
      .from(table)
      .select('email')
      .eq('email', normalized)
      .limit(1)
    if (error) return { allowed: false, error: true }
    if (data && data.length > 0) return { allowed: true, error: false }
  }
  return { allowed: false, error: false }
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
