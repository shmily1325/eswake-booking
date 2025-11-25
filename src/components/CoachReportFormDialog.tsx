/**
 * 教練回報表單對話框組件
 * 包含駕駛回報和參與者回報
 */

import { ParticipantFormItem } from './ParticipantFormItem'
import { getButtonStyle, getInputStyle, getLabelStyle } from '../styles/designSystem'
import { extractDate, extractTime } from '../utils/formatters'
import type { Member, Participant, Booking } from '../types/booking'

interface CoachReportFormDialogProps {
  booking: Booking | undefined
  reportType: 'coach' | 'driver' | 'both'
  coachName: string
  driverDuration: number
  participants: Participant[]
  isMobile: boolean
  memberSearchTerm: string
  filteredMembers: Member[]
  lessonTypes: Array<{ value: string; label: string }>
  paymentMethods: Array<{ value: string; label: string }>
  isSubmitting?: boolean  // 新增：提交中狀態
  onDriverDurationChange: (value: number) => void
  onParticipantUpdate: (index: number, field: keyof Participant, value: any) => void
  onParticipantAdd: () => void
  onParticipantRemove: (index: number) => void
  onClearMember: (index: number) => void
  onMemberSearch: (value: string, index: number) => void
  onMemberSelect: (index: number, member: Member) => void
  onSubmit: () => void
  onCancel: () => void
}

export function CoachReportFormDialog({
  booking,
  reportType,
  coachName,
  driverDuration,
  participants,
  isMobile,
  memberSearchTerm,
  filteredMembers,
  lessonTypes,
  paymentMethods,
  isSubmitting = false,  // 新增：預設為 false
  onDriverDurationChange,
  onParticipantUpdate,
  onParticipantAdd,
  onParticipantRemove,
  onClearMember,
  onMemberSearch,
  onMemberSelect,
  onSubmit,
  onCancel
}: CoachReportFormDialogProps) {
  if (!booking) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: isMobile ? '0' : '20px'
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: isMobile ? '0' : '12px',
          width: '100%',
          maxWidth: '800px',
          maxHeight: isMobile ? '100%' : '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
        }}
      >
        {/* 标题 */}
        <div
          style={{
            padding: '20px',
            borderBottom: '1px solid #e0e0e0',
            position: 'sticky',
            top: 0,
            background: 'white',
            zIndex: 1
          }}
        >
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>
            📝 回報 - {coachName}
          </h2>
          <div style={{ marginTop: '8px', color: '#666', fontSize: '14px' }}>
            {extractDate(booking.start_at)} {extractTime(booking.start_at)} |{' '}
            {booking.boats?.name} ({booking.duration_min}分)
          </div>
          {booking.notes && (
            <div
              style={{
                marginTop: '8px',
                padding: '8px 12px',
                background: '#fff3e0',
                borderRadius: '6px',
                fontSize: '13px',
                color: '#666'
              }}
            >
              備註：{booking.notes}
            </div>
          )}
        </div>

        {/* 表单内容 */}
        <div style={{ padding: '20px', overflow: 'auto', flex: 1 }}>
          {/* 驾驶回报 */}
          {(reportType === 'driver' || reportType === 'both') && (
            <div
              style={{
                marginBottom: '24px',
                padding: '16px',
                background: '#e3f2fd',
                borderRadius: '8px'
              }}
            >
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>
                🚤 駕駛回報
              </h3>
              <div>
                <label style={{ ...getLabelStyle(isMobile) }}>
                  實際駕駛時數（分鐘）
                </label>
                <input
                  type="number"
                  value={driverDuration}
                  onChange={(e) =>
                    onDriverDurationChange(parseInt(e.target.value) || 0)
                  }
                  min="0"
                  style={getInputStyle(isMobile)}
                />
              </div>
            </div>
          )}

          {/* 参与者回报 */}
          {(reportType === 'coach' || reportType === 'both') && (
            <div>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '12px'
              }}>
                <h3 style={{ margin: '0', fontSize: '16px' }}>
                  🎓 參與者回報
                </h3>
                <button
                  onClick={onParticipantAdd}
                  style={{
                    padding: '8px 16px',
                    background: 'white',
                    color: '#2196f3',
                    border: '1px solid #2196f3',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#e3f2fd'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'white'
                  }}
                >
                  ➕ 新增參與者
                </button>
              </div>
              
              <div style={{ fontSize: '12px', color: '#999', marginBottom: '12px' }}>
                可搜尋會員或直接輸入客人姓名
              </div>

              {/* 已添加的参与者列表 */}
              {participants.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {participants.map((participant, index) => (
                      <ParticipantFormItem
                        key={index}
                        participant={participant}
                        index={index}
                        isMobile={isMobile}
                        showRemoveButton={true}
                        memberSearchTerm={memberSearchTerm}
                        filteredMembers={filteredMembers}
                        lessonTypes={lessonTypes}
                        paymentMethods={paymentMethods}
                        onUpdate={onParticipantUpdate}
                        onRemove={onParticipantRemove}
                        onClearMember={onClearMember}
                        onSearchChange={onMemberSearch}
                        onSelectMember={onMemberSelect}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div
          style={{
            padding: '20px',
            borderTop: '1px solid #e0e0e0',
            display: 'flex',
            gap: '12px',
            position: 'sticky',
            bottom: 0,
            background: 'white'
          }}
        >
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            style={{
              ...getButtonStyle('secondary'),
              flex: 1,
              opacity: isSubmitting ? 0.6 : 1,
              cursor: isSubmitting ? 'not-allowed' : 'pointer'
            }}
          >
            取消
          </button>
          <button
            onClick={onSubmit}
            disabled={isSubmitting}
            style={{
              ...getButtonStyle('primary'),
              flex: 2,
              opacity: isSubmitting ? 0.7 : 1,
              cursor: isSubmitting ? 'not-allowed' : 'pointer'
            }}
          >
            {isSubmitting ? '提交中...' : '提交回報'}
          </button>
        </div>
      </div>
    </div>
  )
}

