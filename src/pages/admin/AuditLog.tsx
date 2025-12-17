import { useState, useEffect, useMemo } from 'react'
import { useAuthUser } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { useResponsive } from '../../hooks/useResponsive'
import { getLocalDateString } from '../../utils/date'

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
  time?: string
  duration?: string
  filledBy?: string  // 填表人
  rawText: string
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
  
  if (isBatchEdit || isBatchDelete) {
    const filledByMatch = details.match(/填表人[:：]\s*([^)]+)/)
    if (filledByMatch) info.filledBy = filledByMatch[1].trim()
    return info
  }
  
  const timeMatch = details.match(/(\d{4}\/\d{1,2}\/\d{1,2}\s+\d{2}:\d{2}|\d{1,2}\/\d{1,2}\s+\d{2}:\d{2})/)
  if (timeMatch) info.time = timeMatch[1]
  
  const durationMatch = details.match(/(\d+)\s*分/)
  if (durationMatch) info.duration = `${durationMatch[1]}分`
  
  if (isCreate) {
    let text = details
      .replace(/^新增預約[:：]\s*/, '')
      .replace(/\d{4}\/\d{1,2}\/\d{1,2}\s+\d{2}:\d{2}|\d{1,2}\/\d{1,2}\s+\d{2}:\d{2}/, '')
      .replace(/\d+\s*分/, '')
      .trim()
    
    text = text.replace(/\s*\([^)]*[填表人課堂][^)]*\)\s*/g, '').trim()
    
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
    const boatChangeMatch = details.match(/船隻[:：]\s*[^→]*→\s*([^，\s]+)/)
    if (boatChangeMatch) {
      info.boat = boatChangeMatch[1].trim()
    }
    
    const contactChangeMatch = details.match(/聯絡[:：]\s*[^→]*→\s*([^，\s]+)/)
    if (contactChangeMatch) {
      info.member = contactChangeMatch[1].trim()
    }
    
  } else if (isDelete) {
    let text = details
      .replace(/^刪除預約[:：]\s*/, '')
      .replace(/\d{4}\/\d{1,2}\/\d{1,2}\s+\d{2}:\d{2}|\d{1,2}\/\d{1,2}\s+\d{2}:\d{2}/, '')
      .replace(/\d+\s*分/, '')
      .trim()
    
    text = text.replace(/\s*\([^)]*[填表人課堂][^)]*\)\s*/g, '').trim()
    text = text.replace(/([\u4e00-\u9fa5A-Za-z0-9]+(?:\s+[\u4e00-\u9fa5A-Za-z0-9]+)*)\s*(?:教練|老師)/g, '').trim()
    
    const firstSpaceIndex = text.indexOf(' ')
    if (firstSpaceIndex > 0) {
      info.boat = text.substring(0, firstSpaceIndex).trim()
      info.member = text.substring(firstSpaceIndex + 1).trim()
    } else if (text.length > 0) {
      info.boat = text
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
      ? <mark key={i} style={{ background: '#fef08a', padding: '0 2px', borderRadius: '2px' }}>{part}</mark>
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
    color: '#059669', 
    bgColor: '#d1fae5',
    dotColor: '#10b981'
  },
  update: { 
    icon: '✏️', 
    label: '修改', 
    color: '#2563eb', 
    bgColor: '#dbeafe',
    dotColor: '#3b82f6'
  },
  delete: { 
    icon: '🗑️', 
    label: '刪除', 
    color: '#dc2626', 
    bgColor: '#fee2e2',
    dotColor: '#ef4444'
  },
} as const

export function AuditLog() {
  const user = useAuthUser()
  const { isMobile } = useResponsive()
  
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'add' | 'edit' | 'delete'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 7)
    return getLocalDateString(date)
  })
  const [endDate, setEndDate] = useState(() => {
    return getLocalDateString()
  })
  
  const [selectedFilledBy, setSelectedFilledBy] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)

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
    
    if (selectedFilledBy !== 'all') {
      filtered = filtered.filter(log => {
        if (log.table_name === 'coach_assignment') return true
        
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
        const detailsMatch = log.details && log.details.toLowerCase().includes(query)
        const emailMatch = log.user_email && log.user_email.toLowerCase().includes(query)
        
        if (!log.details) return detailsMatch || emailMatch
        
        const parsed = parseDetails(log.details)
        const filledByMatch = parsed.filledBy && parsed.filledBy.toLowerCase().includes(query)
        
        return detailsMatch || emailMatch || filledByMatch
      })
    }
    
    return filtered
  }, [logs, selectedFilledBy, searchQuery])

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
        .select('*')
        .in('table_name', ['bookings', 'coach_assignment'])
        .gte('created_at', startDateStr)
        .lte('created_at', endDateStr)
        .order('created_at', { ascending: false })
        .limit(500)

      if (filter !== 'all') {
        const actionMap = { 'add': 'create', 'edit': 'update', 'delete': 'delete' }
        query = query.eq('action', actionMap[filter])
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
      return dateString.substring(11, 16) // HH:MM
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

  // 計算篩選條件數量
  const activeFilterCount = [
    filter !== 'all',
    selectedFilledBy !== 'all',
  ].filter(Boolean).length

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
    }}>
      {/* Header */}
      <div style={{
        background: 'rgba(30, 41, 59, 0.95)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{
          maxWidth: '900px',
          margin: '0 auto',
          padding: isMobile ? '12px 16px' : '16px 24px',
        }}>
          <PageHeader title="📋 編輯記錄" user={user} />
        </div>
      </div>

      {/* Main Content */}
      <div style={{
        maxWidth: '900px',
        margin: '0 auto',
        padding: isMobile ? '16px' : '24px',
      }}>
        
        {/* 搜尋與篩選區 */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.08)',
          padding: '16px',
          marginBottom: '20px',
        }}>
          {/* 搜尋框 */}
          <div style={{ 
            display: 'flex', 
            gap: '12px',
            marginBottom: '16px',
          }}>
            <div style={{ 
              flex: 1, 
              position: 'relative',
            }}>
              <input
                type="text"
                placeholder="搜尋會員、船隻、填表人..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px 12px 44px',
                  fontSize: '15px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  color: '#f1f5f9',
                  outline: 'none',
                  transition: 'all 0.2s',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)'
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                }}
              />
              <span style={{
                position: 'absolute',
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '18px',
                opacity: 0.5,
              }}>🔍</span>
            </div>
            
            {/* 篩選按鈕 */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              style={{
                padding: '12px 16px',
                background: showFilters ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${showFilters ? 'rgba(59, 130, 246, 0.5)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: '12px',
                color: '#f1f5f9',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                transition: 'all 0.2s',
              }}
            >
              <span>⚙️</span>
              {activeFilterCount > 0 && (
                <span style={{
                  background: '#3b82f6',
                  color: 'white',
                  borderRadius: '10px',
                  padding: '2px 8px',
                  fontSize: '12px',
                  fontWeight: '600',
                }}>
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* 快速日期選擇 */}
          <div style={{ 
            display: 'flex', 
            gap: '8px', 
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
                  onClick={() => setQuickDateRange(key as any)}
                  style={{
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: '500',
                    border: 'none',
                    borderRadius: '20px',
                    background: isActive 
                      ? 'linear-gradient(135deg, #3b82f6, #2563eb)' 
                      : 'rgba(255,255,255,0.08)',
                    color: isActive ? 'white' : 'rgba(255,255,255,0.7)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {label}
                </button>
              )
            })}
            
            {/* 自訂日期 */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              marginLeft: 'auto',
            }}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  padding: '6px 10px',
                  fontSize: '13px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: '#f1f5f9',
                  outline: 'none',
                }}
              />
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>→</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  padding: '6px 10px',
                  fontSize: '13px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: '#f1f5f9',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* 展開的篩選區 */}
          {showFilters && (
            <div style={{
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              {/* 操作類型篩選 */}
              <div>
                <div style={{ 
                  fontSize: '12px', 
                  color: 'rgba(255,255,255,0.5)', 
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  操作類型
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[
                    { key: 'all', label: '全部', icon: '📋' },
                    { key: 'add', label: '新增', icon: '➕', color: '#10b981' },
                    { key: 'edit', label: '修改', icon: '✏️', color: '#3b82f6' },
                    { key: 'delete', label: '刪除', icon: '🗑️', color: '#ef4444' },
                  ].map(({ key, label, icon, color }) => (
                    <button
                      key={key}
                      onClick={() => setFilter(key as any)}
                      style={{
                        padding: '8px 14px',
                        fontSize: '13px',
                        fontWeight: '500',
                        border: filter === key 
                          ? `1px solid ${color || 'rgba(255,255,255,0.3)'}` 
                          : '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        background: filter === key 
                          ? `${color || 'rgba(255,255,255,0.1)'}20` 
                          : 'transparent',
                        color: filter === key ? (color || '#f1f5f9') : 'rgba(255,255,255,0.6)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s',
                      }}
                    >
                      <span>{icon}</span>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 填表人篩選 */}
              <div>
                <div style={{ 
                  fontSize: '12px', 
                  color: 'rgba(255,255,255,0.5)', 
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  填表人
                </div>
                <select
                  value={selectedFilledBy}
                  onChange={(e) => setSelectedFilledBy(e.target.value)}
                  style={{
                    padding: '10px 14px',
                    fontSize: '14px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: '#f1f5f9',
                    outline: 'none',
                    cursor: 'pointer',
                    minWidth: '180px',
                  }}
                >
                  <option value="all">全部填表人</option>
                  {filledByList.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* 結果統計 */}
        {!loading && logs.length > 0 && (
          <div style={{
            marginBottom: '16px',
            fontSize: '14px',
            color: 'rgba(255,255,255,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            {searchQuery || selectedFilledBy !== 'all' || filter !== 'all' ? (
              <>
                找到 <span style={{ color: '#3b82f6', fontWeight: '600' }}>{displayedLogs.length}</span> 筆記錄
                <span style={{ opacity: 0.5 }}>（共 {logs.length} 筆）</span>
              </>
            ) : (
              <>共 <span style={{ color: '#3b82f6', fontWeight: '600' }}>{logs.length}</span> 筆記錄</>
            )}
          </div>
        )}

        {/* 記錄列表 */}
        {loading ? (
          <div style={{
            padding: '60px 20px',
            textAlign: 'center',
            color: 'rgba(255,255,255,0.5)',
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '3px solid rgba(255,255,255,0.1)',
              borderTopColor: '#3b82f6',
              borderRadius: '50%',
              margin: '0 auto 16px',
              animation: 'spin 1s linear infinite',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            載入中...
          </div>
        ) : displayedLogs.length === 0 ? (
          <div style={{
            padding: '60px 20px',
            textAlign: 'center',
            color: 'rgba(255,255,255,0.4)',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>📭</div>
            {searchQuery || selectedFilledBy !== 'all' || filter !== 'all' 
              ? '沒有符合的記錄' 
              : '沒有記錄'}
          </div>
        ) : (
          // 時間軸列表
          <div>
            {groupedLogs.map(([date, logsInDate]) => (
              <div key={date} style={{ marginBottom: '32px' }}>
                {/* 日期標題 - Sticky */}
                <div style={{
                  position: 'sticky',
                  top: isMobile ? '60px' : '70px',
                  zIndex: 10,
                  background: 'linear-gradient(180deg, rgba(15, 23, 42, 1) 0%, rgba(15, 23, 42, 0.95) 80%, rgba(15, 23, 42, 0) 100%)',
                  paddingTop: '8px',
                  paddingBottom: '16px',
                  marginBottom: '-8px',
                }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 16px',
                    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                    borderRadius: '20px',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                  }}>
                    <span style={{ fontSize: '14px' }}>📅</span>
                    <span style={{ 
                      color: 'white', 
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
                  paddingLeft: '32px',
                }}>
                  {/* 垂直線 */}
                  <div style={{
                    position: 'absolute',
                    left: '11px',
                    top: '24px',
                    bottom: '24px',
                    width: '2px',
                    background: 'linear-gradient(180deg, rgba(59, 130, 246, 0.3), rgba(59, 130, 246, 0.1))',
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
                        return log.details?.replace('教練排班: ', '') || '排班調整'
                      }
                      const parts: string[] = []
                      if (parsed.boat) parts.push(parsed.boat)
                      if (parsed.member) parts.push(parsed.member)
                      if (parsed.coach) parts.push(parsed.coach + '教練')
                      return parts.join(' · ') || getOperationText(log.action, log.table_name || '', log.details || '')
                    })()
                    
                    return (
                      <div
                        key={log.id}
                        style={{
                          position: 'relative',
                          marginBottom: isLast ? 0 : '12px',
                        }}
                      >
                        {/* 時間軸圓點 */}
                        <div style={{
                          position: 'absolute',
                          left: '-26px',
                          top: '18px',
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          background: config.dotColor,
                          border: '2px solid #0f172a',
                          boxShadow: `0 0 0 3px ${config.dotColor}30`,
                          zIndex: 1,
                        }} />

                        {/* 卡片 */}
                        <div
                          onClick={() => toggleExpand(log.id)}
                          style={{
                            background: 'rgba(255,255,255,0.03)',
                            borderRadius: '12px',
                            border: '1px solid rgba(255,255,255,0.06)',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
                          }}
                        >
                          {/* 摘要行 */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '14px 16px',
                            gap: '12px',
                          }}>
                            {/* 時間 */}
                            <span style={{
                              fontSize: '13px',
                              fontFamily: 'ui-monospace, monospace',
                              color: 'rgba(255,255,255,0.4)',
                              minWidth: '45px',
                            }}>
                              {getTimeOnly(log.created_at || '')}
                            </span>

                            {/* 操作標籤 */}
                            <span style={{
                              padding: '4px 10px',
                              fontSize: '12px',
                              fontWeight: '600',
                              borderRadius: '6px',
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
                              color: '#e2e8f0',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {highlightText(summary, searchQuery)}
                            </span>

                            {/* 填表人 */}
                            {parsed.filledBy && (
                              <span style={{
                                fontSize: '12px',
                                color: 'rgba(255,255,255,0.4)',
                                padding: '2px 8px',
                                background: 'rgba(255,255,255,0.05)',
                                borderRadius: '4px',
                              }}>
                                {parsed.filledBy}
                              </span>
                            )}

                            {/* 展開指示器 */}
                            <span style={{
                              fontSize: '12px',
                              color: 'rgba(255,255,255,0.3)',
                              transition: 'transform 0.2s',
                              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            }}>
                              ▼
                            </span>
                          </div>

                          {/* 展開詳情 */}
                          <div style={{
                            maxHeight: isExpanded ? '500px' : '0',
                            overflow: 'hidden',
                            transition: 'max-height 0.3s ease-out',
                          }}>
                            <div style={{
                              padding: '0 16px 16px',
                              borderTop: '1px solid rgba(255,255,255,0.06)',
                            }}>
                              {/* 標籤區 */}
                              {(parsed.member || parsed.boat || parsed.coach || parsed.time || parsed.duration) && (
                                <div style={{ 
                                  display: 'flex', 
                                  gap: '8px', 
                                  flexWrap: 'wrap', 
                                  marginTop: '12px',
                                  marginBottom: '12px',
                                }}>
                                  {parsed.boat && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setSearchQuery(parsed.boat!) }}
                                      style={{
                                        padding: '6px 12px',
                                        fontSize: '13px',
                                        border: 'none',
                                        borderRadius: '6px',
                                        background: 'rgba(168, 85, 247, 0.15)',
                                        color: '#c084fc',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                      }}
                                    >
                                      🚤 {parsed.boat}
                                    </button>
                                  )}
                                  {parsed.member && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setSearchQuery(parsed.member!) }}
                                      style={{
                                        padding: '6px 12px',
                                        fontSize: '13px',
                                        border: 'none',
                                        borderRadius: '6px',
                                        background: 'rgba(59, 130, 246, 0.15)',
                                        color: '#60a5fa',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                      }}
                                    >
                                      👤 {parsed.member}
                                    </button>
                                  )}
                                  {parsed.coach && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setSearchQuery(parsed.coach!) }}
                                      style={{
                                        padding: '6px 12px',
                                        fontSize: '13px',
                                        border: 'none',
                                        borderRadius: '6px',
                                        background: 'rgba(251, 146, 60, 0.15)',
                                        color: '#fb923c',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                      }}
                                    >
                                      🎓 {parsed.coach}
                                    </button>
                                  )}
                                  {parsed.time && (
                                    <span style={{
                                      padding: '6px 12px',
                                      fontSize: '13px',
                                      borderRadius: '6px',
                                      background: 'rgba(34, 197, 94, 0.15)',
                                      color: '#4ade80',
                                    }}>
                                      🕐 {parsed.time}
                                    </span>
                                  )}
                                  {parsed.duration && (
                                    <span style={{
                                      padding: '6px 12px',
                                      fontSize: '13px',
                                      borderRadius: '6px',
                                      background: 'rgba(236, 72, 153, 0.15)',
                                      color: '#f472b6',
                                    }}>
                                      ⏱️ {parsed.duration}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* 填表人/操作者資訊 */}
                              <div style={{ 
                                fontSize: '13px', 
                                color: 'rgba(255,255,255,0.5)',
                                marginBottom: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                flexWrap: 'wrap',
                              }}>
                                {log.table_name === 'coach_assignment' ? (
                                  <>
                                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>操作者：</span>
                                    <span>{log.user_email || '未知'}</span>
                                  </>
                                ) : parsed.filledBy ? (
                                  <>
                                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>填表人：</span>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setSelectedFilledBy(parsed.filledBy!) }}
                                      style={{
                                        padding: '4px 10px',
                                        fontSize: '12px',
                                        border: 'none',
                                        borderRadius: '4px',
                                        background: 'rgba(59, 130, 246, 0.15)',
                                        color: '#60a5fa',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      📝 {parsed.filledBy}
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>操作者：</span>
                                    <span>{log.user_email || '未知'}</span>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setSelectedFilledBy('（無填表人）') }}
                                      style={{
                                        padding: '2px 8px',
                                        fontSize: '11px',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '4px',
                                        background: 'transparent',
                                        color: 'rgba(255,255,255,0.4)',
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
                                padding: '12px',
                                background: 'rgba(0,0,0,0.2)',
                                borderRadius: '8px',
                                fontSize: '13px',
                                color: 'rgba(255,255,255,0.7)',
                                whiteSpace: 'pre-wrap',
                                lineHeight: '1.6',
                                fontFamily: 'ui-monospace, monospace',
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
    </div>
  )
}
