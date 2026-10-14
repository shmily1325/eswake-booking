export type DesignatedSyncItem = {
  participant_id: number
  deduct: boolean
  minutes: number
  regular_minutes: number
  gift_minutes: number
}

export type PendingDesignatedSync = {
  bookingId: number
  coachId: string
  actorEmail: string
  savedAt: number
  items: DesignatedSyncItem[]
}

const STORAGE_KEY = 'coach_designated_pending_sync_v1'
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

function isSyncItem(value: unknown): value is DesignatedSyncItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.participant_id === 'number'
    && Number.isInteger(item.participant_id)
    && typeof item.deduct === 'boolean'
    && typeof item.minutes === 'number'
    && Number.isFinite(item.minutes)
    && typeof item.regular_minutes === 'number'
    && Number.isFinite(item.regular_minutes)
    && typeof item.gift_minutes === 'number'
    && Number.isFinite(item.gift_minutes)
}

export function readPendingDesignatedSync(
  actorEmail: string | null | undefined,
): PendingDesignatedSync | null {
  if (typeof window === 'undefined' || !actorEmail) return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<PendingDesignatedSync>
    const valid = typeof value.bookingId === 'number'
      && Number.isInteger(value.bookingId)
      && typeof value.coachId === 'string'
      && value.coachId.length > 0
      && typeof value.actorEmail === 'string'
      && value.actorEmail.toLowerCase() === actorEmail.toLowerCase()
      && typeof value.savedAt === 'number'
      && Date.now() - value.savedAt <= MAX_AGE_MS
      && Array.isArray(value.items)
      && value.items.length > 0
      && value.items.every(isSyncItem)
    if (!valid) {
      window.localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return value as PendingDesignatedSync
  } catch {
    return null
  }
}

export function savePendingDesignatedSync(pending: PendingDesignatedSync): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pending))
  } catch {
    // Persistence is best-effort; the in-memory retry remains available.
  }
}

export function clearPendingDesignatedSync(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore unavailable storage; successful server sync is authoritative.
  }
}
