// 儲值餘額視圖：iOS 分組列表，點列開明細

import { liffContentPanel, LIFF_THEME, LIFF_TYPE } from '../liffUiStyles'
import type { Member } from '../types'
import { BalanceCard } from './BalanceCard'

interface BalanceViewProps {
  member: Member
  onCategoryClick: (category: string) => void
}

const ROWS: {
  label: string
  unit: '元' | '分'
  category: string
  value: (m: Member) => number | undefined
}[] = [
  { label: '儲值餘額', unit: '元', category: 'balance', value: (m) => m.balance },
  { label: 'VIP票券', unit: '元', category: 'vip_voucher', value: (m) => m.vip_voucher_amount },
  {
    label: '指定課',
    unit: '分',
    category: 'designated_lesson',
    value: (m) => m.designated_lesson_minutes,
  },
  {
    label: 'G23船券',
    unit: '分',
    category: 'boat_voucher_g23',
    value: (m) => m.boat_voucher_g23_minutes,
  },
  {
    label: 'G21/黑豹',
    unit: '分',
    category: 'boat_voucher_g21_panther',
    value: (m) => m.boat_voucher_g21_panther_minutes,
  },
  {
    label: '贈送大船',
    unit: '分',
    category: 'gift_boat',
    value: (m) => m.gift_boat_hours,
  },
]

export function BalanceView({ member, onCategoryClick }: BalanceViewProps) {
  return (
    <div style={liffContentPanel}>
      <p
        style={{
          margin: '0 0 4px',
          fontSize: LIFF_TYPE.caption,
          color: LIFF_THEME.mutedLight,
          lineHeight: 1.5,
        }}
      >
        點選項目可查看扣款明細
      </p>
      <div>
        {ROWS.map((row, index) => (
          <BalanceCard
            key={row.category}
            label={row.label}
            value={row.value(member)}
            unit={row.unit}
            category={row.category}
            onClick={onCategoryClick}
            isLast={index === ROWS.length - 1}
          />
        ))}
      </div>
    </div>
  )
}
