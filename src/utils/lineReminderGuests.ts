import { supabase } from '../lib/supabase'

export type SavedLineReminderGuest = {
  id: string
  line_user_id: string
  name: string
  booking_name?: string | null
  is_active?: boolean
  line_contact?: {
    display_name: string
    picture_url: string | null
    friend_status: 'friend' | 'blocked' | 'unknown'
  } | null
}

const BOOKING_GUEST_CACHE_MS = 60_000
const bookingGuestRequests = new Map<
  number,
  { promise: Promise<SavedLineReminderGuest[]>; expiresAt: number }
>()

type BookingGuestMapping = {
  booking_id: number | null
  guest_id: string | null
  line_user_id: string
  contact_name: string | null
  line_contact?: {
    display_name: string
    friend_status: 'friend' | 'blocked' | 'unknown'
  } | null
  guest?: { is_active: boolean } | null
}

export async function callReminderGuestApi(body: Record<string, unknown>) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('登入已失效，請重新登入')
  const response = await fetch('/api/line-reminder-send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const result = await response.json().catch(() => null) as Record<string, unknown> | null
  if (!response.ok) {
    throw new Error(typeof result?.error === 'string' ? result.error : 'LINE 提醒客人操作失敗')
  }
  return result
}

export async function saveLineReminderGuest(input: {
  guestId: string
  lineUserId: string
  name: string
}): Promise<SavedLineReminderGuest> {
  const result = await callReminderGuestApi({
    action: 'save_guest',
    ...input,
  })
  return result?.guest as SavedLineReminderGuest
}

export async function setLineReminderGuestActive(
  guestId: string,
  isActive: boolean,
): Promise<void> {
  await callReminderGuestApi({ action: 'set_guest_active', guestId, isActive })
}

export async function deleteLineReminderGuest(guestId: string): Promise<void> {
  await callReminderGuestApi({ action: 'delete_guest', guestId })
}

export async function searchSavedLineReminderGuests(
  query: string,
): Promise<SavedLineReminderGuest[]> {
  const result = await callReminderGuestApi({ action: 'search_guests', query })
  return (result?.guests ?? []) as SavedLineReminderGuest[]
}

export async function getBookingSavedLineReminderGuests(
  bookingId: number,
): Promise<SavedLineReminderGuest[]> {
  const cached = bookingGuestRequests.get(bookingId)
  if (cached && cached.expiresAt > Date.now()) return cached.promise

  let promise: Promise<SavedLineReminderGuest[]>
  promise = callReminderGuestApi({ action: 'get_booking_guests', bookingId })
    .then((result) => {
      const guests = (result?.guests ?? []) as SavedLineReminderGuest[]
      const entry = bookingGuestRequests.get(bookingId)
      if (entry?.promise === promise) {
        entry.expiresAt = Date.now() + BOOKING_GUEST_CACHE_MS
      }
      return guests
    })
    .catch((error) => {
      bookingGuestRequests.delete(bookingId)
      throw error
    })
  bookingGuestRequests.set(bookingId, {
    promise,
    expiresAt: Number.POSITIVE_INFINITY,
  })
  return promise
}

export async function prefetchBookingSavedLineReminderGuests(
  bookingIds: number[],
): Promise<void> {
  const now = Date.now()
  const ids = Array.from(new Set(bookingIds))
    .filter((id) =>
      Number.isInteger(id) &&
      id > 0 &&
      !((bookingGuestRequests.get(id)?.expiresAt ?? 0) > now)
    )
  if (ids.length === 0) return

  const chunks = Array.from(
    { length: Math.ceil(ids.length / 200) },
    (_, index) => ids.slice(index * 200, (index + 1) * 200),
  )
  await Promise.all(chunks.map(async (chunk) => {
    const result = await callReminderGuestApi({
      action: 'list_reminder_mappings',
      bookingIds: chunk,
      memberIds: [],
    })
    const guestsByBooking = new Map<number, SavedLineReminderGuest[]>(
      chunk.map((bookingId) => [bookingId, []]),
    )
    for (const mapping of (result?.mappings ?? []) as BookingGuestMapping[]) {
      if (!mapping.booking_id || !mapping.guest_id) continue
      const contactName = mapping.contact_name?.trim() || 'LINE 客人'
      guestsByBooking.get(mapping.booking_id)?.push({
        id: mapping.guest_id,
        line_user_id: mapping.line_user_id,
        name: contactName,
        booking_name: contactName,
        is_active: mapping.guest?.is_active,
        line_contact: mapping.line_contact
          ? {
              ...mapping.line_contact,
              picture_url: null,
            }
          : null,
      })
    }
    const expiresAt = Date.now() + BOOKING_GUEST_CACHE_MS
    guestsByBooking.forEach((guests, bookingId) => {
      bookingGuestRequests.set(bookingId, {
        promise: Promise.resolve(guests),
        expiresAt,
      })
    })
  }))
}

export async function syncBookingSavedLineReminderGuests(
  bookingId: number,
  guests: Array<{ guestId: string; contactName: string }>,
): Promise<void> {
  await callReminderGuestApi({ action: 'sync_booking_guests', bookingId, guests })
  bookingGuestRequests.delete(bookingId)
}
