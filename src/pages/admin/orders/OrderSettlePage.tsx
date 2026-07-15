import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthUser } from '../../../contexts/AuthContext'
import { PageHeader } from '../../../components/PageHeader'
import { Footer } from '../../../components/Footer'
import {
  AdminPageShell,
  AdminPillButton,
  AdminPillRow,
  adminContentCardStyle,
  adminLoadingStyle,
} from '../../../components/AdminPageLayout'
import { ToastContainer, useToast } from '../../../components/ui'
import { useResponsive } from '../../../hooks/useResponsive'
import { isAdmin } from '../../../utils/auth'
import { designSystem } from '../../../styles/designSystem'
import { fetchPendingBillOrders } from './api'
import { usePendingBillOrderCount } from '../../../hooks/usePendingBillOrderCount'
import { PendingOrderSettleItem } from './PendingOrderSettleItem'
import { ShopSettlementStatisticsTab } from './ShopSettlementStatisticsTab'
import { OrderManagement } from './OrderManagement'
import type { ShopOrderWithItems } from './types'

type SettleTab = 'create' | 'pending' | 'statistics'

function parseSettleTab(raw: string | null): SettleTab | null {
  if (raw === 'create' || raw === 'pending' || raw === 'statistics') return raw
  return null
}

export function OrderSettlePage() {
  const user = useAuthUser()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const toast = useToast()
  const { isMobile } = useResponsive()
  const activeTab: SettleTab = parseSettleTab(searchParams.get('tab')) ?? 'create'
  const [orders, setOrders] = useState<ShopOrderWithItems[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const { count: pendingCount, refresh: refreshPendingCount } = usePendingBillOrderCount(true)

  const setTab = useCallback(
    (tab: SettleTab) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (tab === 'create') next.delete('tab')
          else next.set('tab', tab)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

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

  const pendingBadge = pendingCount > 0 ? pendingCount : undefined

  return (
    <AdminPageShell>
      <PageHeader
        title="訂單"
        user={user}
        showBaoLink={isAdmin(user)}
        productHubSection="settle"
        extraLinks={[{ label: isMobile ? '💰' : '儲值', link: '/member-transaction' }]}
      />

      <AdminPillRow style={{ marginBottom: isMobile ? 16 : 20 }}>
        <AdminPillButton
          active={activeTab === 'create'}
          data-track="order_hub_tab_create"
          onClick={() => setTab('create')}
        >
          開單
        </AdminPillButton>
        <AdminPillButton
          active={activeTab === 'pending'}
          data-track="order_hub_tab_pending"
          onClick={() => setTab('pending')}
          badge={pendingBadge}
        >
          結帳
        </AdminPillButton>
        <AdminPillButton
          active={activeTab === 'statistics'}
          data-track="order_hub_tab_statistics"
          onClick={() => setTab('statistics')}
        >
          統計
        </AdminPillButton>
      </AdminPillRow>

      {activeTab === 'create' && <OrderManagement embedded />}

      {activeTab === 'pending' && (
        <>
          {loading ? (
            <div style={adminLoadingStyle()}>載入中…</div>
          ) : loadError ? (
            <div
              style={{
                ...adminContentCardStyle(isMobile),
                color: designSystem.colors.danger[700],
              }}
            >
              載入失敗：{loadError}
            </div>
          ) : orders.length === 0 ? (
            <div style={adminContentCardStyle(isMobile)}>目前沒有待結帳訂單</div>
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

      {activeTab === 'statistics' && <ShopSettlementStatisticsTab isMobile={isMobile} />}

      <Footer />
      <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
    </AdminPageShell>
  )
}
