import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { useAuthUser } from '../../../contexts/AuthContext'

import { useEffect, useState } from 'react'

import { useNavigate } from 'react-router-dom'

import { PageHeader } from '../../../components/PageHeader'

import {
  AdminPillLink,
  AdminPillRow,
  ProductHubShell,
  adminLoadingStyle,
  adminPillButtonStyle,
} from '../../../components/AdminPageLayout'
import { useResponsive } from '../../../hooks/useResponsive'

import { Footer } from '../../../components/Footer'

import {
  canPreviewProductsReadOnly,
  hasEditorFeatureAsync,
  hasProductsAccessAsync,
  isAdmin,
} from '../../../utils/auth'
import { usePendingBillOrderCount } from '../../../hooks/usePendingBillOrderCount'

import { useToast } from '../../../components/ui'
import { getPublicShopHomeUrl } from '../../../lib/shopPublicUrl'
import { ExternalNavLink } from '../../../components/ExternalNavLink'

import { ProductManagement } from './ProductManagement'

import { OrderManagement } from '../orders/OrderManagement'



export function ProductHub() {

  const user = useAuthUser()

  const navigate = useNavigate()

  const location = useLocation()

  const toast = useToast()

  const [ready, setReady] = useState(false)

  const [canEdit, setCanEdit] = useState(false)
  const userIsAdmin = isAdmin(user)
  const forceReadOnly =
    canPreviewProductsReadOnly(user) &&
    new URLSearchParams(location.search).get('mode') === 'readonly'
  const { count: pendingSettleCount } = usePendingBillOrderCount(userIsAdmin)
  const { isMobile } = useResponsive()



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

      const editable =
        !forceReadOnly &&
        ((await hasEditorFeatureAsync(user, 'can_products')) || isAdmin(user))

      if (cancelled) return

      setCanEdit(editable)

      setReady(true)

    })()

    return () => {

      cancelled = true

    }

  }, [user, navigate, toast, forceReadOnly])



  if (!ready) {

    return (

      <ProductHubShell>

        <div style={adminLoadingStyle()}>載入中…</div>

      </ProductHubShell>

    )

  }



  const onOrders = location.pathname.includes('/products/orders')



  return (

    <ProductHubShell>

      <PageHeader
        user={user}
        title={canEdit ? '商品管理' : '商品查詢'}
        showBaoLink={userIsAdmin && !forceReadOnly}
        productHubSection={onOrders ? 'orders' : 'inventory'}
        showOrderSettleLink={userIsAdmin && !forceReadOnly}
        pendingSettleCount={pendingSettleCount}
      />

      <AdminPillRow style={{ marginBottom: isMobile ? 12 : 16 }}>
        <AdminPillLink
          to={forceReadOnly ? '/products?mode=readonly' : '/products'}
          end
          active={!onOrders}
        >
          商品與庫存
        </AdminPillLink>
        {canEdit && (
          <AdminPillLink to="/products/orders" active={onOrders}>
            訂單整理
          </AdminPillLink>
        )}
        <ExternalNavLink
          href={getPublicShopHomeUrl()}
          data-track="products_es_shop"
          style={adminPillButtonStyle(false)}
        >
          ES SHOP
        </ExternalNavLink>
      </AdminPillRow>

      <Routes>

        <Route
          index
          element={
            <ProductManagement
              key={forceReadOnly ? 'readonly-preview' : 'products'}
              embedded
              readOnly={forceReadOnly}
            />
          }
        />

        {canEdit && <Route path="orders" element={<OrderManagement embedded />} />}

        <Route path="*" element={<Navigate to="/products" replace />} />

      </Routes>



      <Footer />

    </ProductHubShell>

  )

}


