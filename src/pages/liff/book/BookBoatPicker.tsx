import type { CSSProperties } from 'react'
import {
  STEP1_BOAT_COPY,
  STEP2_LARGE_GROUP_COPY,
  largeGroupBigLabel,
  largeGroupBigSub,
  largeGroupSmallSub,
} from './liffBookingBoats'
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
  marginBottom: 4,
}

const hint: CSSProperties = {
  fontSize: 10,
  color: '#999',
  marginBottom: 8,
}

const btn = (selected: boolean): CSSProperties => ({
  ...chipBtn(selected),
  flex: 1,
  padding: '10px 6px',
  textAlign: 'center',
  lineHeight: 1.3,
})

const capacityNote: CSSProperties = {
  fontSize: 10,
  color: '#aaa',
  textAlign: 'center',
  marginTop: 8,
  lineHeight: 1.45,
}

interface BookBoatPickerProps {
  /** step1：寬板選船；largeGroup：7 人以上安排 */
  variant: 'step1' | 'largeGroup'
  value: BoatPreference | null
  onChange: (pref: BoatPreference) => void
  headcount?: number
}

export function BookBoatPicker({ variant, value, onChange, headcount = 0 }: BookBoatPickerProps) {
  const isStep1 = variant === 'step1'
  const copy = isStep1 ? STEP1_BOAT_COPY : STEP2_LARGE_GROUP_COPY

  return (
    <div style={wrap}>
      <div style={label}>{copy.title}</div>
      {isStep1 ? <div style={hint}>{STEP1_BOAT_COPY.hint}</div> : null}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          style={btn(value === 'small')}
          onClick={() => onChange('small')}
          aria-pressed={value === 'small'}
        >
          <div style={{ fontSize: 12, fontWeight: 600 }}>
            {isStep1 ? '小船' : '2 艘小船'}
          </div>
          <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>
            {isStep1 ? STEP1_BOAT_COPY.smallSub : largeGroupSmallSub(headcount)}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>
            ${FIRST_TIME_WB_SMALL.toLocaleString()}
            <span style={{ fontSize: 10, fontWeight: 600 }}>／人</span>
          </div>
        </button>
        <button
          type="button"
          style={btn(value === 'big')}
          onClick={() => onChange('big')}
          aria-pressed={value === 'big'}
        >
          <div style={{ fontSize: 12, fontWeight: 600 }}>
            {isStep1 ? '大船' : largeGroupBigLabel(headcount)}
          </div>
          <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>
            {isStep1 ? STEP1_BOAT_COPY.bigSub : largeGroupBigSub(headcount)}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>
            ${FIRST_TIME_BIG_BOAT.toLocaleString()}
            <span style={{ fontSize: 10, fontWeight: 600 }}>／人</span>
          </div>
        </button>
      </div>
      {isStep1 ? <div style={capacityNote}>{STEP1_BOAT_COPY.capacityNote}</div> : null}
    </div>
  )
}
