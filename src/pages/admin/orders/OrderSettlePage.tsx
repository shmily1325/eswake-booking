import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthUser } from '../../../contexts/AuthContext'
import { PageHeader } from '../../../components/PageHeader'
import { Footer } from '../../../components/Footer'
import { AdminPageShell, adminLoadingStyle } from '../../../components/AdminPageLayout'
import { ToastContainer, useToast } from '../../../components/ui'
import { useResponsive } from '../../../hooks/useResponsive'
import { getCardStyle } from '../../../styles/designSystem'
import { isAdmin } from '../../../utils/auth'
import { fetchPendingBillOrders } from './api'
import { PendingOrderSettleItem } from './PendingOrderSettleItem'
import type { ShopOrderWithItems } from './types'

export function OrderSettlePage() {
  const user = useAuthUser()
  const navigate = useNavigate()
  const toast = useToast()
  const { isMobile } = useResponsive()
  const [orders, setOrders] = useState<ShopOrderWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const reloadOrders = useCallback(async () => {
    try {
      setLoadError(null)
      setOrders(await fetchPendingBillOrders())
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '載入失敗'
      setLoadError(msg)
      toast.error(msg)
    }
  }, [toast])

  useEffect(() => {
    if (!isAdmin(user)) {
      toast.error('訂單報帳僅限管理員')
      navigate('/')
      return
    }

    let cancelled = false
    void (async () => {
      setLoading(true)
      setLoadError(null)
      try {
        setOrders(await fetchPendingBillOrders())
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
  }, [user.id, navigate, toast])

  return (
    <AdminPageShell maxWidth={1400}>
      <PageHeader
        title="🧾 訂單報帳"
        user={user}
        showBaoLink={isAdmin(user)}
        extraLinks={[{ label: isMobile ? '💰' : '💰 會員儲值', link: '/member-transaction' }]}
      />

      <p style={{ fontSize: 14, color: '#666', marginBottom: 16 }}>
        待報帳訂單；可調整單價／折扣。付款方式：扣儲值、匯款、現金（會員／非會員皆可，邏輯同回報管理）。
      </p>

      {loading ? (
        <div style={adminLoadingStyle()}>載入中…</div>
      ) : loadError ? (
        <div style={{ ...getCardStyle(isMobile), textAlign: 'center', color: '#c62828' }}>
          載入失敗：{loadError}
        </div>
      ) : orders.length === 0 ? (
        <div style={{ ...getCardStyle(isMobile), textAlign: 'center', color: '#666' }}>
          目前沒有待報帳訂單
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

      <Footer />
      <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
    </AdminPageShell>
  )
}
