import type { CSSProperties } from 'react'
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
import { bookCard } from './bookStyles'
import type { ActivityChoice, ActivityCode } from './types'

interface BookEssentialsPanelProps {
  memberRate?: boolean
  value: ActivityChoice | null
  onChange: (code: ActivityChoice) => void
}

const priceRangeHeader: CSSProperties = {
  fontSize: 11,
  color: '#999',
  lineHeight: 1.5,
  marginBottom: 12,
  textAlign: 'center',
}

const segmentRow: CSSProperties = {
  display: 'flex',
  gap: 6,
  marginBottom: 12,
}

const segmentBtn = (selected: boolean): CSSProperties => ({
  flex: 1,
  minWidth: 0,
  padding: '10px 6px',
  border: selected ? '2px solid #4a4a4a' : '1px solid #e8e8e8',
  borderRadius: 10,
  background: selected ? '#fafafa' : '#fff',
  cursor: 'pointer',
  textAlign: 'center',
  lineHeight: 1.35,
  transition: 'border-color 0.15s, background 0.15s',
})

const segmentZh: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#222',
  wordBreak: 'keep-all',
}

const segmentEn: CSSProperties = {
  fontSize: 9,
  fontWeight: 500,
  color: '#888',
  marginTop: 3,
  wordBreak: 'break-word',
}

const detailPanel: CSSProperties = {
  padding: '12px 12px 10px',
  borderRadius: 10,
  border: '1px solid #ececec',
  background: '#fafafa',
}

const chip: CSSProperties = {
  display: 'inline-block',
  marginTop: 8,
  padding: '2px 7px',
  borderRadius: 999,
  background: '#f0f0f0',
  fontSize: 10,
  fontWeight: 600,
  color: '#666',
}

const tagline: CSSProperties = {
  fontSize: 12,
  color: '#666',
  lineHeight: 1.5,
  marginTop: 8,
}

const priceLine: CSSProperties = {
  marginTop: 10,
  fontSize: 20,
  fontWeight: 700,
  color: '#111',
  lineHeight: 1.1,
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
    return <BookBothIcons size={22} gap={4} style={{ margin: '0 auto 6px' }} />
  }
  return (
    <BookActivityIcon
      code={code}
      size={24}
      style={{ margin: '0 auto 6px' }}
    />
  )
}

function detailTitle(code: ActivityChoice): string {
  if (code === 'BOTH') return BOTH_ACTIVITY_LABEL
  const info = getActivityInfo(code)
  return `${info.labelZh}（${info.label}）`
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

  const priceRange = `初學 $${FIRST_TIME_WB_SMALL.toLocaleString()}～$${FIRST_TIME_BIG_BOAT.toLocaleString()}／人 · ${STEP1_PRICE_RANGE_SUFFIX}`
  const active = value
  const chipLabel = active ? step1ActivityChip(active) : null
  const price = active ? selectedPrice(active) : null

  return (
    <div style={{ ...bookCard, marginBottom: 12, padding: '14px 14px 12px' }}>
      <div style={priceRangeHeader}>{priceRange}</div>

      <div style={segmentRow}>
        {STEP1_ACTIVITY_CHOICES.map(choice => {
          const selected = value === choice.code
          return (
            <button
              key={choice.code}
              type="button"
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
        <div style={detailPanel}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#222' }}>{detailTitle(active)}</div>
          {chipLabel ? <span style={chip}>{chipLabel}</span> : null}
          <div style={tagline}>{activityTagline(active)}</div>
          {price ? <div style={priceLine}>{price}</div> : null}

          {active !== 'BOTH' && (
            <BookVideoPlayer
              variant="compact"
              videoId={getActivityInfo(active as ActivityCode).youtubeVideoId}
              title={detailTitle(active)}
            />
          )}

          {active === 'BOTH' && (
            <div style={{ marginTop: 10 }}>
              <BookBothIcons size={36} gap={8} />
            </div>
          )}
        </div>
      ) : (
        <div style={{ ...detailPanel, textAlign: 'center', color: '#aaa', fontSize: 13 }}>
          請選擇想體驗的項目
        </div>
      )}

      {!LIFF_BOOK_GUEST_PRICING_ONLY && memberRate ? (
        <div style={{ fontSize: 10, color: '#bbb', marginTop: 8 }}>非初學已套用會員價</div>
      ) : null}
    </div>
  )
}
