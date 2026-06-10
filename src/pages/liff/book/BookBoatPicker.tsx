import { useState } from 'react'
import { BOAT_BIG_DUAL_MIN, BOAT_SMALL_DUAL_MIN } from './liffBookingBoats'
import { useBookLocale } from './BookLocaleContext'
import { BOAT_INTRO_VIDEO_ID } from './liffBookingReminders'
import { BookVideoPlayer } from './BookVideoPlayer'
import { boatTierDisplayPricing } from './liffBookingPrices'
import {
  fieldHint,
  fieldLabel,
  segmentBtn,
  segmentMeta,
  segmentPriceBlock,
  segmentPriceFirst,
  segmentPriceReturningAmount,
  segmentPriceReturningLabel,
  segmentPriceUnit,
  segmentRow,
  segmentZh,
} from './bookStyles'
import { BOOK_THEME as T, BOOK_TYPE as ty } from './bookTheme'
import type { BoatPreference } from './types'

interface BookBoatPickerProps {
  value: BoatPreference | null
  onChange: (pref: BoatPreference) => void
  aboard?: number
}

interface BoatSegmentPricing {
  firstTime: number
  sessionGuest: number
  sessionMember: number
}

function BoatSegmentButton({
  selected,
  title,
  seating,
  pricing,
  onSelect,
}: {
  selected: boolean
  title: string
  seating: string
  pricing: BoatSegmentPricing
  onSelect: () => void
}) {
  const { s } = useBookLocale()
  const boat = s.boat

  return (
    <button
      type="button"
      className="book-segment-btn"
      style={segmentBtn(selected)}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <div style={segmentZh}>{title}</div>
      <div style={segmentMeta}>{seating}</div>
      <div style={segmentPriceBlock}>
        <div style={segmentPriceFirst}>{boat.segmentFirstTimePrice(pricing.firstTime)}</div>
        <div style={segmentPriceReturningLabel}>{boat.segmentReturningLabel}</div>
        <div style={segmentPriceReturningAmount}>
          {boat.segmentReturningPrice(pricing.sessionGuest, pricing.sessionMember)}
        </div>
        <div style={segmentPriceUnit}>{boat.segmentPer20Min}</div>
      </div>
    </button>
  )
}

export function BookBoatPicker({ value, onChange, aboard = 0 }: BookBoatPickerProps) {
  const { locale, s } = useBookLocale()
  const boat = s.boat
  const smallPricing = boatTierDisplayPricing('small')
  const bigPricing = boatTierDisplayPricing('big')
  const needsDualContext = aboard >= BOAT_SMALL_DUAL_MIN
  const [videoOpen, setVideoOpen] = useState(false)

  const smallSeating = aboard >= BOAT_SMALL_DUAL_MIN ? boat.smallSeatingDual : boat.smallSeatingSingle
  const bigSeating = aboard >= BOAT_BIG_DUAL_MIN ? boat.bigSeatingDual : boat.bigSeatingSingle
  const videoToggleLabel = videoOpen
    ? (locale === 'zh' ? '收合船型介紹' : 'Hide boat intro')
    : boat.introVideoLabel

  return (
    <div>
      <div style={fieldLabel}>{boat.step1Title}</div>
      {needsDualContext ? (
        <div style={{ ...fieldHint, marginTop: 0, marginBottom: 4 }}>{boat.groupContext(aboard)}</div>
      ) : null}
      <div style={{ textAlign: 'center', marginBottom: 10 }}>
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
          {videoToggleLabel}
        </button>
      </div>
      {videoOpen ? (
        <div style={{ marginBottom: 12, paddingBottom: 12, borderTop: `1px solid ${T.borderSubtle}` }}>
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
      <div style={{ ...segmentRow, marginBottom: 0 }}>
        <BoatSegmentButton
          selected={value === 'small'}
          title={boat.small}
          seating={smallSeating}
          pricing={smallPricing}
          onSelect={() => onChange('small')}
        />
        <BoatSegmentButton
          selected={value === 'big'}
          title={boat.big}
          seating={bigSeating}
          pricing={bigPricing}
          onSelect={() => onChange('big')}
        />
      </div>
    </div>
  )
}
