import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useResponsive } from '../../hooks/useResponsive'
import { useToast } from '../../components/ui'
import {
  designSystem,
  getBadgeStyle,
  getButtonStyle,
  getEmptyStateStyle,
  getInputStyle,
} from '../../styles/designSystem'

type MemberOption = {
  id: string
  name: string
  nickname: string | null
  phone: string | null
  line_binding_can_push?: boolean
}

type LineContact = {
  line_user_id: string
  display_name: string
  picture_url: string | null
  friend_status: 'friend' | 'blocked' | 'unknown'
  last_seen_at: string
  last_action: string
  formal_binding: {
    member_id: string | null
    can_push: boolean
  } | null
}

type ReminderMapping = {
  id: string
  line_user_id: string
  member_id: string | null
  booking_id: number | null
  contact_name: string | null
  contact_phone: string | null
  members?: MemberOption | null
  booking?: BookingSearchResult | null
  guest?: SavedGuest | null
}

type SavedGuest = {
  id: string
  line_user_id: string
  name: string
  normalized_name?: string
  is_active: boolean
}

type BookingSearchResult = {
  id: number
  contact_name: string
  contact_phone: string | null
  start_at: string
}

type SelectedBooking = BookingSearchResult & {
  selectedNames: string[]
}

type Props = {
  members: MemberOption[]
  onOpenSavedGuests: () => void
}

function splitBookingNames(value: string): string[] {
  return Array.from(new Set(
    value.split(/[,，]/).map((name) => name.trim()).filter(Boolean),
  ))
}

function formatBookingDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-TW', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

async function callMappingApi(body: Record<string, unknown>, signal?: AbortSignal) {
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
    signal,
  })
  const result = await response.json().catch(() => null) as Record<string, unknown> | null
  if (!response.ok) throw new Error(typeof result?.error === 'string' ? result.error : '操作失敗')
  return result
}

export function LineReminderMappingPanel({ members, onOpenSavedGuests }: Props) {
  const { isMobile } = useResponsive()
  const toast = useToast()
  const [contacts, setContacts] = useState<LineContact[]>([])
  const [mappings, setMappings] = useState<ReminderMapping[]>([])
  const [guests, setGuests] = useState<SavedGuest[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'unmatched' | 'matched' | 'all'>('unmatched')
  const [selectedContact, setSelectedContact] = useState<LineContact | null>(null)
  const [editingMappingId, setEditingMappingId] = useState('')
  const [targetType, setTargetType] = useState<'member' | 'guest'>('member')
  const [memberId, setMemberId] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [bookingSearch, setBookingSearch] = useState('')
  const [bookingResults, setBookingResults] = useState<BookingSearchResult[]>([])
  const [bookingSearchLoading, setBookingSearchLoading] = useState(false)
  const [selectedBookings, setSelectedBookings] = useState<SelectedBooking[]>([])
  const [saveAsGuest, setSaveAsGuest] = useState(false)
  const [savedGuestName, setSavedGuestName] = useState('')
  const [saving, setSaving] = useState(false)
  const [expandedContactIds, setExpandedContactIds] = useState<Set<string>>(
    () => new Set(),
  )

  const load = async () => {
    setLoading(true)
    try {
      const result = await callMappingApi({ action: 'list' })
      setContacts((result?.contacts ?? []) as LineContact[])
      setMappings((result?.mappings ?? []) as ReminderMapping[])
      setGuests((result?.guests ?? []) as SavedGuest[])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '載入失敗')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (targetType !== 'guest' || !selectedContact) {
      setBookingResults([])
      setBookingSearchLoading(false)
      return
    }
    const query = bookingSearch.trim()
    const digits = query.replace(/\D/g, '')
    if (query.length < 2 && digits.length < 3) {
      setBookingResults([])
      setBookingSearchLoading(false)
      return
    }
    const controller = new AbortController()
    setBookingSearchLoading(true)
    const timer = window.setTimeout(async () => {
      try {
        const result = await callMappingApi(
          { action: 'search_bookings', query },
          controller.signal,
        )
        setBookingResults((result?.bookings ?? []) as BookingSearchResult[])
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        toast.error(error instanceof Error ? error.message : '搜尋預約失敗')
      } finally {
        if (!controller.signal.aborted) setBookingSearchLoading(false)
      }
    }, 150)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [bookingSearch, selectedContact, targetType, toast])

  const mappingsByLineUser = useMemo(() => {
    const map = new Map<string, ReminderMapping[]>()
    mappings.forEach((mapping) => {
      const rows = map.get(mapping.line_user_id) ?? []
      rows.push(mapping)
      map.set(mapping.line_user_id, rows)
    })
    return map
  }, [mappings])

  const guestByLineUser = useMemo(
    () => new Map(guests.map((guest) => [guest.line_user_id, guest])),
    [guests],
  )

  const filteredContacts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('zh-TW')
    return contacts.filter((contact) => {
      const hasReminderMapping = (mappingsByLineUser.get(contact.line_user_id) ?? []).length > 0
      const savedGuest = guestByLineUser.get(contact.line_user_id)
      const isMatched = hasReminderMapping || Boolean(savedGuest) || contact.formal_binding?.can_push === true
      const isEligible = contact.friend_status === 'friend'
      if (filter === 'unmatched' && (isMatched || !isEligible)) return false
      if (filter === 'matched' && !isMatched) return false
      if (!term) return true
      const mappingText = (mappingsByLineUser.get(contact.line_user_id) ?? [])
        .map((mapping) => [
          mapping.contact_name,
          mapping.contact_phone,
          mapping.members?.name,
          mapping.members?.nickname,
        ].filter(Boolean).join(' '))
        .join(' ')
      return `${contact.display_name} ${savedGuest?.name ?? ''} ${mappingText}`
        .toLocaleLowerCase('zh-TW')
        .includes(term)
    })
  }, [contacts, filter, guestByLineUser, mappingsByLineUser, search])

  const matchedCount = useMemo(
    () => contacts.filter((contact) =>
      (mappingsByLineUser.get(contact.line_user_id) ?? []).length > 0 ||
      guestByLineUser.has(contact.line_user_id) ||
      contact.formal_binding?.can_push === true,
    ).length,
    [contacts, guestByLineUser, mappingsByLineUser],
  )
  const unmatchedCount = useMemo(
    () => contacts.filter((contact) =>
      contact.friend_status === 'friend' &&
      (mappingsByLineUser.get(contact.line_user_id) ?? []).length === 0 &&
      !guestByLineUser.has(contact.line_user_id) &&
      contact.formal_binding?.can_push !== true,
    ).length,
    [contacts, guestByLineUser, mappingsByLineUser],
  )
  const memberCandidates = useMemo(() => {
    const term = memberSearch.trim().toLocaleLowerCase('zh-TW')
    const digits = memberSearch.replace(/\D/g, '')
    return members
      .filter((member) => !member.line_binding_can_push)
      .filter((member) => {
        if (!term) return true
        const searchable = `${member.name} ${member.nickname || ''} ${member.phone || ''}`
          .toLocaleLowerCase('zh-TW')
        return searchable.includes(term) ||
          (digits.length >= 3 && (member.phone || '').replace(/\D/g, '').includes(digits))
      })
      .slice(0, 30)
  }, [memberSearch, members])

  const beginPairing = (contact: LineContact, mapping?: ReminderMapping) => {
    const savedGuest = guestByLineUser.get(contact.line_user_id)
    const isBookingMapping = Boolean(mapping && !mapping.member_id)
    setSelectedContact(contact)
    setEditingMappingId(mapping?.id ?? '')
    setTargetType(isBookingMapping ? 'guest' : 'member')
    setMemberId(mapping?.member_id ?? '')
    setMemberSearch(
      mapping?.members?.nickname ||
      mapping?.members?.name ||
      '',
    )
    setBookingSearch('')
    setBookingResults([])
    setSelectedBookings(
      isBookingMapping && mapping?.booking
        ? [{
            ...mapping.booking,
            selectedNames: mapping.contact_name ? [mapping.contact_name] : [],
          }]
        : [],
    )
    setSaveAsGuest(Boolean(savedGuest))
    setSavedGuestName(savedGuest?.name ?? '')
  }

  const saveMapping = async () => {
    if (!selectedContact) return
    if (targetType === 'member' && !memberId) {
      toast.warning('請選擇會員')
      return
    }
    const targets = selectedBookings.flatMap((booking) =>
      booking.selectedNames.map((contactName) => ({
        bookingId: booking.id,
        contactName,
      })),
    )
    if (
      targetType === 'guest' &&
      selectedBookings.some((booking) => booking.selectedNames.length === 0)
    ) {
      toast.warning('每筆預約至少選擇一位預約人')
      return
    }
    if (targetType === 'guest' && targets.length === 0 && !saveAsGuest) {
      toast.warning('請選擇預約或勾選同時建檔')
      return
    }
    if (targetType === 'guest' && saveAsGuest && !savedGuestName.trim()) {
      toast.warning('請輸入建檔姓名')
      return
    }
    if (targetType === 'guest' && editingMappingId && targets.length !== 1) {
      toast.warning('修改時請選擇一筆預約及一位預約人')
      return
    }
    setSaving(true)
    try {
      if (targetType === 'member') {
        await callMappingApi({
          action: 'upsert_mapping',
          mappingId: editingMappingId || null,
          lineUserId: selectedContact.line_user_id,
          memberId,
        })
        toast.success('LINE 提醒配對已儲存')
      } else if (editingMappingId) {
        await callMappingApi({
          action: 'upsert_mapping',
          mappingId: editingMappingId,
          lineUserId: selectedContact.line_user_id,
          bookingId: targets[0].bookingId,
          contactName: targets[0].contactName,
          saveGuestName: saveAsGuest ? savedGuestName.trim() : null,
        })
        toast.success('預約配對已更新')
      } else {
        const saveBatch = (overwrite: boolean) => callMappingApi({
          action: 'batch_upsert_guest_mappings',
          lineUserId: selectedContact.line_user_id,
          targets,
          saveGuestName: saveAsGuest ? savedGuestName.trim() : null,
          overwrite,
        })
        let result = await saveBatch(false)
        if (result?.requiresConfirmation === true) {
          const conflicts = Array.isArray(result.conflicts)
            ? result.conflicts as Array<Record<string, unknown>>
            : []
          const details = conflicts.map((conflict) => {
            const booking = selectedBookings.find(
              (item) => item.id === Number(conflict.bookingId),
            )
            const time = booking ? ` · ${formatBookingDateTime(booking.start_at)}` : ''
            return `${String(conflict.contactName || '預約人')}${time}（目前：${
              String(conflict.existingDisplayName || '其他 LINE')
            }）`
          }).join('\n')
          if (!window.confirm(
            `以下預約人已有其他 LINE 配對：\n${details}\n\n確定改成 ${selectedContact.display_name}？`,
          )) {
            setSaving(false)
            return
          }
          result = await saveBatch(true)
        }
        const mappingCount = Number(result?.mappingCount ?? targets.length)
        toast.success(mappingCount > 0
          ? saveAsGuest
            ? `已儲存 ${mappingCount} 筆配對並建檔`
            : `已儲存 ${mappingCount} 筆配對`
          : '已建檔')
      }
      setSelectedContact(null)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  const deleteMapping = async (mapping: ReminderMapping) => {
    if (!window.confirm('確定解除這筆提醒配對嗎？')) return
    try {
      await callMappingApi({ action: 'delete_mapping', mappingId: mapping.id })
      setMappings((current) => current.filter((row) => row.id !== mapping.id))
      toast.success('已解除配對')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '解除失敗')
    }
  }

  const toggleContactDetails = (lineUserId: string) => {
    setExpandedContactIds((current) => {
      const next = new Set(current)
      if (next.has(lineUserId)) next.delete(lineUserId)
      else next.add(lineUserId)
      return next
    })
  }

  const promoteMapping = async (mapping: ReminderMapping) => {
    if (!mapping.booking_id) return
    const name = (mapping.contact_name || '').trim()
    if (!name) return
    try {
      const result = await callMappingApi({
        action: 'save_guest',
        lineUserId: mapping.line_user_id,
        name,
      })
      const guest = result?.guest as SavedGuest | undefined
      if (!guest) throw new Error('建檔失敗')
      const existingGuests = mappings
        .filter((row) =>
          row.booking_id === mapping.booking_id &&
          row.guest?.id &&
          row.contact_name,
        )
        .map((row) => ({
          guestId: row.guest!.id,
          contactName: row.contact_name!,
        }))
      await callMappingApi({
        action: 'sync_booking_guests',
        bookingId: mapping.booking_id,
        guests: [
          ...existingGuests.filter((item) => item.guestId !== guest.id),
          { guestId: guest.id, contactName: name },
        ],
      })
      toast.success('已建檔')
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '建檔失敗')
    }
  }

  const selectedContactSavedGuest = selectedContact
    ? guestByLineUser.get(selectedContact.line_user_id)
    : undefined

  return (
    <div>
      <div
        style={{
          padding: '12px',
          marginBottom: '12px',
          borderRadius: designSystem.borderRadius.md,
          background: designSystem.colors.info[50],
          color: designSystem.colors.text.secondary,
          fontSize: '14px',
          lineHeight: 1.55,
        }}
      >
        配對後可傳送預約提醒，不影響會員專區。
      </div>
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="搜尋 LINE、會員、姓名或電話"
        style={{ ...getInputStyle(isMobile), width: '100%', boxSizing: 'border-box', marginBottom: 12 }}
      />
      <div
        role="group"
        aria-label="LINE 聯絡人篩選"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 8,
          marginBottom: 12,
        }}
      >
        {([
          { value: 'unmatched', label: `待配對 ${unmatchedCount}` },
          { value: 'matched', label: `已處理 ${matchedCount}` },
          { value: 'all', label: `全部 ${contacts.length}` },
        ] as const).map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={filter === option.value}
            onClick={() => setFilter(option.value)}
            style={{
              ...getButtonStyle(filter === option.value ? 'primary' : 'outline', 'medium', isMobile),
              minHeight: isMobile ? 48 : 42,
              padding: isMobile ? '10px 6px' : undefined,
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={getEmptyStateStyle(isMobile)}>載入 LINE 聯絡人中…</div>
      ) : filteredContacts.length === 0 ? (
        <div style={getEmptyStateStyle(isMobile)}>尚無符合的 LINE 聯絡人</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredContacts.map((contact) => {
            const contactMappings = mappingsByLineUser.get(contact.line_user_id) ?? []
            const hasFormalPushBinding = contact.formal_binding?.can_push === true
            const savedGuest = guestByLineUser.get(contact.line_user_id)
            const memberMappings = contactMappings.filter((mapping) => mapping.member_id)
            const bookingMappings = contactMappings.filter((mapping) => !mapping.member_id)
            const isExpanded = expandedContactIds.has(contact.line_user_id)
            const mappingSummaryVariant: 'default' | 'info' | 'warning' =
              memberMappings.length > 0 && bookingMappings.length > 0
                ? 'default'
                : memberMappings.length > 0
                  ? 'info'
                  : 'warning'
            const canAddPairing =
              contact.friend_status === 'friend' &&
              !hasFormalPushBinding &&
              !savedGuest &&
              memberMappings.length === 0
            const mappingSummary = memberMappings.length > 0 && bookingMappings.length > 0
              ? `配對 ${contactMappings.length}筆`
              : memberMappings.length > 0
                ? memberMappings.length === 1
                  ? `手動：${
                    memberMappings[0].members?.nickname ||
                    memberMappings[0].members?.name ||
                    '會員'
                  }`
                  : `手動 ${memberMappings.length}筆`
                : bookingMappings.length === 1
                  ? `預約：${bookingMappings[0].contact_name || '1筆'}`
                  : `預約 ${bookingMappings.length}筆`
            return (
              <div
                key={contact.line_user_id}
                style={{
                  padding: isMobile ? 12 : 14,
                  border: `1px solid ${designSystem.colors.border.light}`,
                  borderRadius: designSystem.borderRadius.md,
                  background: designSystem.colors.background.card,
                }}
              >
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {contact.picture_url ? (
                    <img
                      src={contact.picture_url}
                      alt=""
                      style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      background: designSystem.colors.secondary[100],
                    }}>LINE</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex',
                      gap: 6,
                      alignItems: 'center',
                      minWidth: 0,
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                    }}>
                      <strong style={{
                        minWidth: 28,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {contact.display_name}
                      </strong>
                      {savedGuest && (
                        <button
                          type="button"
                          onClick={onOpenSavedGuests}
                          aria-label={`管理建檔 ${savedGuest.name}`}
                          style={{
                            ...getBadgeStyle(
                              savedGuest.is_active ? 'success' : 'default',
                              'small',
                            ),
                            flexShrink: 0,
                            maxWidth: isMobile ? 104 : 150,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            border: 'none',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          建檔：{savedGuest.name}
                        </button>
                      )}
                      {hasFormalPushBinding && (
                        <span style={{
                          ...getBadgeStyle('info', 'small'),
                          flexShrink: 0,
                          background: '#dcefe5',
                          color: '#24553a',
                        }}>
                          正式綁定
                        </span>
                      )}
                      {contactMappings.length > 0 && (
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          onClick={() => toggleContactDetails(contact.line_user_id)}
                          style={{
                            ...getBadgeStyle(mappingSummaryVariant, 'small'),
                            minHeight: isMobile ? 34 : 28,
                            maxWidth: isMobile ? 116 : 180,
                            flexShrink: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            border: 'none',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          {mappingSummary} {isExpanded ? '▴' : '▾'}
                        </button>
                      )}
                      {contact.friend_status !== 'friend' && (
                        <span style={getBadgeStyle(
                          contact.friend_status === 'blocked' ? 'warning' : 'default',
                          'small',
                        )}>
                          {contact.friend_status === 'blocked' ? '已封鎖' : '待確認'}
                        </span>
                      )}
                    </div>
                    <div style={{ color: designSystem.colors.text.secondary, fontSize: 12, marginTop: 3 }}>
                      最近 {new Date(contact.last_seen_at).toLocaleString('zh-TW', {
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                  {(canAddPairing ||
                    hasFormalPushBinding ||
                    contact.friend_status !== 'friend') && (
                    <button
                      type="button"
                      onClick={() => canAddPairing && beginPairing(contact)}
                      disabled={!canAddPairing}
                      style={{
                        ...getButtonStyle(
                          'outline',
                          isMobile ? 'medium' : 'small',
                          isMobile,
                        ),
                        minHeight: isMobile ? 46 : undefined,
                        opacity: canAddPairing ? 1 : 0.5,
                      }}
                    >
                      {hasFormalPushBinding
                        ? '已綁定'
                        : contact.friend_status !== 'friend'
                          ? '不可用'
                          : contactMappings.length > 0
                            ? '新增'
                            : '配對'}
                    </button>
                  )}
                </div>

                {contactMappings.length > 0 && isExpanded && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {contactMappings.map((mapping) => (
                      <div
                        key={mapping.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          flexWrap: isMobile ? 'wrap' : 'nowrap',
                          gap: 8,
                          padding: '8px 10px',
                          borderRadius: designSystem.borderRadius.sm,
                          background: designSystem.colors.secondary[50],
                        }}
                      >
                        <span style={{
                          flex: 1,
                          minWidth: isMobile ? '100%' : 0,
                          fontSize: 14,
                        }}>
                          {mapping.member_id
                            ? `手動配對：${mapping.members?.nickname || mapping.members?.name || mapping.member_id}`
                            : `預約：${mapping.contact_name || '—'}${
                              mapping.booking?.start_at
                                ? ` · ${formatBookingDateTime(mapping.booking.start_at)}`
                                : ''
                            }`}
                        </span>
                        <div style={{
                          display: 'flex',
                          gap: 6,
                          marginLeft: 'auto',
                        }}>
                          {!mapping.member_id && !savedGuest && (
                            <button
                              type="button"
                              onClick={() => void promoteMapping(mapping)}
                              style={getButtonStyle('ghost', 'small', isMobile)}
                            >
                              建檔
                            </button>
                          )}
                          {!hasFormalPushBinding && (
                            <button
                              type="button"
                              onClick={() => beginPairing(contact, mapping)}
                              style={getButtonStyle('ghost', 'small', isMobile)}
                            >
                              修改
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void deleteMapping(mapping)}
                            disabled={hasFormalPushBinding}
                            style={getButtonStyle('ghost', 'small', isMobile)}
                          >
                            解除
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {selectedContact && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'grid',
            placeItems: 'center',
            padding: 16,
            background: 'rgba(0,0,0,0.45)',
          }}
          onClick={() => !saving && setSelectedContact(null)}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(520px, 100%)',
              padding: 20,
              maxHeight: isMobile ? '88dvh' : '90vh',
              overflowY: 'auto',
              boxSizing: 'border-box',
              borderRadius: designSystem.borderRadius.lg,
              background: designSystem.colors.background.card,
              boxShadow: designSystem.shadows.elevation[3],
            }}
          >
            <h2 style={{ marginTop: 0, fontSize: 20 }}>
              {editingMappingId ? '修改' : '設定'} {selectedContact.display_name}
            </h2>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {(['member', 'guest'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTargetType(type)}
                  style={getButtonStyle(targetType === type ? 'primary' : 'outline', 'small', isMobile)}
                >
                  {type === 'member' ? '會員' : '非會員'}
                </button>
              ))}
            </div>
            {targetType === 'member' ? (
              <div>
                <input
                  value={memberSearch}
                  onChange={(event) => {
                    setMemberSearch(event.target.value)
                    setMemberId('')
                  }}
                  autoFocus
                  placeholder="搜尋姓名、暱稱或電話"
                  style={{
                    ...getInputStyle(isMobile),
                    width: '100%',
                    minHeight: isMobile ? 50 : 44,
                    boxSizing: 'border-box',
                  }}
                />
                <div
                  style={{
                    maxHeight: isMobile ? 240 : 220,
                    overflowY: 'auto',
                    marginTop: 8,
                    border: `1px solid ${designSystem.colors.border.light}`,
                    borderRadius: designSystem.borderRadius.md,
                  }}
                >
                  {memberCandidates.length === 0 ? (
                    <div style={{ padding: 14, color: designSystem.colors.text.secondary }}>
                      找不到符合的會員
                    </div>
                  ) : memberCandidates.map((member) => {
                    const selected = member.id === memberId
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => {
                          setMemberId(member.id)
                          setMemberSearch(member.nickname || member.name)
                        }}
                        style={{
                          width: '100%',
                          minHeight: isMobile ? 50 : 44,
                          padding: '10px 12px',
                          border: 'none',
                          borderBottom: `1px solid ${designSystem.colors.border.light}`,
                          background: selected
                            ? designSystem.colors.secondary[100]
                            : designSystem.colors.background.card,
                          color: designSystem.colors.text.primary,
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                      >
                        <strong>{member.nickname || member.name}</strong>
                        {member.nickname && member.nickname !== member.name
                          ? `（${member.name}）`
                          : ''}
                        {member.phone ? ` · ${member.phone}` : ''}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input
                  value={bookingSearch}
                  onChange={(event) => setBookingSearch(event.target.value)}
                  autoFocus
                  placeholder="搜尋預約人（選填，可多選）"
                  style={{
                    ...getInputStyle(isMobile),
                    width: '100%',
                    minHeight: isMobile ? 50 : 44,
                    boxSizing: 'border-box',
                  }}
                />
                {(bookingSearchLoading || bookingResults.length > 0) && (
                  <div
                    style={{
                      maxHeight: isMobile ? 220 : 200,
                      overflowY: 'auto',
                      border: `1px solid ${designSystem.colors.border.light}`,
                      borderRadius: designSystem.borderRadius.md,
                    }}
                  >
                    {bookingSearchLoading ? (
                      <div style={{ padding: 14, color: designSystem.colors.text.secondary }}>
                        搜尋中…
                      </div>
                    ) : bookingResults.map((booking) => {
                      const selected = selectedBookings.some((item) => item.id === booking.id)
                      return (
                        <button
                          key={booking.id}
                          type="button"
                          onClick={() => {
                            if (selected) return
                            const names = splitBookingNames(booking.contact_name)
                            const nextBooking = {
                              ...booking,
                              selectedNames: names.length === 1 ? [names[0]] : [],
                            }
                            setSelectedBookings((current) =>
                              editingMappingId ? [nextBooking] : [...current, nextBooking]
                            )
                            if (
                              names.length === 1 &&
                              !selectedContactSavedGuest &&
                              !savedGuestName.trim()
                            ) {
                              setSavedGuestName(names[0])
                            }
                            setBookingSearch('')
                            setBookingResults([])
                          }}
                          style={{
                            width: '100%',
                            minHeight: isMobile ? 56 : 48,
                            padding: '9px 12px',
                            border: 'none',
                            borderBottom: `1px solid ${designSystem.colors.border.light}`,
                            background: selected
                              ? designSystem.colors.secondary[100]
                              : designSystem.colors.background.card,
                            color: designSystem.colors.text.primary,
                            textAlign: 'left',
                            cursor: selected ? 'default' : 'pointer',
                          }}
                        >
                          <div style={{ fontWeight: 650 }}>
                            {selected ? '✓ ' : ''}{booking.contact_name}
                          </div>
                          <div style={{
                            marginTop: 3,
                            color: designSystem.colors.text.secondary,
                            fontSize: 12,
                          }}>
                            {formatBookingDateTime(booking.start_at)}
                            {booking.contact_phone ? ` · ${booking.contact_phone}` : ''}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
                {selectedBookings.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {selectedBookings.map((booking) => {
                      const names = splitBookingNames(booking.contact_name)
                      return (
                        <div
                          key={booking.id}
                          style={{
                            padding: 12,
                            border: `1px solid ${designSystem.colors.border.light}`,
                            borderRadius: designSystem.borderRadius.md,
                            background: designSystem.colors.background.card,
                          }}
                        >
                          <div style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 8,
                            marginBottom: 9,
                          }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 650 }}>{booking.contact_name}</div>
                              <div style={{
                                marginTop: 2,
                                color: designSystem.colors.text.secondary,
                                fontSize: 12,
                              }}>
                                {formatBookingDateTime(booking.start_at)}
                              </div>
                            </div>
                            <button
                              type="button"
                              aria-label={`移除預約 ${booking.contact_name}`}
                              onClick={() => setSelectedBookings((current) =>
                                current.filter((item) => item.id !== booking.id)
                              )}
                              style={getButtonStyle('ghost', 'small', isMobile)}
                            >
                              移除
                            </button>
                          </div>
                          <div style={{
                            marginBottom: 6,
                            color: designSystem.colors.text.secondary,
                            fontSize: 13,
                          }}>
                            選擇這個 LINE 對應的人（可多選）
                          </div>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: isMobile
                              ? '1fr'
                              : 'repeat(2, minmax(0, 1fr))',
                            gap: 8,
                          }}>
                            {names.map((name) => {
                              const selected = booking.selectedNames.includes(name)
                              return (
                                <button
                                  key={name}
                                  type="button"
                                  onClick={() => {
                                    setSelectedBookings((current) => current.map((item) => {
                                      if (item.id !== booking.id) return item
                                      return {
                                        ...item,
                                        selectedNames: selected
                                          ? item.selectedNames.filter((value) => value !== name)
                                          : editingMappingId
                                            ? [name]
                                            : [...item.selectedNames, name],
                                      }
                                    }))
                                    if (
                                      !selected &&
                                      !selectedContactSavedGuest &&
                                      !savedGuestName.trim()
                                    ) {
                                      setSavedGuestName(name)
                                    }
                                  }}
                                  style={getButtonStyle(
                                    selected ? 'primary' : 'outline',
                                    'medium',
                                    isMobile,
                                  )}
                                >
                                  {selected ? '✓ ' : ''}{name}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  minHeight: 44,
                  fontSize: 14,
                }}>
                  <input
                    type="checkbox"
                    checked={saveAsGuest}
                    disabled={Boolean(selectedContactSavedGuest)}
                    onChange={(event) => setSaveAsGuest(event.target.checked)}
                  />
                  {selectedContactSavedGuest
                    ? '已建檔'
                    : selectedBookings.length > 0
                      ? '同時建檔'
                      : '建檔此 LINE'}
                </label>
                {saveAsGuest && (
                  <input
                    value={savedGuestName}
                    disabled={Boolean(selectedContactSavedGuest)}
                    onChange={(event) => setSavedGuestName(event.target.value)}
                    placeholder="建檔名稱（供下次搜尋）"
                    style={{
                      ...getInputStyle(isMobile),
                      width: '100%',
                      minHeight: isMobile ? 50 : 44,
                      boxSizing: 'border-box',
                      opacity: selectedContactSavedGuest ? 0.7 : 1,
                    }}
                  />
                )}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <button
                type="button"
                disabled={saving}
                onClick={() => setSelectedContact(null)}
                style={getButtonStyle('outline', 'medium', isMobile)}
              >
                取消
              </button>
              <button
                type="button"
                disabled={
                  saving ||
                  (targetType === 'member'
                    ? !memberId
                    : selectedBookings.some((booking) => booking.selectedNames.length === 0) ||
                      (selectedBookings.length === 0 && !saveAsGuest) ||
                      (Boolean(editingMappingId) &&
                        selectedBookings.flatMap((booking) => booking.selectedNames).length !== 1) ||
                      (saveAsGuest && !savedGuestName.trim()))
                }
                onClick={() => void saveMapping()}
                style={getButtonStyle('primary', 'medium', isMobile)}
              >
                {saving
                  ? '儲存中…'
                  : editingMappingId
                    ? '儲存修改'
                    : targetType === 'guest' && selectedBookings.length === 0
                      ? '儲存建檔'
                      : targetType === 'guest' && saveAsGuest
                        ? '儲存配對並建檔'
                        : '儲存配對'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
