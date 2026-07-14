// 儲值餘額視圖：2×3 六色低彩卡；點擊開明細

import { designSystem, getFontSizePx } from '../../../styles/designSystem'
import { liffContentPanel, LIFF_THEME } from '../liffUiStyles'
import type { Member } from '../types'
import { BalanceCard, type BalanceTone } from './BalanceCard'

interface BalanceViewProps {
  member: Member
  onCategoryClick: (category: string) => void
}

const c = designSystem.colors

/** 六色保留氣氛；皆低彩。綠／紫灰／暖／青／石板／珊瑚可分辨 */
const TONES = {
  balance: { color: c.success[700], bg: c.success[50], border: c.success[500] },
  vip: { color: '#5a4d63', bg: '#f5f2f6', border: '#b0a4bc' },
  lesson: { color: c.warning[700], bg: c.warning[50], border: c.warning[500] },
  g23: { color: c.info[700], bg: c.info[50], border: c.info[500] },
  g21: { color: c.secondary[800], bg: c.secondary[100], border: c.secondary[400] },
  gift: { color: c.danger[700], bg: c.danger[50], border: c.danger[500] },
} as const satisfies Record<string, BalanceTone>

const CARDS: {
  label: string
  unit: '元' | '分'
  category: string
  tone: BalanceTone
  value: (m: Member) => number | undefined
}[] = [
  { label: '儲值餘額', unit: '元', category: 'balance', tone: TONES.balance, value: (m) => m.balance },
  { label: 'VIP票券', unit: '元', category: 'vip_voucher', tone: TONES.vip, value: (m) => m.vip_voucher_amount },
  {
    label: '指定課',
    unit: '分',
    category: 'designated_lesson',
    tone: TONES.lesson,
    value: (m) => m.designated_lesson_minutes,
  },
  {
    label: 'G23船券',
    unit: '分',
    category: 'boat_voucher_g23',
    tone: TONES.g23,
    value: (m) => m.boat_voucher_g23_minutes,
  },
  {
    label: 'G21/黑豹',
    unit: '分',
    category: 'boat_voucher_g21_panther',
    tone: TONES.g21,
    value: (m) => m.boat_voucher_g21_panther_minutes,
  },
  {
    label: '贈送大船',
    unit: '分',
    category: 'gift_boat',
    tone: TONES.gift,
    value: (m) => m.gift_boat_hours,
  },
]

export function BalanceView({ member, onCategoryClick }: BalanceViewProps) {
  return (
    <div style={liffContentPanel}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 10,
        }}
      >
        {CARDS.map((card) => (
          <BalanceCard
            key={card.category}
            label={card.label}
            value={card.value(member)}
            unit={card.unit}
            tone={card.tone}
            category={card.category}
            onClick={onCategoryClick}
          />
        ))}
      </div>
      <p
        style={{
          margin: '14px 0 0',
          fontSize: getFontSizePx('bodySmall', true),
          color: LIFF_THEME.mutedLight,
          textAlign: 'center',
          lineHeight: 1.45,
        }}
      >
        點選項目可查看扣款明細
      </p>
    </div>
  )
}
