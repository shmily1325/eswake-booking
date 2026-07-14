import { useState } from 'react'
import type { CSSProperties } from 'react'
import { getLocalDateString } from '../utils/formatters'
import { getWeekdayText } from '../utils/date'
import { designSystem, getFontSize, getInputStyle, getLabelStyle } from '../styles/designSystem'

interface DateRangePickerProps {
  selectedDate: string
  onDateChange: (date: string) => void
  isMobile: boolean
  showTodayButton?: boolean
  label?: string
  simplified?: boolean  // 簡化模式：隱藏日期選擇器，用按鈕展開
}

/** 快捷鈕：選中近黑，未選中白底描邊（不使用亮綠／亮藍） */
function presetButtonStyle(
  selected: boolean,
  isMobile: boolean,
  extra?: CSSProperties
): CSSProperties {
  return {
    flex: isMobile ? 1 : 'none',
    padding: isMobile ? '10px 12px' : '10px 20px',
    background: selected
      ? designSystem.colors.primary[500]
      : designSystem.colors.background.card,
    color: selected ? '#ffffff' : designSystem.colors.text.secondary,
    border: `1.5px solid ${
      selected
        ? designSystem.colors.primary[500]
        : designSystem.colors.border.main
    }`,
    borderRadius: designSystem.borderRadius.md,
    cursor: 'pointer',
    fontSize: getFontSize('body', isMobile),
    fontWeight: '600',
    transition: 'all 0.2s',
    boxShadow: selected ? designSystem.shadows.sm : 'none',
    whiteSpace: 'nowrap',
    ...extra,
  }
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
    <div style={{ width: '100%' }}>
      {label && (
        <label style={getLabelStyle(isMobile)}>
          {label}
        </label>
      )}
      
      {/* 快捷按鈕 */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: simplified && !showDatePicker ? '0' : '12px' }}>
        {showTodayButton && (
          <button
            type="button"
            onClick={() => {
              onDateChange(getLocalDateString())
              setShowDatePicker(false)
            }}
            style={presetButtonStyle(isToday, isMobile)}
          >
            🗓️ 今天
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            onDateChange(currentMonth)
            setShowDatePicker(false)
          }}
          style={presetButtonStyle(isCurrentMonth, isMobile)}
        >
          📅 本月
        </button>
        <button
          type="button"
          onClick={() => {
            onDateChange(lastMonthStr)
            setShowDatePicker(false)
          }}
          style={presetButtonStyle(isLastMonth, isMobile)}
        >
          📆 上個月
        </button>
        
        {/* 簡化模式：選擇日期按鈕 */}
        {simplified && (
          <button
            type="button"
            onClick={() => setShowDatePicker(!showDatePicker)}
            style={presetButtonStyle(
              isCustomDate || showDatePicker,
              isMobile,
              { flex: isMobile ? '1 1 100%' : 'none' }
            )}
          >
            📌 {isCustomDate ? (selectedDate.length === 10 ? selectedDate : `${selectedDate.substring(0, 4)}年${selectedDate.substring(5, 7)}月`) : '選擇日期...'}
          </button>
        )}
      </div>

      {/* 日期/月份選擇器 - 簡化模式需要點擊展開 */}
      {(!simplified || showDatePicker) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div>
            <label style={{
              ...getLabelStyle(isMobile),
              fontSize: getFontSize('caption', isMobile),
              marginBottom: '4px'
            }}>
              選擇月份
            </label>
            <input
              type="month"
              value={selectedDate.length === 7 ? selectedDate : ''}
              onChange={(e) => {
                onDateChange(e.target.value)
                if (simplified) setShowDatePicker(false)
              }}
              style={getInputStyle(isMobile)}
            />
          </div>
          <div>
            <label style={{
              ...getLabelStyle(isMobile),
              fontSize: getFontSize('caption', isMobile),
              marginBottom: '4px'
            }}>
              選擇特定日期
            </label>
            <input
              type="date"
              value={selectedDate.length === 10 ? selectedDate : ''}
              onChange={(e) => {
                onDateChange(e.target.value)
                if (simplified) setShowDatePicker(false)
              }}
              style={getInputStyle(isMobile)}
            />
            {selectedDate.length === 10 && (
              <div style={{
                marginTop: '4px',
                fontSize: getFontSize('caption', isMobile),
                color: designSystem.colors.text.secondary,
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
