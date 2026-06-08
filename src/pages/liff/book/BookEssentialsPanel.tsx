import type { CSSProperties } from 'react'
import { firstTimeUnitPrice, sessionBlockRate } from './liffBookingPrices'
import { bookCard } from './bookStyles'
import { BookStaffHint } from './BookStaffHint'
import type { ActivityChoice, ActivityCode } from './types'

const row: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '72px 1fr 1fr',
  gap: '4px 6px',
  fontSize: 12,
  lineHeight: 1.35,
}

const labelCol: CSSProperties = {
  color: '#999',
  fontSize: 11,
  lineHeight: 1.35,
}

interface BookEssentialsPanelProps {
  /** 已綁定正式會員時顯示會員非初學價 */
  memberRate?: boolean
  /** 已選項目時淡化另一欄價格 */
  selectedActivity?: ActivityChoice | null
}

function colStyle(code: ActivityCode, selected: ActivityChoice | null | undefined): CSSProperties {
  if (!selected || selected === 'BOTH' || selected === code) return {}
  return { opacity: 0.4 }
}

export function BookEssentialsPanel({ memberRate = false, selectedActivity = null }: BookEssentialsPanelProps) {
  const wsNonBeginner = sessionBlockRate('big', memberRate)
  const wbNonBeginner = sessionBlockRate('small', memberRate)

  return (
    <div style={{ ...bookCard, marginBottom: 12, padding: '12px 12px 10px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: '#333' }}>① 價格</div>
      <div style={{ ...row, marginBottom: 4 }}>
        <div />
        <div style={{ fontWeight: 600, ...colStyle('WS', selectedActivity) }}>快艇衝浪</div>
        <div style={{ fontWeight: 600, ...colStyle('WB', selectedActivity) }}>寬板滑水</div>

        <div style={labelCol}>
          <div>初學</div>
          <div style={{ fontSize: 10, color: '#bbb' }}>含10分鐘岸上教學</div>
        </div>
        <div style={colStyle('WS', selectedActivity)}>${firstTimeUnitPrice('WS').toLocaleString()}</div>
        <div style={colStyle('WB', selectedActivity)}>${firstTimeUnitPrice('WB').toLocaleString()}</div>
      </div>
      <div style={{ fontSize: 10, color: '#bbb', marginBottom: 12, lineHeight: 1.45 }}>
        非初學 大船 ${wsNonBeginner.price.toLocaleString()}/{wsNonBeginner.blockMin}分 · 小船 ${wbNonBeginner.price.toLocaleString()}/{wbNonBeginner.blockMin}分
        {memberRate ? ' · 已套用會員價' : ' · 會員另有優惠'}
        <span style={{ display: 'block', marginTop: 2 }}>兩個一起固定大船，費率同大船</span>
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, color: '#333' }}>② 船</div>
      <div style={{ fontSize: 12, color: '#555', lineHeight: 1.45 }}>
        🚤 小船 ≤6 · 僅寬板滑水<br />
        🛥 大船 ≤10 · 兩項皆可
      </div>

      <BookStaffHint />
    </div>
  )
}
