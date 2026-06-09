import type { CSSProperties } from 'react'
import { triggerHaptic } from '../../../utils/haptic'
import {
  BOTH_ACTIVITY_SHORT,
  getActivityInfo,
  LIFF_BOOK_GUEST_PRICING_ONLY,
} from './liffBookingConfig'
import { FIRST_TIME_BIG_BOAT, FIRST_TIME_WB_SMALL } from './liffBookingPrices'
import { step1ActivityChip } from './liffBookingBoats'
import { BookActivityIcon, BookBothIcons } from './BookActivityIcon'
import { BookBoatPicker } from './BookBoatPicker'
import { BookVideoPlayer } from './BookVideoPlayer'
import { STEP1_PRICE_RANGE_SUFFIX } from './liffBookingContent'
import { bookCard } from './bookStyles'
import type { ActivityChoice, ActivityCode, BoatPreference } from './types'

const ACTIVITY_CODES: ActivityCode[] = ['WS', 'WB']

interface BookEssentialsPanelProps {
  memberRate?: boolean
  value: ActivityChoice | null
  boatPreference: BoatPreference | null
  onChange: (code: ActivityChoice) => void
  onBoatPreferenceChange: (pref: BoatPreference) => void
}

function activityCardStyle(code: ActivityCode | 'BOTH', selected: ActivityChoice | null): CSSProperties {
  const isBoth = code === 'BOTH'
  const isSelected = selected === code
  const dimmed = selected != null && !isSelected
  return {
    borderRadius: 12,
    border: isSelected ? '2px solid #4a4a4a' : '1px solid #ececec',
    background: isSelected ? '#fafafa' : '#fff',
    boxShadow: isSelected ? '0 0 0 2px rgba(74,74,74,0.08)' : 'none',
    opacity: dimmed ? 0.45 : 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    height: isBoth ? undefined : '100%',
    transition: 'opacity 0.15s, border-color 0.15s',
    ...(isBoth ? { width: '100%', marginTop: 8, marginBottom: 8 } : {}),
  }
}

const selectArea: CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '10px 10px 8px',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  textAlign: 'left',
  flex: 1,
}

const chip: CSSProperties = {
  display: 'inline-block',
  marginTop: 4,
  padding: '2px 7px',
  borderRadius: 999,
  background: '#f0f0f0',
  fontSize: 10,
  fontWeight: 600,
  color: '#666',
}

const tagline: CSSProperties = {
  fontSize: 11,
  color: '#888',
  lineHeight: 1.45,
  marginTop: 6,
}

const priceLine: CSSProperties = {
  marginTop: 8,
  fontSize: 18,
  fontWeight: 700,
  color: '#111',
  lineHeight: 1.1,
}

const priceRangeHeader: CSSProperties = {
  fontSize: 11,
  color: '#999',
  lineHeight: 1.5,
  marginBottom: 12,
  textAlign: 'center',
}

function activityTagline(code: ActivityCode | 'BOTH'): string {
  if (code === 'BOTH') return '同一時段體驗兩項'
  return getActivityInfo(code).tagline
}

function selectedPrice(
  code: ActivityCode | 'BOTH',
  selected: boolean,
  boatPreference: BoatPreference | null,
): string | null {
  if (!selected) return null
  if (code === 'WS' || code === 'BOTH') return `$${FIRST_TIME_BIG_BOAT.toLocaleString()}`
  if (code === 'WB') {
    if (!boatPreference) return null
    const n = boatPreference === 'small' ? FIRST_TIME_WB_SMALL : FIRST_TIME_BIG_BOAT
    return `$${n.toLocaleString()}`
  }
  return null
}

export function BookEssentialsPanel({
  memberRate = false,
  value,
  boatPreference,
  onChange,
  onBoatPreferenceChange,
}: BookEssentialsPanelProps) {
  const pick = (code: ActivityChoice) => {
    triggerHaptic('light')
    onChange(code)
  }

  const priceRange = `初學 $${FIRST_TIME_WB_SMALL.toLocaleString()}～$${FIRST_TIME_BIG_BOAT.toLocaleString()} · ${STEP1_PRICE_RANGE_SUFFIX}`

  return (
    <div style={{ ...bookCard, marginBottom: 12, padding: '14px 14px 12px' }}>
      <div style={priceRangeHeader}>{priceRange}</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'stretch' }}>
        {ACTIVITY_CODES.map(code => {
          const info = getActivityInfo(code)
          const selected = value === code
          const chipLabel = step1ActivityChip(
            code,
            code === 'WB' && selected ? boatPreference : null,
          )
          const price = selectedPrice(code, selected, boatPreference)
          return (
            <div key={code} style={activityCardStyle(code, value)}>
              <button type="button" style={selectArea} onClick={() => pick(code)} aria-pressed={selected}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <BookActivityIcon code={code} size={28} style={{ margin: 0, flexShrink: 0 }} />
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#222' }}>{info.labelZh}</div>
                </div>
                <span style={chip}>{chipLabel}</span>
                <div style={tagline}>{activityTagline(code)}</div>
                {price ? <div style={priceLine}>{price}</div> : null}
              </button>
              <BookVideoPlayer variant="compact" videoId={info.youtubeVideoId} title={info.labelZh} />
            </div>
          )
        })}
      </div>

      <button
        type="button"
        style={{ ...activityCardStyle('BOTH', value), padding: 0, cursor: 'pointer', textAlign: 'left' }}
        onClick={() => pick('BOTH')}
        aria-pressed={value === 'BOTH'}
      >
        <div style={{ ...selectArea, flex: undefined, padding: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BookBothIcons size={28} style={{ margin: 0, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#222' }}>{BOTH_ACTIVITY_SHORT}</div>
                <span style={{ ...chip, marginTop: 0 }}>{step1ActivityChip('BOTH')}</span>
              </div>
              <div style={tagline}>{activityTagline('BOTH')}</div>
              {value === 'BOTH' ? (
                <div style={priceLine}>${FIRST_TIME_BIG_BOAT.toLocaleString()}</div>
              ) : null}
            </div>
          </div>
        </div>
      </button>

      {value === 'WB' && (
        <div style={{ marginTop: 8 }}>
          <BookBoatPicker
            variant="step1"
            value={boatPreference}
            onChange={onBoatPreferenceChange}
          />
        </div>
      )}

      {!LIFF_BOOK_GUEST_PRICING_ONLY && memberRate ? (
        <div style={{ fontSize: 10, color: '#bbb', marginTop: 8 }}>非初學已套用會員價</div>
      ) : null}
    </div>
  )
}
