/**
 * 教練回報表單對話框組件
 * 包含駕駛回報和參與者回報
 */

import { ParticipantFormItem } from './ParticipantFormItem'
import {
  designSystem,
  getButtonStyle,
  getFontSize,
  getInputStyle,
  getLabelStyle,
} from '../styles/designSystem'
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
          borderRadius: isMobile ? '0' : designSystem.borderRadius.xl,
          width: '100%',
          maxWidth: '800px',
          height: isMobile ? '100%' : 'auto',
          maxHeight: isMobile ? '100%' : '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: designSystem.shadows.lg,
          overflow: 'hidden'  // 確保子元素不會溢出
        }}
      >
        {/* 标题 */}
        <div
          style={{
            padding: '20px',
            borderBottom: `1px solid ${designSystem.colors.border.light}`,
            position: 'sticky',
            top: 0,
            background: 'white',
            zIndex: 1
          }}
        >
          <h2 style={{
            margin: 0,
            fontSize: getFontSize('h2', isMobile),
            fontWeight: '600',
            color: designSystem.colors.text.primary
          }}>
            回報 - {coachName}
          </h2>
          <div style={{
            marginTop: '8px',
            color: designSystem.colors.text.secondary,
            fontSize: getFontSize('body', isMobile)
          }}>
            {extractDate(booking.start_at)} {extractTime(booking.start_at)} |{' '}
            {booking.boats?.name} ({booking.duration_min}分)
          </div>
          {booking.notes && (
            <div
              style={{
                marginTop: '8px',
                padding: '8px 12px',
                background: designSystem.colors.warning[50],
                border: `1px solid ${designSystem.colors.warning[500]}33`,
                borderRadius: designSystem.borderRadius.md,
                fontSize: getFontSize('bodySmall', isMobile),
                color: designSystem.colors.warning[700]
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
                background: designSystem.colors.warning[50],
                border: `1px solid ${designSystem.colors.warning[500]}`,
                borderRadius: designSystem.borderRadius.lg,
                fontSize: getFontSize('body', isMobile),
                color: designSystem.colors.warning[700]
              }}
            >
              ⚠️ <strong>注意：</strong>此記錄已完成處理。如果修改任何內容，將會重新進入待處理狀態。
            </div>
          )}

          {/* 驾驶回报 */}
          {(reportType === 'driver' || reportType === 'both') && (
            <div
              style={{
                marginBottom: '24px',
                padding: '16px',
                background: designSystem.colors.info[50],
                border: `1px solid ${designSystem.colors.info[500]}33`,
                borderRadius: designSystem.borderRadius.lg
              }}
            >
              <h3 style={{
                margin: '0 0 12px 0',
                fontSize: getFontSize('h3', isMobile),
                color: designSystem.colors.info[700]
              }}>
                🚤 駕駛時數
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
                <h3 style={{
                  margin: '0',
                  fontSize: getFontSize('h3', isMobile),
                  color: designSystem.colors.success[700]
                }}>
                  🎓 參與者
                </h3>
                <button
                  onClick={onParticipantAdd}
                  style={{
                    ...getButtonStyle('secondary', 'medium', isMobile),
                    color: designSystem.colors.info[700],
                    border: `1.5px solid ${designSystem.colors.info[500]}`,
                    WebkitTapHighlightColor: 'transparent',
                    touchAction: 'manipulation'
                  }}
                >
                  ➕ 新增參與者
                </button>
              </div>
              
              <div style={{
                fontSize: getFontSize('caption', isMobile),
                color: designSystem.colors.text.disabled,
                marginBottom: '12px'
              }}>
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
            paddingBottom: isMobile
              ? 'max(20px, calc(env(safe-area-inset-bottom, 0px) + 16px))'
              : '20px',
            borderTop: `1px solid ${designSystem.colors.border.light}`,
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
              ...getButtonStyle('secondary', 'medium', isMobile),
              flex: 1,
              opacity: isSubmitting ? 0.6 : 1,
              cursor: isSubmitting ? 'not-allowed' : 'pointer'
            }}
          >
            取消
          </button>
          <button
            data-track="coach_report_submit"
            onClick={onSubmit}
            disabled={isSubmitting}
            style={{
              ...getButtonStyle('primary', 'medium', isMobile),
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
