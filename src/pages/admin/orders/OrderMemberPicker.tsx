interface MemberOption {
  id: string
  name: string
  nickname: string | null
  phone: string | null
}

interface OrderMemberPickerProps {
  searchTerm: string
  onSearchChange: (v: string) => void
  showDropdown: boolean
  setShowDropdown: (v: boolean) => void
  filteredMembers: MemberOption[]
  onSelectMember: (m: MemberOption) => void
  disabled?: boolean
}

export function OrderMemberPicker({
  searchTerm,
  onSearchChange,
  showDropdown,
  setShowDropdown,
  filteredMembers,
  onSelectMember,
  disabled,
}: OrderMemberPickerProps) {
  return (
    <div style={{ marginBottom: 16, position: 'relative' }}>
      <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>訂購人</label>
      <input
        type="text"
        value={searchTerm}
        disabled={disabled}
        onChange={(e) => onSearchChange(e.target.value)}
        onFocus={() => filteredMembers.length > 0 && setShowDropdown(true)}
        placeholder="搜尋會員或輸入姓名"
        style={{
          width: '100%',
          padding: '10px 12px',
          border: '1px solid #ccc',
          borderRadius: 8,
          fontSize: 15,
          boxSizing: 'border-box',
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
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              {m.nickname || m.name}
              {m.phone ? ` · ${m.phone}` : ''}
            </button>
          ))}
        </div>
      )}
      <p style={{ margin: '6px 0 0', fontSize: 12, color: '#666' }}>
        選會員或只填姓名（非會員）
      </p>
    </div>
  )
}

export function resolveContactName(
  selectedMemberId: string | null,
  searchTerm: string,
  manualName: string,
  members: { id: string; name: string; nickname: string | null }[],
): string {
  if (selectedMemberId) {
    const m = members.find((x) => x.id === selectedMemberId)
    return (m?.nickname || m?.name || searchTerm).trim()
  }
  return (manualName || searchTerm).trim()
}
