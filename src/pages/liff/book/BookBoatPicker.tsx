import { BOAT_BIG_DUAL_MIN, BOAT_SMALL_DUAL_MIN } from './liffBookingBoats'
import { BookSegmentCheck } from './BookSegmentCheck'
import { useBookLocale } from './BookLocaleContext'
import { BOAT_INTRO_VIDEO_ID } from './liffBookingReminders'
import { BookVideoPlayer } from './BookVideoPlayer'
import { boatTierDisplayPricing } from './liffBookingPrices'
import {
  segmentBtn,
  segmentMeta,
  segmentPriceBlock,
  segmentPriceFirst,
  segmentPriceMemberNote,
  segmentPriceReturningLine,
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
      {selected ? <BookSegmentCheck /> : null}
      <div style={segmentZh}>{title}</div>
      <div style={segmentMeta}>{seating}</div>
      <div style={segmentPriceBlock}>
        <div style={segmentPriceFirst}>{boat.segmentFirstTimePrice(pricing.firstTime)}</div>
        <div style={segmentPriceReturningLine}>
          {boat.segmentReturningLine(pricing.sessionGuest)}
        </div>
        <div style={segmentPriceMemberNote}>
          {boat.segmentMemberNote(pricing.sessionMember)}
        </div>
      </div>
    </button>
  )
}

export function BookBoatPicker({ value, onChange, aboard = 0 }: BookBoatPickerProps) {
  const { locale, s } = useBookLocale()
  const boat = s.boat
  const smallPricing = boatTierDisplayPricing('small')
  const bigPricing = boatTierDisplayPricing('big')
  const smallSeating = aboard >= BOAT_SMALL_DUAL_MIN ? boat.smallSeatingDual : boat.smallSeatingSingle
  const bigSeating = aboard >= BOAT_BIG_DUAL_MIN ? boat.bigSeatingDual : boat.bigSeatingSingle

  return (
    <div>
      <div
        style={{
          textAlign: 'center',
          marginBottom: 10,
          color: T.muted,
          fontSize: ty.caption,
          fontWeight: 500,
        }}
      >
        {boat.introVideoLabel}
      </div>
      <div style={{ marginBottom: 12 }}>
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
