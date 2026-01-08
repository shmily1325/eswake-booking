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
  activeSearchIndex?: number | null  // 正在搜尋的參與者索引
  onDriverDurationChange: (value: number) => void
  onParticipantUpdate: (index: number, field: keyof Participant, value: any) => void
  onParticipantAdd: () => void
  onParticipantRemove: (index: number) => void
  onClearMember: (index: number) => void
  onMemberSearch: (value: string, index: number) => void
  onMemberSelect: (index: number, member: Member) => void
  onSubmit: () => void
  onCancel: () => void
  onSearchFocus?: (index: number) => void
  onSearchBlur?: (index: number) => void
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
  activeSearchIndex = null,  // 正在搜尋的參與者索引
  onDriverDurationChange,
  onParticipantUpdate,
  onParticipantAdd,
  onParticipantRemove,
  onClearMember,
  onMemberSearch,
  onMemberSelect,
  onSubmit,
  onCancel,
  onSearchFocus,
  onSearchBlur
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
    >
      <div
        style={{
          background: 'white',
          borderRadius: isMobile ? '0' : '12px',
          width: '100%',
          maxWidth: '800px',
          height: isMobile ? '100%' : 'auto',
          maxHeight: isMobile ? '100%' : '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          overflow: 'hidden'  // 確保子元素不會溢出
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
          {/* 已結案記錄警告 */}
          {participants.some(p => p.status === 'processed') && (
            <div
              style={{
                marginBottom: '16px',
                padding: '12px 16px',
                background: '#fff3e0',
                border: '1px solid #ffb74d',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#e65100'
              }}
            >
              ⚠️ <strong>注意：</strong>此記錄已被管理員處理過。如果修改任何內容，將會重新進入待處理狀態。
            </div>
          )}

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
                  type="text"
                  inputMode="numeric"
                  value={driverDuration ?? ''}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '') // 只允許數字
                    // 允許空值，避免清空時自動填 0 導致無法重打
                    onDriverDurationChange(value === '' ? 0 : parseInt(value))
                  }}
                  style={getInputStyle(isMobile)}
                  placeholder="60"
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
                    padding: '10px 18px',
                    background: 'white',
                    color: '#2196f3',
                    border: '2px solid #2196f3',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                    WebkitTapHighlightColor: 'transparent',
                    touchAction: 'manipulation'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#e3f2fd'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'white'
                    e.currentTarget.style.transform = 'scale(1)'
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = 'scale(0.95)'
                    e.currentTarget.style.background = '#bbdefb'
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'scale(1)'
                    e.currentTarget.style.background = '#e3f2fd'
                  }}
                  onTouchStart={(e) => {
                    e.currentTarget.style.transform = 'scale(0.95)'
                    e.currentTarget.style.background = '#bbdefb'
                  }}
                  onTouchEnd={(e) => {
                    e.currentTarget.style.transform = 'scale(1)'
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
                        isSearchActive={activeSearchIndex === index}
                        onUpdate={onParticipantUpdate}
                        onRemove={onParticipantRemove}
                        onClearMember={onClearMember}
                        onSearchChange={onMemberSearch}
                        onSelectMember={onMemberSelect}
                        onSearchFocus={onSearchFocus}
                        onSearchBlur={onSearchBlur}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部按钮 - 不使用 sticky 避免手機鍵盤問題 */}
        <div
          style={{
            padding: '20px',
            borderTop: '1px solid #e0e0e0',
            display: 'flex',
            gap: '12px',
            background: 'white',
            flexShrink: 0  // 防止被壓縮
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
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {isSubmitting ? (
              <>
                <span
                  style={{
                    display: 'inline-block',
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: 'white',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite'
                  }}
                />
                提交中...
              </>
            ) : (
              '提交回報'
            )}
          </button>
        </div>
        
        {/* Spinner 動畫的 CSS */}
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  )
}

