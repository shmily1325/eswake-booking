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
  // 'pjpan0511@gmail.com',
  'minlin1325@gmail.com',
]

/** 編輯記錄「操作者」顯示用，key 為小寫 email（與 SUPER_ADMINS 一一對應） */
export const SUPER_ADMIN_DISPLAY_LABELS: Record<string, string> = {
  'callumbao1122@gmail.com': 'B',
  'pjpan0511@gmail.com': 'PJ',
  'minlin1325@gmail.com': 'Ming',
}

function parseCommaSeparatedEmails(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * 可使用「會員電話」專用畫面（首頁圖示）的帳號。
 * 若另設 VITE_MEMBER_PHONE_ONLY_EDITORS（逗號分隔），會與此清單合併（多出的人也能看到圖示）。
 */
export const MEMBER_PHONE_ONLY_EDITORS: string[] = [
  'callumbao1122@gmail.com',
  'pjpan0511@gmail.com',
  'minlin1325@gmail.com',
  'stt884142000@gmail.com',
  'lynn8046356@gmail.com',
]

const MEMBER_PHONE_ONLY_EDITORS_FROM_ENV = parseCommaSeparatedEmails(
  import.meta.env.VITE_MEMBER_PHONE_ONLY_EDITORS
)

/**
 * 是否可使用「會員電話」專用畫面（email 須在 MEMBER_PHONE_ONLY_EDITORS，或於環境變數 VITE_MEMBER_PHONE_ONLY_EDITORS 中列出）。
 */
export function isMemberPhoneOnlyEditor(user: User | null): boolean {
  if (!user?.email) return false
  const email = user.email.toLowerCase()
  const all = new Set(
    [...MEMBER_PHONE_ONLY_EDITORS, ...MEMBER_PHONE_ONLY_EDITORS_FROM_ENV].map((e) => e.toLowerCase())
  )
  return all.has(email)
}

/** 可勾選的進階功能（對應 editor_users 欄位；之後新功能可再加欄＋一併在後台顯示勾選） */
export const EDITOR_FEATURE_KEYS = [
  'can_schedule',
  'can_boats',
  'can_repeat_booking',
  'can_search_batch',
] as const
export type EditorFeatureKey = (typeof EDITOR_FEATURE_KEYS)[number]

export const EDITOR_FEATURE_LABELS: Record<EditorFeatureKey, string> = {
  can_schedule: '排班',
  can_boats: '船隻管理',
  can_repeat_booking: '重複預約（預約表）',
  can_search_batch: '預約查詢·批次',
}

type EditorUserRow = {
  email: string
  can_schedule: boolean
  can_boats: boolean
  can_repeat_booking: boolean
  can_search_batch: boolean
}

// 權限緩存
let allowedEmailsCache: string[] | null = null
let editorEmailsCache: string[] | null = null
/** 功能權限列（表 editor_users；產品面稱功能權限，不再使用「小編」語意） */
let editorRowsCache: EditorUserRow[] | null = null
let viewUsersCache: string[] | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 60000 // 1分鐘

const DEFAULT_FEATURE_FLAGS: Record<EditorFeatureKey, boolean> = {
  can_schedule: true,
  can_boats: true,
  can_repeat_booking: true,
  can_search_batch: true,
}

function editorRowFromDb(r: { email: string; can_schedule?: boolean; can_boats?: boolean; can_repeat_booking?: boolean; can_search_batch?: boolean }): EditorUserRow {
  // 欄位尚未遷移或為 null 時，預設 true（與 migration 104 DEFAULT 及舊行為一致，降低上線風險）
  return {
    email: r.email,
    can_schedule: r.can_schedule !== false,
    can_boats: r.can_boats !== false,
    can_repeat_booking: r.can_repeat_booking !== false,
    can_search_batch: r.can_search_batch !== false,
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
    cacheTimestamp = Date.now()
    return allowedEmailsCache
  } catch (err) {
    logger.error('Failed to load allowed emails:', err)
    return SUPER_ADMINS
  }
}

/**
 * 從資料庫載入功能權限列（editor_users 全欄，含各功能布林）
 */
async function loadEditorRows(): Promise<EditorUserRow[]> {
  const now = Date.now()
  if (editorRowsCache && now - cacheTimestamp < CACHE_DURATION) {
    return editorRowsCache
  }
  try {
    const { data, error } = await (supabase as any).from('editor_users').select('*')
    if (error) {
      logger.error('Failed to load editor_users:', error)
      editorRowsCache = []
      editorEmailsCache = []
      cacheTimestamp = Date.now()
      return []
    }
    const rows: EditorUserRow[] = (data || []).map((row: any) => editorRowFromDb(row))
    editorRowsCache = rows
    editorEmailsCache = rows.map((r) => r.email)
    cacheTimestamp = Date.now()
    return rows
  } catch (err) {
    logger.error('Failed to load editor_users', err)
    return []
  }
}

async function loadEditorEmails(): Promise<string[]> {
  const rows = await loadEditorRows()
  return rows.map((r) => r.email)
}

/**
 * 從資料庫載入一般權限用戶列表
 */
async function loadViewUsers(): Promise<string[]> {
  const now = Date.now()
  
  // 使用緩存
  if (viewUsersCache && (now - cacheTimestamp < CACHE_DURATION)) {
    return viewUsersCache
  }
  
  try {
    const { data, error } = await (supabase as any)
      .from('view_users')
      .select('email')
    
    if (error) {
      logger.error('Failed to load view users:', error)
      return []
    }
    
    const emails: string[] = data?.map((row: any) => row.email) || []
    viewUsersCache = emails
    cacheTimestamp = Date.now()
    return emails
  } catch (err) {
    logger.error('Failed to load view users:', err)
    return []
  }
}

/**
 * 清除權限緩存
 */
export function clearPermissionCache() {
  allowedEmailsCache = null
  editorEmailsCache = null
  editorRowsCache = null
  viewUsersCache = null
  cacheTimestamp = 0
}

/**
 * 檢查用戶是否為管理員（僅檢查硬編碼列表，不查詢資料庫）
 */
function isSuperAdminEmail(email: string): boolean {
  const n = email.toLowerCase()
  return SUPER_ADMINS.some((a) => a.toLowerCase() === n)
}

export function isAdmin(user: User | null): boolean {
  if (!user || !user.email) return false

  // 只檢查硬編碼的管理員列表，不查詢資料庫
  return isSuperAdminEmail(user.email)
}

/**
 * 檢查用戶是否在白名單中（異步版本）
 */
export async function isAllowedUser(user: User | null): Promise<boolean> {
  if (!user || !user.email) return false

  // 超級管理員始終允許
  if (isSuperAdminEmail(user.email)) return true

  const allowedEmails = await loadAllowedEmails()
  const n = user.email.toLowerCase()
  return allowedEmails.some((e) => e.toLowerCase() === n)
}

/**
 * 檢查用戶是否為管理員（異步版本）
 * 注意：目前管理員等同於超級管理員（硬編碼列表）
 */
export async function isAdminAsync(user: User | null): Promise<boolean> {
  if (!user || !user.email) return false
  
  // 管理員 = 超級管理員（硬編碼列表）
  return isSuperAdminEmail(user.email)
}

/**
 * Hook: 舊版佔位用；登入名單實際由 App 內的 isAllowedUser 檢查
 */
export function useCheckAllowedUser(_user: User | null) {
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
 * 是否在功能權限名單（editor_users 列）內。超級管理員：true（等同擁有全部模組；僅用於顯示／相容）
 */
export async function isEditorAsync(user: User | null): Promise<boolean> {
  if (!user || !user.email) return false
  if (isSuperAdminEmail(user.email)) return true
  const n = user.email.toLowerCase()
  const rows = await loadEditorRows()
  return rows.some((e) => e.email.toLowerCase() === n)
}

/**
 * 單一進階功能（超級管理員永遠為 true）
 */
export async function hasEditorFeatureAsync(user: User | null, feature: EditorFeatureKey): Promise<boolean> {
  if (!user || !user.email) return false
  if (isSuperAdminEmail(user.email)) return true
  const n = user.email.toLowerCase()
  const rows = await loadEditorRows()
  const row = rows.find((e) => e.email.toLowerCase() === n)
  if (!row) return false
  return row[feature] === true
}

/**
 * 讀取目前帳號四項功能開關（用於首頁等；超級管理員全 true；非名單內為 null）
 */
export async function getEditorFeatureFlags(user: User | null): Promise<Record<EditorFeatureKey, boolean> | null> {
  if (!user?.email) return null
  if (isSuperAdminEmail(user.email)) {
    return { ...DEFAULT_FEATURE_FLAGS }
  }
  const n = user.email.toLowerCase()
  const rows = await loadEditorRows()
  const row = rows.find((e) => e.email.toLowerCase() === n)
  if (!row) return null
  return {
    can_schedule: row.can_schedule,
    can_boats: row.can_boats,
    can_repeat_booking: row.can_repeat_booking,
    can_search_batch: row.can_search_batch,
  }
}

/**
 * 功能權限名單成員（同步、依緩存；首次載入前可能為 false）
 */
export function isEditor(user: User | null): boolean {
  if (!user || !user.email) return false
  if (isSuperAdminEmail(user.email)) return true
  const n = user.email.toLowerCase()
  if (editorRowsCache && editorRowsCache.some((e) => e.email.toLowerCase() === n)) return true
  if (editorEmailsCache && editorEmailsCache.some((e) => e.toLowerCase() === n)) return true
  return false
}

/**
 * 檢查用戶是否有一般權限（異步版本）
 * 有一般權限的用戶可以看到一般功能（預約表、查詢、明日提醒、編輯記錄等）
 * @param user 用戶
 * @returns 是否有一般權限
 */
export async function hasViewAccess(user: User | null): Promise<boolean> {
  if (!user || !user.email) return false

  // 超級管理員有所有權限
  if (isSuperAdminEmail(user.email)) return true

  const n = user.email.toLowerCase()
  // 在功能權限名單內則具備與一般權限相當的瀏覽權限（實作沿用既有邏輯）
  const editorEmails = await loadEditorEmails()
  if (editorEmails.some((e) => e.toLowerCase() === n)) return true

  // 檢查是否在一般權限用戶列表中
  const viewUsers = await loadViewUsers()
  return viewUsers.some((e) => e.toLowerCase() === n)
}

