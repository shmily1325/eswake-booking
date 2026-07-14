// LIFF 分頁：底線 + 字重標示 active（無 emoji）

import { getFontSizePx } from '../../../styles/designSystem'
import { triggerHaptic } from '../../../utils/haptic'
import { LIFF_THEME } from '../liffUiStyles'
import type { TabType } from '../types'

const TABS: { tab: TabType; label: string }[] = [
  { tab: 'bookings', label: '預約' },
  { tab: 'balance', label: '儲值' },
  { tab: 'orders', label: '商品' },
  { tab: 'profile', label: '會員' },
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
        background: LIFF_THEME.cardBg,
        borderBottom: `1px solid ${LIFF_THEME.borderSubtle}`,
        position: 'sticky',
        top: 'var(--safe-area-inset-top, 0px)',
        zIndex: 10,
      }}
    >
      {TABS.map(({ tab, label }) => {
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
              padding: '14px 4px',
              border: 'none',
              background: 'transparent',
              color: active ? LIFF_THEME.tabActive : LIFF_THEME.tabInactive,
              fontWeight: active ? 700 : 400,
              fontSize: active ? getFontSizePx('body', true) : getFontSizePx('button', true),
              letterSpacing: active ? '0.01em' : '0.02em',
              cursor: 'pointer',
              borderBottom: active ? `2.5px solid ${LIFF_THEME.tabActive}` : '2.5px solid transparent',
              transition: 'color 0.15s, border-color 0.15s, font-size 0.15s',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
