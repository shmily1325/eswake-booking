import { useMemo } from 'react'
import { useDailyStaff } from '../hooks/useDailyStaff'
import { formatStaffTimeOffBadgeLabel } from '../utils/coachTimeOff'
import { filterTimeOffStaffDisplay, filterWorkingStaffDisplay } from '../utils/dailyStaffDisplay'
import { styles, getResponsiveStyles } from '../styles/designSystem'

interface DailyStaffDisplayProps {
  date: string  // YYYY-MM-DD 格式
  isMobile: boolean
  unassignedCount?: number  // 未排班預約數量
}

/**
 * 顯示指定日期的上班／休假人員
 * 使用共用的 useDailyStaff hook
 */
export function DailyStaffDisplay({ date, isMobile, unassignedCount }: DailyStaffDisplayProps) {
  const { workingStaff, allStaff, loading } = useDailyStaff(date)
  const rs = getResponsiveStyles(isMobile)

  const visibleWorkingStaff = useMemo(
    () => filterWorkingStaffDisplay(workingStaff),
    [workingStaff]
  )

  const timeOffStaff = useMemo(
    () => filterTimeOffStaffDisplay(allStaff.filter(s => s.timeOffRecords.length > 0)),
    [allStaff]
  )

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
      {unassignedCount !== undefined && unassignedCount > 0 && (
        <div style={{ ...styles.warningBox, ...rs.alertPadding, marginBottom: '8px' }}>
          <span style={{ fontSize: isMobile ? '13px' : '14px' }}>⚠️</span>
          <span style={{ ...styles.textWarning, fontSize: isMobile ? '13px' : '14px' }}>
            尚有 {unassignedCount} 筆未排班
          </span>
        </div>
      )}

      <div style={{ ...styles.flexRow, flexWrap: 'wrap' }}>
        <span style={{ ...rs.labelText, ...styles.flexRowTight, whiteSpace: 'nowrap' }}>
          👥 可上班
        </span>
        <div style={{ ...styles.flexWrap, ...rs.gapSm }}>
          {visibleWorkingStaff.length > 0 ? (
            visibleWorkingStaff.map(staff => (
              <span
                key={staff.id}
                style={{ ...styles.badgeSuccess, ...rs.badgePadding, fontSize: isMobile ? '12px' : '13px' }}
              >
                {staff.name}
              </span>
            ))
          ) : (
            <span style={rs.smallText}>無排班人員</span>
          )}
        </div>
      </div>

      {timeOffStaff.length > 0 && (
        <div style={{ ...styles.flexRow, flexWrap: 'wrap', marginTop: '8px' }}>
          <span style={{ ...rs.labelText, ...styles.flexRowTight, whiteSpace: 'nowrap' }}>
            🏖️ 休假
          </span>
          <div style={{ ...styles.flexWrap, ...rs.gapSm }}>
            {timeOffStaff.map(staff => (
              <span
                key={staff.id}
                style={{ ...styles.badgeWarning, ...rs.badgePadding, fontSize: isMobile ? '12px' : '13px' }}
              >
                {formatStaffTimeOffBadgeLabel(staff.name, staff.timeOffRecords, date)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
