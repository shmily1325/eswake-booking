import type { User } from '@supabase/supabase-js'

/** 區間時數與船艇零件庫存共用的 hard-code 白名單。 */
export const BOAT_OPERATIONS_ALLOWED_EMAILS = [
  'minlin1325@gmail.com',
  'pjpan0511@gmail.com',
] as const

export function canAccessBoatOperations(userOrEmail: User | string | null | undefined): boolean {
  const email = typeof userOrEmail === 'string' ? userOrEmail : userOrEmail?.email
  if (!email) return false
  const normalizedEmail = email.trim().toLowerCase()
  return BOAT_OPERATIONS_ALLOWED_EMAILS.some(allowedEmail => allowedEmail === normalizedEmail)
}
