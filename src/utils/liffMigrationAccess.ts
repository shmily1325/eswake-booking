import type { User } from '@supabase/supabase-js'

/** 暫時的 LIFF 搬移進度頁，只提供給專案負責人。 */
export const LIFF_MIGRATION_ALLOWED_EMAILS = ['minlin1325@gmail.com'] as const

export function canAccessLiffMigration(
  userOrEmail: User | string | null | undefined,
): boolean {
  const email = typeof userOrEmail === 'string' ? userOrEmail : userOrEmail?.email
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  return LIFF_MIGRATION_ALLOWED_EMAILS.some(allowed => allowed === normalized)
}
