import { triggerHaptic } from '../../../utils/haptic'
import { useBookLocale } from './BookLocaleContext'
import { LIFF_BOOK_GUEST_PRICING_ONLY, toggleActivitySelection } from './liffBookingConfig'
import { FIRST_TIME_BIG_BOAT, FIRST_TIME_WB_SMALL } from './liffBookingPrices'
import { activitySegmentLabels } from './liffBookingI18n'
import { BookActivityIcon } from './BookActivityIcon'
import { BookVideoPlayer } from './BookVideoPlayer'
import {
  bookFieldGroup,
  includesTrustLine,
  summaryPriceLine,
  segmentBtn,
  segmentCheck,
  segmentEn,
  segmentMeta,
  segmentRow,
  segmentZh,
  step1Summary,
} from './bookStyles'
import { BOOK_TYPE as ty } from './bookTheme'
import type { ActivityChoice, ActivityCode } from './types'

interface BookEssentialsPanelProps {
  memberRate?: boolean
  value: ActivityChoice | null
  onChange: (code: ActivityChoice | null) => void
}

const CHOICES: ActivityCode[] = ['WS', 'WB']

function videoPoster(code: ActivityCode) {
  const base = code === 'WS' ? '/liff/book/ws-thumb' : '/liff/book/wb-thumb'
  return { src: `${base}.webp`, src2x: `${base}@2x.webp` }
}

function segmentIcon(code: ActivityCode) {
  return (
    <BookActivityIcon
      code={code}
      size={26}
      style={{ margin: '0 auto 6px' }}
    />
  )
}

function step1PriceLabel(
  activity: ActivityChoice,
  s: ReturnType<typeof useBookLocale>['s'],
  priceWS: string,
  priceWB: string,
  priceBoth: string,
): string {
  if (activity === 'WS') return s.step1.priceWS(priceWS)
  if (activity === 'WB') return s.step1.priceWBFrom(priceWB)
  return s.step1.bothPrice(priceBoth)
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

  const toggle = (code: ActivityCode) => {
    triggerHaptic('light')
    onChange(toggleActivitySelection(value, code))
  }

  const showVideo = value === 'WS' || value === 'WB'
  const act = showVideo ? s.step1.activities[value] : null

  return (
    <div style={bookFieldGroup}>
      <div style={{ ...segmentRow, marginBottom: 0 }}>
        {CHOICES.map(code => {
          const selected = value === code || value === 'BOTH'
          const { primary, secondary } = activitySegmentLabels(code, locale)
          const diff = code === 'WS' ? s.step1.diffWS : s.step1.diffWB
          return (
            <button
              key={code}
              type="button"
              className="book-segment-btn"
              style={segmentBtn(selected)}
              onClick={() => toggle(code)}
              aria-pressed={selected}
            >
              {selected ? <span style={segmentCheck} aria-hidden>✓</span> : null}
              {segmentIcon(code)}
              <div style={segmentZh}>{primary}</div>
              <div style={segmentEn}>{secondary}</div>
              <div style={segmentMeta}>{diff}</div>
            </button>
          )
        })}
      </div>

      {showVideo && act ? (
        <div style={{ marginTop: 14 }}>
          <BookVideoPlayer
            variant="compact"
            videoId={value === 'WS' ? 'esgwXR0ikOU' : 'oHp8IeOvbdk'}
            title={act.labelEn}
            posterSrc={videoPoster(value).src}
            posterSrcSet={`${videoPoster(value).src} 1x, ${videoPoster(value).src2x} 2x`}
          />
          <div style={{ fontSize: ty.caption, color: '#aaa', marginTop: 6, textAlign: 'center' }}>
            {s.step1.videoMandarinNote}
          </div>
        </div>
      ) : null}

      {value ? (
        <div style={step1Summary}>
          <div style={summaryPriceLine}>{step1PriceLabel(value, s, priceWS, priceWB, priceBoth)}</div>
          <div style={includesTrustLine}>{s.common.priceIncludes}</div>
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
