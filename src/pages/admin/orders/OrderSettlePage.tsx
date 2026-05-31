import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthUser } from '../../../contexts/AuthContext'
import { PageHeader } from '../../../components/PageHeader'
import { Footer } from '../../../components/Footer'
import { ToastContainer, useToast } from '../../../components/ui'
import { useResponsive } from '../../../hooks/useResponsive'
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

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setOrders(await fetchPendingBillOrders())
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '載入失敗')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (!user) return
    if (!isAdmin(user)) {
      toast.error('訂單報帳僅限管理員')
      navigate('/')
      return
    }
    void load()
  }, [user, navigate, toast, load])

  return (
    <div style={{ padding: isMobile ? 12 : 20, minHeight: '100vh', background: '#f5f5f5' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <PageHeader
          title="🧾 訂單報帳"
          user={user}
          showBaoLink
          breadcrumbs={[{ label: 'BAO', link: '/bao' }]}
          extraLinks={[{ label: isMobile ? '💰' : '💰 會員儲值', link: '/member-transaction' }]}
        />

        <p style={{ fontSize: 14, color: '#666', marginBottom: 16 }}>
          待報帳訂單；可調整單價／折扣後結帳。含非會員匯款／現金。
        </p>

        {loading ? (
          <p style={{ color: '#666' }}>載入中…</p>
        ) : orders.length === 0 ? (
          <p style={{ color: '#666' }}>目前沒有待報帳訂單</p>
        ) : (
          orders.map((order) => (
            <PendingOrderSettleItem key={order.id} order={order} onComplete={() => void load()} />
          ))
        )}

        <Footer />
        <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
      </div>
    </div>
  )
}
