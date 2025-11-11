// 權限管理工具

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'

// 🔧 權限檢查開關（開發時可以設為 false 暫時關閉）
export const ENABLE_PERMISSION_CHECK = false

// 管理員 email 列表
export const ADMIN_EMAILS = [
  'minlin1325@gmail.com',
  'eswake.official@gmail.com'
]

/**
 * 檢查用戶是否為管理員
 */
export function isAdmin(user: User | null): boolean {
  if (!user || !user.email) return false
  return ADMIN_EMAILS.includes(user.email)
}

/**
 * 檢查用戶是否有權限訪問特定功能
 */
export function hasPermission(user: User | null, permission: 'admin' | 'coach' | 'staff'): boolean {
  if (!user) return false
  
  switch (permission) {
    case 'admin':
      return isAdmin(user)
    case 'coach':
      // 未來可以擴展：檢查用戶是否為教練
      return true
    case 'staff':
      // 未來可以擴展：檢查用戶是否為員工
      return true
    default:
      return false
  }
}

/**
 * Hook: 要求管理員權限，否則重定向到首頁
 * 使用方式：在組件頂部調用 useRequireAdmin(user)
 */
export function useRequireAdmin(user: User | null) {
  const navigate = useNavigate()
  const userIsAdmin = isAdmin(user)
  
  useEffect(() => {
    // 如果權限檢查被關閉，直接跳過
    if (!ENABLE_PERMISSION_CHECK) return
    
    if (!userIsAdmin) {
      alert('您沒有權限訪問此頁面')
      navigate('/')
    }
  }, [userIsAdmin, navigate])
  
  return userIsAdmin
}

