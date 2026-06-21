import { useMemo, useState } from 'react'
import { triggerHaptic } from '../../../utils/haptic'
import { useBookLocale } from './BookLocaleContext'
import { fieldHint } from './bookStyles'
import { getVenueDateString } from '../../../utils/date'
import {
  bookingLastDate,
  buildMonthGrid,
  classifyBookingDate,
  monthBookability,
} from './liffBookingDates'
import { BOOK_TYPE as ty } from './bookTheme'

interface BookDateCalendarProps {
  value: string
  blockedDates: Set<string>
  onChange: (ymd: string) => void
}

const WEEK_HEADER_EN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const
const WEEK_HEADER_ZH = ['日', '一', '二', '三', '四', '五', '六'] as const

export function BookDateCalendar({ value, blockedDates, onChange }: BookDateCalendarProps) {
  const { locale, s } = useBookLocale()
  const cal = s.step3.calendar
  const weekHeader = locale === 'en' ? WEEK_HEADER_EN : WEEK_HEADER_ZH

  const todayStr = useMemo(() => getVenueDateString(), [])
  const [viewYear, setViewYear] = useState(() => {
    if (value) {
      const [y] = value.split('-').map(Number)
      return y
    }
    const [y] = todayStr.split('-').map(Number)
    return y
  })
  const [viewMonth, setViewMonth] = useState(() => {
    if (value) {
      const [, m] = value.split('-').map(Number)
      return m - 1
    }
    const [, m] = todayStr.split('-').map(Number)
    return m - 1
  })

  const bookability = monthBookability(viewYear, viewMonth, todayStr)
  const grid = buildMonthGrid(viewYear, viewMonth)
  const lastBookable = bookingLastDate(todayStr).replace(/-/g, '/')

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1)
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }

  const canPrev = monthBookability(
    viewMonth === 0 ? viewYear - 1 : viewYear,
    viewMonth === 0 ? 11 : viewMonth - 1,
    todayStr,
  ) !== 'past'

  const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1
  const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear
  const canNext = monthBookability(nextYear, nextMonth, todayStr) !== 'closed'

  const pick = (ymd: string) => {
    const status = classifyBookingDate(ymd, blockedDates, todayStr)
    if (status !== 'open') return
    triggerHaptic('light')
    onChange(ymd)
  }

  const statusTitle = (status: ReturnType<typeof classifyBookingDate>) => {
    if (status === 'closed') return cal.closed
    if (status === 'blocked') return cal.blocked
    if (status === 'past') return cal.past
    return undefined
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
          aria-label={cal.prevMonth}
        >
          ‹
        </button>
        <div style={{ fontSize: ty.title, fontWeight: 700, color: '#222' }}>
          {cal.monthLabel(viewYear, viewMonth)}
        </div>
        <button
          type="button"
          disabled={!canNext}
          onClick={() => shiftMonth(1)}
          style={navBtn(!canNext)}
          aria-label={cal.nextMonth}
        >
          ›
        </button>
      </div>

      {bookability === 'closed' && (
        <div style={{
          fontSize: ty.caption,
          color: '#888',
          textAlign: 'center',
          padding: '10px 8px',
          marginBottom: 8,
          background: '#f5f5f5',
          borderRadius: 10,
        }}>
          {cal.notOpen}
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 4,
        textAlign: 'center',
      }}>
        {weekHeader.map((wd, i) => (
          <div key={`${wd}-${i}`} style={{ fontSize: ty.caption, fontWeight: 600, color: '#999', padding: '4px 0' }}>
            {wd}
          </div>
        ))}
        {grid.map((cell, idx) => {
          if (!cell.ymd) {
            return <div key={`empty-${idx}`} />
          }
          const status = classifyBookingDate(cell.ymd, blockedDates, todayStr)
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
                fontSize: ty.body,
                fontWeight: selected ? 700 : 500,
                cursor: disabled ? 'not-allowed' : 'pointer',
                padding: 0,
              }}
              title={statusTitle(status)}
            >
              {dayNum}
            </button>
          )
        })}
      </div>

      <div style={{ ...fieldHint, marginTop: 10, textAlign: 'center' }}>
        {cal.bookUntil(lastBookable)}
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
