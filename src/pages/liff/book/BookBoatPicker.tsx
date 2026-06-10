import { useState } from 'react'
import { BOAT_BIG_DUAL_MIN } from './liffBookingBoats'
import { useBookLocale } from './BookLocaleContext'
import { BOAT_INTRO_VIDEO_ID } from './liffBookingReminders'
import { BookVideoPlayer } from './BookVideoPlayer'
import { chipBtn } from './bookStyles'
import { BOOK_THEME as T, BOOK_TYPE as ty } from './bookTheme'
import type { BoatPreference } from './types'
import type { CSSProperties } from 'react'

const wrap: CSSProperties = {
  padding: '12px 14px',
  borderRadius: 14,
  background: T.surfaceMuted,
  border: '1px solid #e8e8e8',
}

const label: CSSProperties = {
  fontSize: ty.body,
  fontWeight: 600,
  color: T.inkSoft,
  marginBottom: 4,
}

const hint: CSSProperties = {
  fontSize: ty.caption,
  color: T.muted,
  marginBottom: 10,
  lineHeight: 1.45,
}

const btn = (selected: boolean): CSSProperties => ({
  ...chipBtn(selected),
  flex: 1,
  padding: '12px 8px',
  textAlign: 'center',
  lineHeight: 1.35,
  borderRadius: 12,
})

const capacityNote: CSSProperties = {
  fontSize: ty.caption,
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
  const [videoOpen, setVideoOpen] = useState(false)

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
          <div style={{ fontSize: ty.body, fontWeight: 600 }}>{smallTitle}</div>
          <div style={{ fontSize: ty.caption, color: value === 'small' ? 'rgba(255,255,255,0.85)' : '#888', marginTop: 3 }}>
            {smallSub}
          </div>
        </button>
        <button
          type="button"
          className="book-chip-btn"
          style={btn(value === 'big')}
          onClick={() => onChange('big')}
          aria-pressed={value === 'big'}
        >
          <div style={{ fontSize: ty.body, fontWeight: 600 }}>{bigTitle}</div>
          <div style={{ fontSize: ty.caption, color: value === 'big' ? 'rgba(255,255,255,0.85)' : '#888', marginTop: 3 }}>
            {bigSub}
          </div>
        </button>
      </div>
      {isStep1 ? <div style={capacityNote}>{boat.capacityNote}</div> : null}
      {isStep1 ? (
        <div style={{ marginTop: 10 }}>
          <button
            type="button"
            onClick={() => setVideoOpen(v => !v)}
            style={{
              padding: 0,
              border: 'none',
              background: 'none',
              color: T.muted,
              fontSize: ty.caption,
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            {videoOpen ? '收合船型介紹' : boat.introVideoLabel}
          </button>
          {videoOpen ? (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #e8e8e8' }}>
              <BookVideoPlayer
                variant="compact"
                videoId={BOAT_INTRO_VIDEO_ID}
                title={boat.introVideoLabel}
                label={boat.introVideoLabel}
              />
              {locale === 'en' ? (
                <div style={{ fontSize: ty.caption, color: '#aaa', marginTop: 6, textAlign: 'center' }}>
                  {s.step1.videoMandarinNote}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
