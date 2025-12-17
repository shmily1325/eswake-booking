import { useState } from 'react'
import { getLocalDateString } from '../utils/formatters'
import { getWeekdayText } from '../utils/date'

interface DateRangePickerProps {
  selectedDate: string
  onDateChange: (date: string) => void
  isMobile: boolean
  showTodayButton?: boolean
  label?: string
  simplified?: boolean  // 簡化模式：隱藏日期選擇器，用按鈕展開
}

export function DateRangePicker({
  selectedDate,
  onDateChange,
  isMobile,
  showTodayButton = true,
  label = '查詢期間',
  simplified = false
}: DateRangePickerProps) {
  const [showDatePicker, setShowDatePicker] = useState(false)
  
  const today = new Date()
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  
  const lastMonth = new Date()
  lastMonth.setMonth(lastMonth.getMonth() - 1)
  const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`

  const isToday = selectedDate === getLocalDateString() && selectedDate.length === 10
  const isCurrentMonth = selectedDate === currentMonth && selectedDate.length === 7
  const isLastMonth = selectedDate === lastMonthStr && selectedDate.length === 7
  const isCustomDate = !isToday && !isCurrentMonth && !isLastMonth

  return (
    <div>
      {label && (
        <label style={{ 
          display: 'block', 
          marginBottom: '8px', 
          fontWeight: '600', 
          fontSize: '15px', 
          color: '#333' 
        }}>
          {label}
        </label>
      )}
      
      {/* 快捷按鈕 */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: simplified && !showDatePicker ? '0' : '12px' }}>
        {showTodayButton && (
          <button
            onClick={() => {
              onDateChange(getLocalDateString())
              setShowDatePicker(false)
            }}
            style={{
              flex: isMobile ? 1 : 'none',
              padding: isMobile ? '10px 12px' : '10px 20px',
              background: isToday ? '#4caf50' : '#e8f5e9',
              color: isToday ? '#fff' : '#2e7d32',
              border: `2px solid ${isToday ? '#4caf50' : '#81c784'}`,
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              transition: 'all 0.2s',
              boxShadow: isToday ? '0 2px 8px rgba(76,175,80,0.3)' : 'none',
              whiteSpace: 'nowrap'
            }}
          >
            🗓️ 今天
          </button>
        )}
        <button
          onClick={() => {
            onDateChange(currentMonth)
            setShowDatePicker(false)
          }}
          style={{
            flex: isMobile ? 1 : 'none',
            padding: isMobile ? '10px 12px' : '10px 20px',
            background: isCurrentMonth ? '#2196f3' : '#e3f2fd',
            color: isCurrentMonth ? '#fff' : '#1976d2',
            border: `2px solid ${isCurrentMonth ? '#2196f3' : '#90caf9'}`,
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'all 0.2s',
            boxShadow: isCurrentMonth ? '0 2px 8px rgba(33,150,243,0.3)' : 'none',
            whiteSpace: 'nowrap'
          }}
        >
          📅 本月
        </button>
        <button
          onClick={() => {
            onDateChange(lastMonthStr)
            setShowDatePicker(false)
          }}
          style={{
            flex: isMobile ? 1 : 'none',
            padding: isMobile ? '10px 12px' : '10px 20px',
            background: isLastMonth ? '#ff9800' : '#fff3e0',
            color: isLastMonth ? '#fff' : '#e65100',
            border: `2px solid ${isLastMonth ? '#ff9800' : '#ffb74d'}`,
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'all 0.2s',
            boxShadow: isLastMonth ? '0 2px 8px rgba(255,152,0,0.3)' : 'none',
            whiteSpace: 'nowrap'
          }}
        >
          📆 上個月
        </button>
        
        {/* 簡化模式：選擇日期按鈕 */}
        {simplified && (
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            style={{
              flex: isMobile ? '1 1 100%' : 'none',  // 手機版獨占一行
              padding: isMobile ? '10px 12px' : '10px 20px',
              background: isCustomDate ? '#9c27b0' : showDatePicker ? '#f3e5f5' : '#fafafa',
              color: isCustomDate ? '#fff' : showDatePicker ? '#7b1fa2' : '#666',
              border: `2px solid ${isCustomDate ? '#9c27b0' : showDatePicker ? '#ce93d8' : '#e0e0e0'}`,
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              transition: 'all 0.2s',
              boxShadow: isCustomDate ? '0 2px 8px rgba(156,39,176,0.3)' : 'none',
              whiteSpace: 'nowrap'
            }}
          >
            📌 {isCustomDate ? (selectedDate.length === 10 ? selectedDate : `${selectedDate.substring(0, 4)}年${selectedDate.substring(5, 7)}月`) : '選擇日期...'}
          </button>
        )}
      </div>

      {/* 日期/月份選擇器 - 簡化模式需要點擊展開 */}
      {(!simplified || showDatePicker) && (
        <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
              選擇月份
            </label>
            <input
              type="month"
              value={selectedDate.length === 7 ? selectedDate : ''}
              onChange={(e) => {
                onDateChange(e.target.value)
                if (simplified) setShowDatePicker(false)
              }}
              style={{
                width: '100%',
                padding: isMobile ? '10px 12px' : '8px 12px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '16px', // 16px 防止 iOS 縮放
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
              onChange={(e) => {
                onDateChange(e.target.value)
                if (simplified) setShowDatePicker(false)
              }}
              style={{
                width: '100%',
                padding: isMobile ? '10px 12px' : '8px 12px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '16px', // 16px 防止 iOS 縮放
                fontWeight: '500',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
            />
            {/* 星期幾顯示 - 只在選擇特定日期時顯示 */}
            {selectedDate.length === 10 && (
              <div style={{
                marginTop: '4px',
                fontSize: '12px',
                color: '#666',
                fontWeight: '500',
                textAlign: 'center'
              }}>
                {getWeekdayText(selectedDate)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

