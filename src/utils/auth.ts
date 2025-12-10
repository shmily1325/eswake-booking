// 權限管理工具

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { logger } from './logger'
import { useToast } from '../components/ui'


// 超級管理員（硬編碼，始終有權限）
export const SUPER_ADMINS = [
  'callumbao1122@gmail.com',
  //'pjpan0511@gmail.com',
  //'minlin1325@gmail.com',
]

// 權限緩存
let adminEmailsCache: string[] | null = null
let allowedEmailsCache: string[] | null = null
let editorEmailsCache: string[] | null = null
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
      logger.error('Failed to load admin emails:', error)
      return SUPER_ADMINS
    }
    
    const emails = data?.map(row => row.email) || []
    adminEmailsCache = [...SUPER_ADMINS, ...emails]
    cacheTimestamp = now
    return adminEmailsCache
  } catch (err) {
    logger.error('Failed to load admin emails:', err)
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
      logger.error('Failed to load allowed emails:', error)
      return SUPER_ADMINS
    }
    
    const emails = data?.map(row => row.email) || []
    allowedEmailsCache = [...SUPER_ADMINS, ...emails]
    return allowedEmailsCache
  } catch (err) {
    logger.error('Failed to load allowed emails:', err)
    return SUPER_ADMINS
  }
}

/**
 * 從資料庫載入小編列表
 */
async function loadEditorEmails(): Promise<string[]> {
  const now = Date.now()
  
  // 使用緩存
  if (editorEmailsCache && (now - cacheTimestamp < CACHE_DURATION)) {
    return editorEmailsCache
  }
  
  try {
    const { data, error } = await (supabase as any)
      .from('editor_users')
      .select('email')
    
    if (error) {
      logger.error('Failed to load editor emails:', error)
      return []
    }
    
    const emails: string[] = data?.map((row: any) => row.email) || []
    editorEmailsCache = emails
    return emails
  } catch (err) {
    logger.error('Failed to load editor emails:', err)
    return []
  }
}

/**
 * 清除權限緩存
 */
export function clearPermissionCache() {
  adminEmailsCache = null
  allowedEmailsCache = null
  editorEmailsCache = null
  cacheTimestamp = 0
}

/**
 * 檢查用戶是否為管理員（僅檢查硬編碼列表，不查詢資料庫）
 */
export function isAdmin(user: User | null): boolean {
  if (!user || !user.email) return false
  
  // 只檢查硬編碼的管理員列表，不查詢資料庫
  return SUPER_ADMINS.includes(user.email)
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
 * Hook: 檢查用戶是否在白名單中（已廢棄，始終返回 true）
 */
export function useCheckAllowedUser(_user: User | null) {
  // 白名單檢查已關閉，所有登入用戶都允許訪問
  return { isAllowed: true, checking: false }
}

/**
 * Hook: 要求管理員權限，否則重定向（僅檢查硬編碼列表，不查詢資料庫）
 */
export function useRequireAdmin(user: User | null) {
  const navigate = useNavigate()
  const toast = useToast()
  const userIsAdmin = isAdmin(user)
  
  useEffect(() => {
    if (!userIsAdmin) {
      toast.error('您沒有權限訪問此頁面')
      navigate('/')
    }
  }, [userIsAdmin, navigate, toast])
  
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

/**
 * 檢查用戶是否為小編（異步版本）
 * 小編可以看到更多功能，如船隻管理等
 */
export async function isEditorAsync(user: User | null): Promise<boolean> {
  if (!user || !user.email) return false
  
  // 管理員（包括超級管理員）同時也有小編權限
  const adminEmails = await loadAdminEmails()
  if (adminEmails.includes(user.email)) return true
  
  // 檢查是否在小編列表中
  const editorEmails = await loadEditorEmails()
  return editorEmails.includes(user.email)
}

/**
 * 檢查用戶是否為小編（同步版本，使用緩存）
 * 注意：第一次呼叫可能返回 false，因為緩存可能尚未載入
 */
export function isEditor(user: User | null): boolean {
  if (!user || !user.email) return false
  
  // 超級管理員也有小編權限
  if (SUPER_ADMINS.includes(user.email)) return true
  
  // 檢查緩存中的管理員（管理員也有小編權限）
  if (adminEmailsCache && adminEmailsCache.includes(user.email)) return true
  
  // 檢查緩存中的小編
  if (editorEmailsCache && editorEmailsCache.includes(user.email)) return true
  
  return false
}

