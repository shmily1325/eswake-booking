import {
  STEP1_BOAT_COPY,
  STEP2_LARGE_GROUP_COPY,
  largeGroupBigLabel,
  largeGroupBigSub,
  largeGroupSmallSub,
} from './liffBookingBoats'
import { FIRST_TIME_BIG_BOAT, FIRST_TIME_WB_SMALL } from './liffBookingPrices'
import { chipBtn } from './bookStyles'
import { BOOK_THEME as T } from './bookTheme'
import type { BoatPreference } from './types'
import type { CSSProperties } from 'react'

const wrap: CSSProperties = {
  padding: '12px 14px',
  borderRadius: 14,
  background: T.surfaceMuted,
  border: '1px solid #e8e8e8',
}

const label: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: T.inkSoft,
  marginBottom: 4,
}

const hint: CSSProperties = {
  fontSize: 10,
  color: T.muted,
  marginBottom: 10,
}

const btn = (selected: boolean): CSSProperties => ({
  ...chipBtn(selected),
  flex: 1,
  padding: '12px 8px',
  textAlign: 'center',
  lineHeight: 1.3,
  borderRadius: 12,
})

const capacityNote: CSSProperties = {
  fontSize: 10,
  color: T.mutedLight,
  textAlign: 'center',
  marginTop: 10,
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
          className="book-chip-btn"
          style={btn(value === 'small')}
          onClick={() => onChange('small')}
          aria-pressed={value === 'small'}
        >
          <div style={{ fontSize: 12, fontWeight: 600 }}>
            {isStep1 ? '小船' : '2 艘小船'}
          </div>
          <div style={{ fontSize: 10, color: value === 'small' ? 'rgba(255,255,255,0.8)' : '#888', marginTop: 2 }}>
            {isStep1 ? STEP1_BOAT_COPY.smallSub : largeGroupSmallSub(headcount)}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
            ${FIRST_TIME_WB_SMALL.toLocaleString()}
            <span style={{ fontSize: 10, fontWeight: 600 }}>／人</span>
          </div>
        </button>
        <button
          type="button"
          className="book-chip-btn"
          style={btn(value === 'big')}
          onClick={() => onChange('big')}
          aria-pressed={value === 'big'}
        >
          <div style={{ fontSize: 12, fontWeight: 600 }}>
            {isStep1 ? '大船' : largeGroupBigLabel(headcount)}
          </div>
          <div style={{ fontSize: 10, color: value === 'big' ? 'rgba(255,255,255,0.8)' : '#888', marginTop: 2 }}>
            {isStep1 ? STEP1_BOAT_COPY.bigSub : largeGroupBigSub(headcount)}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
            ${FIRST_TIME_BIG_BOAT.toLocaleString()}
            <span style={{ fontSize: 10, fontWeight: 600 }}>／人</span>
          </div>
        </button>
      </div>
      {isStep1 ? <div style={capacityNote}>{STEP1_BOAT_COPY.capacityNote}</div> : null}
    </div>
  )
}
