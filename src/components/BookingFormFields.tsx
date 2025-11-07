import { useMemberSearch } from '../hooks/useMemberSearch'

interface Member {
  id: string
  name: string
  nickname: string | null
  phone: string | null
}

interface MemberSearchFieldProps {
  label?: string
  placeholder?: string
  required?: boolean
  isMobile?: boolean
  onMemberSelect?: (memberId: string | null, name: string) => void
}

/**
 * 可重用的會員搜索欄位組件
 * 整合了會員搜索、下拉選擇、手動輸入功能
 * 
 * 使用範例：
 * <MemberSearchField 
 *   label="預約人"
 *   placeholder="搜尋會員或直接輸入姓名"
 *   required
 *   onMemberSelect={(id, name) => {
 *     setSelectedMemberId(id)
 *     setContactName(name)
 *   }}
 * />
 */
export function MemberSearchField({
  label = '預約人',
  placeholder = '搜尋會員姓名/暱稱...',
  required = false,
  isMobile = false,
  onMemberSelect
}: MemberSearchFieldProps) {
  const {
    searchTerm,
    showDropdown,
    filteredMembers,
    handleSearchChange,
    selectMember,
    setShowDropdown,
  } = useMemberSearch()

  const handleSelect = (member: Member) => {
    selectMember(member)
    onMemberSelect?.(member.id, member.name)
  }

  const handleChange = (value: string) => {
    handleSearchChange(value)
    onMemberSelect?.(null, value)
  }

  return (
    <div style={{ marginBottom: '16px', position: 'relative' }}>
      {label && (
        <label style={{
          display: 'block',
          marginBottom: '8px',
          fontSize: '13px',
          color: '#495057',
          fontWeight: '500'
        }}>
          {label}
          {required && <span style={{ color: '#dc3545' }}> *</span>}
        </label>
      )}
      
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => {
          if (filteredMembers.length > 0) {
            setShowDropdown(true)
          }
        }}
        onBlur={() => {
          setTimeout(() => setShowDropdown(false), 200)
        }}
        placeholder={placeholder}
        required={required}
        style={{
          width: '100%',
          padding: isMobile ? '12px 14px' : '10px 12px',
          fontSize: isMobile ? '16px' : '14px',
          border: '1px solid #dee2e6',
          borderRadius: '6px',
          outline: 'none',
          transition: 'border-color 0.2s',
          boxSizing: 'border-box'
        }}
      />
      
      {/* 會員下拉選單 */}
      {showDropdown && filteredMembers.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          maxHeight: '240px',
          overflowY: 'auto',
          backgroundColor: 'white',
          border: '1px solid #dee2e6',
          borderTop: 'none',
          borderRadius: '0 0 6px 6px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 1000
        }}>
          {filteredMembers.map((member) => (
            <div
              key={member.id}
              onClick={() => handleSelect(member)}
              style={{
                padding: '12px 14px',
                cursor: 'pointer',
                borderBottom: '1px solid #f0f0f0',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f8f9fa'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'white'
              }}
            >
              <div style={{ 
                fontWeight: '500', 
                color: '#212529',
                marginBottom: '2px'
              }}>
                {member.name}
              </div>
              {(member.nickname || member.phone) && (
                <div style={{ 
                  fontSize: '12px', 
                  color: '#6c757d'
                }}>
                  {member.nickname && `${member.nickname}`}
                  {member.nickname && member.phone && ' · '}
                  {member.phone}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface TimeSelectFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  isMobile?: boolean
  min?: string
  max?: string
}

/**
 * 可重用的時間選擇欄位組件
 * 支持手動輸入和原生時間選擇器
 */
export function TimeSelectField({
  label,
  value,
  onChange,
  required = false,
  isMobile = false,
  min,
  max
}: TimeSelectFieldProps) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{
        display: 'block',
        marginBottom: '8px',
        fontSize: '13px',
        color: '#495057',
        fontWeight: '500'
      }}>
        {label}
        {required && <span style={{ color: '#dc3545' }}> *</span>}
      </label>
      
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        min={min}
        max={max}
        style={{
          width: '100%',
          padding: isMobile ? '12px 14px' : '10px 12px',
          fontSize: isMobile ? '16px' : '14px',
          border: '1px solid #dee2e6',
          borderRadius: '6px',
          outline: 'none',
          transition: 'border-color 0.2s',
          boxSizing: 'border-box'
        }}
      />
    </div>
  )
}

interface DurationSelectFieldProps {
  label: string
  value: number
  onChange: (value: number) => void
  options?: number[]
  required?: boolean
  isMobile?: boolean
}

/**
 * 可重用的時長選擇欄位組件
 * 提供常用時長選項的快速選擇
 */
export function DurationSelectField({
  label,
  value,
  onChange,
  options = [15, 30, 45, 60, 90, 120],
  required = false,
  isMobile = false
}: DurationSelectFieldProps) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{
        display: 'block',
        marginBottom: '8px',
        fontSize: '13px',
        color: '#495057',
        fontWeight: '500'
      }}>
        {label}
        {required && <span style={{ color: '#dc3545' }}> *</span>}
      </label>
      
      {/* 快速選擇按鈕 */}
      <div style={{
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
        marginBottom: '10px'
      }}>
        {options.map((duration) => (
          <button
            key={duration}
            type="button"
            onClick={() => onChange(duration)}
            style={{
              padding: isMobile ? '8px 16px' : '6px 12px',
              fontSize: isMobile ? '14px' : '13px',
              borderRadius: '6px',
              border: value === duration 
                ? '2px solid #007bff' 
                : '1px solid #dee2e6',
              backgroundColor: value === duration 
                ? '#e7f3ff' 
                : 'white',
              color: value === duration 
                ? '#007bff' 
                : '#495057',
              cursor: 'pointer',
              fontWeight: value === duration ? '600' : '400',
              transition: 'all 0.2s'
            }}
          >
            {duration} 分
          </button>
        ))}
      </div>
      
      {/* 自訂輸入 */}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        required={required}
        min="15"
        max="240"
        step="15"
        placeholder="自訂時長（分鐘）"
        style={{
          width: '100%',
          padding: isMobile ? '12px 14px' : '10px 12px',
          fontSize: isMobile ? '16px' : '14px',
          border: '1px solid #dee2e6',
          borderRadius: '6px',
          outline: 'none',
          transition: 'border-color 0.2s',
          boxSizing: 'border-box'
        }}
      />
    </div>
  )
}

