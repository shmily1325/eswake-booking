import type { CSSProperties } from 'react'
import { BEGINNER_LESSON_NOTE, getActivityInfo } from './liffBookingConfig'
import { firstTimeUnitPrice, sessionBlockRate } from './liffBookingPrices'
import { BOAT_BIG_MAX, BOAT_SMALL_MAX } from './liffBookingBoats'
import { bookCard } from './bookStyles'

import type { ActivityChoice, ActivityCode } from './types'

const ACTIVITY_CODES: ActivityCode[] = ['WS', 'WB']

interface BookEssentialsPanelProps {
  memberRate?: boolean
  selectedActivity?: ActivityChoice | null
}

function priceCardStyle(code: ActivityCode, selected: ActivityChoice | null | undefined): CSSProperties {
  const active = !selected || selected === 'BOTH' || selected === code
  const highlighted = selected === code
  return {
    padding: '10px 10px 9px',
    borderRadius: 10,
    border: highlighted ? '2px solid #4a4a4a' : '1px solid #ececec',
    background: highlighted ? '#fafafa' : '#fff',
    boxShadow: highlighted ? '0 0 0 2px rgba(74,74,74,0.08)' : 'none',
    opacity: active ? 1 : 0.38,
    transition: 'opacity 0.15s, border-color 0.15s',
  }
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

export function BookEssentialsPanel({ memberRate = false, selectedActivity = null }: BookEssentialsPanelProps) {
  const big = sessionBlockRate('big', memberRate)
  const small = sessionBlockRate('small', memberRate)

  return (
    <div style={{ ...bookCard, marginBottom: 12, padding: '14px 14px 12px' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#222', marginBottom: 10 }}>
        預約前先知道
      </div>

      <div style={{ fontSize: 11, fontWeight: 600, color: '#999', marginBottom: 6, letterSpacing: '0.02em' }}>
        初學體驗
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        {ACTIVITY_CODES.map(code => {
          const info = getActivityInfo(code)
          return (
            <div key={code} style={priceCardStyle(code, selectedActivity)}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#333', marginBottom: 4 }}>{info.labelZh}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#111', lineHeight: 1.1 }}>
                ${firstTimeUnitPrice(code).toLocaleString()}
              </div>
              <div style={{ fontSize: 10, color: '#aaa', marginTop: 5, lineHeight: 1.4 }}>
                {BEGINNER_LESSON_NOTE}
              </div>
            </div>
          )
        })}
      </div>

      <div
        style={{
          fontSize: 11,
          color: '#888',
          lineHeight: 1.55,
          padding: '8px 10px',
          borderRadius: 8,
          background: '#f7f7f7',
          marginBottom: 12,
        }}
      >
        <div>
          <span style={{ color: '#666', fontWeight: 600 }}>非初學 </span>
          大船 ${big.price.toLocaleString()}／{big.blockMin} 分
          <span style={{ margin: '0 5px', color: '#ddd' }}>|</span>
          小船 ${small.price.toLocaleString()}／{small.blockMin} 分
        </div>
        <div style={{ fontSize: 10, color: '#aaa', marginTop: 3 }}>
          {memberRate ? '已套用會員價' : '會員另有優惠'}
          <span style={{ margin: '0 4px' }}>·</span>
          兩項一起固定大船
        </div>
      </div>

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
      </div>
    </div>
  )
}
