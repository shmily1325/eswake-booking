import { triggerHaptic } from '../../../utils/haptic'
import { useBookLocale } from './BookLocaleContext'
import { LIFF_BOOK_GUEST_PRICING_ONLY, STEP1_ACTIVITY_CHOICES } from './liffBookingConfig'
import { FIRST_TIME_BIG_BOAT, FIRST_TIME_WB_SMALL } from './liffBookingPrices'
import { activityDetailTitle, activitySegmentLabels } from './liffBookingI18n'
import { step1ActivityChip } from './liffBookingBoats'
import { BookActivityIcon, BookBothIcons } from './BookActivityIcon'
import { BookVideoPlayer } from './BookVideoPlayer'
import {
  bookFieldGroup,
  detailPanel,
  metaChip,
  priceBanner,
  priceLine,
  segmentBtn,
  segmentEn,
  segmentRow,
  segmentZh,
} from './bookStyles'
import { BOOK_THEME as T, BOOK_TYPE as ty } from './bookTheme'
import type { ActivityChoice, ActivityCode } from './types'

interface BookEssentialsPanelProps {
  memberRate?: boolean
  value: ActivityChoice | null
  onChange: (code: ActivityChoice) => void
}

function selectedPrice(code: ActivityChoice, perPerson: string, rangeSep: string): string | null {
  if (code === 'WS' || code === 'BOTH') return `$${FIRST_TIME_BIG_BOAT.toLocaleString()}${perPerson}`
  if (code === 'WB') {
    return `$${FIRST_TIME_WB_SMALL.toLocaleString()}${rangeSep}$${FIRST_TIME_BIG_BOAT.toLocaleString()}${perPerson}`
  }
  return null
}

function segmentIcon(code: ActivityChoice) {
  if (code === 'BOTH') {
    return <BookBothIcons size={26} gap={4} style={{ margin: '0 auto 8px' }} />
  }
  return (
    <BookActivityIcon
      code={code}
      size={28}
      style={{ margin: '0 auto 8px' }}
    />
  )
}

function videoPoster(code: ActivityCode) {
  const base = code === 'WS' ? '/liff/book/ws-thumb' : '/liff/book/wb-thumb'
  return { src: `${base}.webp`, src2x: `${base}@2x.webp` }
}

export function BookEssentialsPanel({
  memberRate = false,
  value,
  onChange,
}: BookEssentialsPanelProps) {
  const { locale, s } = useBookLocale()

  const pick = (code: ActivityChoice) => {
    triggerHaptic('light')
    onChange(code)
  }

  const perPerson = s.boat.perPerson
  const rangeSep = locale === 'en' ? '–' : '～'
  const priceRange = s.step1.priceBannerRange(FIRST_TIME_WB_SMALL, FIRST_TIME_BIG_BOAT)

  const active = value
  const chipLabel = active ? step1ActivityChip(active, locale) : null
  const price = active ? selectedPrice(active, perPerson, rangeSep) ?? null : null
  const act = active ? s.step1.activities[active] : null

  return (
    <>
      <div style={{ ...priceBanner, marginBottom: 0 }}>{priceRange}</div>

      <div style={{ ...bookFieldGroup, marginTop: 12 }}>
        <div style={{ ...segmentRow, marginBottom: 14 }}>
          {STEP1_ACTIVITY_CHOICES.map(choice => {
            const selected = value === choice.code
            const { primary, secondary } = activitySegmentLabels(choice.code, locale)
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
              </button>
            )
          })}
        </div>

        {active && act ? (
          <div style={detailPanel(true)}>
            <div style={{ fontSize: ty.title, fontWeight: 700, color: T.ink }}>
              {activityDetailTitle(active, locale)}
            </div>
            {chipLabel ? <span style={metaChip}>{chipLabel}</span> : null}
            {price ? <div style={priceLine}>{price}</div> : null}

            {active !== 'BOTH' && (
              <div style={{ marginTop: 12 }}>
                <BookVideoPlayer
                  variant="compact"
                  videoId={active === 'WS' ? 'esgwXR0ikOU' : 'oHp8IeOvbdk'}
                  title={act.labelEn}
                  posterSrc={videoPoster(active as ActivityCode).src}
                  posterSrcSet={`${videoPoster(active as ActivityCode).src} 1x, ${videoPoster(active as ActivityCode).src2x} 2x`}
                />
                <div style={{ fontSize: ty.caption, color: T.mutedLight, marginTop: 6, textAlign: 'center' }}>
                  {s.step1.videoMandarinNote}
                </div>
              </div>
            )}

            {active === 'BOTH' && (
              <div style={{ marginTop: 12, padding: '12px 0 4px' }}>
                <BookBothIcons size={40} gap={10} />
              </div>
            )}
          </div>
        ) : (
          <div style={{ ...detailPanel(false), textAlign: 'center', color: T.mutedLight, fontSize: ty.body, padding: '20px 14px' }}>
            {s.step1.pickPrompt}
          </div>
        )}
      </div>

      {!LIFF_BOOK_GUEST_PRICING_ONLY && memberRate ? (
        <div style={{ fontSize: ty.caption, color: T.mutedLight, marginTop: 10, textAlign: 'center' }}>{s.step1.memberRateApplied}</div>
      ) : null}
    </>
  )
}
