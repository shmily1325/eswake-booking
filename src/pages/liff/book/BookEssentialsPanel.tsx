import { triggerHaptic } from '../../../utils/haptic'
import { useBookLocale } from './BookLocaleContext'
import { LIFF_BOOK_GUEST_PRICING_ONLY, STEP1_ACTIVITY_CHOICES } from './liffBookingConfig'
import { FIRST_TIME_BIG_BOAT, FIRST_TIME_WB_SMALL } from './liffBookingPrices'
import { activitySegmentLabels } from './liffBookingI18n'
import { BookActivityIcon } from './BookActivityIcon'
import { BookVideoPlayer } from './BookVideoPlayer'
import {
  bookFieldGroup,
  bothSegmentBtn,
  includesTrustLine,
  segmentBtn,
  segmentEn,
  segmentMeta,
  segmentPrice,
  segmentRow,
  segmentZh,
} from './bookStyles'
import { BOOK_TYPE as ty } from './bookTheme'
import type { ActivityChoice, ActivityCode } from './types'

interface BookEssentialsPanelProps {
  memberRate?: boolean
  value: ActivityChoice | null
  onChange: (code: ActivityChoice) => void
}

const SINGLE_CHOICES = STEP1_ACTIVITY_CHOICES.filter(c => c.code !== 'BOTH')

function videoPoster(code: ActivityCode) {
  const base = code === 'WS' ? '/liff/book/ws-thumb' : '/liff/book/wb-thumb'
  return { src: `${base}.webp`, src2x: `${base}@2x.webp` }
}

function segmentIcon(code: ActivityChoice) {
  return (
    <BookActivityIcon
      code={code as ActivityCode}
      size={26}
      style={{ margin: '0 auto 6px' }}
    />
  )
}

export function BookEssentialsPanel({
  memberRate = false,
  value,
  onChange,
}: BookEssentialsPanelProps) {
  const { locale, s } = useBookLocale()
  const priceWS = `$${FIRST_TIME_BIG_BOAT.toLocaleString()}`
  const priceWB = `$${FIRST_TIME_WB_SMALL.toLocaleString()}`
  const priceBoth = `$${FIRST_TIME_BIG_BOAT.toLocaleString()}`

  const pick = (code: ActivityChoice) => {
    triggerHaptic('light')
    onChange(code)
  }

  const active = value
  const showVideo = active === 'WS' || active === 'WB'
  const act = showVideo ? s.step1.activities[active] : null

  return (
    <div style={bookFieldGroup}>
      <div style={segmentRow}>
        {SINGLE_CHOICES.map(choice => {
          const selected = value === choice.code
          const { primary, secondary } = activitySegmentLabels(choice.code, locale)
          const diff = choice.code === 'WS' ? s.step1.diffWS : s.step1.diffWB
          const priceLabel = choice.code === 'WS'
            ? s.step1.priceWS(priceWS)
            : s.step1.priceWBFrom(priceWB)
          return (
            <button
              key={choice.code}
              type="button"
              className="book-segment-btn"
              style={segmentBtn(selected)}
              onClick={() => pick(choice.code)}
              aria-pressed={selected}
            >
              {segmentIcon(choice.code)}
              <div style={segmentZh}>{primary}</div>
              <div style={segmentEn}>{secondary}</div>
              <div style={segmentMeta}>{diff}</div>
              <div style={segmentPrice}>{priceLabel}</div>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        className="book-segment-btn"
        style={bothSegmentBtn(value === 'BOTH')}
        onClick={() => pick('BOTH')}
        aria-pressed={value === 'BOTH'}
      >
        <div style={{ fontSize: ty.body, fontWeight: 700, color: '#222' }}>{s.step1.bothLabel}</div>
        <div style={{ ...segmentMeta, marginTop: 4 }}>{s.step1.bothSub}</div>
        <div style={{ ...segmentPrice, marginTop: 6 }}>{s.step1.bothPrice(priceBoth)}</div>
      </button>

      <div style={includesTrustLine}>{s.common.priceIncludes}</div>

      {showVideo && act ? (
        <div style={{ marginTop: 14 }}>
          <BookVideoPlayer
            variant="compact"
            videoId={active === 'WS' ? 'esgwXR0ikOU' : 'oHp8IeOvbdk'}
            title={act.labelEn}
            posterSrc={videoPoster(active).src}
            posterSrcSet={`${videoPoster(active).src} 1x, ${videoPoster(active).src2x} 2x`}
          />
          <div style={{ fontSize: ty.caption, color: '#aaa', marginTop: 6, textAlign: 'center' }}>
            {s.step1.videoMandarinNote}
          </div>
        </div>
      ) : null}

      {!LIFF_BOOK_GUEST_PRICING_ONLY && memberRate ? (
        <div style={{ fontSize: ty.caption, color: '#aaa', marginTop: 10, textAlign: 'center' }}>
          {s.step1.memberRateApplied}
        </div>
      ) : null}
    </div>
  )
}
