import { triggerHaptic } from '../../../utils/haptic'
import { useBookLocale } from './BookLocaleContext'
import { FIRST_TIME_BIG_BOAT, FIRST_TIME_WB_SMALL } from './liffBookingPrices'
import { activitySegmentLabels } from './liffBookingI18n'
import { BookActivityIcon } from './BookActivityIcon'
import { BookVideoPlayer } from './BookVideoPlayer'
import {
  bookFieldGroup,
  includesTrustLine,
  selectionDetail,
  summaryPriceLine,
  segmentBtn,
  segmentEn,
  segmentMeta,
  segmentRow,
  segmentZh,
  step1Summary,
} from './bookStyles'
import { BOOK_THEME as T, BOOK_TYPE as ty } from './bookTheme'
import type { ActivityChoice, ActivityCode } from './types'

interface BookEssentialsPanelProps {
  value: ActivityChoice | null
  onChange: (code: ActivityChoice | null) => void
}

const CHOICES: ActivityCode[] = ['WS', 'WB']

function videoPoster(code: ActivityCode) {
  const base = code === 'WS' ? '/liff/book/ws-poster' : '/liff/book/wb-poster'
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
  priceWBSmall: string,
  priceWBBig: string,
  priceBoth: string,
): string {
  if (activity === 'WS') return s.step1.priceWS(priceWS)
  if (activity === 'WB') return s.step1.priceWBDual(priceWBSmall, priceWBBig)
  return s.step1.bothPrice(priceBoth)
}

export function BookEssentialsPanel({
  value,
  onChange,
}: BookEssentialsPanelProps) {
  const { locale, s } = useBookLocale()
  const priceWS = `$${FIRST_TIME_BIG_BOAT.toLocaleString()}`
  const priceWBSmall = `$${FIRST_TIME_WB_SMALL.toLocaleString()}`
  const priceWBBig = `$${FIRST_TIME_BIG_BOAT.toLocaleString()}`
  const priceBoth = `$${FIRST_TIME_BIG_BOAT.toLocaleString()}`

  const pickSingle = (code: ActivityCode) => {
    triggerHaptic('light')
    onChange(code)
  }

  const pickBoth = () => {
    triggerHaptic('light')
    onChange('BOTH')
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
              onClick={() => pickSingle(code)}
              aria-pressed={selected}
            >
              {segmentIcon(code)}
              <div style={segmentZh}>{primary}</div>
              <div style={segmentEn}>{secondary}</div>
              <div style={segmentMeta}>{diff}</div>
            </button>
          )
        })}
      </div>

      {value === 'WS' || value === 'WB' ? (
        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <button
            type="button"
            onClick={pickBoth}
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
            {s.step1.mixedToggle}
          </button>
        </div>
      ) : null}

      {value === 'BOTH' ? (
        <div style={selectionDetail}>
          <div>{s.step1.bothNote}</div>
          <div style={{ marginTop: 4 }}>{s.step1.bothNoteAction}</div>
        </div>
      ) : null}

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
          <div style={summaryPriceLine}>{step1PriceLabel(value, s, priceWS, priceWBSmall, priceWBBig, priceBoth)}</div>
          <div style={includesTrustLine}>{s.common.priceIncludes}</div>
        </div>
      ) : null}

    </div>
  )
}
