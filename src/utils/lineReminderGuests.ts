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

export async function searchSavedLineReminderGuests(
  query: string,
): Promise<SavedLineReminderGuest[]> {
  const result = await callReminderGuestApi({ action: 'search_guests', query })
  return (result?.guests ?? []) as SavedLineReminderGuest[]
}

export async function getBookingSavedLineReminderGuests(
  bookingId: number,
): Promise<SavedLineReminderGuest[]> {
  const result = await callReminderGuestApi({ action: 'get_booking_guests', bookingId })
  return (result?.guests ?? []) as SavedLineReminderGuest[]
}

export async function syncBookingSavedLineReminderGuests(
  bookingId: number,
  guests: Array<{ guestId: string; contactName: string }>,
): Promise<void> {
  await callReminderGuestApi({ action: 'sync_booking_guests', bookingId, guests })
}
