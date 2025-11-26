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
  rawText: string
}

/**
 * 解析 details 字串，提取關鍵資訊
 * 
 * 不同操作有不同格式：
 * - 新增預約：「日期 時間 時長 船隻 會員 教練」
 * - 修改預約：「日期 時間 船隻 · 變更 · 欄位: 舊值 → 新值」
 * - 刪除預約：「日期 時間 船隻 會員」
 */
function parseDetails(details: string): ParsedDetails {
  const info: ParsedDetails = { rawText: details }
  
  // 判斷操作類型
  const isCreate = details.startsWith('新增預約')
  const isUpdate = details.startsWith('修改預約')
  const isDelete = details.startsWith('刪除預約')
  
  // 1. 提取時間（格式：11/01 13:45）
  const timeMatch = details.match(/(\d{1,2}\/\d{1,2}\s+\d{2}:\d{2})/)
  if (timeMatch) info.time = timeMatch[1]
  
  // 2. 提取時長（60分）
  const durationMatch = details.match(/(\d+)\s*分/)
  if (durationMatch) info.duration = `${durationMatch[1]}分`
  
  // 3. 提取教練（XX教練）
  const coachMatches = details.match(/([\u4e00-\u9fa5]{2,5}|[A-Z][a-z]+)\s*(?:教練|老師)/g)
  if (coachMatches) {
    const coaches = coachMatches.map(m => m.replace(/教練|老師/g, '').trim())
    info.coach = coaches.join('/')
  }
  
  if (isCreate) {
    // 新增預約：日期 時間 時長 船隻 會員 教練
    let remaining = details
      .replace(/^新增預約[:：]\s*/, '')
      .replace(/\d{1,2}\/\d{1,2}\s+\d{2}:\d{2}/, '')
      .replace(/\d+\s*分/, '')
      .replace(/([\u4e00-\u9fa5]{2,5}|[A-Z][a-z]+)\s*(?:教練|老師)/g, '')
      .trim()
    
    // 先移除填表人/課堂人部分（如果有）
    remaining = remaining.replace(/\s*\([^)]*[填表人課堂][^)]*\)\s*/g, '').trim()
    
    // 分割：船隻 會員1, 會員2
    // 第一個空格前是船隻，之後都是會員名（可能用逗號或頓號分隔）
    const firstSpaceIndex = remaining.indexOf(' ')
    if (firstSpaceIndex > 0) {
      info.boat = remaining.substring(0, firstSpaceIndex).trim()
      info.member = remaining.substring(firstSpaceIndex + 1).trim()
    } else if (remaining.length > 0) {
      // 如果沒有空格，整個都是船隻
      info.boat = remaining
    }
    
  } else if (isUpdate) {
    // 修改預約：日期 時間 [名稱]，變更：...
    // 只從「變更」內容中提取明確的欄位
    
    // 提取船隻變更（船隻: XX → YY）
    const boatChangeMatch = details.match(/船隻[:：]\s*[^→]*→\s*([^，\s]+)/)
    if (boatChangeMatch) {
      info.boat = boatChangeMatch[1].trim()
    }
    
    // 提取聯絡人變更（聯絡: XX → YY）
    const contactChangeMatch = details.match(/聯絡[:：]\s*[^→]*→\s*([^，\s]+)/)
    if (contactChangeMatch) {
      info.member = contactChangeMatch[1].trim()
    }
    
  } else if (isDelete) {
    // 刪除預約：日期 時間 船隻 會員
    let remaining = details
      .replace(/^刪除預約[:：]\s*/, '')
      .replace(/\d{1,2}\/\d{1,2}\s+\d{2}:\d{2}/, '')
      .replace(/\d+\s*分/, '')
      .replace(/([\u4e00-\u9fa5]{2,5}|[A-Z][a-z]+)\s*(?:教練|老師)/g, '')
      .trim()
    
    // 先移除填表人/課堂人部分（如果有）
    remaining = remaining.replace(/\s*\([^)]*[填表人課堂][^)]*\)\s*/g, '').trim()
    
    // 分割：船隻 會員1, 會員2
    // 第一個空格前是船隻，之後都是會員名（可能用逗號或頓號分隔）
    const firstSpaceIndex = remaining.indexOf(' ')
    if (firstSpaceIndex > 0) {
      info.boat = remaining.substring(0, firstSpaceIndex).trim()
      info.member = remaining.substring(firstSpaceIndex + 1).trim()
    } else if (remaining.length > 0) {
      // 如果沒有空格，整個都是船隻
      info.boat = remaining
    }
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

export function AuditLog() {
  const user = useAuthUser()
  const { isMobile } = useResponsive()
  
  // 原有 state
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'add' | 'edit' | 'delete'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  
  // 新增：日期範圍篩選
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 7)
    return getLocalDateString(date)
  })
  const [endDate, setEndDate] = useState(() => {
    return getLocalDateString()
  })
  
  // 新增：操作者篩選
  const [selectedOperator, setSelectedOperator] = useState<string>('all')

  useEffect(() => {
    fetchLogs()
  }, [filter, startDate, endDate])

  // 計算所有操作者
  const operators = useMemo(() => {
    const uniqueOperators = [...new Set(logs.map(log => log.user_email).filter(Boolean))] as string[]
    return uniqueOperators.sort()
  }, [logs])

  // 篩選和搜尋邏輯
  const displayedLogs = useMemo(() => {
    let filtered = logs
    
    // 操作者篩選
    if (selectedOperator !== 'all') {
      filtered = filtered.filter(log => log.user_email === selectedOperator)
    }
    
    // 搜尋篩選
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(log => 
        (log.details && log.details.toLowerCase().includes(query)) ||
        (log.user_email && log.user_email.toLowerCase().includes(query))
      )
    }
    
    return filtered
  }, [logs, selectedOperator, searchQuery])

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

      // 根據篩選條件過濾 action
      if (filter !== 'all') {
        const actionMap = {
          'add': 'create',
          'edit': 'update',
          'delete': 'delete',
        }
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

  const formatDateTime = (dateString: string) => {
    if (!dateString) return ''
    
    try {
      const datetime = dateString.substring(0, 16)
      const [dateStr, timeStr] = datetime.split('T')
      const [, month, day] = dateStr.split('-')
      
      return `${month}/${day} ${timeStr}`
    } catch (error) {
      console.error('Error formatting date:', error)
      return dateString
    }
  }

  const getOperationColor = (action: string) => {
    switch (action) {
      case 'create': return '#28a745'
      case 'update': return '#007bff'
      case 'delete': return '#dc3545'
      default: return '#666'
    }
  }

  const getOperationIcon = (action: string) => {
    switch (action) {
      case 'create': return '➕'
      case 'update': return '✏️'
      case 'delete': return '🗑️'
      default: return '📝'
    }
  }

  const getOperationText = (action: string, tableName: string) => {
    if (tableName === 'coach_assignment') return '排班'
    
    switch (action) {
      case 'create': return '新增預約'
      case 'update': return '修改預約'
      case 'delete': return '刪除預約'
      default: return '未知操作'
    }
  }

  const setQuickDateRange = (range: 'today' | '7days' | '30days' | 'all') => {
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
      case 'all':
        start.setDate(start.getDate() - 90)
        setStartDate(getLocalDateString(start))
        break
    }
  }

  return (
    <div style={{
      padding: isMobile ? '10px' : '15px',
      maxWidth: '1400px',
      margin: '0 auto',
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
    }}>
      <PageHeader title="📝 編輯記錄" user={user} />

      {/* 日期範圍篩選 */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '15px',
        marginBottom: '15px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}>
        <div style={{ 
          display: 'flex', 
          gap: '10px', 
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: '12px'
        }}>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{
              padding: '8px 12px',
              fontSize: '14px',
              border: '1px solid #dee2e6',
              borderRadius: '6px',
              outline: 'none',
            }}
          />
          <span style={{ color: '#666', fontSize: '14px' }}>至</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{
              padding: '8px 12px',
              fontSize: '14px',
              border: '1px solid #dee2e6',
              borderRadius: '6px',
              outline: 'none',
            }}
          />
        </div>
        
        {/* 快速選擇按鈕 */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setQuickDateRange('today')}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              backgroundColor: 'white',
              cursor: 'pointer',
              color: '#666',
            }}
          >
            今天
          </button>
          <button
            onClick={() => setQuickDateRange('7days')}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              backgroundColor: 'white',
              cursor: 'pointer',
              color: '#666',
            }}
          >
            最近 7 天
          </button>
          <button
            onClick={() => setQuickDateRange('30days')}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              backgroundColor: 'white',
              cursor: 'pointer',
              color: '#666',
            }}
          >
            最近 30 天
          </button>
          <button
            onClick={() => setQuickDateRange('all')}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              backgroundColor: 'white',
              cursor: 'pointer',
              color: '#666',
            }}
          >
            最近 90 天
          </button>
        </div>
      </div>

      {/* 搜尋框 + 操作者篩選 */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '15px',
        marginBottom: '15px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}>
        <div style={{ 
          display: 'flex', 
          gap: '10px', 
          flexWrap: 'wrap',
          marginBottom: '10px'
        }}>
          <input
            type="text"
            placeholder="🔍 搜尋會員名稱、操作者或預約內容..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: '1 1 300px',
              padding: '12px 16px',
              fontSize: '14px',
              border: '1px solid #dee2e6',
              borderRadius: '6px',
              outline: 'none',
            }}
          />
          
          {/* 操作者下拉選單 */}
          <select
            value={selectedOperator}
            onChange={(e) => setSelectedOperator(e.target.value)}
            style={{
              padding: '12px 16px',
              fontSize: '14px',
              border: '1px solid #dee2e6',
              borderRadius: '6px',
              outline: 'none',
              cursor: 'pointer',
              backgroundColor: 'white',
              minWidth: '200px',
            }}
          >
            <option value="all">👤 全部操作者</option>
            {operators.map(email => (
              <option key={email || 'unknown'} value={email || ''}>{email ? email.split('@')[0] : '未知'}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 操作類型篩選 */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '15px',
        marginBottom: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {[
            { key: 'all', label: '全部', color: '#007bff', bgColor: '#e7f3ff' },
            { key: 'add', label: '➕ 新增', color: '#28a745', bgColor: '#d4edda' },
            { key: 'edit', label: '✏️ 修改', color: '#007bff', bgColor: '#d1ecf1' },
            { key: 'delete', label: '🗑️ 刪除', color: '#dc3545', bgColor: '#f8d7da' },
          ].map(({ key, label, color, bgColor }) => (
            <button
              key={key}
              onClick={() => setFilter(key as any)}
              style={{
                padding: '10px 20px',
                borderRadius: '6px',
                border: filter === key ? `2px solid ${color}` : '1px solid #dee2e6',
                backgroundColor: filter === key ? bgColor : 'white',
                color: filter === key ? color : '#333',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
              }}
            >
              {label}
            </button>
          ))}
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
          {searchQuery || selectedOperator !== 'all' ? (
            <>找到 <strong style={{ color: '#007bff' }}>{displayedLogs.length}</strong> 筆記錄（共 {logs.length} 筆）</>
          ) : (
            <>共 <strong style={{ color: '#007bff' }}>{logs.length}</strong> 筆記錄</>
          )}
        </div>
      )}

      {/* 記錄列表 */}
      {loading ? (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: 'white',
          borderRadius: '8px',
          color: '#666',
          fontSize: '16px',
        }}>
          載入中...
        </div>
      ) : displayedLogs.length === 0 ? (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: 'white',
          borderRadius: '8px',
          color: '#999',
          fontSize: '16px',
        }}>
          {searchQuery || selectedOperator !== 'all' ? '沒有符合的記錄' : '沒有記錄'}
        </div>
      ) : (
        // 按日期分組顯示
        <>
          {groupedLogs.map(([date, logsInDate]) => (
            <div key={date} style={{ marginBottom: '24px' }}>
              {/* 日期標題 */}
              <div style={{
                padding: '10px 16px',
                backgroundColor: '#007bff',
                color: 'white',
                borderRadius: '8px',
                marginBottom: '12px',
                fontSize: '15px',
                fontWeight: '600',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span>📅 {formatDateHeader(date)}</span>
                <span style={{ fontSize: '13px', opacity: 0.9 }}>
                  {logsInDate.length} 筆
                </span>
              </div>

              {/* 該日期的所有記錄 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {logsInDate.map((log) => {
                  const parsed = parseDetails(log.details || '')
                  
                  return (
                    <div
                      key={log.id}
                      style={{
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        padding: '16px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        borderLeft: `4px solid ${getOperationColor(log.action)}`,
                      }}
                    >
                      {/* 標題列 */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '12px',
                        flexWrap: 'wrap',
                        gap: '10px',
                      }}>
                        <div>
                          <span style={{ fontSize: '18px', marginRight: '8px' }}>
                            {getOperationIcon(log.action)}
                          </span>
                          <span style={{
                            fontSize: '16px',
                            fontWeight: '600',
                            color: getOperationColor(log.action),
                          }}>
                            {getOperationText(log.action, log.table_name || '')}
                          </span>
                        </div>
                        <div style={{ fontSize: '13px', color: '#666' }}>
                          {log.created_at ? formatDateTime(log.created_at) : '-'}
                        </div>
                      </div>

                      {/* 解析出的關鍵資訊標籤 */}
                      {(parsed.member || parsed.boat || parsed.coach || parsed.time || parsed.duration) && (
                        <div style={{ 
                          display: 'flex', 
                          gap: '8px', 
                          flexWrap: 'wrap', 
                          marginBottom: '12px' 
                        }}>
                          {parsed.member && (
                            <button
                              onClick={() => setSearchQuery(parsed.member!)}
                              style={{
                                padding: '4px 10px',
                                fontSize: '13px',
                                border: 'none',
                                borderRadius: '4px',
                                backgroundColor: '#e3f2fd',
                                color: '#1976d2',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                              }}
                              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#bbdefb'}
                              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#e3f2fd'}
                            >
                              👤 {parsed.member}
                            </button>
                          )}
                          {parsed.boat && (
                            <button
                              onClick={() => setSearchQuery(parsed.boat!)}
                              style={{
                                padding: '4px 10px',
                                fontSize: '13px',
                                border: 'none',
                                borderRadius: '4px',
                                backgroundColor: '#f3e5f5',
                                color: '#7b1fa2',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                              }}
                              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e1bee7'}
                              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f3e5f5'}
                            >
                              🚤 {parsed.boat}
                            </button>
                          )}
                          {parsed.coach && (
                            <button
                              onClick={() => setSearchQuery(parsed.coach!)}
                              style={{
                                padding: '4px 10px',
                                fontSize: '13px',
                                border: 'none',
                                borderRadius: '4px',
                                backgroundColor: '#fff3e0',
                                color: '#e65100',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                              }}
                              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#ffe0b2'}
                              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#fff3e0'}
                            >
                              🎓 {parsed.coach}
                            </button>
                          )}
                          {parsed.time && (
                            <span style={{
                              padding: '4px 10px',
                              fontSize: '13px',
                              borderRadius: '4px',
                              backgroundColor: '#e8f5e9',
                              color: '#2e7d32',
                            }}>
                              🕐 {parsed.time}
                            </span>
                          )}
                          {parsed.duration && (
                            <span style={{
                              padding: '4px 10px',
                              fontSize: '13px',
                              borderRadius: '4px',
                              backgroundColor: '#fce4ec',
                              color: '#c2185b',
                            }}>
                              ⏱️ {parsed.duration}
                            </span>
                          )}
                        </div>
                      )}

                      {/* 操作者 */}
                      <div style={{ marginBottom: '8px', fontSize: '14px' }}>
                        <strong>操作者：</strong>
                        <span style={{ color: '#666' }}>
                          {highlightText(log.user_email || '未知', searchQuery)}
                        </span>
                      </div>

                      {/* 詳細內容（帶高亮） */}
                      <div style={{
                        marginTop: '12px',
                        padding: '12px',
                        backgroundColor: '#f8f9fa',
                        borderRadius: '6px',
                        fontSize: '14px',
                        color: '#333',
                        whiteSpace: 'pre-wrap',
                        lineHeight: '1.6'
                      }}>
                        {highlightText(log.details || '', searchQuery)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
