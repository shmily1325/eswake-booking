import type { CSSProperties } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuthUser } from '../../../contexts/AuthContext'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { hasEditorFeatureAsync, hasProductsAccessAsync, isAdmin } from '../../../utils/auth'
import { useToast } from '../../../components/ui'
import { ProductManagement } from './ProductManagement'
import { OrderManagement } from '../orders/OrderManagement'

const tabStyle = (active: boolean): CSSProperties => ({
  padding: '10px 18px',
  textDecoration: 'none',
  color: active ? '#111' : '#666',
  borderBottom: active ? '2px solid #333' : '2px solid transparent',
  fontWeight: active ? 600 : 400,
  fontSize: 15,
})

export function ProductHub() {
  const user = useAuthUser()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const [ready, setReady] = useState(false)
  const [canEdit, setCanEdit] = useState(false)

  useEffect(() => {
    if (!user) return
    void (async () => {
      const allowed = await hasProductsAccessAsync(user)
      if (!allowed) {
        toast.error('您沒有權限訪問此頁面')
        navigate('/')
        return
      }
      const editable = (await hasEditorFeatureAsync(user, 'can_products')) || isAdmin(user)
      setCanEdit(editable)
      setReady(true)
    })()
  }, [user, navigate, toast])

  if (!ready) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>載入中…</div>
  }

  const onOrders = location.pathname.includes('/products/orders')

  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: '12px 16px 0',
          maxWidth: 1200,
          margin: '0 auto',
          borderBottom: '1px solid #e5e5e5',
          background: '#f5f5f5',
        }}
      >
        <NavLink to="/products" end style={({ isActive }) => tabStyle(isActive && !onOrders)}>
          庫存
        </NavLink>
        {canEdit && (
          <NavLink to="/products/orders" style={({ isActive }) => tabStyle(isActive)}>
            訂單
          </NavLink>
        )}
      </div>

      <Routes>
        <Route index element={<ProductManagement embedded />} />
        {canEdit && <Route path="orders" element={<OrderManagement />} />}
        <Route path="*" element={<Navigate to="/products" replace />} />
      </Routes>
    </div>
  )
}
