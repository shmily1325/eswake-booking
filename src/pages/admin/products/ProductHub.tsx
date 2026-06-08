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
} from '../../../components/AdminPageLayout'
import { useResponsive } from '../../../hooks/useResponsive'

import { Footer } from '../../../components/Footer'

import { hasEditorFeatureAsync, hasProductsAccessAsync, isAdmin } from '../../../utils/auth'
import { usePendingBillOrderCount } from '../../../hooks/usePendingBillOrderCount'

import { useToast } from '../../../components/ui'
import { getPublicShopHomeUrl, SHOP_NAV_LOGO_SRC } from '../../../lib/shopPublicUrl'

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
        (await hasEditorFeatureAsync(user, 'can_products')) || isAdmin(user)

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
        title="📦 商品訂單"
        showBaoLink={userIsAdmin}
        productHubSection={onOrders ? 'orders' : 'inventory'}
        showOrderSettleLink={userIsAdmin}
        pendingSettleCount={pendingSettleCount}
        extraLinks={[{ label: 'ES SHOP', link: getPublicShopHomeUrl(), iconSrc: SHOP_NAV_LOGO_SRC }]}
      />

      {canEdit && (
        <AdminPillRow style={{ marginBottom: isMobile ? 12 : 16 }}>
          <AdminPillLink to="/products" end active={!onOrders}>
            庫存
          </AdminPillLink>
          <AdminPillLink to="/products/orders" active={onOrders}>
            訂單開單
          </AdminPillLink>
        </AdminPillRow>
      )}

      <Routes>

        <Route index element={<ProductManagement embedded />} />

        {canEdit && <Route path="orders" element={<OrderManagement embedded />} />}

        <Route path="*" element={<Navigate to="/products" replace />} />

      </Routes>



      <Footer />

    </ProductHubShell>

  )

}


