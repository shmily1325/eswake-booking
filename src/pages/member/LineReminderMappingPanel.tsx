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
}

type ReminderMapping = {
  id: string
  line_user_id: string
  member_id: string | null
  contact_name: string | null
  contact_phone: string | null
  members?: MemberOption | null
}

type Props = {
  members: MemberOption[]
}

async function callMappingApi(body: Record<string, unknown>) {
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
  const [selectedContact, setSelectedContact] = useState<LineContact | null>(null)
  const [targetType, setTargetType] = useState<'member' | 'guest'>('member')
  const [memberId, setMemberId] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
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
    if (!term) return contacts
    return contacts.filter((contact) => {
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
  }, [contacts, mappingsByLineUser, search])

  const beginPairing = (contact: LineContact) => {
    setSelectedContact(contact)
    setTargetType('member')
    setMemberId('')
    setContactName('')
    setContactPhone('')
  }

  const saveMapping = async () => {
    if (!selectedContact) return
    if (targetType === 'member' && !memberId) {
      toast.warning('請選擇會員')
      return
    }
    if (targetType === 'guest' && !contactName.trim() && !contactPhone.trim()) {
      toast.warning('非會員至少需要預約名稱或電話')
      return
    }
    setSaving(true)
    try {
      await callMappingApi({
        action: 'upsert_mapping',
        lineUserId: selectedContact.line_user_id,
        memberId: targetType === 'member' ? memberId : null,
        contactName: targetType === 'guest' ? contactName : null,
        contactPhone: targetType === 'guest' ? contactPhone : null,
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
        客人加好友、傳訊息或按 Rich Menu 後會出現在這裡。此配對只用於預約提醒，不會開通會員專區。
      </div>
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="搜尋 LINE 名稱、會員、預約名稱或電話"
        style={{ ...getInputStyle(isMobile), width: '100%', boxSizing: 'border-box', marginBottom: 12 }}
      />

      {loading ? (
        <div style={getEmptyStateStyle(isMobile)}>載入 LINE 聯絡人中…</div>
      ) : filteredContacts.length === 0 ? (
        <div style={getEmptyStateStyle(isMobile)}>尚無符合的 LINE 聯絡人</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredContacts.map((contact) => {
            const contactMappings = mappingsByLineUser.get(contact.line_user_id) ?? []
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
                      <span style={getBadgeStyle(
                        contact.friend_status === 'friend'
                          ? 'success'
                          : contact.friend_status === 'blocked'
                            ? 'warning'
                            : 'default',
                        'small',
                      )}>
                        {contact.friend_status === 'friend'
                          ? '可推播'
                          : contact.friend_status === 'blocked'
                            ? '已封鎖'
                            : '資格待確認'}
                      </span>
                    </div>
                    <div style={{ color: designSystem.colors.text.secondary, fontSize: 12, marginTop: 3 }}>
                      最近互動：{new Date(contact.last_seen_at).toLocaleString('zh-TW')}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => beginPairing(contact)}
                    style={getButtonStyle('outline', 'small', isMobile)}
                  >
                    新增配對
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
                            ? `會員：${mapping.members?.nickname || mapping.members?.name || mapping.member_id}`
                            : `非會員：${mapping.contact_name || '未命名'}${mapping.contact_phone ? ` · ${mapping.contact_phone}` : ' · 無電話，傳送前確認'}`}
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
                  {type === 'member' ? '會員' : '非會員'}
                </button>
              ))}
            </div>
            {targetType === 'member' ? (
              <select
                value={memberId}
                onChange={(event) => setMemberId(event.target.value)}
                style={{ ...getInputStyle(isMobile), width: '100%', boxSizing: 'border-box' }}
              >
                <option value="">選擇未正式綁定會員</option>
                {members.filter((member) => !member.line_binding_can_push).map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.nickname || member.name}{member.phone ? ` · ${member.phone}` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input
                  value={contactName}
                  onChange={(event) => setContactName(event.target.value)}
                  placeholder="預約使用的姓名或暱稱"
                  style={{ ...getInputStyle(isMobile), width: '100%', boxSizing: 'border-box' }}
                />
                <input
                  value={contactPhone}
                  onChange={(event) => setContactPhone(event.target.value)}
                  placeholder="電話（選填，有電話可自動配對）"
                  inputMode="tel"
                  style={{ ...getInputStyle(isMobile), width: '100%', boxSizing: 'border-box' }}
                />
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
                disabled={saving}
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
