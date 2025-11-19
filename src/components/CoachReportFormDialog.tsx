/**
 * 教练回报表单对话框组件
 * 包含驾驶回报和参与者回报
 */

import { ParticipantFormItem } from './ParticipantFormItem'
import { getButtonStyle, getInputStyle, getLabelStyle } from '../styles/designSystem'

interface Member {
  id: string
  name: string
  nickname: string | null
  phone: string | null
}

interface Participant {
  id?: number
  member_id: string | null
  participant_name: string
  duration_min: number
  payment_method: string
  lesson_type: string
  notes?: string
}

interface Booking {
  id: number
  start_at: string
  duration_min: number
  contact_name: string
  notes: string | null
  boats: { name: string; color: string } | null
}

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
  onDriverDurationChange: (value: number) => void
  onParticipantUpdate: (index: number, field: keyof Participant, value: any) => void
  onParticipantAddMember: () => void
  onParticipantAddGuest: () => void
  onParticipantRemove: (index: number) => void
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
  onDriverDurationChange,
  onParticipantUpdate,
  onParticipantAddMember,
  onParticipantAddGuest,
  onParticipantRemove,
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
            {booking.start_at.substring(0, 10)}{' '}
            {booking.start_at.substring(11, 16)} |{' '}
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
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>
                🎓 參與者回報
              </h3>

              {/* 已添加的参与者列表 */}
              {participants.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                    已添加的參與者：
                  </div>
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
                        onSearchChange={onMemberSearch}
                        onSelectMember={onMemberSelect}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* 添加参与者区域 */}
              <div
                style={{
                  padding: '16px',
                  background: '#f8f9fa',
                  borderRadius: '8px',
                  border: '2px dashed #ddd'
                }}
              >
                <div style={{ marginBottom: '12px', fontWeight: '600', fontSize: '15px' }}>
                  ➕ 新增參與者
                </div>

                {/* 会员搜索 */}
                <div style={{ marginBottom: '12px' }}>
                  <button
                    onClick={onParticipantAddMember}
                    style={{
                      ...getButtonStyle('primary'),
                      width: '100%'
                    }}
                  >
                    👤 搜尋並新增會員
                  </button>
                </div>

                {/* 或直接输入非会员 */}
                <div
                  style={{
                    textAlign: 'center',
                    color: '#999',
                    fontSize: '13px',
                    margin: '8px 0'
                  }}
                >
                  ── 或 ──
                </div>

                <button
                  onClick={onParticipantAddGuest}
                  style={{
                    ...getButtonStyle('secondary'),
                    width: '100%'
                  }}
                >
                  ✏️ 直接輸入客人姓名（非會員）
                </button>
              </div>
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
            style={{
              ...getButtonStyle('secondary'),
              flex: 1
            }}
          >
            取消
          </button>
          <button
            onClick={onSubmit}
            style={{
              ...getButtonStyle('primary'),
              flex: 2
            }}
          >
            提交回報
          </button>
        </div>
      </div>
    </div>
  )
}

