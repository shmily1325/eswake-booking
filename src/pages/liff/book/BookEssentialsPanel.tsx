import { triggerHaptic } from '../../../utils/haptic'
import { useBookLocale } from './BookLocaleContext'
import { FIRST_TIME_BIG_BOAT, FIRST_TIME_WB_SMALL } from './liffBookingPrices'
import { activitySegmentLabels } from './liffBookingI18n'
import { BookActivityIcon } from './BookActivityIcon'
import { BookSegmentCheck } from './BookSegmentCheck'
import { BookVideoPlayer } from './BookVideoPlayer'
import {
  bothSegmentBtn,
  includesTrustLine,
  selectionDetail,
  segmentBtn,
  segmentEn,
  segmentMeta,
  segmentPrice,
  segmentRow,
  segmentZh,
  step1Summary,
  stepInlineHint,
  summaryPriceLine,
} from './bookStyles'
import { BOOK_THEME as T, BOOK_TYPE as ty } from './bookTheme'
import type { ActivityChoice, ActivityCode } from './types'

interface BookEssentialsPanelProps {
  value: ActivityChoice | null
  onChange: (code: ActivityChoice | null) => void
  validationHint?: string | null
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

function cardPriceLine(
  code: ActivityCode,
  s: ReturnType<typeof useBookLocale>['s'],
  priceWS: string,
  priceWBSmall: string,
  priceWBBig: string,
): string {
  if (code === 'WS') return s.step1.cardPriceWS(priceWS)
  return s.step1.cardPriceWB(priceWBSmall, priceWBBig)
}

export function BookEssentialsPanel({
  value,
  onChange,
  validationHint = null,
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

  const showSelectedVideo = value === 'WS' || value === 'WB'
  const act = showSelectedVideo ? s.step1.activities[value] : null
  const bothSelected = value === 'BOTH'

  return (
    <>
      <div style={{ ...segmentRow, marginBottom: 0 }}>
        {CHOICES.map(code => {
          const selected = value === code
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
              {selected ? <BookSegmentCheck /> : null}
              {segmentIcon(code)}
              <div style={segmentZh}>{primary}</div>
              <div style={segmentEn}>{secondary}</div>
              <div style={segmentMeta}>{diff}</div>
              <div style={segmentPrice}>
                {cardPriceLine(code, s, priceWS, priceWBSmall, priceWBBig)}
              </div>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        className="book-segment-btn"
        style={bothSegmentBtn(bothSelected)}
        onClick={pickBoth}
        aria-pressed={bothSelected}
      >
        {bothSelected ? <BookSegmentCheck /> : null}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 6 }}>
          <BookActivityIcon code="WS" size={22} />
          <BookActivityIcon code="WB" size={22} />
        </div>
        <div style={segmentZh}>{s.step1.bothCardTitle}</div>
        <div style={segmentMeta}>{s.step1.bothSub}</div>
        <div style={segmentPrice}>{s.step1.cardPriceBoth(priceBoth)}</div>
      </button>

      {bothSelected ? (
        <div style={{ ...selectionDetail, marginTop: 10 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{s.step1.bothShort}</div>
          <div>{s.step1.bothNote}</div>
          <div style={{ marginTop: 4 }}>{s.step1.bothNoteAction}</div>
        </div>
      ) : null}

      {!value ? (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: ty.body, fontWeight: 600, color: T.inkSoft, marginBottom: 10, textAlign: 'center', lineHeight: 1.4 }}>
            {s.step1.videoSectionHeading}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {CHOICES.map(code => (
                <div key={code} style={{ flex: 1, minWidth: 0 }}>
                  <BookVideoPlayer
                    variant="compact"
                    videoId={code === 'WS' ? 'esgwXR0ikOU' : 'oHp8IeOvbdk'}
                    title={activitySegmentLabels(code, locale).secondary}
                    posterSrc={videoPoster(code).src}
                    posterSrcSet={`${videoPoster(code).src} 1x, ${videoPoster(code).src2x} 2x`}
                  />
                </div>
              ))}
          </div>
          <div style={{ fontSize: ty.caption, color: T.mutedLight, marginTop: 6, textAlign: 'center' }}>
            {s.step1.videoMandarinNote}
          </div>
        </div>
      ) : null}

      {showSelectedVideo && act ? (
        <div style={{ marginTop: 14 }}>
          <BookVideoPlayer
            variant="compact"
            videoId={value === 'WS' ? 'esgwXR0ikOU' : 'oHp8IeOvbdk'}
            title={act.labelEn}
            posterSrc={videoPoster(value).src}
            posterSrcSet={`${videoPoster(value).src} 1x, ${videoPoster(value).src2x} 2x`}
          />
          <div style={{ fontSize: ty.caption, color: T.mutedLight, marginTop: 6, textAlign: 'center' }}>
            {s.step1.videoMandarinNote}
          </div>
        </div>
      ) : null}

      {value ? (
        <div style={step1Summary}>
          <div style={summaryPriceLine}>{step1PriceLabel(value, s, priceWS, priceWBSmall, priceWBBig, priceBoth)}</div>
        </div>
      ) : null}

      <div style={{ ...includesTrustLine, marginTop: value ? 6 : 14 }}>
        {s.common.priceIncludes}
      </div>

      {validationHint ? (
        <div style={stepInlineHint} role="status">{validationHint}</div>
      ) : null}
    </>
  )
}
