/**
 * 單個參與者表單項組件
 * 用於教練回報中的參與者信息輸入
 */

import type { CSSProperties } from 'react'
import {
  designSystem,
  getBookingChoiceStyle,
  getFontSize,
  getInputStyle,
  getLabelStyle,
} from '../styles/designSystem'
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
  isSearchActive?: boolean  // 是否顯示搜尋結果（避免所有參與者同時顯示下拉選單）
  onUpdate: (index: number, field: keyof Participant, value: any) => void
  onRemove: (index: number) => void
  onClearMember: (index: number) => void
  onSearchChange: (value: string, index: number) => void
  onSelectMember: (index: number, member: Member) => void
  onSearchFocus?: (index: number) => void  // 輸入框獲得焦點時通知父組件
  onSearchBlur?: (index: number) => void   // 輸入框失去焦點時通知父組件
}

function getPaymentChoiceStyle(selected: boolean): CSSProperties {
  return {
    border: selected
      ? `1.5px solid ${designSystem.colors.success[500]}`
      : `1px solid ${designSystem.colors.border.light}`,
    borderRadius: designSystem.borderRadius.lg,
    background: selected ? designSystem.colors.success[50] : '#ffffff',
    color: selected ? designSystem.colors.success[700] : designSystem.colors.text.primary,
    fontWeight: 600,
    cursor: 'pointer',
  }
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
  isSearchActive = true,  // 預設顯示搜尋結果（向後兼容）
  onUpdate,
  onRemove,
  onClearMember,
  onSearchChange,
  onSelectMember,
  onSearchFocus,
  onSearchBlur
}: ParticipantFormItemProps) {
  return (
    <div
      style={{
        padding: '16px',
        background: designSystem.colors.background.hover,
        borderRadius: designSystem.borderRadius.lg,
        border: `1px solid ${designSystem.colors.border.light}`,
        position: 'relative'
      }}
    >
      {/* 刪除按鈕 - 淺色背景，hover 變紅 */}
      {showRemoveButton && (
        <button
          onClick={() => onRemove(index)}
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            padding: '4px 8px',
            background: '#ffffff',
            color: designSystem.colors.text.secondary,
            border: `1px solid ${designSystem.colors.border.light}`,
            borderRadius: designSystem.borderRadius.sm,
            cursor: 'pointer',
            fontSize: getFontSize('caption', isMobile),
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = designSystem.colors.danger[50]
            e.currentTarget.style.color = designSystem.colors.danger[700]
            e.currentTarget.style.borderColor = designSystem.colors.danger[500]
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#ffffff'
            e.currentTarget.style.color = designSystem.colors.text.secondary
            e.currentTarget.style.borderColor = designSystem.colors.border.light
          }}
        >
          <span style={{ fontSize: getFontSize('body', isMobile), lineHeight: 1 }}>×</span>
          <span>移除</span>
        </button>
      )}

      {/* 會員狀態標籤 + 清除按鈕 */}
      <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {participant.member_id ? (
          <>
            <span
              style={{
                display: 'inline-block',
                padding: '4px 12px',
                background: designSystem.colors.success[50],
                color: designSystem.colors.success[700],
                border: `1px solid ${designSystem.colors.success[500]}`,
                borderRadius: designSystem.borderRadius.full,
                fontSize: getFontSize('caption', isMobile),
                fontWeight: '600'
              }}
            >
              👤 會員
            </span>
            <button
              onClick={() => onClearMember(index)}
              style={{
                padding: '4px 8px',
                background: designSystem.colors.danger[50],
                color: designSystem.colors.danger[700],
                border: `1px solid ${designSystem.colors.danger[500]}`,
                borderRadius: designSystem.borderRadius.md,
                fontSize: getFontSize('caption', true),
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              清除
            </button>
          </>
        ) : (
          <span
            style={{
              display: 'inline-block',
              padding: '4px 12px',
              background: designSystem.colors.warning[50],
              color: designSystem.colors.warning[700],
              border: `1px solid ${designSystem.colors.warning[500]}`,
              borderRadius: designSystem.borderRadius.full,
              fontSize: getFontSize('caption', isMobile),
              fontWeight: '600'
            }}
          >
            可搜尋會員或輸入客人姓名
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
          onFocus={() => onSearchFocus?.(index)}
          onBlur={() => {
            // 延遲關閉以便用戶可以點擊搜尋結果
            setTimeout(() => onSearchBlur?.(index), 200)
          }}
          readOnly={!!participant.member_id}
          style={{
            ...getInputStyle(isMobile),
            background: participant.member_id ? designSystem.colors.background.hover : 'white',
            cursor: participant.member_id ? 'not-allowed' : 'text'
          }}
          placeholder="搜尋會員或輸入姓名"
        />

        {/* 会员搜索结果 - 只在此參與者正在搜尋時顯示 */}
        {isSearchActive && memberSearchTerm && filteredMembers.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              maxHeight: '200px',
              overflow: 'auto',
              background: 'white',
              border: `1px solid ${designSystem.colors.border.main}`,
              borderRadius: designSystem.borderRadius.md,
              marginTop: '4px',
              zIndex: 1000,
              boxShadow: designSystem.shadows.md
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
                  borderBottom: `1px solid ${designSystem.colors.border.light}`,
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = designSystem.colors.background.hover)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = 'white')
                }
              >
                <div style={{ fontWeight: '600' }}>
                  {member.nickname || member.name}
                </div>
                {member.phone && (
                  <div style={{
                    fontSize: getFontSize('caption', isMobile),
                    color: designSystem.colors.text.secondary
                  }}>
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
          value={participant.duration_min ?? ''}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, '') // 只允許數字
            // 空值時設為 0，確保資料一致性
            onUpdate(index, 'duration_min', value === '' ? 0 : parseInt(value))
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
                ...getBookingChoiceStyle(participant.lesson_type === type.value),
                flex: isMobile ? '1 1 calc(50% - 4px)' : 'none',
                padding: '10px 16px',
                fontSize: getFontSize('button', isMobile),
                fontWeight: 600,
                cursor: 'pointer',
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
                ...getPaymentChoiceStyle(participant.payment_method === method.value),
                flex: isMobile ? '1 1 calc(50% - 4px)' : 'none',
                padding: '10px 16px',
                fontSize: getFontSize('button', isMobile),
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
