import { triggerHaptic } from '../../../utils/haptic'
import {
  BOTH_ACTIVITY_LABEL,
  getActivityInfo,
  LIFF_BOOK_GUEST_PRICING_ONLY,
  STEP1_ACTIVITY_CHOICES,
} from './liffBookingConfig'
import { FIRST_TIME_BIG_BOAT, FIRST_TIME_WB_SMALL } from './liffBookingPrices'
import { step1ActivityChip } from './liffBookingBoats'
import { BookActivityIcon, BookBothIcons } from './BookActivityIcon'
import { BookVideoPlayer } from './BookVideoPlayer'
import { STEP1_PRICE_RANGE_SUFFIX } from './liffBookingContent'
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

function activityTagline(code: ActivityChoice): string {
  if (code === 'BOTH') return '同一時段體驗兩項'
  return getActivityInfo(code).tagline
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

function detailTitle(code: ActivityChoice): string {
  if (code === 'BOTH') return BOTH_ACTIVITY_LABEL
  const info = getActivityInfo(code)
  return `${info.labelZh}（${info.label}）`
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
  const pick = (code: ActivityChoice) => {
    triggerHaptic('light')
    onChange(code)
  }

  const priceRange = `體驗 $${FIRST_TIME_WB_SMALL.toLocaleString()}～$${FIRST_TIME_BIG_BOAT.toLocaleString()}／人 · ${STEP1_PRICE_RANGE_SUFFIX}`
  const active = value
  const chipLabel = active ? step1ActivityChip(active) : null
  const price = active ? selectedPrice(active) : null

  return (
    <div style={{ ...bookCard, marginBottom: 12, padding: '16px 16px 14px' }}>
      <div style={priceBanner}>{priceRange}</div>

      <div style={segmentRow}>
        {STEP1_ACTIVITY_CHOICES.map(choice => {
          const selected = value === choice.code
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
              <div style={segmentZh}>{choice.labelZh}</div>
              <div style={segmentEn}>{choice.labelEn}</div>
            </button>
          )
        })}
      </div>

      {active ? (
        <div style={detailPanel(true)}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#222' }}>{detailTitle(active)}</div>
          {chipLabel ? <span style={metaChip}>{chipLabel}</span> : null}
          <div style={{ fontSize: 12, color: '#666', lineHeight: 1.5, marginTop: 8 }}>
            {activityTagline(active)}
          </div>
          {price ? <div style={priceLine}>{price}</div> : null}

          {active !== 'BOTH' && (
            <div style={{ marginTop: 12 }}>
              <BookVideoPlayer
                variant="compact"
                videoId={getActivityInfo(active as ActivityCode).youtubeVideoId}
                title={detailTitle(active)}
                posterSrc={videoPoster(active as ActivityCode).src}
                posterSrcSet={`${videoPoster(active as ActivityCode).src} 1x, ${videoPoster(active as ActivityCode).src2x} 2x`}
              />
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
          請選擇想體驗的項目
        </div>
      )}

      {!LIFF_BOOK_GUEST_PRICING_ONLY && memberRate ? (
        <div style={{ fontSize: 10, color: '#bbb', marginTop: 10, textAlign: 'center' }}>已滑過已套用會員價</div>
      ) : null}
    </div>
  )
}
