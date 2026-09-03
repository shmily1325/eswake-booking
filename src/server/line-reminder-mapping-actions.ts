import type { VercelResponse } from '@vercel/node'
import type { SupabaseAdmin } from './staff-api-auth.js'

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('zh-TW')
}

function normalizePhone(value: string): string | null {
  const digits = value.replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('8869') && digits.length === 12) return `0${digits.slice(3)}`
  if (digits.startsWith('09') && digits.length === 10) return digits
  return null
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export async function handleLineReminderMappingAction(
  body: Record<string, unknown>,
  res: VercelResponse,
  supabase: SupabaseAdmin,
  operatorEmail: string,
) {
  const action = text(body.action)
  try {
    if (action === 'list') {
      const [contactsResult, mappingsResult, bindingsResult] = await Promise.all([
        supabase
          .from('line_webhook_contacts')
          .select('line_user_id, display_name, picture_url, profile_complete, friend_status, first_seen_at, last_seen_at, last_action')
          .order('last_seen_at', { ascending: false }),
        supabase
          .from('line_reminder_mappings')
          .select('id, line_user_id, member_id, booking_id, contact_name, normalized_name, contact_phone, created_at, updated_at, members:member_id(id, name, nickname, phone), booking:booking_id(id, contact_name, contact_phone, start_at), line_contact:line_user_id(display_name, picture_url, friend_status)')
          .order('updated_at', { ascending: false }),
        supabase
          .from('line_bindings')
          .select('line_user_id, member_id, can_push')
          .eq('status', 'active'),
      ])
      if (contactsResult.error) throw contactsResult.error
      if (mappingsResult.error) throw mappingsResult.error
      if (bindingsResult.error) throw bindingsResult.error
      const bindingByLineUser = new Map(
        (bindingsResult.data ?? []).map((binding) => [binding.line_user_id, binding]),
      )
      return res.status(200).json({
        contacts: (contactsResult.data ?? []).map((contact) => ({
          ...contact,
          formal_binding: bindingByLineUser.get(contact.line_user_id) ?? null,
        })),
        mappings: mappingsResult.data ?? [],
      })
    }

    if (action === 'search_bookings') {
      const query = text(body.query).replace(/[%_]/g, '')
      const digits = query.replace(/\D/g, '')
      if (query.length < 2 && digits.length < 3) {
        return res.status(200).json({ bookings: [] })
      }
      const now = new Date()
      const from = new Date(now)
      from.setDate(from.getDate() - 90)
      const to = new Date(now)
      to.setFullYear(to.getFullYear() + 1)
      const select = 'id, contact_name, contact_phone, start_at'
      const searches = [
        query.length >= 2
          ? supabase
              .from('bookings')
              .select(select)
              .gte('start_at', from.toISOString())
              .lte('start_at', to.toISOString())
              .ilike('contact_name', `%${query}%`)
              .limit(20)
          : Promise.resolve({ data: [], error: null }),
        digits.length >= 3
          ? supabase
              .from('bookings')
              .select(select)
              .gte('start_at', from.toISOString())
              .lte('start_at', to.toISOString())
              .ilike('contact_phone', `%${digits}%`)
              .limit(20)
          : Promise.resolve({ data: [], error: null }),
      ]
      const results = await Promise.all(searches)
      const failed = results.find((result) => result.error)
      if (failed?.error) throw failed.error
      const unique = new Map<number, {
        id: number
        contact_name: string
        contact_phone: string | null
        start_at: string
      }>()
      results.flatMap((result) => result.data ?? []).forEach((booking) => {
        unique.set(booking.id, booking)
      })
      const nowMs = now.getTime()
      const bookings = Array.from(unique.values())
        .sort((a, b) => {
          const aTime = new Date(a.start_at).getTime()
          const bTime = new Date(b.start_at).getTime()
          const aUpcoming = aTime >= nowMs
          const bUpcoming = bTime >= nowMs
          if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1
          return aUpcoming ? aTime - bTime : bTime - aTime
        })
        .slice(0, 20)
      return res.status(200).json({ bookings })
    }

    if (action === 'delete_mapping') {
      const mappingId = text(body.mappingId)
      if (!mappingId) return res.status(400).json({ error: 'mappingId is required' })
      const { error } = await supabase.from('line_reminder_mappings').delete().eq('id', mappingId)
      if (error) throw error
      return res.status(200).json({ ok: true })
    }

    if (action === 'delete_contact') {
      const lineUserId = text(body.lineUserId)
      if (!lineUserId) return res.status(400).json({ error: 'lineUserId is required' })
      const { error } = await supabase
        .from('line_webhook_contacts')
        .delete()
        .eq('line_user_id', lineUserId)
      if (error) throw error
      return res.status(200).json({ ok: true })
    }

    if (action !== 'upsert_mapping') {
      return res.status(400).json({ error: 'Unsupported action' })
    }

    const mappingId = text(body.mappingId)
    const lineUserId = text(body.lineUserId)
    const memberId = text(body.memberId) || null
    const bookingId = Number(body.bookingId)
    if (!lineUserId) return res.status(400).json({ error: 'lineUserId is required' })
    if (!memberId && (!Number.isInteger(bookingId) || bookingId <= 0)) {
      return res.status(400).json({ error: 'A booking is required for a new guest' })
    }

    const { data: contact, error: contactError } = await supabase
      .from('line_webhook_contacts')
      .select('line_user_id')
      .eq('line_user_id', lineUserId)
      .maybeSingle()
    if (contactError) throw contactError
    if (!contact) return res.status(404).json({ error: 'LINE contact not found' })

    let booking: {
      id: number
      contact_name: string
      contact_phone: string | null
    } | null = null
    if (memberId) {
      const { data: formalBinding, error: bindingError } = await supabase
        .from('line_bindings')
        .select('member_id')
        .eq('member_id', memberId)
        .eq('status', 'active')
        .eq('can_push', true)
        .maybeSingle()
      if (bindingError) throw bindingError
      if (formalBinding) {
        return res.status(409).json({ error: 'Member already has a push-capable LINE binding' })
      }
    } else {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, contact_name, contact_phone')
        .eq('id', bookingId)
        .maybeSingle()
      if (error) throw error
      if (!data) return res.status(404).json({ error: 'Booking not found' })
      booking = data
    }

    let existingId = mappingId
    if (!existingId && memberId) {
      const { data } = await supabase
        .from('line_reminder_mappings')
        .select('id')
        .eq('member_id', memberId)
        .maybeSingle()
      existingId = text(data?.id)
    } else if (!existingId && !memberId) {
      const { data } = await supabase
        .from('line_reminder_mappings')
        .select('id')
        .is('member_id', null)
        .eq('booking_id', bookingId)
        .maybeSingle()
      existingId = text(data?.id)
    }

    const contactName = memberId ? null : booking?.contact_name ?? null
    const contactPhone = memberId ? null : normalizePhone(booking?.contact_phone ?? '')
    const values = {
      line_user_id: lineUserId,
      member_id: memberId,
      booking_id: memberId ? null : bookingId,
      contact_name: contactName,
      normalized_name: contactName ? normalizeName(contactName) : null,
      contact_phone: contactPhone,
      updated_at: new Date().toISOString(),
      updated_by_email: operatorEmail.toLowerCase(),
    }
    const result = existingId
      ? await supabase
          .from('line_reminder_mappings')
          .update(values)
          .eq('id', existingId)
          .select('id')
          .single()
      : await supabase
          .from('line_reminder_mappings')
          .insert({ ...values, created_by_email: operatorEmail.toLowerCase() })
          .select('id')
          .single()
    if (result.error) throw result.error
    return res.status(200).json({ ok: true, mappingId: result.data.id })
  } catch (error) {
    console.error(
      'LINE reminder mapping action failed:',
      error instanceof Error ? error.message : String(error),
    )
    return res.status(500).json({ error: 'Unable to update LINE reminder mappings' })
  }
}
