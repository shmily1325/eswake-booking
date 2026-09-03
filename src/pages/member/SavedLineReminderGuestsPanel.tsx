import { useEffect, useMemo, useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { useResponsive } from '../../hooks/useResponsive'
import { useToast } from '../../components/ui'
import {
  callReminderGuestApi,
  deleteLineReminderGuest,
  saveLineReminderGuest,
  type SavedLineReminderGuest,
} from '../../utils/lineReminderGuests'
import {
  designSystem,
  getButtonStyle,
  getEmptyStateStyle,
  getFontSize,
  getInputStyle,
  getLabelStyle,
} from '../../styles/designSystem'

type LineContactOption = {
  line_user_id: string
  display_name: string
  picture_url: string | null
  friend_status: 'friend' | 'blocked' | 'unknown'
  formal_binding: {
    can_push: boolean
  } | null
}

export function SavedLineReminderGuestsPanel() {
  const { isMobile } = useResponsive()
  const toast = useToast()
  const [guests, setGuests] = useState<SavedLineReminderGuest[]>([])
  const [contacts, setContacts] = useState<LineContactOption[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<SavedLineReminderGuest | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draftLineUserId, setDraftLineUserId] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const result = await callReminderGuestApi({ action: 'list' })
      setGuests((result?.guests ?? []) as SavedLineReminderGuest[])
      setContacts((result?.contacts ?? []) as LineContactOption[])
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

  const assignedGuestByLine = useMemo(
    () => new Map(guests.map((guest) => [guest.line_user_id, guest.id])),
    [guests],
  )
  const availableContacts = useMemo(
    () => contacts.filter((contact) => {
      if (contact.friend_status !== 'friend' || contact.formal_binding?.can_push) return false
      const assignedGuestId = assignedGuestByLine.get(contact.line_user_id)
      return !assignedGuestId || assignedGuestId === editing?.id
    }),
    [assignedGuestByLine, contacts, editing?.id],
  )
  const filteredGuests = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('zh-TW')
    if (!term) return guests
    return guests.filter((guest) =>
      `${guest.name} ${guest.line_contact?.display_name ?? ''}`
        .toLocaleLowerCase('zh-TW')
        .includes(term),
    )
  }, [guests, search])

  const openEdit = (guest: SavedLineReminderGuest) => {
    setEditing(guest)
    setDraftName(guest.name)
    setDraftLineUserId(guest.line_user_id)
  }

  const save = async () => {
    if (!editing || !draftName.trim() || !draftLineUserId) return
    setSaving(true)
    try {
      await saveLineReminderGuest({
        guestId: editing.id,
        lineUserId: draftLineUserId,
        name: draftName.trim(),
      })
      toast.success('已更新')
      setEditing(null)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '更新失敗')
    } finally {
      setSaving(false)
    }
  }

  const deleteGuest = async () => {
    if (!editing) return
    if (!window.confirm(
      `確定永久刪除「${editing.name}」？相關預約的 LINE 提醒配對也會一併刪除，且無法復原。`,
    )) return
    setSaving(true)
    try {
      await deleteLineReminderGuest(editing.id)
      toast.success('已永久刪除')
      setEditing(null)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '刪除失敗')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="搜尋姓名或 LINE"
        style={{
          ...getInputStyle(isMobile),
          width: '100%',
          boxSizing: 'border-box',
          marginBottom: designSystem.spacing.md,
        }}
      />

      {loading ? (
        <div style={getEmptyStateStyle(isMobile)}>載入中…</div>
      ) : filteredGuests.length === 0 ? (
        <div style={getEmptyStateStyle(isMobile)}>尚無已建檔非會員</div>
      ) : (
        <div style={{
          overflow: 'hidden',
          borderRadius: designSystem.borderRadius.lg,
          background: designSystem.colors.background.card,
          boxShadow: designSystem.shadows.sm,
        }}>
          {filteredGuests.map((guest, index) => (
            <div
              key={guest.id}
              style={{
                minHeight: isMobile ? 64 : 58,
                padding: `${designSystem.spacing.md} ${designSystem.spacing.lg}`,
                display: 'flex',
                alignItems: 'center',
                gap: designSystem.spacing.md,
                borderBottom: index < filteredGuests.length - 1
                  ? `1px solid ${designSystem.colors.border.light}`
                  : 'none',
                opacity: guest.is_active ? 1 : 0.58,
              }}
            >
              {guest.line_contact?.picture_url ? (
                <img
                  src={guest.line_contact.picture_url}
                  alt=""
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    flexShrink: 0,
                  }}
                />
              ) : null}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  color: designSystem.colors.text.primary,
                  fontSize: getFontSize('bodyLarge', isMobile),
                  fontWeight: 650,
                }}>
                  {guest.name}
                </div>
                <div style={{
                  marginTop: 2,
                  color: designSystem.colors.text.secondary,
                  fontSize: getFontSize('bodySmall', isMobile),
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {guest.line_contact?.display_name || 'LINE 使用者'}
                  {!guest.is_active ? ' · 已停用' : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => openEdit(guest)}
                style={{
                  ...getButtonStyle('outline', 'small', isMobile),
                  minHeight: isMobile ? 44 : undefined,
                  flexShrink: 0,
                }}
              >
                編輯
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={Boolean(editing)}
        onClose={() => !saving && setEditing(null)}
        title="編輯非會員"
        size="small"
        footer={(
          <>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              disabled={saving}
              onClick={() => setEditing(null)}
              style={getButtonStyle('outline', 'medium', isMobile)}
            >
              取消
            </button>
            <button
              type="button"
              disabled={saving || !draftName.trim() || !draftLineUserId}
              onClick={() => void save()}
              style={getButtonStyle('primary', 'medium', isMobile)}
            >
              {saving ? '儲存中…' : '儲存'}
            </button>
          </>
        )}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: designSystem.spacing.lg }}>
          <label>
            <span style={getLabelStyle(isMobile)}>姓名</span>
            <input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              style={{
                ...getInputStyle(isMobile),
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
          </label>
          <label>
            <span style={getLabelStyle(isMobile)}>LINE</span>
            <select
              value={draftLineUserId}
              onChange={(event) => setDraftLineUserId(event.target.value)}
              style={{
                ...getInputStyle(isMobile),
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              {availableContacts.map((contact) => (
                <option key={contact.line_user_id} value={contact.line_user_id}>
                  {contact.display_name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={() => void deleteGuest()}
            style={{
              ...getButtonStyle('danger', 'medium', isMobile),
              width: '100%',
              minHeight: isMobile ? 46 : undefined,
            }}
          >
            刪除建檔
          </button>
        </div>
      </Modal>
    </div>
  )
}
