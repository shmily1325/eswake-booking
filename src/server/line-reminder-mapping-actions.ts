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
          .select('id, line_user_id, member_id, contact_name, normalized_name, contact_phone, created_at, updated_at, members:member_id(id, name, nickname, phone), line_contact:line_user_id(display_name, picture_url, friend_status)')
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
    const contactName = text(body.contactName) || null
    const suppliedPhone = text(body.contactPhone)
    const contactPhone = suppliedPhone ? normalizePhone(suppliedPhone) : null
    if (!lineUserId) return res.status(400).json({ error: 'lineUserId is required' })
    if (suppliedPhone && !contactPhone) {
      return res.status(400).json({ error: 'contactPhone must be a Taiwan mobile number' })
    }
    if (!memberId && !contactPhone && !contactName) {
      return res.status(400).json({ error: 'A member, phone, or contact name is required' })
    }

    const { data: contact, error: contactError } = await supabase
      .from('line_webhook_contacts')
      .select('line_user_id')
      .eq('line_user_id', lineUserId)
      .maybeSingle()
    if (contactError) throw contactError
    if (!contact) return res.status(404).json({ error: 'LINE contact not found' })

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
    }

    let existingId = mappingId
    if (!existingId && memberId) {
      const { data } = await supabase
        .from('line_reminder_mappings')
        .select('id')
        .eq('member_id', memberId)
        .maybeSingle()
      existingId = text(data?.id)
    } else if (!existingId && !memberId && contactPhone) {
      const { data } = await supabase
        .from('line_reminder_mappings')
        .select('id')
        .is('member_id', null)
        .eq('contact_phone', contactPhone)
        .maybeSingle()
      existingId = text(data?.id)
    }

    const values = {
      line_user_id: lineUserId,
      member_id: memberId,
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
