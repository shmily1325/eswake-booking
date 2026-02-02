// 儲值餘額視圖組件

import type { Member } from '../types'
import { BalanceCard } from './BalanceCard'

interface BalanceViewProps {
  member: Member
  onCategoryClick: (category: string) => void
}

export function BalanceView({ member, onCategoryClick }: BalanceViewProps) {
  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
    }}>
      <h2 style={{
        fontSize: '18px',
        fontWeight: '600',
        color: '#333',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        💰 我的儲值
      </h2>

      {/* 提示 */}
      <div style={{
        padding: '10px 12px',
        background: '#f0f7ff',
        borderRadius: '6px',
        marginBottom: '12px',
        fontSize: '13px',
        color: '#666',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        💡 點擊任一項目查看兩個月內的交易明細
      </div>

      {/* 儲值數據 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '12px'
      }}>
        <BalanceCard
          label="儲值餘額"
          value={member.balance}
          unit="元"
          color="#52c41a"
          category="balance"
          onClick={onCategoryClick}
        />
        <BalanceCard
          label="VIP票券"
          value={member.vip_voucher_amount}
          unit="元"
          color="#9c27b0"
          category="vip_voucher"
          onClick={onCategoryClick}
        />
        <BalanceCard
          label="指定課"
          value={member.designated_lesson_minutes}
          unit="分"
          color="#ff9800"
          category="designated_lesson"
          onClick={onCategoryClick}
        />
        <BalanceCard
          label="G23船券"
          value={member.boat_voucher_g23_minutes}
          unit="分"
          color="#1976d2"
          category="boat_voucher_g23"
          onClick={onCategoryClick}
        />
        <BalanceCard
          label="G21/黑豹"
          value={member.boat_voucher_g21_panther_minutes}
          unit="分"
          color="#00acc1"
          category="boat_voucher_g21_panther"
          onClick={onCategoryClick}
        />
        <BalanceCard
          label="贈送大船"
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

