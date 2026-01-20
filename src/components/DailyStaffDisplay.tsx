import { useDailyStaff } from '../hooks/useDailyStaff'
import { styles, getResponsiveStyles } from '../styles/designSystem'

interface DailyStaffDisplayProps {
  date: string  // YYYY-MM-DD 格式
  isMobile: boolean
  unassignedCount?: number  // 未排班預約數量
}

/**
 * 顯示指定日期的上班人員
 * 使用共用的 useDailyStaff hook
 */
export function DailyStaffDisplay({ date, isMobile, unassignedCount }: DailyStaffDisplayProps) {
  const { workingStaff, loading } = useDailyStaff(date)
  const rs = getResponsiveStyles(isMobile)

  if (loading) {
    return (
      <div style={{ ...styles.card, ...rs.cardPadding, marginBottom: '12px' }}>
        <div style={styles.flexRow}>
          <span style={rs.iconSize}>👥</span>
          <div style={{ ...styles.shimmer, width: '150px', height: '16px' }} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ ...styles.cardBordered, ...rs.cardPadding, marginBottom: '12px' }}>
      {/* 未排班警告 */}
      {unassignedCount !== undefined && unassignedCount > 0 && (
        <div style={{ ...styles.warningBox, ...rs.alertPadding, marginBottom: '8px' }}>
          <span style={{ fontSize: isMobile ? '13px' : '14px' }}>⚠️</span>
          <span style={{ ...styles.textWarning, fontSize: isMobile ? '13px' : '14px' }}>
            尚有 {unassignedCount} 筆未排班
          </span>
        </div>
      )}
      
      {/* 上班人員 */}
      <div style={{ ...styles.flexRow, flexWrap: 'wrap' }}>
        <span style={{ ...rs.labelText, ...styles.flexRowTight, whiteSpace: 'nowrap' }}>
          👥 可上班
        </span>
        <div style={{ ...styles.flexWrap, ...rs.gapSm }}>
          {workingStaff.length > 0 ? (
            workingStaff.map(staff => (
              <span
                key={staff.id}
                style={{ ...styles.badgeSuccess, ...rs.badgePadding, fontSize: isMobile ? '12px' : '13px' }}
              >
                {staff.name}
              </span>
            ))
          ) : (
            <span style={rs.smallText}>
              無排班人員
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
