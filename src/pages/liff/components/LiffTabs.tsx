// LIFF 分頁：emoji + 短標題，三欄仍緊湊

import { triggerHaptic } from '../../../utils/haptic'
import type { TabType } from '../types'

const TABS: { tab: TabType; icon: string; label: string }[] = [
  { tab: 'bookings', icon: '📅', label: '預約' },
  { tab: 'balance', icon: '💰', label: '儲值' },
  { tab: 'profile', icon: '👤', label: '會員' }
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
        zIndex: 10
      }}
    >
      {TABS.map(({ tab, icon, label }) => {
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
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              padding: '11px 4px',
              border: 'none',
              background: 'transparent',
              color: active ? '#333' : '#9e9e9e',
              fontWeight: active ? 600 : 400,
              fontSize: '13px',
              letterSpacing: '0.02em',
              cursor: 'pointer',
              borderBottom: active ? '2px solid #333' : '2px solid transparent',
              transition: 'color 0.15s, border-color 0.15s'
            }}
          >
            <span aria-hidden style={{ fontSize: '15px', lineHeight: 1 }}>
              {icon}
            </span>
            <span>{label}</span>
          </button>
        )
      })}
      {/* 暫時隱藏：取消預約 tab 可加入 TABS */}
    </div>
  )
}
