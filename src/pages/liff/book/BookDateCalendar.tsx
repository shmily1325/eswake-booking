import { useMemo, useState } from 'react'
import { triggerHaptic } from '../../../utils/haptic'
import { fieldHint } from './bookStyles'
import {
  bookingLastDate,
  buildMonthGrid,
  classifyBookingDate,
  monthBookability,
  monthLabel,
} from './liffBookingDates'

interface BookDateCalendarProps {
  value: string
  blockedDates: Set<string>
  onChange: (ymd: string) => void
}

const WEEK_HEADER = ['日', '一', '二', '三', '四', '五', '六'] as const

export function BookDateCalendar({ value, blockedDates, onChange }: BookDateCalendarProps) {
  const today = useMemo(() => new Date(), [])
  const [viewYear, setViewYear] = useState(() => {
    const base = value ? new Date(`${value}T12:00:00`) : today
    return base.getFullYear()
  })
  const [viewMonth, setViewMonth] = useState(() => {
    const base = value ? new Date(`${value}T12:00:00`) : today
    return base.getMonth()
  })

  const bookability = monthBookability(viewYear, viewMonth, today)
  const grid = buildMonthGrid(viewYear, viewMonth)
  const lastBookable = bookingLastDate(today)

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1)
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }

  const canPrev = monthBookability(
    viewMonth === 0 ? viewYear - 1 : viewYear,
    viewMonth === 0 ? 11 : viewMonth - 1,
    today,
  ) !== 'past'

  const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1
  const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear
  const canNext = monthBookability(nextYear, nextMonth, today) !== 'closed'

  const pick = (ymd: string) => {
    const status = classifyBookingDate(ymd, blockedDates, today)
    if (status !== 'open') return
    triggerHaptic('light')
    onChange(ymd)
  }

  return (
    <div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => shiftMonth(-1)}
          style={navBtn(!canPrev)}
          aria-label="上個月"
        >
          ‹
        </button>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#222' }}>
          {monthLabel(viewYear, viewMonth)}
        </div>
        <button
          type="button"
          disabled={!canNext}
          onClick={() => shiftMonth(1)}
          style={navBtn(!canNext)}
          aria-label="下個月"
        >
          ›
        </button>
      </div>

      {bookability === 'closed' && (
        <div style={{
          fontSize: 12,
          color: '#888',
          textAlign: 'center',
          padding: '10px 8px',
          marginBottom: 8,
          background: '#f5f5f5',
          borderRadius: 10,
        }}>
          尚未開放預約
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 4,
        textAlign: 'center',
      }}>
        {WEEK_HEADER.map(wd => (
          <div key={wd} style={{ fontSize: 11, fontWeight: 600, color: '#999', padding: '4px 0' }}>
            {wd}
          </div>
        ))}
        {grid.map((cell, idx) => {
          if (!cell.ymd) {
            return <div key={`empty-${idx}`} />
          }
          const status = classifyBookingDate(cell.ymd, blockedDates, today)
          const selected = value === cell.ymd
          const dayNum = Number(cell.ymd.slice(-2))
          const disabled = status !== 'open'

          return (
            <button
              key={cell.ymd}
              type="button"
              disabled={disabled}
              onClick={() => pick(cell.ymd!)}
              style={{
                aspectRatio: '1',
                minHeight: 40,
                border: selected ? '2px solid #4a4a4a' : '1px solid #e8e8e8',
                borderRadius: 10,
                background: selected ? '#4a4a4a' : disabled ? '#fafafa' : '#fff',
                color: selected ? '#fff' : disabled ? '#ccc' : '#333',
                fontSize: 14,
                fontWeight: selected ? 700 : 500,
                cursor: disabled ? 'not-allowed' : 'pointer',
                padding: 0,
              }}
              title={
                status === 'closed' ? '尚未開放' :
                status === 'blocked' ? '不可預約' :
                status === 'past' ? '已過期' : undefined
              }
            >
              {dayNum}
            </button>
          )
        })}
      </div>

      <div style={{ ...fieldHint, marginTop: 10, textAlign: 'center' }}>
        可預約至 {lastBookable.replace(/-/g, '/')}
      </div>
    </div>
  )
}

function navBtn(disabled: boolean) {
  return {
    width: 36,
    height: 36,
    border: '1px solid #ddd',
    borderRadius: 10,
    background: disabled ? '#f5f5f5' : '#fff',
    color: disabled ? '#ccc' : '#444',
    fontSize: 20,
    lineHeight: 1,
    cursor: disabled ? 'not-allowed' as const : 'pointer' as const,
  }
}
