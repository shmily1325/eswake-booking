/**
 * 單個參與者表單項組件
 * 用於教練回報中的參與者信息輸入
 */

import { getInputStyle, getLabelStyle } from '../styles/designSystem'
import type { Member, Participant } from '../types/booking'

interface ParticipantFormItemProps {
  participant: Participant
  index: number
  isMobile: boolean
  showRemoveButton: boolean
  memberSearchTerm: string
  filteredMembers: Member[]
  lessonTypes: Array<{ value: string; label: string }>
  paymentMethods: Array<{ value: string; label: string }>
  onUpdate: (index: number, field: keyof Participant, value: any) => void
  onRemove: (index: number) => void
  onClearMember: (index: number) => void
  onSearchChange: (value: string, index: number) => void
  onSelectMember: (index: number, member: Member) => void
}

export function ParticipantFormItem({
  participant,
  index,
  isMobile,
  showRemoveButton,
  memberSearchTerm,
  filteredMembers,
  lessonTypes,
  paymentMethods,
  onUpdate,
  onRemove,
  onClearMember,
  onSearchChange,
  onSelectMember
}: ParticipantFormItemProps) {
  return (
    <div
      style={{
        padding: '16px',
        background: '#f8f9fa',
        borderRadius: '8px',
        position: 'relative'
      }}
    >
      {/* 刪除按鈕 */}
      {showRemoveButton && (
        <button
          onClick={() => onRemove(index)}
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            padding: '4px 8px',
            background: '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          刪除
        </button>
      )}

      {/* 會員狀態標籤 + 清除按鈕 */}
      <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        {participant.member_id ? (
          <>
            <span
              style={{
                display: 'inline-block',
                padding: '4px 12px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: '600'
              }}
            >
              👤 會員
            </span>
            <button
              onClick={() => onClearMember(index)}
              style={{
                padding: '4px 8px',
                background: '#ff5252',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '11px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              ❌ 清除
            </button>
          </>
        ) : (
          <span
            style={{
              display: 'inline-block',
              padding: '4px 12px',
              background: '#fff3e0',
              color: '#e65100',
              border: '1px solid #ffb74d',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: '600'
            }}
          >
            🔍 可搜尋會員或輸入客人姓名
          </span>
        )}
      </div>

      {/* 姓名輸入 + 會員搜尋 */}
      <div style={{ marginBottom: '12px', position: 'relative' }}>
        <label style={{ ...getLabelStyle(isMobile) }}>姓名</label>
        <input
          type="text"
          value={participant.participant_name}
          onChange={(e) => {
            onUpdate(index, 'participant_name', e.target.value)
            onSearchChange(e.target.value, index)
          }}
          readOnly={!!participant.member_id}
          style={{
            ...getInputStyle(isMobile),
            background: participant.member_id ? '#f0f0f0' : 'white',
            cursor: participant.member_id ? 'not-allowed' : 'text'
          }}
          placeholder="搜尋會員或輸入姓名"
        />

        {/* 会员搜索结果 */}
        {memberSearchTerm && filteredMembers.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              maxHeight: '200px',
              overflow: 'auto',
              background: 'white',
              border: '1px solid #ddd',
              borderRadius: '6px',
              marginTop: '4px',
              zIndex: 1000,
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}
            onMouseDown={(e) => e.preventDefault()}
          >
            {filteredMembers.map(member => (
              <div
                key={member.id}
                onClick={() => onSelectMember(index, member)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #f0f0f0',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = '#f5f5f5')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = 'white')
                }
              >
                <div style={{ fontWeight: '600' }}>
                  {member.nickname || member.name}
                </div>
                {member.phone && (
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {member.phone}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 时数 */}
      <div style={{ marginBottom: '12px' }}>
        <label style={{ ...getLabelStyle(isMobile) }}>時數（分鐘）</label>
        <input
          type="text"
          inputMode="numeric"
          value={participant.duration_min || ''}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, '') // 只允許數字
            onUpdate(index, 'duration_min', parseInt(value) || 0)
          }}
          style={getInputStyle(isMobile)}
          placeholder="60"
        />
      </div>

      {/* 教学方式 */}
      <div style={{ marginBottom: '12px' }}>
        <label style={{ ...getLabelStyle(isMobile), marginBottom: '8px' }}>
          教學方式
        </label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {lessonTypes.map(type => (
            <button
              key={type.value}
              type="button"
              onClick={() => onUpdate(index, 'lesson_type', type.value)}
              style={{
                flex: isMobile ? '1 1 calc(50% - 4px)' : 'none',
                padding: '10px 16px',
                background:
                  participant.lesson_type === type.value ? '#2196f3' : 'white',
                color:
                  participant.lesson_type === type.value ? 'white' : '#666',
                border: `2px solid ${
                  participant.lesson_type === type.value ? '#2196f3' : '#e0e0e0'
                }`,
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                transition: 'all 0.2s'
              }}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* 收费方式 */}
      <div>
        <label style={{ ...getLabelStyle(isMobile), marginBottom: '8px' }}>
          收費方式
        </label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {paymentMethods.map(method => (
            <button
              key={method.value}
              type="button"
              onClick={() => onUpdate(index, 'payment_method', method.value)}
              style={{
                flex: isMobile ? '1 1 calc(50% - 4px)' : 'none',
                padding: '10px 16px',
                background:
                  participant.payment_method === method.value
                    ? '#4caf50'
                    : 'white',
                color:
                  participant.payment_method === method.value ? 'white' : '#666',
                border: `2px solid ${
                  participant.payment_method === method.value
                    ? '#4caf50'
                    : '#e0e0e0'
                }`,
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                transition: 'all 0.2s'
              }}
            >
              {method.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

