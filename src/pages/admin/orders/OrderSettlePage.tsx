import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthUser } from '../../../contexts/AuthContext'
import { PageHeader } from '../../../components/PageHeader'
import { Footer } from '../../../components/Footer'
import { AdminPageShell, adminContentCardStyle, adminLoadingStyle } from '../../../components/AdminPageLayout'
import { ToastContainer, useToast } from '../../../components/ui'
import { useResponsive } from '../../../hooks/useResponsive'
import { isAdmin } from '../../../utils/auth'
import { fetchPendingBillOrders } from './api'
import { usePendingBillOrderCount } from '../../../hooks/usePendingBillOrderCount'
import { PendingOrderSettleItem } from './PendingOrderSettleItem'
import { ShopSettlementStatisticsTab } from './ShopSettlementStatisticsTab'
import type { ShopOrderWithItems } from './types'

type SettleTab = 'pending' | 'statistics'

export function OrderSettlePage() {
  const user = useAuthUser()
  const navigate = useNavigate()
  const toast = useToast()
  const { isMobile } = useResponsive()
  const [activeTab, setActiveTab] = useState<SettleTab>('pending')
  const [orders, setOrders] = useState<ShopOrderWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const { refresh: refreshPendingCount } = usePendingBillOrderCount(true)

  const reloadOrders = useCallback(async () => {
    try {
      setLoadError(null)
      setOrders(await fetchPendingBillOrders())
      void refreshPendingCount()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '載入失敗'
      setLoadError(msg)
      toast.error(msg)
    }
  }, [toast, refreshPendingCount])

  useEffect(() => {
    if (!isAdmin(user)) {
      toast.error('僅限管理員')
      navigate('/')
    }
  }, [user, navigate, toast])

  useEffect(() => {
    if (!isAdmin(user) || activeTab !== 'pending') return

    let cancelled = false
    void (async () => {
      setLoading(true)
      setLoadError(null)
      try {
        const data = await fetchPendingBillOrders()
        if (!cancelled) setOrders(data)
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : '載入失敗'
          setLoadError(msg)
          toast.error(msg)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user.id, activeTab, toast])

  if (!isAdmin(user)) return null

  return (
    <AdminPageShell>
      <PageHeader
        title="訂單結帳"
        user={user}
        showBaoLink={isAdmin(user)}
        productHubSection="settle"
        extraLinks={[
          { label: isMobile ? '💰' : '💰 儲值', link: '/member-transaction' },
        ]}
      />

      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 24,
          borderBottom: '2px solid #e0e0e0',
          flexWrap: 'wrap',
        }}
      >
        <TabButton
          active={activeTab === 'pending'}
          trackId="product_order_settle_tab_pending"
          onClick={() => setActiveTab('pending')}
          isMobile={isMobile}
          badge={orders.length > 0 ? orders.length : undefined}
        >
          📋 待結帳
        </TabButton>
        <TabButton
          active={activeTab === 'statistics'}
          trackId="product_order_settle_tab_statistics"
          onClick={() => setActiveTab('statistics')}
          isMobile={isMobile}
        >
          📊 已結帳統計
        </TabButton>
      </div>

      {activeTab === 'pending' && (
        <>
          {loading ? (
            <div style={adminLoadingStyle()}>載入中…</div>
          ) : loadError ? (
            <div style={{ ...adminContentCardStyle(isMobile), color: '#c62828' }}>
              載入失敗：{loadError}
            </div>
          ) : orders.length === 0 ? (
            <div style={adminContentCardStyle(isMobile)}>
              <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.35 }}>🧾</div>
              目前沒有待結帳訂單
            </div>
          ) : (
            orders.map((order) => (
              <PendingOrderSettleItem
                key={order.id}
                order={order}
                isMobile={isMobile}
                onComplete={() => void reloadOrders()}
              />
            ))
          )}
        </>
      )}

      {activeTab === 'statistics' && (
        <ShopSettlementStatisticsTab isMobile={isMobile} />
      )}

      <Footer />
      <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
    </AdminPageShell>
  )
}

function TabButton({
  active,
  onClick,
  isMobile,
  children,
  badge,
  trackId,
}: {
  active: boolean
  onClick: () => void
  isMobile: boolean
  children: ReactNode
  badge?: number
  trackId?: string
}) {
  return (
    <button
      type="button"
      data-track={trackId}
      onClick={onClick}
      style={{
        padding: '12px 24px',
        background: active ? '#2196f3' : 'transparent',
        color: active ? 'white' : '#666',
        border: 'none',
        borderBottom: active ? '3px solid #2196f3' : 'none',
        borderRadius: '8px 8px 0 0',
        cursor: 'pointer',
        fontSize: isMobile ? 14 : 16,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {children}
      {badge != null && badge > 0 && (
        <span
          style={{
            background: active ? 'white' : '#2196f3',
            color: active ? '#2196f3' : 'white',
            borderRadius: 12,
            padding: '2px 8px',
            fontSize: 12,
            fontWeight: 'bold',
          }}
        >
          {badge}
        </span>
      )}
    </button>
  )
}
