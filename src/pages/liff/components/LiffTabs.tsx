// LIFF 分頁組件

import { triggerHaptic } from '../../../utils/haptic'
import type { TabType } from '../types'

interface LiffTabsProps {
  activeTab: TabType
  setActiveTab: (tab: TabType) => void
}

export function LiffTabs({ activeTab, setActiveTab }: LiffTabsProps) {
  return (
    <div style={{
      display: 'flex',
      background: 'white',
      borderBottom: '1px solid #e0e0e0',
      position: 'sticky',
      top: 'var(--safe-area-inset-top, 0px)',
      zIndex: 10
    }}>
      <button
        onClick={() => {
          triggerHaptic('light')
          setActiveTab('bookings')
        }}
        style={{
          flex: 1,
          padding: '16px 8px',
          border: 'none',
          background: 'transparent',
          color: activeTab === 'bookings' ? '#5a5a5a' : '#999',
          fontWeight: activeTab === 'bookings' ? '600' : '400',
          fontSize: '14px',
          cursor: 'pointer',
          borderBottom: activeTab === 'bookings' ? '3px solid #5a5a5a' : '3px solid transparent',
          transition: 'all 0.2s'
        }}
      >
        📅 我的預約
      </button>
      <button
        onClick={() => {
          triggerHaptic('light')
          setActiveTab('balance')
        }}
        style={{
          flex: 1,
          padding: '16px 8px',
          border: 'none',
          background: 'transparent',
          color: activeTab === 'balance' ? '#5a5a5a' : '#999',
          fontWeight: activeTab === 'balance' ? '600' : '400',
          fontSize: '14px',
          cursor: 'pointer',
          borderBottom: activeTab === 'balance' ? '3px solid #5a5a5a' : '3px solid transparent',
          transition: 'all 0.2s'
        }}
      >
        💰 查儲值
      </button>
      <button
        onClick={() => {
          triggerHaptic('light')
          setActiveTab('profile')
        }}
        style={{
          flex: 1,
          padding: '16px 8px',
          border: 'none',
          background: 'transparent',
          color: activeTab === 'profile' ? '#5a5a5a' : '#999',
          fontWeight: activeTab === 'profile' ? '600' : '400',
          fontSize: '14px',
          cursor: 'pointer',
          borderBottom: activeTab === 'profile' ? '3px solid #5a5a5a' : '3px solid transparent',
          transition: 'all 0.2s'
        }}
      >
        👤 會員資訊
      </button>
      {/* 暫時隱藏取消預約功能
      <button
        onClick={() => {
          triggerHaptic('light')
          setActiveTab('cancel')
        }}
        style={{
          flex: 1,
          padding: '16px',
          border: 'none',
          background: 'transparent',
          color: activeTab === 'cancel' ? '#5a5a5a' : '#999',
          fontWeight: activeTab === 'cancel' ? '600' : '400',
          fontSize: '15px',
          cursor: 'pointer',
          borderBottom: activeTab === 'cancel' ? '3px solid #5a5a5a' : '3px solid transparent',
          transition: 'all 0.2s'
        }}
      >
        ❌ 取消預約
      </button>
      */}
    </div>
  )
}

