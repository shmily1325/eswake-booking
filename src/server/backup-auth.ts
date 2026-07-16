import type { VercelRequest } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'node:crypto'

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

function tokensMatch(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual)
  const expectedBuffer = Buffer.from(expected)
  return actualBuffer.length === expectedBuffer.length
    && timingSafeEqual(actualBuffer, expectedBuffer)
}

function authorizeAutomation(req: VercelRequest): BackupAuthResult {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return { ok: false, status: 500, error: '自動備份密鑰尚未設定' }
  }

  const token = bearerToken(req)
  if (!token || !tokensMatch(token, expected)) {
    return { ok: false, status: 401, error: '未授權的自動備份請求' }
  }

  return { ok: true }
}

export function authorizeAutomationRequest(req: VercelRequest): BackupAuthResult {
  return authorizeAutomation(req)
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
 * Automated GET requests require the Vercel CRON_SECRET.
 */
export async function authorizeBackupRequest(req: VercelRequest): Promise<BackupAuthResult> {
  if (req.method === 'GET') return authorizeAutomation(req)
  return authorizeAdmin(req)
}

export function setBackupResponseHeaders(res: {
  setHeader: (name: string, value: string) => unknown
}): void {
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('X-Content-Type-Options', 'nosniff')
}
