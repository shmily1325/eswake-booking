import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { useAuthUser } from '../../../contexts/AuthContext'

import { useEffect, useState } from 'react'

import { useNavigate } from 'react-router-dom'

import { PageHeader } from '../../../components/PageHeader'

import {

  ProductHubShell,

  AdminPillRow,

  AdminPillLink,

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
        title={onOrders ? '📋 訂單開單' : '📦 商品庫存'}
        showBaoLink={isAdmin(user)}
        productHubSection={onOrders ? 'orders' : 'inventory'}
        showOrderSettleLink={isAdmin(user)}
      />



      {canEdit && (
        <>
          <AdminPillRow style={{ marginBottom: 6 }}>
            <AdminPillLink to="/products" end active={!onOrders}>
              📦 庫存
            </AdminPillLink>
            <AdminPillLink to="/products/orders" active={onOrders}>
              📋 訂單開單
            </AdminPillLink>
          </AdminPillRow>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: '#666', lineHeight: 1.5 }}>
            {onOrders
              ? '開單、送結帳、追蹤狀態。管理員扣款請用上方「訂單結帳」。'
              : '管理 SKU、庫存與上架。客人訂單請切換「訂單開單」。'}
          </p>
        </>
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


