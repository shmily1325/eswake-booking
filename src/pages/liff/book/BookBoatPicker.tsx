import type { CSSProperties } from 'react'
import { FIRST_TIME_BIG_BOAT, FIRST_TIME_WB_SMALL } from './liffBookingPrices'
import { chipBtn } from './bookStyles'
import type { BoatPreference } from './types'

const wrap: CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  background: '#f7f7f7',
  border: '1px solid #ececec',
}

const label: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#444',
  marginBottom: 8,
}

const btn = (selected: boolean): CSSProperties => ({
  ...chipBtn(selected),
  flex: 1,
  padding: '10px 6px',
  textAlign: 'center',
  lineHeight: 1.3,
})

interface BookBoatPickerProps {
  /** step1：寬板選船；largeGroup：7 人以上安排 */
  variant: 'step1' | 'largeGroup'
  value: BoatPreference | null
  onChange: (pref: BoatPreference) => void
}

export function BookBoatPicker({ variant, value, onChange }: BookBoatPickerProps) {
  const title = variant === 'step1' ? '坐什麼船？' : '7 人以上怎麼安排？'

  return (
    <div style={wrap}>
      <div style={label}>{title}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          style={btn(value === 'small')}
          onClick={() => onChange('small')}
          aria-pressed={value === 'small'}
        >
          <div style={{ fontSize: 12, fontWeight: 600 }}>
            {variant === 'largeGroup' ? '2 艘小船' : '小船'}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>
            ${FIRST_TIME_WB_SMALL.toLocaleString()}
          </div>
        </button>
        <button
          type="button"
          style={btn(value === 'big')}
          onClick={() => onChange('big')}
          aria-pressed={value === 'big'}
        >
          <div style={{ fontSize: 12, fontWeight: 600 }}>大船</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>
            ${FIRST_TIME_BIG_BOAT.toLocaleString()}
          </div>
        </button>
      </div>
    </div>
  )
}
