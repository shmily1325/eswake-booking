import { BOAT_BIG_DUAL_MIN } from './liffBookingBoats'
import { FIRST_TIME_BIG_BOAT, FIRST_TIME_WB_SMALL } from './liffBookingPrices'
import { useBookLocale } from './BookLocaleContext'
import { BOAT_INTRO_VIDEO_ID } from './liffBookingReminders'
import { BookVideoPlayer } from './BookVideoPlayer'
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
  variant: 'step1' | 'largeGroup'
  value: BoatPreference | null
  onChange: (pref: BoatPreference) => void
  headcount?: number
}

export function BookBoatPicker({ variant, value, onChange, headcount = 0 }: BookBoatPickerProps) {
  const { locale, s } = useBookLocale()
  const boat = s.boat
  const isStep1 = variant === 'step1'
  const dualBig = headcount >= BOAT_BIG_DUAL_MIN

  const smallTitle = isStep1 ? boat.small : boat.twoSmallBoats
  const smallSub = isStep1
    ? boat.smallSub
    : dualBig ? boat.largeGroupSmallMax : boat.largeGroupSmallRange

  const bigTitle = isStep1 ? boat.big : dualBig ? boat.twoBigBoats : boat.big
  const bigSub = isStep1
    ? boat.bigSub
    : dualBig ? boat.largeGroupBigDual : boat.largeGroupBigSingle

  return (
    <div style={wrap}>
      <div style={label}>{isStep1 ? boat.step1Title : boat.largeGroupTitle}</div>
      {isStep1 ? <div style={hint}>{boat.step1Hint}</div> : null}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          className="book-chip-btn"
          style={btn(value === 'small')}
          onClick={() => onChange('small')}
          aria-pressed={value === 'small'}
        >
          <div style={{ fontSize: 12, fontWeight: 600 }}>{smallTitle}</div>
          <div style={{ fontSize: 10, color: value === 'small' ? 'rgba(255,255,255,0.8)' : '#888', marginTop: 2 }}>
            {smallSub}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
            ${FIRST_TIME_WB_SMALL.toLocaleString()}
            <span style={{ fontSize: 10, fontWeight: 600 }}>{boat.perPerson}</span>
          </div>
        </button>
        <button
          type="button"
          className="book-chip-btn"
          style={btn(value === 'big')}
          onClick={() => onChange('big')}
          aria-pressed={value === 'big'}
        >
          <div style={{ fontSize: 12, fontWeight: 600 }}>{bigTitle}</div>
          <div style={{ fontSize: 10, color: value === 'big' ? 'rgba(255,255,255,0.8)' : '#888', marginTop: 2 }}>
            {bigSub}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
            ${FIRST_TIME_BIG_BOAT.toLocaleString()}
            <span style={{ fontSize: 10, fontWeight: 600 }}>{boat.perPerson}</span>
          </div>
        </button>
      </div>
      {isStep1 ? <div style={capacityNote}>{boat.capacityNote}</div> : null}
      {isStep1 ? (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e8e8e8' }}>
          <BookVideoPlayer
            variant="compact"
            videoId={BOAT_INTRO_VIDEO_ID}
            title={boat.introVideoLabel}
            label={boat.introVideoLabel}
          />
          {locale === 'en' ? (
            <div style={{ fontSize: 10, color: '#aaa', marginTop: 6, textAlign: 'center' }}>
              {s.step1.videoMandarinNote}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
