import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthUser } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { useResponsive } from '../../hooks/useResponsive'
import { getLocalDateString } from '../../utils/date'
import { hasViewAccess, SUPER_ADMIN_DISPLAY_LABELS } from '../../utils/auth'

interface AuditLogEntry {
  id: number
  user_email: string | null
  action: string
  table_name: string | null
  details: string | null
  created_at: string | null
}

interface ParsedDetails {
  member?: string
  boat?: string
  coach?: string
  driver?: string         // 駕駛
  time?: string
  duration?: string
  filledBy?: string
  changeSummary?: string  // 修改預約的變更摘要
  bookingDate?: string    // 預約日期 (MM/DD 格式)
  bookingList?: string[]  // 批次操作中的預約列表
  totalCount?: number     // 批次操作的真實總筆數（從 "8 筆" 中提取）
  notes?: string          // 預約的原始備註
  activityTypes?: string  // 活動類型
  rawText: string
}

type PermissionRow = { email: string; display_name: string | null }

/** 人員管理 → 權限管理：view_users（一般）＋ editor_users（小編，有 display_name 時覆蓋） */
function buildPermissionDisplayMap(
  viewRows: PermissionRow[] | null | undefined,
  editorRows: PermissionRow[] | null | undefined
): Record<string, string> {
  const map: Record<string, string> = {}
  for (const row of viewRows || []) {
    const key = row.email?.trim().toLowerCase()
    if (!key) continue
    const name = row.display_name?.trim()
    if (name) map[key] = name
  }
  for (const row of editorRows || []) {
    const key = row.email?.trim().toLowerCase()
    if (!key) continue
    const name = row.display_name?.trim()
    if (name) map[key] = name
  }
  return map
}

/** audit_log.user_email → 顯示名稱：超級管理員寫死 → 權限表 → 原 email */
function actorLabelFromPermissionTables(
  userEmail: string | null | undefined,
  permissionDisplayByEmail: Record<string, string>
): string {
  if (!userEmail?.trim()) return '?'
  const key = userEmail.trim().toLowerCase()
  const superLabel = SUPER_ADMIN_DISPLAY_LABELS[key]
  if (superLabel) return superLabel
  return permissionDisplayByEmail[key] || userEmail
}

/**
 * 解析 details 字串，提取關鍵資訊
 */
function parseDetails(details: string): ParsedDetails {
  const info: ParsedDetails = { rawText: details }
  
  const isCreate = details.startsWith('新增預約')
  const isUpdate = details.startsWith('修改預約')
  const isDelete = details.startsWith('刪除預約')
  const isBatchEdit = details.startsWith('批次修改')
  const isBatchDelete = details.startsWith('批次刪除')
  const isRepeat = details.startsWith('重複預約')
  
  if (isBatchEdit || isBatchDelete || isRepeat) {
    // 提取筆數
    const countMatch = details.match(/(\d+)\s*筆/)
    if (countMatch) {
      info.member = `${countMatch[1]}筆`
      info.totalCount = parseInt(countMatch[1], 10)  // ✅ 保存真實總筆數
    }
    
    // 新格式：
    // 批次修改 3 筆：時長→90分鐘 [Ming (04/03 08:30), John (04/03 09:00)] (填表人: Ming)
    // 重複預約 3 筆：G23 60分 Queenie | Papa教練 [SUP] [04/03 10:00, 04/04 10:00] (填表人: L)
    // 提取變更內容或預約信息（在 筆： 和第一個 [ 之間）
    const changesMatch = details.match(/筆[:：]\s*(.+?)(?:\s*\[|$)/)
    if (changesMatch && changesMatch[1].trim()) {
      const content = changesMatch[1].trim()
      
      if (isRepeat) {
        // 重複預約：解析船隻、時長、會員、教練
        // 格式：G23 60分 Queenie | Papa教練
        const parts = content.split('|').map(p => p.trim())
        const mainPart = parts[0] || ''
        
        // 提取船隻、時長、會員
        const tokens = mainPart.split(/\s+/)
        if (tokens.length >= 3) {
          info.boat = tokens[0] // G23
          info.duration = tokens[1] // 60分
          info.member = tokens.slice(2).join(' ') // Queenie
        }
        
        // 提取教練
        if (parts.length > 1) {
          const coachPart = parts[1]
          const coachMatches = coachPart.match(/([\u4e00-\u9fa5A-Za-z0-9\s]+?)(?:教練|老師)/g)
          if (coachMatches) {
            const coaches = coachMatches.map(m => m.replace(/教練|老師/g, '').trim())
            info.coach = coaches.join('/')
          }
        }
      } else {
        // 批次修改/刪除
        info.changeSummary = content
      }
    }
    
    // 提取預約列表（在最後一個 [...] 中，因為前面可能有活動和備註）
    const allBrackets = details.match(/\[([^\]]+)\]/g)
    if (allBrackets && allBrackets.length > 0) {
      // 最後一個方括號通常是時間列表
      const lastBracket = allBrackets[allBrackets.length - 1]
      let listStr = lastBracket.slice(1, -1).trim()
      
      // 檢查是否為時間列表（包含時間格式）
      if (/\d{1,2}\/\d{1,2}\s+\d{2}:\d{2}/.test(listStr) || /\d{1,2}\/\d{1,2}/.test(listStr)) {
        // ✅ 移除 "等X筆" 這樣的後綴文字（如：05/09 08:30, 05/16 08:30 等8筆）
        listStr = listStr.replace(/\s*等\d+筆\s*$/, '').trim()
        
        // 解析每筆預約：Ming (04/03 08:30), John (04/03 09:00) 或 04/03 10:00, 04/04 10:00
        info.bookingList = listStr.split(/,\s*/).map(s => s.trim()).filter(Boolean)
        
        // 提取所有日期用於搜尋
        const dateMatches = listStr.match(/\d{1,2}\/\d{1,2}/g)
        if (dateMatches && dateMatches.length > 0) {
          info.bookingDate = dateMatches[0] // 使用第一個日期作為代表
        }
      }
    }
    
    const filledByMatch = details.match(/填表人[:：]\s*([^)]+)/)
    if (filledByMatch) info.filledBy = filledByMatch[1].trim()
    return info
  }
  
  const timeMatch = details.match(/(\d{4}\/\d{1,2}\/\d{1,2}\s+\d{2}:\d{2}|\d{1,2}\/\d{1,2}\s+\d{2}:\d{2})/)
  if (timeMatch) {
    info.time = timeMatch[1]
    // 提取預約日期 (MM/DD 格式)
    // 如果是完整日期格式 (YYYY/MM/DD)，提取後面的 MM/DD
    if (/^\d{4}\//.test(timeMatch[1])) {
      const dateOnlyMatch = timeMatch[1].match(/\/(\d{1,2}\/\d{1,2})/)
      if (dateOnlyMatch) info.bookingDate = dateOnlyMatch[1]
    } else {
      // 短日期格式 (MM/DD)，直接提取
      const dateOnlyMatch = timeMatch[1].match(/(\d{1,2}\/\d{1,2})/)
      if (dateOnlyMatch) info.bookingDate = dateOnlyMatch[1]
    }
  }
  
  const durationMatch = details.match(/(\d+)\s*分/)
  if (durationMatch) info.duration = `${durationMatch[1]}分`
  
  // 提取方括號內容（活動類型和備註）
  // 新格式：[SUP+風帆] [課堂人：L]
  // 舊格式：[活動: SUP] [備註: xxx]（向後兼容）
  const bracketMatches = details.match(/\[([^\]]+)\]/g)
  if (bracketMatches && bracketMatches.length > 0) {
    bracketMatches.forEach((match) => {
      const content = match.slice(1, -1).trim() // 去掉方括號
      
      // 檢查是否為舊格式
      if (content.startsWith('活動:') || content.startsWith('活動：')) {
        info.activityTypes = content.replace(/^活動[:：]\s*/, '').trim()
      } else if (content.startsWith('備註:') || content.startsWith('備註：')) {
        info.notes = content.replace(/^備註[:：]\s*/, '').trim()
      } else {
        // 新格式：按順序判斷
        // 活動類型通常包含 + 號（如 WB+WS）或是 WB/WS
        const isActivity = content.includes('+') || /^(WB|WS)(\+|$)/.test(content)
        
        if (isActivity && !info.activityTypes) {
          info.activityTypes = content
        } else if (!info.notes) {
          info.notes = content
        }
      }
    })
  }
  
  if (isCreate) {
    let text = details
      .replace(/^新增預約[:：]\s*/, '')
      .replace(/\d{4}\/\d{1,2}\/\d{1,2}\s+\d{2}:\d{2}|\d{1,2}\/\d{1,2}\s+\d{2}:\d{2}/, '')
      .replace(/\d+\s*分/, '')
      .trim()
    
    // 移除填表人和課堂人資訊
    text = text.replace(/\s*\([^)]*[填表人課堂][^)]*\)\s*/g, '').trim()
    
    // ✅ 移除活動類型和備註（方括號內容），因為已經在前面提取過了
    text = text.replace(/\s*\[[^\]]+\]\s*/g, ' ').trim()
    // 規範化多餘空格
    text = text.replace(/\s+/g, ' ')
    
    const pipeIndex = text.indexOf(' | ')
    if (pipeIndex > 0) {
      const beforePipe = text.substring(0, pipeIndex).trim()
      const afterPipe = text.substring(pipeIndex + 3).trim()
      
      const coachMatches = afterPipe.match(/([\u4e00-\u9fa5A-Za-z0-9\s]+?)(?:教練|老師)/g)
      if (coachMatches) {
        const coaches = coachMatches.map(m => m.replace(/教練|老師/g, '').trim())
        info.coach = coaches.join('/')
      }
      
      const firstSpaceIndex = beforePipe.indexOf(' ')
      if (firstSpaceIndex > 0) {
        info.boat = beforePipe.substring(0, firstSpaceIndex).trim()
        info.member = beforePipe.substring(firstSpaceIndex + 1).trim()
      } else {
        info.boat = beforePipe
      }
    } else {
      const coachPattern = /([\u4e00-\u9fa5A-Za-z0-9]+)(?:教練|老師)/g
      const coachMatches = text.match(coachPattern)
      if (coachMatches) {
        const coaches = coachMatches.map(m => m.replace(/教練|老師/g, '').trim())
        info.coach = coaches.join('/')
        text = text.replace(/([\u4e00-\u9fa5A-Za-z0-9]+)(?:教練|老師)/g, '').trim()
      }
      
      const firstSpaceIndex = text.indexOf(' ')
      if (firstSpaceIndex > 0) {
        info.boat = text.substring(0, firstSpaceIndex).trim()
        info.member = text.substring(firstSpaceIndex + 1).trim()
      } else if (text.length > 0) {
        info.boat = text
      }
    }
    
  } else if (isUpdate) {
    // 格式：修改預約：2025/11/20 14:45 小楊，變更：時間: 14:00 → 14:45、船隻: G21 → G23
    
    // 提取會員名稱（在時間和「，變更」之間）
    const memberMatch = details.match(/\d{2}:\d{2}\s+([^，]+?)，變更/)
    if (memberMatch) {
      info.member = memberMatch[1].trim()
    }
    
    // 提取變更內容摘要
    const changesMatch = details.match(/變更[:：]\s*(.+?)(?:\s*\(填表人|$)/)
    if (changesMatch) {
      const changesText = changesMatch[1].trim()
      // 提取所有變更項目
      const changeItems: string[] = []
      
      // 時間變更
      if (changesText.includes('時間:') || changesText.includes('時間：')) {
        changeItems.push('時間')
      }
      // 船隻變更
      const boatChange = changesText.match(/船隻[:：]\s*([^→]+)\s*→\s*([^，、]+)/)
      if (boatChange) {
        info.boat = boatChange[2].trim()
        changeItems.push(`船 ${boatChange[1].trim()}→${boatChange[2].trim()}`)
      }
      // 教練變更
      if (changesText.includes('教練:') || changesText.includes('教練：')) {
        changeItems.push('教練')
      }
      // 駕駛變更
      if (changesText.includes('駕駛:') || changesText.includes('駕駛：')) {
        changeItems.push('駕駛')
      }
      // 聯絡人變更
      const contactChange = changesText.match(/聯絡[:：]\s*([^→]+)\s*→\s*([^，、]+)/)
      if (contactChange) {
        info.member = contactChange[2].trim()
        changeItems.push('聯絡人')
      }
      // 備註變更
      if (changesText.includes('備註:') || changesText.includes('備註：')) {
        changeItems.push('備註')
      }
      // 時長變更
      if (changesText.includes('時長:') || changesText.includes('時長：')) {
        changeItems.push('時長')
      }
      // 活動變更
      if (changesText.includes('活動:') || changesText.includes('活動：')) {
        changeItems.push('活動')
      }
      
      if (changeItems.length > 0) {
        info.changeSummary = changeItems.join('、')
      }
    }
    
  } else if (isDelete) {
    let text = details
      .replace(/^刪除預約[:：]\s*/, '')
      .replace(/\d{4}\/\d{1,2}\/\d{1,2}\s+\d{2}:\d{2}|\d{1,2}\/\d{1,2}\s+\d{2}:\d{2}/, '')
      .replace(/\d+\s*分/, '')
      .trim()
    
    // 移除活動類型和備註（已在前面統一處理，包含新舊格式）
    text = text.replace(/\s*\[[^\]]+\]\s*/g, ' ').trim()
    // 規範化多餘空格
    text = text.replace(/\s+/g, ' ')
    
    text = text.replace(/\s*\([^)]*[填表人課堂][^)]*\)\s*/g, '').trim()
    
    // 提取教練和駕駛（使用 | 分隔）
    const pipeIndex = text.indexOf(' | ')
    if (pipeIndex > 0) {
      const beforePipe = text.substring(0, pipeIndex).trim()
      const afterPipe = text.substring(pipeIndex + 3).trim()
      
      // 解析教練和駕駛
      const parts = afterPipe.split('|').map(p => p.trim())
      for (const part of parts) {
        // 新格式：🚤Sky、Papa
        if (part.startsWith('🚤')) {
          info.driver = part.replace(/^🚤\s*/, '').trim()
        }
        // 舊格式（向後兼容）：🚗Sky 或 駕駛:Sky
        else if (part.startsWith('🚗')) {
          info.driver = part.replace(/^🚗\s*/, '').trim()
        }
        else if (part.startsWith('駕駛:') || part.startsWith('駕駛：')) {
          info.driver = part.replace(/^駕駛[:：]\s*/, '').trim()
        } else {
          // 教練
          const coachMatches = part.match(/([\u4e00-\u9fa5A-Za-z0-9\s]+?)(?:教練|老師)/g)
          if (coachMatches) {
            const coaches = coachMatches.map(m => m.replace(/教練|老師/g, '').trim())
            info.coach = coaches.join('/')
          }
        }
      }
      
      // 解析船隻和會員
      const firstSpaceIndex = beforePipe.indexOf(' ')
      if (firstSpaceIndex > 0) {
        info.boat = beforePipe.substring(0, firstSpaceIndex).trim()
        info.member = beforePipe.substring(firstSpaceIndex + 1).trim()
      } else {
        info.boat = beforePipe
      }
    } else {
      // 沒有管道符號，舊格式
      text = text.replace(/([\u4e00-\u9fa5A-Za-z0-9]+(?:\s+[\u4e00-\u9fa5A-Za-z0-9]+)*)\s*(?:教練|老師)/g, '').trim()
      
      const firstSpaceIndex = text.indexOf(' ')
      if (firstSpaceIndex > 0) {
        info.boat = text.substring(0, firstSpaceIndex).trim()
        info.member = text.substring(firstSpaceIndex + 1).trim()
      } else if (text.length > 0) {
        info.boat = text
      }
    }
  }
  
  const filledByMatch = details.match(/\((?:填表人|課堂人)[:：]\s*([^)]+)\)/)
  if (filledByMatch) {
    info.filledBy = filledByMatch[1].trim()
  }
  
  return info
}

/**
 * 高亮搜尋文字
 */
function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text
  
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  
  return parts.map((part, i) => 
    part.toLowerCase() === query.toLowerCase() 
      ? <mark key={i} style={{ background: '#ffeb3b', padding: '0 2px', borderRadius: '2px' }}>{part}</mark>
      : part
  )
}

/**
 * 格式化日期（用於分組標題）
 */
function formatDateHeader(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    const isToday = date.toDateString() === today.toDateString()
    const isYesterday = date.toDateString() === yesterday.toDateString()
    
    if (isToday) return `今天 ${month}/${day}`
    if (isYesterday) return `昨天 ${month}/${day}`
    
    const weekdays = ['日', '一', '二', '三', '四', '五', '六']
    const weekday = weekdays[date.getDay()]
    
    return `${month}/${day} (${weekday})`
  } catch {
    return dateStr
  }
}

// 操作類型配置
const OPERATION_CONFIG = {
  create: { 
    icon: '➕', 
    label: '新增', 
    color: '#28a745', 
    bgColor: '#d4edda',
    dotColor: '#28a745'
  },
  update: { 
    icon: '✏️', 
    label: '修改', 
    color: '#007bff', 
    bgColor: '#d1ecf1',
    dotColor: '#007bff'
  },
  delete: { 
    icon: '🗑️', 
    label: '刪除', 
    color: '#dc3545', 
    bgColor: '#f8d7da',
    dotColor: '#dc3545'
  },
} as const

export function AuditLog() {
  const user = useAuthUser()
  const navigate = useNavigate()
  const { isMobile } = useResponsive()
  
  // 權限檢查：需要一般權限
  useEffect(() => {
    const checkAccess = async () => {
      if (user) {
        const canAccess = await hasViewAccess(user)
        if (!canAccess) {
          navigate('/')
        }
      }
    }
    checkAccess()
  }, [user, navigate])
  
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'add' | 'edit' | 'delete' | 'schedule'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30)  // 預設 30 天
    return getLocalDateString(date)
  })
  const [endDate, setEndDate] = useState(() => {
    return getLocalDateString()
  })
  
  const [selectedFilledBy, setSelectedFilledBy] = useState<string>('all')
  
  // 預約日期篩選（MM/DD 格式，如 "04/03"）
  const [bookingDateFilter, setBookingDateFilter] = useState<string>('')
  
  // 進階篩選展開狀態
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  
  // 是否有設定進階篩選
  const hasAdvancedFilters = filter !== 'all' || selectedFilledBy !== 'all'

  /** 與人員管理「權限管理」分頁相同資料來源：view_users + editor_users */
  const [permissionDisplayByEmail, setPermissionDisplayByEmail] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!user) return
    let cancelled = false
    void (async () => {
      const [viewRes, editorRes] = await Promise.all([
        supabase.from('view_users').select('email, display_name'),
        supabase.from('editor_users').select('email, display_name'),
      ])
      if (cancelled) return
      if (viewRes.error) console.error('載入 view_users 失敗:', viewRes.error)
      if (editorRes.error) console.error('載入 editor_users 失敗:', editorRes.error)
      setPermissionDisplayByEmail(
        buildPermissionDisplayMap(
          viewRes.data as PermissionRow[] | null,
          editorRes.data as PermissionRow[] | null
        )
      )
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    fetchLogs()
  }, [filter, startDate, endDate])

  // 計算所有填表人
  const filledByList = useMemo(() => {
    const filledBySet = new Set<string>()
    let hasEmptyFilledBy = false
    
    logs.forEach(log => {
      if (log.table_name === 'coach_assignment') return
      
      if (!log.details) {
        hasEmptyFilledBy = true
        return
      }
      const parsed = parseDetails(log.details)
      if (parsed.filledBy) {
        filledBySet.add(parsed.filledBy)
      } else {
        hasEmptyFilledBy = true
      }
    })
    
    const list = Array.from(filledBySet).sort()
    if (hasEmptyFilledBy) {
      list.unshift('（無填表人）')
    }
    return list
  }, [logs])

  // 篩選邏輯
  const displayedLogs = useMemo(() => {
    let filtered = logs
    
    // 預約日期篩選（支援多種格式）
    if (bookingDateFilter.trim()) {
      const input = bookingDateFilter.trim()
      
      // 轉換各種格式為 MM/DD 標準格式
      let normalizedDate = input
      
      // 1218 → 12/18
      if (/^\d{4}$/.test(input)) {
        normalizedDate = `${input.slice(0, 2)}/${input.slice(2)}`
      }
      // 12-18 → 12/18
      else if (/^\d{1,2}-\d{1,2}$/.test(input)) {
        normalizedDate = input.replace('-', '/')
      }
      // 2024/12/18 → 12/18
      else if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(input)) {
        const parts = input.split('/')
        normalizedDate = `${parts[1]}/${parts[2]}`
      }
      // 2024-12-18 → 12/18
      else if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(input)) {
        const parts = input.split('-')
        normalizedDate = `${parts[1]}/${parts[2]}`
      }
      
      // 補零：4/3 → 04/03
      if (/^\d{1,2}\/\d{1,2}$/.test(normalizedDate)) {
        const [m, d] = normalizedDate.split('/')
        normalizedDate = `${m.padStart(2, '0')}/${d.padStart(2, '0')}`
      }
      
      filtered = filtered.filter(log => {
        if (log.table_name === 'coach_assignment') return false // 排班記錄不含預約日期
        if (!log.details) return false
        
        const parsed = parseDetails(log.details)
        
        // 檢查主要日期
        if (parsed.bookingDate && parsed.bookingDate.includes(normalizedDate)) return true
        
        // 檢查批次操作中的預約列表
        if (parsed.bookingList) {
          return parsed.bookingList.some(item => item.includes(normalizedDate))
        }
        
        // 直接在原始內容搜尋（也包含原始輸入格式）
        return log.details.includes(normalizedDate) || log.details.includes(input)
      })
    }
    
    if (selectedFilledBy !== 'all') {
      filtered = filtered.filter(log => {
        // 排班記錄沒有填表人，選擇特定填表人時應過濾掉
        if (log.table_name === 'coach_assignment') return false
        
        if (!log.details) {
          return selectedFilledBy === '（無填表人）'
        }
        const parsed = parseDetails(log.details)
        if (selectedFilledBy === '（無填表人）') {
          return !parsed.filledBy
        }
        return parsed.filledBy === selectedFilledBy
      })
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(log => {
        // 搜尋原始 details（包含日期、時間、會員名等）
        const detailsMatch = log.details && log.details.toLowerCase().includes(query)
        const emailMatch = log.user_email && log.user_email.toLowerCase().includes(query)
        const operatorLabel = log.user_email
          ? actorLabelFromPermissionTables(log.user_email, permissionDisplayByEmail)
          : ''
        const operatorMatch = operatorLabel.toLowerCase().includes(query)
        
        if (!log.details) return detailsMatch || emailMatch || operatorMatch
        
        const parsed = parseDetails(log.details)
        const filledByMatch = parsed.filledBy && parsed.filledBy.toLowerCase().includes(query)
        const memberMatch = parsed.member && parsed.member.toLowerCase().includes(query)
        const boatMatch = parsed.boat && parsed.boat.toLowerCase().includes(query)
        const timeMatch = parsed.time && parsed.time.toLowerCase().includes(query)
        const coachMatch = parsed.coach && parsed.coach.toLowerCase().includes(query)
        const driverMatch = parsed.driver && parsed.driver.toLowerCase().includes(query)
        const activityMatch = parsed.activityTypes && parsed.activityTypes.toLowerCase().includes(query)
        const notesMatch = parsed.notes && parsed.notes.toLowerCase().includes(query)
        
        return detailsMatch || emailMatch || operatorMatch || filledByMatch || memberMatch || boatMatch || timeMatch || coachMatch || driverMatch || activityMatch || notesMatch
      })
    }
    
    return filtered
  }, [logs, selectedFilledBy, searchQuery, bookingDateFilter, permissionDisplayByEmail])

  // 按日期分組
  const groupedLogs = useMemo(() => {
    const groups: Record<string, AuditLogEntry[]> = {}
    
    displayedLogs.forEach(log => {
      if (!log.created_at) return
      const date = log.created_at.split('T')[0]
      if (!groups[date]) groups[date] = []
      groups[date].push(log)
    })
    
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
  }, [displayedLogs])

  const fetchLogs = async () => {
    setLoading(true)
    
    try {
      const startDateStr = `${startDate}T00:00:00`
      const endDateStr = `${endDate}T23:59:59`
      
      let query = supabase
        .from('audit_log')
        .select('id, user_email, action, table_name, details, created_at')
        .in('table_name', ['bookings', 'coach_assignment'])
        .gte('created_at', startDateStr)
        .lte('created_at', endDateStr)
        .order('created_at', { ascending: false })
        .limit(500)

      if (filter !== 'all') {
        if (filter === 'schedule') {
          // 篩選排班記錄
          query = query.eq('table_name', 'coach_assignment')
        } else {
          // 篩選預約操作類型，排除排班
          const actionMap = { 'add': 'create', 'edit': 'update', 'delete': 'delete' } as const
          query = query
            .eq('action', actionMap[filter])
            .eq('table_name', 'bookings')
        }
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching audit logs:', error)
      } else {
        setLogs(data || [])
      }
    } catch (err) {
      console.error('Fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const getTimeOnly = (dateString: string) => {
    if (!dateString) return ''
    try {
      return dateString.substring(11, 16)
    } catch {
      return ''
    }
  }

  const getOperationConfig = (action: string) => {
    return OPERATION_CONFIG[action as keyof typeof OPERATION_CONFIG] || OPERATION_CONFIG.update
  }

  const getOperationText = (action: string, tableName: string, details?: string) => {
    if (tableName === 'coach_assignment') return '排班'
    if (details?.startsWith('批次修改')) return '批次修改'
    if (details?.startsWith('批次刪除')) return '批次刪除'
    if (details?.startsWith('重複預約')) return '重複預約'
    return getOperationConfig(action).label + '預約'
  }

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const setQuickDateRange = (range: 'today' | '7days' | '30days' | '90days') => {
    const end = getLocalDateString()
    setEndDate(end)
    
    const start = new Date()
    switch (range) {
      case 'today':
        setStartDate(end)
        break
      case '7days':
        start.setDate(start.getDate() - 7)
        setStartDate(getLocalDateString(start))
        break
      case '30days':
        start.setDate(start.getDate() - 30)
        setStartDate(getLocalDateString(start))
        break
      case '90days':
        start.setDate(start.getDate() - 90)
        setStartDate(getLocalDateString(start))
        break
    }
  }

  return (
    <div style={{
      padding: isMobile ? '10px' : '15px',
      maxWidth: '900px',
      margin: '0 auto',
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
    }}>
      <PageHeader title="📝 編輯記錄" user={user} />

      {/* 篩選區 */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: isMobile ? '16px' : '24px',
        marginBottom: '15px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}>
        {/* 搜尋框 */}
        <div style={{ marginBottom: '12px' }}>
          <input
            type="text"
            placeholder="🔍 搜尋會員、船隻、填表人..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '14px 16px',
              fontSize: isMobile ? '16px' : '15px',
              border: '2px solid #e0e0e0',
              borderRadius: '8px',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = '#5a5a5a'}
            onBlur={(e) => e.currentTarget.style.borderColor = '#e0e0e0'}
          />
        </div>

        {/* 預約日期篩選 - 放最外面 */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="📅 預約日期（如 12/18 或 1218）"
              value={bookingDateFilter}
              onChange={(e) => setBookingDateFilter(e.target.value)}
              style={{
                flex: 1,
                padding: '14px 16px',
                fontSize: isMobile ? '16px' : '15px',
                border: bookingDateFilter ? '2px solid #5a5a5a' : '2px solid #e0e0e0',
                borderRadius: '8px',
                outline: 'none',
                background: bookingDateFilter ? '#f8f9fa' : 'white',
                boxSizing: 'border-box',
                transition: 'all 0.2s',
              }}
            />
            {bookingDateFilter && (
              <button
                onClick={() => setBookingDateFilter('')}
                style={{
                  padding: '14px 16px',
                  fontSize: '14px',
                  border: 'none',
                  borderRadius: '8px',
                  background: '#5a5a5a',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: '600',
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* 進階篩選按鈕 */}
        <button
          data-track="audit_advanced_filters"
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '14px',
            fontWeight: '500',
            border: hasAdvancedFilters ? '2px solid #5a5a5a' : '1px solid #e0e0e0',
            borderRadius: '8px',
            background: hasAdvancedFilters ? '#f0f0f0' : 'white',
            color: '#666',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s',
          }}
        >
          {showAdvancedFilters ? '收起篩選' : '更多篩選'}
          {hasAdvancedFilters && (
            <span style={{
              padding: '2px 8px',
              background: '#5a5a5a',
              color: 'white',
              borderRadius: '10px',
              fontSize: '12px',
            }}>
              {[
                filter !== 'all' ? 1 : 0,
                selectedFilledBy !== 'all' ? 1 : 0,
              ].reduce((a, b) => a + b, 0)}
            </span>
          )}
          <span style={{ 
            fontSize: '10px',
            transform: showAdvancedFilters ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}>▼</span>
        </button>

        {/* 進階篩選區（可摺疊） */}
        <div style={{
          maxHeight: showAdvancedFilters ? '600px' : '0',
          overflow: 'hidden',
          transition: 'max-height 0.3s ease',
        }}>
          <div style={{
            marginTop: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}>
            {/* 操作類型篩選 */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '13px',
                color: '#868e96',
                fontWeight: '500'
              }}>
                操作類型
              </label>
              <div style={{
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap',
              }}>
                {[
                  { key: 'all', label: '全部' },
                  { key: 'add', label: '➕ 新增' },
                  { key: 'edit', label: '✏️ 修改' },
                  { key: 'delete', label: '🗑️ 刪除' },
                  { key: 'schedule', label: '📅 排班' },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    data-track={`audit_filter_${key}`}
                    onClick={() => setFilter(key as any)}
                    style={{
                      padding: '10px 16px',
                      fontSize: '14px',
                      fontWeight: filter === key ? '600' : '500',
                      border: filter === key ? '2px solid #5a5a5a' : '2px solid #e0e0e0',
                      borderRadius: '20px',
                      background: filter === key ? '#f0f0f0' : 'white',
                      color: filter === key ? '#5a5a5a' : '#333',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 記錄時間 */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '13px',
                color: '#868e96',
                fontWeight: '500'
              }}>
                記錄時間範圍
              </label>
              {/* 快選按鈕 */}
              <div style={{ 
                display: 'flex', 
                gap: '8px',
                marginBottom: '8px',
                flexWrap: 'wrap',
              }}>
                {[
                  { key: 'today', label: '今天' },
                  { key: '7days', label: '7天' },
                  { key: '30days', label: '30天' },
                  { key: '90days', label: '90天' },
                ].map(({ key, label }) => {
                  const isActive = (() => {
                    const end = getLocalDateString()
                    const start = new Date()
                    if (key === 'today') return startDate === end && endDate === end
                    if (key === '7days') {
                      start.setDate(start.getDate() - 7)
                      return startDate === getLocalDateString(start) && endDate === end
                    }
                    if (key === '30days') {
                      start.setDate(start.getDate() - 30)
                      return startDate === getLocalDateString(start) && endDate === end
                    }
                    if (key === '90days') {
                      start.setDate(start.getDate() - 90)
                      return startDate === getLocalDateString(start) && endDate === end
                    }
                    return false
                  })()
                  
                  return (
                    <button
                      key={key}
                      data-track={`audit_quick_${key}`}
                      onClick={() => setQuickDateRange(key as any)}
                      style={{
                        padding: '10px 16px',
                        fontSize: '14px',
                        fontWeight: isActive ? '600' : '500',
                        border: isActive ? '2px solid #5a5a5a' : '2px solid #e0e0e0',
                        borderRadius: '20px',
                        background: isActive ? '#f0f0f0' : 'white',
                        color: isActive ? '#5a5a5a' : '#333',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
              {/* 自訂日期 */}
              <div style={{ 
                display: 'flex', 
                gap: '8px',
                alignItems: 'center',
                width: '100%',
              }}>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '12px 10px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                  }}
                />
                <span style={{ fontSize: '14px', color: '#999', flexShrink: 0 }}>→</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '12px 10px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* 填表人篩選 */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '13px',
                color: '#868e96',
                fontWeight: '500'
              }}>
                填表人
              </label>
              <select
                value={selectedFilledBy}
                onChange={(e) => setSelectedFilledBy(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  fontSize: isMobile ? '16px' : '15px',
                  border: selectedFilledBy !== 'all' ? '2px solid #5a5a5a' : '2px solid #e0e0e0',
                  borderRadius: '8px',
                  outline: 'none',
                  cursor: 'pointer',
                  background: 'white',
                  boxSizing: 'border-box',
                }}
              >
                <option value="all">全部填表人</option>
                {filledByList.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            {/* 清除所有進階篩選 */}
            {hasAdvancedFilters && (
              <button
                onClick={() => {
                  setFilter('all')
                  setSelectedFilledBy('all')
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '14px',
                  fontWeight: '600',
                  border: 'none',
                  borderRadius: '8px',
                  background: '#dc3545',
                  color: 'white',
                  cursor: 'pointer',
                }}
              >
                清除所有篩選
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 結果統計 */}
      {!loading && logs.length > 0 && (
        <div style={{
          marginBottom: '12px',
          fontSize: '14px',
          color: '#666',
          padding: '0 4px',
        }}>
          {searchQuery || selectedFilledBy !== 'all' || filter !== 'all' || bookingDateFilter ? (
            <>
              找到 <strong style={{ color: '#5a5a5a' }}>{displayedLogs.length}</strong> 筆記錄（共 {logs.length} 筆）
              {bookingDateFilter && (
                <span style={{ 
                  marginLeft: '8px',
                  padding: '3px 10px',
                  background: '#fff3e0',
                  borderRadius: '12px',
                  fontSize: '13px',
                  color: '#e65100',
                  fontWeight: '500',
                }}>
                  📅 預約 {bookingDateFilter}
                </span>
              )}
            </>
          ) : (
            <>共 <strong style={{ color: '#5a5a5a' }}>{logs.length}</strong> 筆記錄</>
          )}
        </div>
      )}

      {/* 記錄列表 */}
      {loading ? (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          background: 'white',
          borderRadius: '12px',
          color: '#666',
        }}>
          載入中...
        </div>
      ) : displayedLogs.length === 0 ? (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          background: 'white',
          borderRadius: '12px',
          color: '#999',
        }}>
          {searchQuery || selectedFilledBy !== 'all' || filter !== 'all' || bookingDateFilter ? (
            <div>
              <div style={{ marginBottom: '8px' }}>沒有符合的記錄</div>
              {bookingDateFilter && (
                <div style={{ fontSize: '13px', color: '#666' }}>
                  找不到 <strong>{bookingDateFilter}</strong> 的預約變更記錄
                  <br />
                  <span style={{ fontSize: '12px', color: '#999' }}>
                    💡 提示：請確認記錄時間範圍足夠長（可選 30 或 90 天）
                  </span>
                </div>
              )}
            </div>
          ) : '沒有記錄'}
        </div>
      ) : (
        // 時間軸列表
        <div>
          {groupedLogs.map(([date, logsInDate]) => (
            <div key={date} style={{ marginBottom: '24px' }}>
              {/* 日期標題 */}
              <div style={{
                position: 'sticky',
                top: isMobile ? '0' : '0',
                zIndex: 10,
                background: '#f5f5f5',
                paddingTop: '4px',
                paddingBottom: '8px',
              }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  background: '#e8f4fd',
                  border: '2px solid #4a90d9',
                  borderRadius: '20px',
                }}>
                  <span style={{ fontSize: '14px' }}>📅</span>
                  <span style={{ 
                    color: '#2171b5', 
                    fontWeight: '600',
                    fontSize: '14px',
                  }}>
                    {formatDateHeader(date)}
                  </span>
                  <span style={{
                    background: 'rgba(255,255,255,0.2)',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '12px',
                    color: 'white',
                  }}>
                    {logsInDate.length}
                  </span>
                </div>
              </div>

              {/* 時間軸 */}
              <div style={{ 
                position: 'relative',
                paddingLeft: '28px',
              }}>
                {/* 垂直線 */}
                <div style={{
                  position: 'absolute',
                  left: '9px',
                  top: '20px',
                  bottom: '20px',
                  width: '2px',
                  background: 'linear-gradient(180deg, #dee2e6, #f0f0f0)',
                  borderRadius: '1px',
                }} />

                {/* 記錄卡片 */}
                {logsInDate.map((log, idx) => {
                  const parsed = parseDetails(log.details || '')
                  const config = getOperationConfig(log.action)
                  const isExpanded = expandedIds.has(log.id)
                  const isLast = idx === logsInDate.length - 1
                  
                  // 生成摘要
                  const summary = (() => {
                    if (log.table_name === 'coach_assignment') {
                      // logCoachAssignment 格式：排班：2025/11/20 14:45 G23 會員，變更：…
                      return log.details?.replace(/^排班[:：]\s*/, '') || '排班調整'
                    }
                    
                    // 批次操作和重複預約：顯示筆數 + 內容 + 預約列表預覽
                    const isBatch = log.details?.startsWith('批次修改') || log.details?.startsWith('批次刪除')
                    const isRepeatBooking = log.details?.startsWith('重複預約')
                    
                    if (isBatch || isRepeatBooking) {
                      const parts: string[] = []
                      
                      if (isRepeatBooking) {
                        // 重複預約：顯示船隻、會員、教練
                        if (parsed.boat) parts.push(parsed.boat)
                        if (parsed.member) parts.push(parsed.member)
                        if (parsed.coach) parts.push(parsed.coach + '教練')
                      } else {
                        // 批次修改/刪除
                        if (parsed.member) parts.push(parsed.member)  // 筆數
                        if (parsed.changeSummary) parts.push(parsed.changeSummary)
                      }
                      
                      // 顯示前 2 筆預約的簡短資訊
                      if (parsed.bookingList && parsed.bookingList.length > 0) {
                        const previews = parsed.bookingList.slice(0, 2).map(item => {
                          // "Ming (04/03 08:30)" → "Ming 04/03" 或 "04/03 10:00" → "04/03 10:00"
                          const match = item.match(/^(.+?)\s*\((\d{1,2}\/\d{1,2})/)
                          if (match) return `${match[1]} ${match[2]}`
                          // 純時間格式
                          return item.substring(0, 15)
                        })
                        const previewText = previews.join(', ')
                        // ✅ 使用真實總筆數計算剩餘數量（如果有的話）
                        const totalCount = parsed.totalCount || parsed.bookingList.length
                        const moreText = totalCount > 2 ? ` +${totalCount - 2}` : ''
                        parts.push(`[${previewText}${moreText}]`)
                      }
                      
                      return parts.join(' · ') || (log.details?.startsWith('批次刪除') ? '刪除' : log.details?.startsWith('重複預約') ? '重複預約' : '修改')
                    }
                    
                    // 修改預約：顯示預約時間 + 會員 + 變更摘要
                    if (log.action === 'update' && parsed.changeSummary) {
                      const parts: string[] = []
                      if (parsed.time) parts.push(parsed.time)  // 預約日期時間
                      if (parsed.member) parts.push(parsed.member)
                      parts.push(`改${parsed.changeSummary}`)
                      return parts.join(' · ')
                    }
                    
                    // 一般預約：顯示預約時間 + 船隻 + 會員 + 備註預覽
                    const parts: string[] = []
                    if (parsed.time) parts.push(parsed.time)  // 預約日期時間
                    if (parsed.boat) parts.push(parsed.boat)
                    if (parsed.member) parts.push(parsed.member)
                    if (parsed.coach) parts.push(parsed.coach + '教練')
                    // 如果是刪除操作且有備註，在摘要中顯示備註預覽
                    if (log.action === 'delete' && parsed.notes) {
                      const notePreview = parsed.notes.length > 15 ? parsed.notes.substring(0, 15) + '...' : parsed.notes
                      parts.push(`[${notePreview}]`)
                    }
                    return parts.join(' · ') || getOperationText(log.action, log.table_name || '', log.details || '')
                  })()
                  
                  return (
                    <div
                      key={log.id}
                      style={{
                        position: 'relative',
                        marginBottom: isLast ? 0 : '8px',
                      }}
                    >
                      {/* 時間軸圓點 */}
                      <div style={{
                        position: 'absolute',
                        left: '-23px',
                        top: '16px',
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: config.dotColor,
                        border: '2px solid white',
                        boxShadow: '0 0 0 2px #f5f5f5',
                        zIndex: 1,
                      }} />

                      {/* 卡片 */}
                      <div
                        onClick={() => toggleExpand(log.id)}
                        style={{
                          background: 'white',
                          borderRadius: '10px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          transition: 'box-shadow 0.2s',
                          border: '1px solid #f0f0f0',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)'
                        }}
                      >
                        {/* 摘要行 */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '12px 14px',
                          gap: '10px',
                        }}>
                          {/* 時間 */}
                          <span style={{
                            fontSize: '13px',
                            fontFamily: 'ui-monospace, monospace',
                            color: '#999',
                            minWidth: '42px',
                          }}>
                            {getTimeOnly(log.created_at || '')}
                          </span>

                          {/* 操作標籤 */}
                          <span style={{
                            padding: '3px 8px',
                            fontSize: '12px',
                            fontWeight: '600',
                            borderRadius: '4px',
                            background: config.bgColor,
                            color: config.color,
                            whiteSpace: 'nowrap',
                          }}>
                            {config.icon} {getOperationText(log.action, log.table_name || '', log.details || '')}
                          </span>

                          {/* 摘要內容 */}
                          <span style={{
                            flex: 1,
                            fontSize: '14px',
                            color: '#333',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {highlightText(summary, searchQuery)}
                          </span>

                          {/* 填表人 / 操作者 */}
                          {(parsed.filledBy || log.table_name === 'coach_assignment') && (
                            <span style={{
                              fontSize: '12px',
                              color: '#999',
                              padding: '2px 8px',
                              background: '#f5f5f5',
                              borderRadius: '4px',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                            }}>
                              {parsed.filledBy ||
                                actorLabelFromPermissionTables(log.user_email, permissionDisplayByEmail)}
                            </span>
                          )}

                          {/* 展開指示器 */}
                          <span style={{
                            fontSize: '10px',
                            color: '#ccc',
                            transition: 'transform 0.2s',
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                          }}>
                            ▼
                          </span>
                        </div>

                        {/* 展開詳情 */}
                        <div style={{
                          maxHeight: isExpanded ? '400px' : '0',
                          overflow: 'hidden',
                          transition: 'max-height 0.3s ease-out',
                        }}>
                          <div style={{
                            padding: '0 14px 14px',
                            borderTop: '1px solid #f0f0f0',
                          }}>
                            {/* 標籤區 */}
                            {(parsed.member || parsed.boat || parsed.coach || parsed.driver || parsed.time || parsed.duration || parsed.activityTypes || parsed.notes) && (
                              <div style={{ 
                                display: 'flex', 
                                gap: '6px', 
                                flexWrap: 'wrap', 
                                marginTop: '12px',
                                marginBottom: '10px',
                              }}>
                                {parsed.boat && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setSearchQuery(parsed.boat!) }}
                                    style={{
                                      padding: '5px 10px',
                                      fontSize: '12px',
                                      border: 'none',
                                      borderRadius: '4px',
                                      background: '#f3e5f5',
                                      color: '#7b1fa2',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    🚤 {parsed.boat}
                                  </button>
                                )}
                                {parsed.member && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setSearchQuery(parsed.member!) }}
                                    style={{
                                      padding: '5px 10px',
                                      fontSize: '12px',
                                      border: 'none',
                                      borderRadius: '4px',
                                      background: '#e3f2fd',
                                      color: '#1976d2',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    👤 {parsed.member}
                                  </button>
                                )}
                                {parsed.coach && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setSearchQuery(parsed.coach!) }}
                                    style={{
                                      padding: '5px 10px',
                                      fontSize: '12px',
                                      border: 'none',
                                      borderRadius: '4px',
                                      background: '#fff3e0',
                                      color: '#e65100',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    🎓 {parsed.coach}
                                  </button>
                                )}
                                {parsed.driver && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setSearchQuery(parsed.driver!) }}
                                    style={{
                                      padding: '5px 10px',
                                      fontSize: '12px',
                                      border: 'none',
                                      borderRadius: '4px',
                                      background: '#e1f5fe',
                                      color: '#0277bd',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    🚤 {parsed.driver}
                                  </button>
                                )}
                                {parsed.time && (
                                  <button
                                    onClick={(e) => { 
                                      e.stopPropagation()
                                      if (parsed.bookingDate) setBookingDateFilter(parsed.bookingDate)
                                    }}
                                    style={{
                                      padding: '5px 10px',
                                      fontSize: '12px',
                                      borderRadius: '4px',
                                      background: '#e8f5e9',
                                      color: '#2e7d32',
                                      border: 'none',
                                      cursor: parsed.bookingDate ? 'pointer' : 'default',
                                    }}
                                    title={parsed.bookingDate ? `點擊篩選 ${parsed.bookingDate} 的預約` : undefined}
                                  >
                                    🕐 {parsed.time}
                                  </button>
                                )}
                                {parsed.duration && (
                                  <span style={{
                                    padding: '5px 10px',
                                    fontSize: '12px',
                                    borderRadius: '4px',
                                    background: '#fce4ec',
                                    color: '#c2185b',
                                  }}>
                                    ⏱️ {parsed.duration}
                                  </span>
                                )}
                                {parsed.activityTypes && (
                                  <span style={{
                                    padding: '5px 10px',
                                    fontSize: '12px',
                                    borderRadius: '4px',
                                    background: '#f3e5f5',
                                    color: '#8e24aa',
                                    fontWeight: '600',
                                  }}>
                                    🏄 {parsed.activityTypes}
                                  </span>
                                )}
                                {parsed.notes && (
                                  <span style={{
                                    padding: '5px 10px',
                                    fontSize: '12px',
                                    borderRadius: '4px',
                                    background: '#fff9e6',
                                    color: '#d97706',
                                    border: '1px solid #fcd34d',
                                    maxWidth: '300px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title={parsed.notes}
                                  >
                                    📝 {parsed.notes}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* 批次操作：顯示預約列表 */}
                            {parsed.bookingList && parsed.bookingList.length > 0 && (
                              <div style={{
                                marginTop: '12px',
                                marginBottom: '12px',
                                padding: '12px',
                                background: '#f8f9fa',
                                borderRadius: '8px',
                                border: '1px solid #e0e0e0',
                              }}>
                                <div style={{ 
                                  fontSize: '12px', 
                                  color: '#666', 
                                  marginBottom: '8px',
                                  fontWeight: '600',
                                }}>
                                  {/* ✅ 如果有真實總筆數且與顯示筆數不同，則標註 */}
                                  {parsed.totalCount && parsed.totalCount > parsed.bookingList.length ? (
                                    <>📋 涉及的預約（顯示 {parsed.bookingList.length} 筆，共 {parsed.totalCount} 筆）：</>
                                  ) : (
                                    <>📋 涉及的預約（{parsed.bookingList.length} 筆）：</>
                                  )}
                                </div>
                                <div style={{ 
                                  display: 'flex', 
                                  flexWrap: 'wrap', 
                                  gap: '6px',
                                }}>
                                  {parsed.bookingList.map((item, idx) => {
                                    // 解析 "Ming (04/03 08:30)" 格式
                                    const match = item.match(/^(.+?)\s*\((\d{1,2}\/\d{1,2})\s+(\d{2}:\d{2})\)/)
                                    const name = match ? match[1].trim() : item
                                    const date = match ? match[2] : ''
                                    const time = match ? match[3] : ''
                                    
                                    return (
                                      <button
                                        key={idx}
                                        onClick={(e) => { 
                                          e.stopPropagation()
                                          if (date) setBookingDateFilter(date)
                                        }}
                                        style={{
                                          padding: '4px 10px',
                                          fontSize: '12px',
                                          border: 'none',
                                          borderRadius: '4px',
                                          background: '#fff3e0',
                                          color: '#e65100',
                                          cursor: date ? 'pointer' : 'default',
                                          display: 'flex',
                                          gap: '4px',
                                          alignItems: 'center',
                                        }}
                                        title={date ? `點擊篩選 ${date} 的預約` : undefined}
                                      >
                                        <span style={{ fontWeight: '500' }}>{name}</span>
                                        {date && (
                                          <span style={{ color: '#ff9800', fontSize: '11px' }}>
                                            {date} {time}
                                          </span>
                                        )}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            )}

                            {/* 填表人/操作者資訊 */}
                            <div style={{ 
                              fontSize: '13px', 
                              color: '#666',
                              marginBottom: '10px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              flexWrap: 'wrap',
                            }}>
                              {log.table_name === 'coach_assignment' ? (
                                <>
                                  <span style={{ color: '#999' }}>操作者：</span>
                                  <span title={log.user_email || undefined}>
                                    {actorLabelFromPermissionTables(log.user_email, permissionDisplayByEmail)}
                                  </span>
                                </>
                              ) : parsed.filledBy ? (
                                <>
                                  <span style={{ color: '#999' }}>填表人：</span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setSelectedFilledBy(parsed.filledBy!) }}
                                    style={{
                                      padding: '3px 8px',
                                      fontSize: '12px',
                                      border: 'none',
                                      borderRadius: '4px',
                                      background: '#e3f2fd',
                                      color: '#1565c0',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    📝 {parsed.filledBy}
                                  </button>
                                </>
                              ) : (
                                <>
                                  <span style={{ color: '#999' }}>操作者：</span>
                                  <span title={log.user_email || undefined}>
                                    {actorLabelFromPermissionTables(log.user_email, permissionDisplayByEmail)}
                                  </span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setSelectedFilledBy('（無填表人）') }}
                                    style={{
                                      padding: '2px 6px',
                                      fontSize: '11px',
                                      border: '1px solid #e0e0e0',
                                      borderRadius: '4px',
                                      background: 'white',
                                      color: '#999',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    舊資料
                                  </button>
                                </>
                              )}
                            </div>

                            {/* 完整記錄 */}
                            <div style={{
                              padding: '10px 12px',
                              background: '#f8f9fa',
                              borderRadius: '6px',
                              fontSize: '13px',
                              color: '#333',
                              whiteSpace: 'pre-wrap',
                              lineHeight: '1.6',
                            }}>
                              {highlightText(log.details || '', searchQuery)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
