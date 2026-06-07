import type { CSSProperties } from 'react'
import { ACTIVITY_OPTIONS } from './liffBookingConfig'
import { firstTimeUnitPrice, sessionBlockRate } from './liffBookingPrices'
import { bookCard } from './bookStyles'
import { BookStaffHint } from './BookStaffHint'
import { openYoutubeVideo } from './bookMedia'
import { triggerHaptic } from '../../../utils/haptic'

const row: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '76px 1fr 1fr',
  gap: '4px 6px',
  fontSize: 12,
  lineHeight: 1.35,
}

const labelCol: CSSProperties = {
  color: '#999',
  fontSize: 11,
  lineHeight: 1.35,
}

const linkBtn: CSSProperties = {
  marginTop: 4,
  padding: 0,
  border: 'none',
  background: 'none',
  color: '#888',
  fontSize: 11,
  cursor: 'pointer',
  textDecoration: 'underline',
}

interface BookEssentialsPanelProps {
  /** 已綁定正式會員時顯示會員非初學價 */
  memberRate?: boolean
}

export function BookEssentialsPanel({ memberRate = false }: BookEssentialsPanelProps) {
  const ws = ACTIVITY_OPTIONS.find(a => a.code === 'WS')!
  const wb = ACTIVITY_OPTIONS.find(a => a.code === 'WB')!
  const wsNonBeginner = sessionBlockRate('big', memberRate)
  const wbNonBeginner = sessionBlockRate('small', memberRate)

  return (
    <div style={{ ...bookCard, marginBottom: 12, padding: '12px 12px 10px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: '#333' }}>① 差別</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {[ws, wb].map(opt => (
          <div key={opt.code} style={{ flex: 1, fontSize: 12, lineHeight: 1.4, color: '#444' }}>
            <div style={{ fontWeight: 600 }}>{opt.emoji} {opt.labelZh}</div>
            <div style={{ color: '#888', fontSize: 11, marginTop: 2 }}>{opt.tagline}</div>
            <button
              type="button"
              style={linkBtn}
              onClick={() => {
                triggerHaptic('light')
                openYoutubeVideo(opt.youtubeVideoId)
              }}
            >
              ▶ 影片
            </button>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: '#333' }}>② 價格</div>
      <div style={{ ...row, marginBottom: 4 }}>
        <div />
        <div style={{ fontWeight: 600 }}>快艇衝浪</div>
        <div style={{ fontWeight: 600 }}>寬板滑水</div>

        <div style={labelCol}>
          <div>初學</div>
          <div style={{ fontSize: 10, color: '#bbb' }}>含10分鐘岸上教學</div>
        </div>
        <div>${firstTimeUnitPrice('WS').toLocaleString()}</div>
        <div>${firstTimeUnitPrice('WB').toLocaleString()}</div>

        <div style={labelCol}>非初學</div>
        <div>${wsNonBeginner.price}/{wsNonBeginner.blockMin}分</div>
        <div>${wbNonBeginner.price}/{wbNonBeginner.blockMin}分</div>
      </div>
      <div style={{ fontSize: 10, color: '#bbb', marginBottom: 12 }}>
        {memberRate
          ? '非初學以 20 分計 · 已套用會員價'
          : '非初學以 20 分計 · 會員另有優惠'}
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, color: '#333' }}>③ 船</div>
      <div style={{ fontSize: 12, color: '#555', lineHeight: 1.45 }}>
        🚤 小船 ≤6 · 僅寬板滑水<br />
        🛥 大船 ≤10 · 兩項皆可
      </div>

      <BookStaffHint />
    </div>
  )
}
