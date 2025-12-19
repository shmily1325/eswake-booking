// 預約卡片組件

import type { Booking } from '../types'

interface BookingCardProps {
  booking: Booking
  isFirstOfDay: boolean
  formatDate: (dateString: string) => string
  getArrivalTime: (startAt: string) => string
  getStartTime: (startAt: string) => string
  getEndTime: (startAt: string, duration: number) => string
}

export function BookingCard({
  booking,
  isFirstOfDay,
  formatDate,
  getArrivalTime,
  getStartTime,
  getEndTime
}: BookingCardProps) {
  const coachNames = booking.coaches.map(c => c.name).join('、')

  return (
    <div
      style={{
        background: 'white',
        borderRadius: '12px',
        padding: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        borderLeft: `4px solid ${booking.boats?.color || '#1976d2'}`
      }}
    >
      {/* 日期 */}
      <div style={{
        fontSize: '16px',
        fontWeight: '600',
        color: '#333',
        marginBottom: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <span>📅</span>
        <span>{formatDate(booking.start_at)}</span>
      </div>
      
      {/* 抵達時間 & 下水時間 */}
      <div style={{
        display: 'flex',
        gap: '16px',
        marginBottom: '12px',
        padding: '10px 12px',
        background: '#f0f7ff',
        borderRadius: '8px'
      }}>
        {isFirstOfDay && (
          <div>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '2px' }}>🚗 抵達時間</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#1976d2' }}>
              {getArrivalTime(booking.start_at)}
            </div>
          </div>
        )}
        <div style={isFirstOfDay ? { borderLeft: '1px solid #ddd', paddingLeft: '16px' } : {}}>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '2px' }}>🏄 下水時間</div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#333' }}>
            {getStartTime(booking.start_at)}
          </div>
        </div>
      </div>

      {/* 船隻 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px'
      }}>
        <div style={{
          width: '20px',
          height: '20px',
          borderRadius: '4px',
          background: booking.boats?.color || '#1976d2'
        }} />
        <span style={{ fontSize: '15px', fontWeight: '600', color: '#555' }}>
          {booking.boats?.name || '未指定'}
        </span>
      </div>

      {/* 時長 */}
      <div style={{
        fontSize: '14px',
        color: '#666',
        marginBottom: '8px'
      }}>
        ⏱️ {booking.duration_min} 分鐘
        <span style={{ color: '#999', marginLeft: '8px' }}>
          (結束: {getEndTime(booking.start_at, booking.duration_min)})
        </span>
      </div>

      {/* 教練（如果有指定才顯示）*/}
      {coachNames && (
        <div style={{
          fontSize: '14px',
          color: '#666'
        }}>
          🎓 指定教練: {coachNames}
        </div>
      )}

      {/* 活動類型 */}
      {booking.activity_types && booking.activity_types.length > 0 && (
        <div style={{
          display: 'flex',
          gap: '6px',
          flexWrap: 'wrap',
          marginTop: '12px'
        }}>
          {booking.activity_types.map((type, idx) => (
            <span
              key={idx}
              style={{
                padding: '4px 10px',
                background: '#e3f2fd',
                color: '#1976d2',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: '600'
              }}
            >
              {type}
            </span>
          ))}
        </div>
      )}

      {/* 備註 */}
      {booking.notes && (
        <div style={{
          marginTop: '12px',
          padding: '12px',
          background: '#f8f9fa',
          borderRadius: '8px',
          fontSize: '13px',
          color: '#555',
          lineHeight: '1.5'
        }}>
          <div style={{ fontWeight: '600', marginBottom: '4px' }}>📝 備註</div>
          {booking.notes}
        </div>
      )}
    </div>
  )
}

