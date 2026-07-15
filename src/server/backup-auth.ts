import type { VercelRequest } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const SUPER_ADMIN_EMAILS = [
  'callumbao1122@gmail.com',
  'pjpan0511@gmail.com',
  'minlin1325@gmail.com',
]

export type BackupAuthResult =
  | { ok: true }
  | { ok: false; status: number; error: string }

function bearerToken(req: VercelRequest): string | null {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return null
  return header.slice(7).trim() || null
}

async function authorizeAdmin(req: VercelRequest): Promise<BackupAuthResult> {
  const token = bearerToken(req)
  if (!token) return { ok: false, status: 401, error: '請先登入' }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return { ok: false, status: 500, error: 'Server 設定錯誤' }
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)

  if (error || !user?.email) {
    return { ok: false, status: 401, error: '登入已失效，請重新登入' }
  }

  const email = user.email.toLowerCase()
  if (!SUPER_ADMIN_EMAILS.some((admin) => admin.toLowerCase() === email)) {
    return { ok: false, status: 403, error: '沒有備份權限' }
  }

  return { ok: true }
}

/**
 * Manual POST requests require a signed-in super admin.
 * GET keeps the existing automated Vercel / local backup flow.
 */
export async function authorizeBackupRequest(req: VercelRequest): Promise<BackupAuthResult> {
  if (req.method === 'GET') return { ok: true }
  return authorizeAdmin(req)
}
