// LIFF 分頁：僅 active 顯示 emoji，避免四格過擠

import { triggerHaptic } from '../../../utils/haptic'
import type { TabType } from '../types'

const TABS: { tab: TabType; label: string; emoji: string }[] = [
  { tab: 'bookings', label: '預約', emoji: '📅' },
  { tab: 'balance', label: '儲值', emoji: '💰' },
  { tab: 'orders', label: '商品', emoji: '📦' },
  { tab: 'profile', label: '會員', emoji: '👤' },
]

interface LiffTabsProps {
  activeTab: TabType
  setActiveTab: (tab: TabType) => void
}

export function LiffTabs({ activeTab, setActiveTab }: LiffTabsProps) {
  return (
    <div
      style={{
        display: 'flex',
        background: 'white',
        borderBottom: '1px solid #e8e8e8',
        position: 'sticky',
        top: 'var(--safe-area-inset-top, 0px)',
        zIndex: 10,
      }}
    >
      {TABS.map(({ tab, label, emoji }) => {
        const active = activeTab === tab
        return (
          <button
            key={tab}
            type="button"
            onClick={() => {
              triggerHaptic('light')
              setActiveTab(tab)
            }}
            style={{
              flex: 1,
              padding: '12px 4px',
              border: 'none',
              background: 'transparent',
              color: active ? '#333' : '#9e9e9e',
              fontWeight: active ? 600 : 400,
              fontSize: '13px',
              letterSpacing: '0.02em',
              cursor: 'pointer',
              borderBottom: active ? '2px solid #333' : '2px solid transparent',
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            {active ? `${emoji} ${label}` : label}
          </button>
        )
      })}
    </div>
  )
}
