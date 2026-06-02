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
      <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>訂購人</label>

      {(hasMember || hasGuest) && (
        <div style={{ marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {hasMember && (
            <span
              style={{
                padding: '6px 12px',
                background: '#dbeafe',
                color: '#1e40af',
                border: '1px solid #3b82f6',
                borderRadius: 6,
                fontSize: 15,
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
                    color: '#1e40af',
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: 18,
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
                background: 'white',
                color: '#666',
                border: '1.5px dashed #ccc',
                borderRadius: 6,
                fontSize: 15,
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
                    color: '#999',
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: 18,
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
              padding: '12px',
              border: hasMember ? '2px solid #4caf50' : '1px solid #ccc',
              borderRadius: 8,
              fontSize: 16,
              boxSizing: 'border-box',
              marginBottom: 8,
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
                background: '#fff',
                border: '1px solid #ddd',
                borderRadius: 8,
                maxHeight: 200,
                overflowY: 'auto',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
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
                    borderBottom: '1px solid #f0f0f0',
                    background: '#fff',
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  <strong>{m.nickname || m.name}</strong>
                  {m.nickname && <span style={{ color: '#666', marginLeft: 6 }}>({m.name})</span>}
                  {m.phone && <span style={{ color: '#999', marginLeft: 8 }}>📱 {m.phone}</span>}
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
                padding: '12px',
                border: '1px solid #ff9800',
                borderRadius: 8,
                fontSize: 16,
                boxSizing: 'border-box',
              }}
            />
            <button
              type="button"
              onClick={onConfirmGuest}
              disabled={!guestName.trim()}
              style={{
                padding: '0 20px',
                background: guestName.trim() ? '#ff9800' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontSize: 20,
                fontWeight: 'bold',
                cursor: guestName.trim() ? 'pointer' : 'not-allowed',
                minWidth: 52,
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
