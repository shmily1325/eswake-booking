import { triggerHaptic } from '../../../utils/haptic'
import { useBookLocale } from './BookLocaleContext'
import { LIFF_BOOK_GUEST_PRICING_ONLY, STEP1_ACTIVITY_CHOICES } from './liffBookingConfig'
import { FIRST_TIME_BIG_BOAT, FIRST_TIME_WB_SMALL } from './liffBookingPrices'
import { step1ActivityChip } from './liffBookingBoats'
import { BookActivityIcon, BookBothIcons } from './BookActivityIcon'
import { BookVideoPlayer } from './BookVideoPlayer'
import {
  bookCard,
  detailPanel,
  metaChip,
  priceBanner,
  priceLine,
  segmentBtn,
  segmentEn,
  segmentRow,
  segmentZh,
} from './bookStyles'
import type { ActivityChoice, ActivityCode } from './types'

interface BookEssentialsPanelProps {
  memberRate?: boolean
  value: ActivityChoice | null
  onChange: (code: ActivityChoice) => void
}

function selectedPrice(code: ActivityChoice): string | null {
  if (code === 'WS' || code === 'BOTH') return `$${FIRST_TIME_BIG_BOAT.toLocaleString()}／人`
  if (code === 'WB') {
    return `$${FIRST_TIME_WB_SMALL.toLocaleString()}～$${FIRST_TIME_BIG_BOAT.toLocaleString()}／人`
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

  const perPerson = locale === 'en' ? '/person' : '／人'
  const priceRange = locale === 'en'
    ? `First-time $${FIRST_TIME_WB_SMALL.toLocaleString()}–$${FIRST_TIME_BIG_BOAT.toLocaleString()}${perPerson} · ${s.step1.priceSuffix}`
    : `體驗 $${FIRST_TIME_WB_SMALL.toLocaleString()}～$${FIRST_TIME_BIG_BOAT.toLocaleString()}${perPerson} · ${s.step1.priceSuffix}`

  const active = value
  const chipLabel = active ? step1ActivityChip(active) : null
  const price = active ? selectedPrice(active)?.replace('／人', perPerson) ?? null : null
  const act = active ? s.step1.activities[active] : null

  return (
    <div style={{ ...bookCard, marginBottom: 12, padding: '16px 16px 14px' }}>
      <div style={priceBanner}>{priceRange}</div>

      <div style={segmentRow}>
        {STEP1_ACTIVITY_CHOICES.map(choice => {
          const selected = value === choice.code
          const labels = s.step1.activities[choice.code]
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
              <div style={segmentZh}>{labels.labelZh}</div>
              <div style={segmentEn}>{labels.labelEn}</div>
            </button>
          )
        })}
      </div>

      {active && act ? (
        <div style={detailPanel(true)}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#222' }}>
            {locale === 'en' ? act.labelEn : `${act.labelZh}（${act.labelEn}）`}
          </div>
          {chipLabel ? <span style={metaChip}>{chipLabel}</span> : null}
          <div style={{ fontSize: 12, color: '#666', lineHeight: 1.5, marginTop: 8 }}>
            {s.step1.playMode[active]}
          </div>
          {active === 'BOTH' ? (
            <div style={{ fontSize: 11, color: '#888', lineHeight: 1.5, marginTop: 6 }}>
              {s.step1.bothNote}
            </div>
          ) : null}
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
              {locale === 'en' && (
                <div style={{ fontSize: 10, color: '#aaa', marginTop: 6, textAlign: 'center' }}>
                  {s.step1.videoMandarinNote}
                </div>
              )}
            </div>
          )}

          {active === 'BOTH' && (
            <div style={{ marginTop: 12, padding: '12px 0 4px' }}>
              <BookBothIcons size={40} gap={10} />
            </div>
          )}
        </div>
      ) : (
        <div style={{ ...detailPanel(false), textAlign: 'center', color: '#aaa', fontSize: 13, padding: '20px 14px' }}>
          {s.step1.pickPrompt}
        </div>
      )}

      {!LIFF_BOOK_GUEST_PRICING_ONLY && memberRate ? (
        <div style={{ fontSize: 10, color: '#bbb', marginTop: 10, textAlign: 'center' }}>{s.step1.memberRateApplied}</div>
      ) : null}
    </div>
  )
}
