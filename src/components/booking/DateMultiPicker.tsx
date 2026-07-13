import { useState, useMemo } from 'react'
import { designSystem } from '../../styles/designSystem'

interface DateMultiPickerProps {
  selectedDates: string[]  // 格式: 'YYYY-MM-DD'
  onDatesChange: (dates: string[]) => void
  minDate?: string  // 最早可選日期
}

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

export function DateMultiPicker({
  selectedDates,
  onDatesChange,
  minDate,
}: DateMultiPickerProps) {
  // 當前顯示的月份
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date()
    return { year: today.getFullYear(), month: today.getMonth() }
  })

  // 計算該月的日曆格子
  const calendarDays = useMemo(() => {
    const { year, month } = currentMonth
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startWeekday = firstDay.getDay()

    const days: Array<{ date: string; day: number; isCurrentMonth: boolean; isDisabled: boolean }> = []

    // 上個月的補位
    const prevMonthLastDay = new Date(year, month, 0).getDate()
    for (let i = startWeekday - 1; i >= 0; i--) {
      const day = prevMonthLastDay - i
      const prevMonth = month === 0 ? 11 : month - 1
      const prevYear = month === 0 ? year - 1 : year
      const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      days.push({ date: dateStr, day, isCurrentMonth: false, isDisabled: true })
    }

    // 當月的日期
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      let isDisabled = false

      // 檢查是否早於最小日期
      if (minDate && dateStr < minDate) {
        isDisabled = true
      }
      // 檢查是否早於今天
      if (dateStr < todayStr) {
        isDisabled = true
      }

      days.push({ date: dateStr, day, isCurrentMonth: true, isDisabled })
    }

    // 下個月的補位（補滿6行 或 更少）
    const totalCells = Math.ceil(days.length / 7) * 7
    const remainingDays = totalCells - days.length
    for (let day = 1; day <= remainingDays; day++) {
      const nextMonth = month === 11 ? 0 : month + 1
      const nextYear = month === 11 ? year + 1 : year
      const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      days.push({ date: dateStr, day, isCurrentMonth: false, isDisabled: true })
    }

    return days
  }, [currentMonth, minDate])

  // 切換月份
  const goToPrevMonth = () => {
    setCurrentMonth(prev => {
      if (prev.month === 0) {
        return { year: prev.year - 1, month: 11 }
      }
      return { year: prev.year, month: prev.month - 1 }
    })
  }

  const goToNextMonth = () => {
    setCurrentMonth(prev => {
      if (prev.month === 11) {
        return { year: prev.year + 1, month: 0 }
      }
      return { year: prev.year, month: prev.month + 1 }
    })
  }

  // 點選日期
  const toggleDate = (dateStr: string) => {
    if (selectedDates.includes(dateStr)) {
      onDatesChange(selectedDates.filter(d => d !== dateStr))
    } else {
      onDatesChange([...selectedDates, dateStr].sort())
    }
  }

  // 格式化月份標題
  const monthTitle = `${currentMonth.year}年${currentMonth.month + 1}月`

  // 檢查是否不能往前（當月或更早）
  const today = new Date()
  const canGoPrev = currentMonth.year > today.getFullYear() ||
    (currentMonth.year === today.getFullYear() && currentMonth.month > today.getMonth())

  return (
    <div style={{ marginTop: designSystem.spacing.sm }}>
      {/* 月份切換 - 加大按鈕 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: designSystem.spacing.md,
        padding: '0 2px',
      }}>
        <button
          type="button"
          onClick={goToPrevMonth}
          disabled={!canGoPrev}
          style={{
            width: '44px',
            height: '44px',
            borderRadius: designSystem.borderRadius.md,
            border: `1px solid ${designSystem.colors.border.main}`,
            background: canGoPrev ? '#ffffff' : designSystem.colors.background.main,
            color: canGoPrev ? designSystem.colors.text.primary : designSystem.colors.text.disabled,
            fontSize: '20px',
            fontWeight: 'bold',
            cursor: canGoPrev ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            touchAction: 'manipulation',
          }}
        >
          ‹
        </button>
        <span style={{
          fontSize: designSystem.fontSize.bodyLarge.mobile,
          fontWeight: '600',
          color: designSystem.colors.text.primary,
        }}>
          {monthTitle}
        </span>
        <button
          type="button"
          onClick={goToNextMonth}
          style={{
            width: '44px',
            height: '44px',
            borderRadius: designSystem.borderRadius.md,
            border: `1px solid ${designSystem.colors.border.main}`,
            background: '#ffffff',
            color: designSystem.colors.text.primary,
            fontSize: '20px',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            touchAction: 'manipulation',
          }}
        >
          ›
        </button>
      </div>

      {/* 星期標題 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '2px',
        marginBottom: '4px',
      }}>
        {WEEKDAY_LABELS.map((label, i) => (
          <div
            key={label}
            style={{
              textAlign: 'center',
              fontSize: designSystem.fontSize.bodySmall.mobile,
              fontWeight: '600',
              color: i === 0
                ? designSystem.colors.danger[700]
                : i === 6
                  ? designSystem.colors.info[700]
                  : designSystem.colors.text.secondary,
              padding: '4px 0',
            }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* 日期格子 - 加大高度 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '3px',
      }}>
        {calendarDays.map((dayInfo, index) => {
          const isSelected = selectedDates.includes(dayInfo.date)
          const weekday = index % 7

          return (
            <button
              key={dayInfo.date + index}
              type="button"
              onClick={() => !dayInfo.isDisabled && toggleDate(dayInfo.date)}
              disabled={dayInfo.isDisabled}
              style={{
                height: '42px',
                borderRadius: designSystem.borderRadius.sm,
                border: isSelected
                  ? `1.5px solid ${designSystem.colors.primary[500]}`
                  : `1px solid ${designSystem.colors.border.light}`,
                background: isSelected
                  ? designSystem.colors.primary[500]
                  : dayInfo.isDisabled
                    ? designSystem.colors.background.main
                    : '#ffffff',
                color: isSelected
                  ? 'white'
                  : dayInfo.isDisabled
                    ? designSystem.colors.text.disabled
                    : !dayInfo.isCurrentMonth
                      ? designSystem.colors.text.disabled
                      : weekday === 0
                        ? designSystem.colors.danger[700]
                        : weekday === 6
                          ? designSystem.colors.info[700]
                          : designSystem.colors.text.primary,
                fontSize: '15px',
                fontWeight: isSelected ? '700' : '500',
                cursor: dayInfo.isDisabled ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                touchAction: 'manipulation',
              }}
            >
              {dayInfo.day}
            </button>
          )
        })}
      </div>

      {/* 已選日期列表 - 加大標籤 */}
      {selectedDates.length > 0 && (
        <div style={{
          marginTop: designSystem.spacing.md,
          padding: `${designSystem.spacing.sm} ${designSystem.spacing.md}`,
          background: designSystem.colors.background.main,
          border: `1px solid ${designSystem.colors.border.light}`,
          borderRadius: designSystem.borderRadius.lg,
        }}>
          <div style={{
            fontWeight: '600',
            color: designSystem.colors.text.secondary,
            marginBottom: designSystem.spacing.sm,
            fontSize: designSystem.fontSize.bodySmall.mobile,
          }}>
            已選 {selectedDates.length} 個日期（點擊可移除）
          </div>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
          }}>
            {selectedDates.map(dateStr => {
              const [y, m, d] = dateStr.split('-')
              const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
              const weekday = WEEKDAY_LABELS[date.getDay()]
              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => toggleDate(dateStr)}
                  style={{
                    padding: '8px 12px',
                    background: designSystem.colors.primary[500],
                    color: 'white',
                    borderRadius: designSystem.borderRadius.md,
                    fontSize: designSystem.fontSize.bodySmall.mobile,
                    fontWeight: '500',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    touchAction: 'manipulation',
                    border: 'none',
                    minHeight: '36px',
                  }}
                >
                  {parseInt(m)}/{parseInt(d)}({weekday})
                  <span style={{ fontSize: '16px', fontWeight: 'bold' }}>×</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
