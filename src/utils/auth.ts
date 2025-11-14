// 權限管理工具

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

// 🔧 權限檢查開關（開發時可以設為 false 暫時關閉）
export const ENABLE_PERMISSION_CHECK = false

// 超級管理員（硬編碼，始終有權限）
export const SUPER_ADMINS = [
  'callumbao1122@gmail.com',
  'pjpan0511@gmail.com',
  'minlin1325@gmail.com'
]

// 權限緩存
let adminEmailsCache: string[] | null = null
let allowedEmailsCache: string[] | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 60000 // 1分鐘

/**
 * 從資料庫載入管理員列表
 */
async function loadAdminEmails(): Promise<string[]> {
  const now = Date.now()
  
  // 使用緩存
  if (adminEmailsCache && (now - cacheTimestamp < CACHE_DURATION)) {
    return adminEmailsCache
  }
  
  try {
    const { data, error } = await supabase
      .from('admin_users')
      .select('email')
    
    if (error) {
      console.error('Failed to load admin emails:', error)
      return SUPER_ADMINS
    }
    
    const emails = data?.map(row => row.email) || []
    adminEmailsCache = [...SUPER_ADMINS, ...emails]
    cacheTimestamp = now
    return adminEmailsCache
  } catch (err) {
    console.error('Failed to load admin emails:', err)
    return SUPER_ADMINS
  }
}

/**
 * 從資料庫載入白名單
 */
async function loadAllowedEmails(): Promise<string[]> {
  const now = Date.now()
  
  // 使用緩存
  if (allowedEmailsCache && (now - cacheTimestamp < CACHE_DURATION)) {
    return allowedEmailsCache
  }
  
  try {
    const { data, error } = await supabase
      .from('allowed_users')
      .select('email')
    
    if (error) {
      console.error('Failed to load allowed emails:', error)
      return SUPER_ADMINS
    }
    
    const emails = data?.map(row => row.email) || []
    allowedEmailsCache = [...SUPER_ADMINS, ...emails]
    return allowedEmailsCache
  } catch (err) {
    console.error('Failed to load allowed emails:', err)
    return SUPER_ADMINS
  }
}

/**
 * 清除權限緩存
 */
export function clearPermissionCache() {
  adminEmailsCache = null
  allowedEmailsCache = null
  cacheTimestamp = 0
}

/**
 * 檢查用戶是否為管理員（同步版本，使用緩存）
 */
export function isAdmin(user: User | null): boolean {
  if (!user || !user.email) return false
  
  // 超級管理員始終有權限
  if (SUPER_ADMINS.includes(user.email)) return true
  
  // 使用緩存檢查
  if (adminEmailsCache) {
    return adminEmailsCache.includes(user.email)
  }
  
  return false
}

/**
 * 檢查用戶是否在白名單中（異步版本）
 */
export async function isAllowedUser(user: User | null): Promise<boolean> {
  if (!user || !user.email) return false
  
  // 超級管理員始終允許
  if (SUPER_ADMINS.includes(user.email)) return true
  
  const allowedEmails = await loadAllowedEmails()
  return allowedEmails.includes(user.email)
}

/**
 * 檢查用戶是否為管理員（異步版本）
 */
export async function isAdminAsync(user: User | null): Promise<boolean> {
  if (!user || !user.email) return false
  
  // 超級管理員始終有權限
  if (SUPER_ADMINS.includes(user.email)) return true
  
  const adminEmails = await loadAdminEmails()
  return adminEmails.includes(user.email)
}

/**
 * Hook: 檢查用戶是否在白名單中
 */
export function useCheckAllowedUser(user: User | null) {
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(true)
  
  useEffect(() => {
    async function check() {
      if (!ENABLE_PERMISSION_CHECK) {
        setIsAllowed(true)
        setChecking(false)
        return
      }
      
      if (!user) {
        setIsAllowed(false)
        setChecking(false)
        return
      }
      
      const allowed = await isAllowedUser(user)
      setIsAllowed(allowed)
      setChecking(false)
    }
    
    check()
  }, [user])
  
  return { isAllowed, checking }
}

/**
 * Hook: 要求管理員權限，否則重定向
 */
export function useRequireAdmin(user: User | null) {
  const navigate = useNavigate()
  const [userIsAdmin, setUserIsAdmin] = useState(false)
  
  useEffect(() => {
    async function check() {
      // 如果權限檢查被關閉，直接跳過
      if (!ENABLE_PERMISSION_CHECK) {
        setUserIsAdmin(true)
        return
      }
      
      const adminStatus = await isAdminAsync(user)
      setUserIsAdmin(adminStatus)
      
      if (!adminStatus) {
        alert('您沒有權限訪問此頁面')
        navigate('/unauthorized')
      }
    }
    
    check()
  }, [user, navigate])
  
  return userIsAdmin
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

