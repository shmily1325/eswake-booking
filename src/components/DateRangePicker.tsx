import { useState } from 'react'
import type { CSSProperties } from 'react'
import { getCalendarDateString, getVenueDateString, getWeekdayText } from '../utils/date'
import { designSystem, getFontSize, getInputStyle, getLabelStyle } from '../styles/designSystem'

interface DateRangePickerProps {
  selectedDate: string
  onDateChange: (date: string) => void
  isMobile: boolean
  showTodayButton?: boolean
  label?: string
  simplified?: boolean  // 簡化模式：隱藏日期選擇器，用按鈕展開
  /** 額外顯示今年累計／去年，selectedDate 以 YYYY 表示整年 */
  showYearButtons?: boolean
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
  simplified = false,
  showYearButtons = false,
}: DateRangePickerProps) {
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [customPickerType, setCustomPickerType] = useState<'month' | 'date'>(
    selectedDate.length === 10 ? 'date' : 'month'
  )
  
  const venueToday = getVenueDateString()
  const currentMonth = venueToday.slice(0, 7)
  const [currentYear, currentMonthNumber] = currentMonth.split('-').map(Number)
  const lastMonthStr = getCalendarDateString(currentYear, currentMonthNumber - 2, 1).slice(0, 7)
  const currentYearStr = String(currentYear)
  const lastYearStr = String(currentYear - 1)

  const isToday = selectedDate === getVenueDateString() && selectedDate.length === 10
  const isCurrentYear = selectedDate === currentYearStr
  const isLastYear = selectedDate === lastYearStr
  const isCurrentMonth = selectedDate === currentMonth && selectedDate.length === 7
  const isLastMonth = selectedDate === lastMonthStr && selectedDate.length === 7
  const isCustomDate = (selectedDate.length === 7 || selectedDate.length === 10)
    && !isToday
    && !isCurrentMonth
    && !isLastMonth
  const customDateLabel = selectedDate.length === 10
    ? selectedDate.replace(/-/g, '/')
    : selectedDate.length === 7
      ? `${selectedDate.substring(0, 4)} 年 ${Number(selectedDate.substring(5, 7))} 月`
      : '自訂…'

  const openCustomPicker = () => {
    if (isCustomDate) {
      setCustomPickerType(selectedDate.length === 10 ? 'date' : 'month')
    }
    setShowDatePicker(current => !current)
  }

  return (
    <div style={{ width: '100%' }}>
      {label && (
        <label style={getLabelStyle(isMobile)}>
          {label}
        </label>
      )}
      
      {/* 快捷按鈕 */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: simplified && !showDatePicker ? '0' : '12px' }}>
        {showYearButtons && (
          <>
            <button
              type="button"
              onClick={() => {
                onDateChange(currentYearStr)
                setShowDatePicker(false)
              }}
              style={presetButtonStyle(isCurrentYear, isMobile)}
              aria-pressed={isCurrentYear}
            >
              今年累計
            </button>
            <button
              type="button"
              onClick={() => {
                onDateChange(lastYearStr)
                setShowDatePicker(false)
              }}
              style={presetButtonStyle(isLastYear, isMobile)}
              aria-pressed={isLastYear}
            >
              去年
            </button>
          </>
        )}
        {showTodayButton && (
          <button
            type="button"
            onClick={() => {
              onDateChange(getVenueDateString())
              setShowDatePicker(false)
            }}
            style={presetButtonStyle(isToday, isMobile)}
            aria-pressed={isToday}
          >
            今天
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            onDateChange(currentMonth)
            setShowDatePicker(false)
          }}
          style={presetButtonStyle(isCurrentMonth, isMobile)}
          aria-pressed={isCurrentMonth}
        >
          本月
        </button>
        <button
          type="button"
          onClick={() => {
            onDateChange(lastMonthStr)
            setShowDatePicker(false)
          }}
          style={presetButtonStyle(isLastMonth, isMobile)}
          aria-pressed={isLastMonth}
        >
          上個月
        </button>
        
        {/* 簡化模式：選擇日期按鈕 */}
        {simplified && (
          <button
            type="button"
            onClick={openCustomPicker}
            style={presetButtonStyle(
              isCustomDate || showDatePicker,
              isMobile,
              { flex: isMobile ? '1 1 100%' : 'none' }
            )}
            aria-expanded={showDatePicker}
          >
            {isCustomDate ? customDateLabel : '自訂…'}
          </button>
        )}
      </div>

      {/* 日期/月份選擇器 - 簡化模式需要點擊展開 */}
      {(!simplified || showDatePicker) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{
            display: 'flex',
            gap: '0',
            padding: '4px',
            background: designSystem.colors.background.hover,
            borderRadius: designSystem.borderRadius.md
          }}>
            <button
              type="button"
              onClick={() => setCustomPickerType('month')}
              style={presetButtonStyle(
                customPickerType === 'month',
                isMobile,
                { flex: 1, padding: '8px 12px', border: 'none', boxShadow: 'none' }
              )}
              aria-pressed={customPickerType === 'month'}
            >
              指定月份
            </button>
            <button
              type="button"
              onClick={() => setCustomPickerType('date')}
              style={presetButtonStyle(
                customPickerType === 'date',
                isMobile,
                { flex: 1, padding: '8px 12px', border: 'none', boxShadow: 'none' }
              )}
              aria-pressed={customPickerType === 'date'}
            >
              指定日期
            </button>
          </div>

          {customPickerType === 'month' ? (
            <input
              type="month"
              value={selectedDate.length === 7 ? selectedDate : ''}
              aria-label="指定月份"
              onChange={(e) => {
                onDateChange(e.target.value)
                if (simplified) setShowDatePicker(false)
              }}
              style={getInputStyle(isMobile)}
            />
          ) : (
            <div>
              <input
                type="date"
                value={selectedDate.length === 10 ? selectedDate : ''}
                aria-label="指定日期"
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
          )}
        </div>
      )}
    </div>
  )
}
