import type { CSSProperties } from 'react'
import { triggerHaptic } from '../../../utils/haptic'
import {
  BEGINNER_LESSON_NOTE,
  BOTH_ACTIVITY_SHORT,
  getActivityInfo,
  LIFF_BOOK_GUEST_PRICING_ONLY,
} from './liffBookingConfig'
import { firstTimeUnitPrice } from './liffBookingPrices'
import { BOAT_BIG_MAX, BOAT_SMALL_MAX } from './liffBookingBoats'
import { BookActivityIcon, BookBothIcons } from './BookActivityIcon'
import { BookVideoPlayer } from './BookVideoPlayer'
import { bookCard } from './bookStyles'
import type { ActivityChoice, ActivityCode } from './types'

const ACTIVITY_CODES: ActivityCode[] = ['WS', 'WB']

interface BookEssentialsPanelProps {
  memberRate?: boolean
  value: ActivityChoice | null
  onChange: (code: ActivityChoice) => void
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
    transition: 'opacity 0.15s, border-color 0.15s',
    ...(isBoth ? { width: '100%', marginTop: 8, marginBottom: 12 } : {}),
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
}

function boatCardStyle(): CSSProperties {
  return {
    padding: '9px 10px',
    borderRadius: 10,
    background: '#fafafa',
    border: '1px solid #ececec',
    fontSize: 12,
    lineHeight: 1.45,
    color: '#444',
  }
}

export function BookEssentialsPanel({ memberRate = false, value, onChange }: BookEssentialsPanelProps) {
  const pick = (code: ActivityChoice) => {
    triggerHaptic('light')
    onChange(code)
  }

  return (
    <div style={{ ...bookCard, marginBottom: 12, padding: '14px 14px 12px' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#222', marginBottom: 4 }}>
        預約前先知道
      </div>
      <div style={{ fontSize: 11, color: '#999', marginBottom: 10 }}>
        看影片、比價格，點選想玩的項目
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#999', letterSpacing: '0.02em' }}>
          初學體驗
        </div>
        {LIFF_BOOK_GUEST_PRICING_ONLY ? (
          <div style={{ fontSize: 10, color: '#bbb' }}>非會員價</div>
        ) : (
          <div style={{ fontSize: 10, color: '#bbb' }}>{memberRate ? '會員價' : '非會員價'}</div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {ACTIVITY_CODES.map(code => {
          const info = getActivityInfo(code)
          const selected = value === code
          return (
            <div key={code} style={activityCardStyle(code, value)}>
              <button type="button" style={selectArea} onClick={() => pick(code)} aria-pressed={selected}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <BookActivityIcon code={code} size={28} style={{ margin: 0 }} />
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#222' }}>{info.labelZh}</div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#111', lineHeight: 1.1 }}>
                  ${firstTimeUnitPrice(code).toLocaleString()}
                </div>
                <div style={{ fontSize: 10, color: '#aaa', marginTop: 4, lineHeight: 1.4 }}>
                  {BEGINNER_LESSON_NOTE}
                </div>
              </button>
              <BookVideoPlayer variant="compact" videoId={info.youtubeVideoId} title={info.labelZh} />
            </div>
          )
        })}
      </div>

      <button
        type="button"
        style={{ ...activityCardStyle('BOTH', value), padding: 0, cursor: 'pointer' }}
        onClick={() => pick('BOTH')}
        aria-pressed={value === 'BOTH'}
      >
        <div style={{ ...selectArea, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 12px' }}>
          <BookBothIcons size={28} style={{ margin: 0, flexShrink: 0 }} />
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#222' }}>{BOTH_ACTIVITY_SHORT}</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>快艇衝浪 + 寬板滑水 · 大船</div>
          </div>
        </div>
      </button>

      <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#999', marginBottom: 6, letterSpacing: '0.02em' }}>
          船型
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={boatCardStyle()}>
            <div style={{ fontWeight: 600, color: '#333', marginBottom: 2 }}>小船</div>
            <div style={{ fontSize: 11, color: '#888' }}>最多 {BOAT_SMALL_MAX} 人 · 僅寬板滑水</div>
          </div>
          <div style={boatCardStyle()}>
            <div style={{ fontWeight: 600, color: '#333', marginBottom: 2 }}>大船</div>
            <div style={{ fontSize: 11, color: '#888' }}>最多 {BOAT_BIG_MAX} 人 · 兩項皆可</div>
          </div>
        </div>
        <div style={{ fontSize: 10, color: '#bbb', marginTop: 8, lineHeight: 1.45 }}>
          {LIFF_BOOK_GUEST_PRICING_ONLY ? '非初學價格詳見「更多：G23 · FAQ」' : null}
          {LIFF_BOOK_GUEST_PRICING_ONLY ? <span style={{ margin: '0 4px' }}>·</span> : null}
          {memberRate ? '已套用會員價' : '會員另有優惠'}
        </div>
      </div>
    </div>
  )
}
