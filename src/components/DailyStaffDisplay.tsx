import { useDailyStaff } from '../hooks/useDailyStaff'

interface DailyStaffDisplayProps {
  date: string  // YYYY-MM-DD 格式
  isMobile: boolean
}

/**
 * 顯示指定日期的上班人員
 * 使用共用的 useDailyStaff hook
 */
export function DailyStaffDisplay({ date, isMobile }: DailyStaffDisplayProps) {
  const { workingStaff, loading } = useDailyStaff(date)

  if (loading) {
    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '10px',
        padding: isMobile ? '10px 12px' : '12px 16px',
        marginBottom: '12px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span style={{ fontSize: isMobile ? '14px' : '15px' }}>👥</span>
          <div style={{
            width: '150px',
            height: '16px',
            background: 'linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
            borderRadius: '4px',
          }} />
        </div>
      </div>
    )
  }

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '10px',
      padding: isMobile ? '10px 12px' : '12px 16px',
      marginBottom: '12px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      border: '1px solid #e9ecef',
    }}>
      {/* 上班人員 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexWrap: 'wrap',
      }}>
        <span style={{
          fontSize: isMobile ? '14px' : '15px',
          fontWeight: '600',
          color: '#2c3e50',
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}>
          👥 可上班
        </span>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: isMobile ? '4px' : '6px',
        }}>
          {workingStaff.length > 0 ? (
            workingStaff.map(staff => (
              <span
                key={staff.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: isMobile ? '3px 8px' : '4px 10px',
                  backgroundColor: '#e8f5e9',
                  color: '#2e7d32',
                  borderRadius: '12px',
                  fontSize: isMobile ? '12px' : '13px',
                  fontWeight: '500',
                  border: '1px solid #c8e6c9',
                }}
              >
                {staff.name}
              </span>
            ))
          ) : (
            <span style={{
              color: '#999',
              fontSize: isMobile ? '12px' : '13px',
            }}>
              無排班人員
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
