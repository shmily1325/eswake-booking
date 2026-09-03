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
}

type BookingSearchResult = {
  id: number
  contact_name: string
  contact_phone: string | null
  start_at: string
}

type Props = {
  members: MemberOption[]
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

export function LineReminderMappingPanel({ members }: Props) {
  const { isMobile } = useResponsive()
  const toast = useToast()
  const [contacts, setContacts] = useState<LineContact[]>([])
  const [mappings, setMappings] = useState<ReminderMapping[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'unmatched' | 'matched' | 'all'>('unmatched')
  const [selectedContact, setSelectedContact] = useState<LineContact | null>(null)
  const [targetType, setTargetType] = useState<'member' | 'guest'>('member')
  const [memberId, setMemberId] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [bookingSearch, setBookingSearch] = useState('')
  const [bookingResults, setBookingResults] = useState<BookingSearchResult[]>([])
  const [bookingSearchLoading, setBookingSearchLoading] = useState(false)
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const result = await callMappingApi({ action: 'list' })
      setContacts((result?.contacts ?? []) as LineContact[])
      setMappings((result?.mappings ?? []) as ReminderMapping[])
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
    const timer = window.setTimeout(async () => {
      setBookingSearchLoading(true)
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
    }, 300)
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

  const filteredContacts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('zh-TW')
    return contacts.filter((contact) => {
      const hasReminderMapping = (mappingsByLineUser.get(contact.line_user_id) ?? []).length > 0
      const isMatched = hasReminderMapping || contact.formal_binding?.can_push === true
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
      return `${contact.display_name} ${mappingText}`.toLocaleLowerCase('zh-TW').includes(term)
    })
  }, [contacts, filter, mappingsByLineUser, search])

  const matchedCount = useMemo(
    () => contacts.filter((contact) =>
      (mappingsByLineUser.get(contact.line_user_id) ?? []).length > 0 ||
      contact.formal_binding?.can_push === true,
    ).length,
    [contacts, mappingsByLineUser],
  )
  const unmatchedCount = useMemo(
    () => contacts.filter((contact) =>
      contact.friend_status === 'friend' &&
      (mappingsByLineUser.get(contact.line_user_id) ?? []).length === 0 &&
      contact.formal_binding?.can_push !== true,
    ).length,
    [contacts, mappingsByLineUser],
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

  const beginPairing = (contact: LineContact) => {
    setSelectedContact(contact)
    setTargetType('member')
    setMemberId('')
    setMemberSearch('')
    setBookingSearch('')
    setBookingResults([])
    setSelectedBookingId(null)
  }

  const saveMapping = async () => {
    if (!selectedContact) return
    if (targetType === 'member' && !memberId) {
      toast.warning('請選擇會員')
      return
    }
    if (targetType === 'guest' && !selectedBookingId) {
      toast.warning('請選擇預約')
      return
    }
    setSaving(true)
    try {
      await callMappingApi({
        action: 'upsert_mapping',
        lineUserId: selectedContact.line_user_id,
        memberId: targetType === 'member' ? memberId : null,
        bookingId: targetType === 'guest' ? selectedBookingId : null,
      })
      toast.success('LINE 提醒配對已儲存')
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
          { value: 'matched', label: `已配對 ${matchedCount}` },
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
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <strong>{contact.display_name}</strong>
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
                  <button
                    type="button"
                    onClick={() => beginPairing(contact)}
                    disabled={hasFormalPushBinding || contact.friend_status !== 'friend'}
                    style={{
                      ...getButtonStyle('outline', isMobile ? 'medium' : 'small', isMobile),
                      minHeight: isMobile ? 46 : undefined,
                      opacity: hasFormalPushBinding || contact.friend_status !== 'friend' ? 0.5 : 1,
                    }}
                  >
                    {hasFormalPushBinding
                      ? '已綁定'
                      : contact.friend_status === 'friend'
                        ? '配對'
                        : '不可用'}
                  </button>
                </div>

                {contactMappings.length > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {contactMappings.map((mapping) => (
                      <div
                        key={mapping.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '8px 10px',
                          borderRadius: designSystem.borderRadius.sm,
                          background: designSystem.colors.secondary[50],
                        }}
                      >
                        <span style={{ flex: 1, fontSize: 14 }}>
                          {mapping.member_id
                            ? `已建檔：${mapping.members?.nickname || mapping.members?.name || mapping.member_id}`
                            : `預約：${mapping.booking?.contact_name || mapping.contact_name || mapping.booking_id || '—'}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => void deleteMapping(mapping)}
                          style={getButtonStyle('ghost', 'small', isMobile)}
                        >
                          解除
                        </button>
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
              borderRadius: designSystem.borderRadius.lg,
              background: designSystem.colors.background.card,
              boxShadow: designSystem.shadows.elevation[3],
            }}
          >
            <h2 style={{ marginTop: 0, fontSize: 20 }}>配對 {selectedContact.display_name}</h2>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {(['member', 'guest'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTargetType(type)}
                  style={getButtonStyle(targetType === type ? 'primary' : 'outline', 'small', isMobile)}
                >
                  {type === 'member' ? '已建檔' : '新客'}
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
                  onChange={(event) => {
                    setBookingSearch(event.target.value)
                    setSelectedBookingId(null)
                  }}
                  autoFocus
                  placeholder="搜尋預約人"
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
                      const selected = booking.id === selectedBookingId
                      return (
                        <button
                          key={booking.id}
                          type="button"
                          onClick={() => {
                            setSelectedBookingId(booking.id)
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
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ fontWeight: 650 }}>{booking.contact_name}</div>
                          <div style={{
                            marginTop: 3,
                            color: designSystem.colors.text.secondary,
                            fontSize: 12,
                          }}>
                            {new Date(booking.start_at).toLocaleDateString('zh-TW', {
                              year: 'numeric',
                              month: 'numeric',
                              day: 'numeric',
                            })}
                            {booking.contact_phone ? ` · ${booking.contact_phone}` : ''}
                          </div>
                        </button>
                      )
                    })}
                  </div>
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
                disabled={saving || (targetType === 'member' ? !memberId : !selectedBookingId)}
                onClick={() => void saveMapping()}
                style={getButtonStyle('primary', 'medium', isMobile)}
              >
                {saving ? '儲存中…' : '儲存配對'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
