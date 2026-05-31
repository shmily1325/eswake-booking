import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuthUser } from '../../../contexts/AuthContext'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../../components/PageHeader'
import {
  AdminPageShell,
  AdminTabBar,
  AdminTabLink,
  adminLoadingStyle,
} from '../../../components/AdminPageLayout'
import { Footer } from '../../../components/Footer'
import { hasEditorFeatureAsync, hasProductsAccessAsync, isAdmin } from '../../../utils/auth'
import { useToast } from '../../../components/ui'
import { ProductManagement } from './ProductManagement'
import { OrderManagement } from '../orders/OrderManagement'

export function ProductHub() {
  const user = useAuthUser()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const [ready, setReady] = useState(false)
  const [canEdit, setCanEdit] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const allowed = await hasProductsAccessAsync(user)
      if (cancelled) return
      if (!allowed) {
        toast.error('您沒有權限訪問此頁面')
        navigate('/')
        return
      }
      const editable = (await hasEditorFeatureAsync(user, 'can_products')) || isAdmin(user)
      if (cancelled) return
      setCanEdit(editable)
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [user.id, navigate, toast])

  if (!ready) {
    return (
      <AdminPageShell maxWidth={1400}>
        <div style={adminLoadingStyle()}>載入中…</div>
      </AdminPageShell>
    )
  }

  const onOrders = location.pathname.includes('/products/orders')

  return (
    <AdminPageShell maxWidth={1400}>
      <PageHeader user={user} title="📦 商品管理" showBaoLink={isAdmin(user)} />

      {canEdit && (
        <AdminTabBar>
          <AdminTabLink to="/products" end active={!onOrders}>
            📦 庫存
          </AdminTabLink>
          <AdminTabLink to="/products/orders" active={onOrders}>
            📋 訂單
          </AdminTabLink>
        </AdminTabBar>
      )}

      <Routes>
        <Route index element={<ProductManagement embedded />} />
        {canEdit && <Route path="orders" element={<OrderManagement embedded />} />}
        <Route path="*" element={<Navigate to="/products" replace />} />
      </Routes>

      <Footer />
    </AdminPageShell>
  )
}
