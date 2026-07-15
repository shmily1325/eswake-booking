import type { CSSProperties } from 'react'
import { designSystem, getFontSize } from '../../styles/designSystem'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const

function getMonthCells(month: string): Array<string | null> {
  const [year, monthNumber] = month.split('-').map(Number)
  const firstWeekday = new Date(year, monthNumber - 1, 1).getDay()
  const dayCount = new Date(year, monthNumber, 0).getDate()
  const cells: Array<string | null> = Array.from({ length: firstWeekday }, () => null)

  for (let day = 1; day <= dayCount; day += 1) {
    cells.push(`${year}-${String(monthNumber).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function TimeOffBatchCalendar({
  month,
  onMonthChange,
  draftDateLabels,
  existingDateLabels,
  onToggleDate,
}: {
  month: string
  onMonthChange: (month: string) => void
  draftDateLabels: Map<string, string>
  existingDateLabels: Map<string, string>
  onToggleDate: (date: string) => void
}) {
  const cells = getMonthCells(month)
  const cellBase: CSSProperties = {
    minWidth: 0,
    minHeight: '52px',
    padding: '6px 3px',
    border: `1px solid ${designSystem.colors.border.light}`,
    borderRadius: designSystem.borderRadius.md,
    background: designSystem.colors.background.card,
    color: designSystem.colors.text.primary,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '3px',
  }

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        marginBottom: '10px',
      }}>
        <span style={{ fontSize: getFontSize('body', false), fontWeight: 600 }}>
          選擇日期
        </span>
        <input
          type="month"
          value={month}
          onChange={event => {
            if (event.target.value) onMonthChange(event.target.value)
          }}
          style={{
            padding: '7px 9px',
            border: `1px solid ${designSystem.colors.border.light}`,
            borderRadius: designSystem.borderRadius.md,
            background: designSystem.colors.background.card,
            fontSize: '15px',
          }}
        />
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
        gap: '5px',
      }}>
        {WEEKDAYS.map((weekday, index) => (
          <div
            key={weekday}
            style={{
              padding: '3px 0',
              textAlign: 'center',
              color: index === 0 || index === 6
                ? designSystem.colors.text.disabled
                : designSystem.colors.text.secondary,
              fontSize: getFontSize('caption', false),
              fontWeight: 600,
            }}
          >
            {weekday}
          </div>
        ))}

        {cells.map((date, index) => {
          if (!date) return <div key={`empty-${index}`} aria-hidden />

          const draftLabel = draftDateLabels.get(date)
          const selected = Boolean(draftLabel)
          const existingLabel = existingDateLabels.get(date)
          const disabled = Boolean(existingLabel)
          const day = Number(date.slice(-2))

          return (
            <button
              key={date}
              type="button"
              data-track="staff_time_off_batch_date"
              aria-pressed={selected}
              disabled={disabled}
              title={disabled
                ? `已有休假：${existingLabel}`
                : draftLabel
                  ? `本次設定：${draftLabel}`
                  : '點一下套用目前時段'}
              onClick={() => onToggleDate(date)}
              style={{
                ...cellBase,
                borderColor: selected
                  ? designSystem.colors.warning[500]
                  : designSystem.colors.border.light,
                background: selected
                  ? designSystem.colors.warning[50]
                  : disabled
                    ? designSystem.colors.background.main
                    : designSystem.colors.background.card,
                color: selected
                  ? designSystem.colors.warning[700]
                  : disabled
                    ? designSystem.colors.text.disabled
                    : designSystem.colors.text.primary,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.72 : 1,
                boxShadow: selected ? `inset 0 0 0 1px ${designSystem.colors.warning[500]}` : 'none',
              }}
            >
              <span style={{ fontSize: getFontSize('body', false), fontWeight: selected ? 700 : 600 }}>
                {day}
              </span>
              <span style={{
                minHeight: '12px',
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: '10px',
                lineHeight: 1.1,
              }}>
                {draftLabel || existingLabel || ''}
              </span>
            </button>
          )
        })}
      </div>

      <div style={{
        marginTop: '8px',
        color: designSystem.colors.text.secondary,
        fontSize: getFontSize('caption', false),
        lineHeight: 1.5,
      }}>
        先選時段，再點日期套用；切換時段後可繼續選其他日期。同一日期再點一次即可取消，灰色日期請從列表編輯。
      </div>
    </div>
  )
}
