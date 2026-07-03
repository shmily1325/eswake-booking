// 儲值餘額視圖組件

import { liffContentPanel, liffHintBox } from '../liffUiStyles'
import type { Member } from '../types'
import { BalanceCard } from './BalanceCard'

interface BalanceViewProps {
  member: Member
  onCategoryClick: (category: string) => void
}

export function BalanceView({ member, onCategoryClick }: BalanceViewProps) {
  return (
    <div style={liffContentPanel}>
      <div style={liffHintBox}>
        點擊下方任一張卡片，即可查看該項目的<strong style={{ color: '#333' }}>扣款明細</strong>。
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '12px',
        }}
      >
        <BalanceCard
          label="儲值餘額"
          emoji="💰"
          value={member.balance}
          unit="元"
          color="#52c41a"
          category="balance"
          onClick={onCategoryClick}
        />
        <BalanceCard
          label="VIP票券"
          emoji="💎"
          value={member.vip_voucher_amount}
          unit="元"
          color="#9c27b0"
          category="vip_voucher"
          onClick={onCategoryClick}
        />
        <BalanceCard
          label="指定課"
          emoji="📚"
          value={member.designated_lesson_minutes}
          unit="分"
          color="#ff9800"
          category="designated_lesson"
          onClick={onCategoryClick}
        />
        <BalanceCard
          label="G23船券"
          emoji="🚤"
          value={member.boat_voucher_g23_minutes}
          unit="分"
          color="#1976d2"
          category="boat_voucher_g23"
          onClick={onCategoryClick}
        />
        <BalanceCard
          label="G21/黑豹"
          emoji="⛵"
          value={member.boat_voucher_g21_panther_minutes}
          unit="分"
          color="#00acc1"
          category="boat_voucher_g21_panther"
          onClick={onCategoryClick}
        />
        <BalanceCard
          label="贈送大船"
          emoji="🎁"
          value={member.gift_boat_hours}
          unit="分"
          color="#e91e63"
          category="gift_boat"
          onClick={onCategoryClick}
        />
      </div>
    </div>
  )
}
