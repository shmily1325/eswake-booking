/**
 * Design thinking:
 * Current feel: bright blue member chips and orange guest CTA read as stock Material forms.
 * Hierarchy: selected contact is the signal; search / guest entry stay quiet frames.
 * Primary task: pick a member or confirm a guest name without loud accent chrome.
 */
import { designSystem, getFontSize, getButtonStyle } from '../../../styles/designSystem'

interface MemberOption {
  id: string
  name: string
  nickname: string | null
  phone: string | null
}

interface OrderMemberPickerProps {
  selectedMemberId: string | null
  selectedMemberLabel: string | null
  onClearMember: () => void
  searchTerm: string
  onSearchChange: (v: string) => void
  showDropdown: boolean
  setShowDropdown: (v: boolean) => void
  filteredMembers: MemberOption[]
  onSelectMember: (m: MemberOption) => void
  guestName: string
  onGuestNameChange: (v: string) => void
  onConfirmGuest: () => void
  confirmedGuestName: string | null
  onClearGuest: () => void
  disabled?: boolean
}

const { colors, borderRadius, shadows, spacing } = designSystem

export function OrderMemberPicker({
  selectedMemberId,
  selectedMemberLabel,
  onClearMember,
  searchTerm,
  onSearchChange,
  showDropdown,
  setShowDropdown,
  filteredMembers,
  onSelectMember,
  guestName,
  onGuestNameChange,
  onConfirmGuest,
  confirmedGuestName,
  onClearGuest,
  disabled,
}: OrderMemberPickerProps) {
  const hasMember = Boolean(selectedMemberId && selectedMemberLabel)
  const hasGuest = Boolean(confirmedGuestName && !selectedMemberId)

  return (
    <div style={{ marginBottom: 16, position: 'relative' }}>
      <label
        style={{
          display: 'block',
          marginBottom: 6,
          fontWeight: 500,
          fontSize: getFontSize('body', false),
          color: colors.text.primary,
        }}
      >
        訂購人
      </label>

      {(hasMember || hasGuest) && (
        <div style={{ marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {hasMember && (
            <span
              style={{
                padding: '6px 12px',
                background: colors.info[50],
                color: colors.info[700],
                border: `1px solid ${colors.info[500]}`,
                borderRadius: borderRadius.md,
                fontSize: getFontSize('body', false),
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 600,
              }}
            >
              {selectedMemberLabel}
              {!disabled && (
                <button
                  type="button"
                  onClick={onClearMember}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: colors.info[700],
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: getFontSize('h3', false),
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              )}
            </span>
          )}
          {hasGuest && (
            <span
              style={{
                padding: '6px 12px',
                background: colors.background.card,
                color: colors.text.secondary,
                border: `1.5px dashed ${colors.border.main}`,
                borderRadius: borderRadius.md,
                fontSize: getFontSize('body', false),
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 500,
              }}
            >
              {confirmedGuestName}
              {!disabled && (
                <button
                  type="button"
                  onClick={onClearGuest}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: colors.text.disabled,
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: getFontSize('h3', false),
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              )}
            </span>
          )}
        </div>
      )}

      {!hasMember && !hasGuest && !disabled && (
        <>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={() => filteredMembers.length > 0 && setShowDropdown(true)}
            placeholder="搜尋會員暱稱／姓名／電話"
            style={{
              width: '100%',
              padding: spacing.md,
              border: `1px solid ${colors.border.main}`,
              borderRadius: borderRadius.md,
              fontSize: getFontSize('bodyLarge', false),
              boxSizing: 'border-box',
              marginBottom: 8,
              color: colors.text.primary,
              background: colors.background.card,
            }}
          />
          {showDropdown && filteredMembers.length > 0 && (
            <div
              style={{
                position: 'absolute',
                zIndex: 20,
                top: '100%',
                left: 0,
                right: 0,
                background: colors.background.card,
                border: `1px solid ${colors.border.light}`,
                borderRadius: borderRadius.md,
                maxHeight: 200,
                overflowY: 'auto',
                boxShadow: shadows.elevation[1],
                marginTop: -4,
              }}
            >
              {filteredMembers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onSelectMember(m)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 12px',
                    border: 'none',
                    borderBottom: `1px solid ${colors.border.light}`,
                    background: colors.background.card,
                    cursor: 'pointer',
                    fontSize: getFontSize('body', false),
                    color: colors.text.primary,
                  }}
                >
                  <strong>{m.nickname || m.name}</strong>
                  {m.nickname && (
                    <span style={{ color: colors.text.secondary, marginLeft: 6 }}>({m.name})</span>
                  )}
                  {m.phone && (
                    <span style={{ color: colors.text.disabled, marginLeft: 8 }}>{m.phone}</span>
                  )}
                </button>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
            <input
              type="text"
              value={guestName}
              onChange={(e) => onGuestNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing && guestName.trim()) {
                  e.preventDefault()
                  onConfirmGuest()
                }
              }}
              placeholder="或直接輸入姓名（非會員）"
              style={{
                flex: 1,
                padding: spacing.md,
                border: `1px solid ${colors.warning[500]}`,
                borderRadius: borderRadius.md,
                fontSize: getFontSize('bodyLarge', false),
                boxSizing: 'border-box',
                color: colors.text.primary,
                background: colors.background.card,
              }}
            />
            <button
              type="button"
              onClick={onConfirmGuest}
              disabled={!guestName.trim()}
              style={{
                ...getButtonStyle(guestName.trim() ? 'warning' : 'secondary', 'medium', false),
                minWidth: 52,
                opacity: guestName.trim() ? 1 : 0.55,
                cursor: guestName.trim() ? 'pointer' : 'not-allowed',
                fontSize: getFontSize('h2', false),
                fontWeight: 700,
              }}
            >
              +
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export function resolveContactName(
  selectedMemberId: string | null,
  selectedMemberLabel: string | null,
  confirmedGuestName: string | null,
  members: { id: string; name: string; nickname: string | null }[],
): string {
  if (selectedMemberId) {
    const m = members.find((x) => x.id === selectedMemberId)
    return (m?.nickname || m?.name || selectedMemberLabel || '').trim()
  }
  return (confirmedGuestName || '').trim()
}
