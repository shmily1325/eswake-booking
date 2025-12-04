import { getLocalDateString } from '../utils/formatters'

interface DateRangePickerProps {
  selectedDate: string
  onDateChange: (date: string) => void
  isMobile: boolean
  showTodayButton?: boolean
  label?: string
}

export function DateRangePicker({
  selectedDate,
  onDateChange,
  isMobile,
  showTodayButton = true,
  label = '查詢期間'
}: DateRangePickerProps) {
  const today = new Date()
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  
  const lastMonth = new Date()
  lastMonth.setMonth(lastMonth.getMonth() - 1)
  const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`

  const isToday = selectedDate === getLocalDateString() && selectedDate.length === 10
  const isCurrentMonth = selectedDate === currentMonth && selectedDate.length === 7

  return (
    <div>
      <label style={{ 
        display: 'block', 
        marginBottom: '8px', 
        fontWeight: '600', 
        fontSize: '15px', 
        color: '#333' 
      }}>
        {label}
      </label>
      
      {/* 快捷按鈕 */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
        {showTodayButton && (
          <button
            onClick={() => onDateChange(getLocalDateString())}
            style={{
              flex: isMobile ? 1 : 'none',
              padding: '10px 20px',
              background: isToday ? '#4caf50' : '#e8f5e9',
              color: isToday ? '#fff' : '#2e7d32',
              border: `2px solid ${isToday ? '#4caf50' : '#81c784'}`,
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              transition: 'all 0.2s',
              boxShadow: isToday ? '0 2px 8px rgba(76,175,80,0.3)' : 'none'
            }}
          >
            🗓️ 今天
          </button>
        )}
        <button
          onClick={() => onDateChange(currentMonth)}
          style={{
            flex: isMobile ? 1 : 'none',
            padding: '10px 20px',
            background: isCurrentMonth ? '#2196f3' : '#e3f2fd',
            color: isCurrentMonth ? '#fff' : '#1976d2',
            border: `2px solid ${isCurrentMonth ? '#2196f3' : '#90caf9'}`,
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'all 0.2s',
            boxShadow: isCurrentMonth ? '0 2px 8px rgba(33,150,243,0.3)' : 'none'
          }}
        >
          📅 本月
        </button>
        <button
          onClick={() => onDateChange(lastMonthStr)}
          style={{
            flex: isMobile ? 1 : 'none',
            padding: '10px 20px',
            background: '#fff3e0',
            color: '#e65100',
            border: `2px solid #ffb74d`,
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'all 0.2s'
          }}
        >
          📆 上個月
        </button>
      </div>

      {/* 日期/月份選擇器 */}
      <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
            選擇月份
          </label>
          <input
            type="month"
            value={selectedDate.length === 7 ? selectedDate : ''}
            onChange={(e) => onDateChange(e.target.value)}
            style={{
              width: '100%',
              padding: isMobile ? '10px 12px' : '8px 12px',
              border: '2px solid #e0e0e0',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
            選擇特定日期
          </label>
          <input
            type="date"
            value={selectedDate.length === 10 ? selectedDate : ''}
            onChange={(e) => onDateChange(e.target.value)}
            style={{
              width: '100%',
              padding: isMobile ? '10px 12px' : '8px 12px',
              border: '2px solid #e0e0e0',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
          />
        </div>
      </div>
    </div>
  )
}

