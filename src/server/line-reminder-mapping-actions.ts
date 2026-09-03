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

function bookingNames(value: string): string[] {
  return value.split(/[,，]/).map((name) => name.trim()).filter(Boolean)
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
      const [contactsResult, mappingsResult, bindingsResult, guestsResult] = await Promise.all([
        supabase
          .from('line_webhook_contacts')
          .select('line_user_id, display_name, picture_url, profile_complete, friend_status, first_seen_at, last_seen_at, last_action')
          .order('last_seen_at', { ascending: false }),
        supabase
          .from('line_reminder_mappings')
          .select('id, line_user_id, member_id, booking_id, guest_id, contact_name, normalized_name, contact_phone, created_at, updated_at, members:member_id(id, name, nickname, phone), booking:booking_id(id, contact_name, contact_phone, start_at), guest:guest_id(id, name, is_active), line_contact:line_user_id(display_name, picture_url, friend_status)')
          .order('updated_at', { ascending: false }),
        supabase
          .from('line_bindings')
          .select('line_user_id, member_id, can_push')
          .eq('status', 'active'),
        supabase
          .from('line_reminder_guests')
          .select('id, line_user_id, name, normalized_name, is_active, updated_at, line_contact:line_user_id(display_name, picture_url, friend_status)')
          .order('name'),
      ])
      if (contactsResult.error) throw contactsResult.error
      if (mappingsResult.error) throw mappingsResult.error
      if (bindingsResult.error) throw bindingsResult.error
      if (guestsResult.error) throw guestsResult.error
      const bindingByLineUser = new Map(
        (bindingsResult.data ?? []).map((binding) => [binding.line_user_id, binding]),
      )
      return res.status(200).json({
        contacts: (contactsResult.data ?? []).map((contact) => ({
          ...contact,
          formal_binding: bindingByLineUser.get(contact.line_user_id) ?? null,
        })),
        mappings: mappingsResult.data ?? [],
        guests: guestsResult.data ?? [],
      })
    }

    if (action === 'search_guests') {
      const query = text(body.query).replace(/[%_]/g, '')
      if (!query) return res.status(200).json({ guests: [] })
      const { data, error } = await supabase
        .from('line_reminder_guests')
        .select('id, line_user_id, name, line_contact:line_user_id(display_name, picture_url, friend_status)')
        .eq('is_active', true)
        .ilike('name', `%${query}%`)
        .order('name')
        .limit(10)
      if (error) throw error
      const lineUserIds = (data ?? []).map((guest) => guest.line_user_id)
      const { data: bindings, error: bindingsError } = lineUserIds.length > 0
        ? await supabase
            .from('line_bindings')
            .select('line_user_id')
            .in('line_user_id', lineUserIds)
            .eq('status', 'active')
            .eq('can_push', true)
        : { data: [], error: null }
      if (bindingsError) throw bindingsError
      const formallyBound = new Set((bindings ?? []).map((binding) => binding.line_user_id))
      return res.status(200).json({
        guests: (data ?? []).filter((guest) => {
          const contact = Array.isArray(guest.line_contact)
            ? guest.line_contact[0]
            : guest.line_contact
          return contact?.friend_status === 'friend' && !formallyBound.has(guest.line_user_id)
        }),
      })
    }

    if (action === 'get_booking_guests') {
      const bookingId = Number(body.bookingId)
      if (!Number.isInteger(bookingId) || bookingId <= 0) {
        return res.status(400).json({ error: 'bookingId is required' })
      }
      const { data, error } = await supabase
        .from('line_reminder_mappings')
        .select('contact_name, guest:guest_id(id, line_user_id, name, is_active, line_contact:line_user_id(display_name, picture_url, friend_status))')
        .eq('booking_id', bookingId)
        .not('guest_id', 'is', null)
      if (error) throw error
      const guests = (data ?? []).flatMap((mapping) => {
        const guest = Array.isArray(mapping.guest) ? mapping.guest[0] : mapping.guest
        return guest ? [{ ...guest, booking_name: mapping.contact_name ?? null }] : []
      })
      return res.status(200).json({
        guests,
      })
    }

    if (action === 'save_guest') {
      const guestId = text(body.guestId)
      const lineUserId = text(body.lineUserId)
      const name = text(body.name)
      if (!lineUserId || !name) {
        return res.status(400).json({ error: 'lineUserId and name are required' })
      }
      const [{ data: contact, error: contactError }, { data: binding, error: bindingError }] =
        await Promise.all([
          supabase
            .from('line_webhook_contacts')
            .select('line_user_id, friend_status')
            .eq('line_user_id', lineUserId)
            .maybeSingle(),
          supabase
            .from('line_bindings')
            .select('member_id')
            .eq('line_user_id', lineUserId)
            .eq('status', 'active')
            .eq('can_push', true)
            .maybeSingle(),
        ])
      if (contactError) throw contactError
      if (bindingError) throw bindingError
      if (!contact || contact.friend_status !== 'friend') {
        return res.status(409).json({ error: 'LINE contact is not available for reminders' })
      }
      if (binding) {
        return res.status(409).json({ error: 'LINE contact already has a formal member binding' })
      }
      const values = {
        line_user_id: lineUserId,
        name,
        normalized_name: normalizeName(name),
        is_active: true,
        updated_at: new Date().toISOString(),
        updated_by_email: operatorEmail.toLowerCase(),
      }
      const result = guestId
        ? await supabase
            .from('line_reminder_guests')
            .update(values)
            .eq('id', guestId)
            .select('id, line_user_id, name, normalized_name, is_active')
            .single()
        : await supabase
            .from('line_reminder_guests')
            .upsert(
              { ...values, created_by_email: operatorEmail.toLowerCase() },
              { onConflict: 'line_user_id' },
            )
            .select('id, line_user_id, name, normalized_name, is_active')
            .single()
      if (result.error) throw result.error
      if (guestId) {
        const { error: mappingError } = await supabase
          .from('line_reminder_mappings')
          .update({
            line_user_id: lineUserId,
            updated_at: new Date().toISOString(),
            updated_by_email: operatorEmail.toLowerCase(),
          })
          .eq('guest_id', guestId)
        if (mappingError) throw mappingError
      }
      return res.status(200).json({ ok: true, guest: result.data })
    }

    if (action === 'set_guest_active') {
      const guestId = text(body.guestId)
      if (!guestId) return res.status(400).json({ error: 'guestId is required' })
      const { error } = await supabase
        .from('line_reminder_guests')
        .update({
          is_active: body.isActive === true,
          updated_at: new Date().toISOString(),
          updated_by_email: operatorEmail.toLowerCase(),
        })
        .eq('id', guestId)
      if (error) throw error
      return res.status(200).json({ ok: true })
    }

    if (action === 'sync_booking_guests') {
      const bookingId = Number(body.bookingId)
      if (!Number.isInteger(bookingId) || bookingId <= 0) {
        return res.status(400).json({ error: 'bookingId is required' })
      }
      if (!Array.isArray(body.guests)) {
        return res.status(400).json({ error: 'guests must be an array' })
      }
      const guests = body.guests.flatMap((value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return []
        const row = value as Record<string, unknown>
        const guestId = text(row.guestId)
        const contactName = text(row.contactName)
        return guestId && contactName ? [{ guestId, contactName }] : []
      })
      const guestIds = new Set(guests.map((guest) => guest.guestId))
      const guestNames = new Set(guests.map((guest) => normalizeName(guest.contactName)))
      if (
        guests.length !== body.guests.length ||
        guests.length > 20 ||
        guests.some((guest) =>
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
            .test(guest.guestId)
        ) ||
        guestIds.size !== guests.length ||
        guestNames.size !== guests.length
      ) {
        return res.status(400).json({ error: 'guests must contain unique IDs and names' })
      }
      const { error } = await supabase.rpc('sync_line_reminder_booking_guests', {
        p_booking_id: bookingId,
        p_guests: guests,
        p_operator_email: operatorEmail.toLowerCase(),
      })
      if (error) {
        if (/booking|guest|LINE|name/i.test(error.message)) {
          return res.status(409).json({ error: error.message })
        }
        throw error
      }
      return res.status(200).json({ ok: true })
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
    const requestedContactName = text(body.contactName)
    const saveGuestName = text(body.saveGuestName)
    if (!lineUserId) return res.status(400).json({ error: 'lineUserId is required' })
    if (!memberId && (!Number.isInteger(bookingId) || bookingId <= 0)) {
      return res.status(400).json({ error: 'A booking is required for a new guest' })
    }
    if (!memberId && !requestedContactName) {
      return res.status(400).json({ error: 'contactName is required for a new guest' })
    }

    const { data: contact, error: contactError } = await supabase
      .from('line_webhook_contacts')
      .select('line_user_id, friend_status')
      .eq('line_user_id', lineUserId)
      .maybeSingle()
    if (contactError) throw contactError
    if (!contact) return res.status(404).json({ error: 'LINE contact not found' })
    if (contact.friend_status !== 'friend') {
      return res.status(409).json({ error: 'LINE contact is not available for reminders' })
    }
    const { data: lineBinding, error: lineBindingError } = await supabase
      .from('line_bindings')
      .select('member_id')
      .eq('line_user_id', lineUserId)
      .eq('status', 'active')
      .eq('can_push', true)
      .maybeSingle()
    if (lineBindingError) throw lineBindingError
    if (lineBinding) {
      return res.status(409).json({ error: 'LINE contact already has a formal member binding' })
    }

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
      const requestedNormalizedName = normalizeName(requestedContactName)
      if (!bookingNames(data.contact_name ?? '').some(
        (name) => normalizeName(name) === requestedNormalizedName,
      )) {
        return res.status(409).json({ error: 'Selected name is not part of this booking' })
      }
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
        .eq('normalized_name', normalizeName(requestedContactName))
        .maybeSingle()
      existingId = text(data?.id)
    }

    const contactName = memberId ? null : requestedContactName
    const contactPhone = memberId ? null : normalizePhone(booking?.contact_phone ?? '')
    const values = {
      line_user_id: lineUserId,
      member_id: memberId,
      booking_id: memberId ? null : bookingId,
      guest_id: null,
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
    let savedGuest = null
    if (!memberId && saveGuestName) {
      const guestValues = {
        line_user_id: lineUserId,
        name: saveGuestName,
        normalized_name: normalizeName(saveGuestName),
        is_active: true,
        updated_at: new Date().toISOString(),
        updated_by_email: operatorEmail.toLowerCase(),
        created_by_email: operatorEmail.toLowerCase(),
      }
      const guestResult = await supabase
        .from('line_reminder_guests')
        .upsert(guestValues, { onConflict: 'line_user_id' })
        .select('id, line_user_id, name, normalized_name, is_active')
        .single()
      if (guestResult.error) throw guestResult.error
      savedGuest = guestResult.data
      const { error: mappingGuestError } = await supabase
        .from('line_reminder_mappings')
        .update({ guest_id: guestResult.data.id })
        .eq('id', result.data.id)
      if (mappingGuestError) throw mappingGuestError
    }
    return res.status(200).json({
      ok: true,
      mappingId: result.data.id,
      ...(savedGuest ? { guest: savedGuest } : {}),
    })
  } catch (error) {
    console.error(
      'LINE reminder mapping action failed:',
      error instanceof Error ? error.message : String(error),
    )
    return res.status(500).json({ error: 'Unable to update LINE reminder mappings' })
  }
}
