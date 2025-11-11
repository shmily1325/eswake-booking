import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/PageHeader'

interface AuditLogEntry {
  id: number
  user_email: string
  action: string // 'create', 'update', 'delete'
  table_name: string
  details: string
  created_at: string
}

interface AuditLogProps {
  user: User
}

export function AuditLog({ user }: AuditLogProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'add' | 'edit' | 'delete'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [displayedLogs, setDisplayedLogs] = useState<AuditLogEntry[]>([])

  useEffect(() => {
    fetchLogs()
  }, [filter])

  useEffect(() => {
    // 客户端搜索过滤
    if (searchQuery.trim() === '') {
      setDisplayedLogs(logs)
    } else {
      const filtered = logs.filter(log => 
        log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.user_email.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setDisplayedLogs(filtered)
    }
  }, [searchQuery, logs])

  const fetchLogs = async () => {
    setLoading(true)
    
    try {
      // 只查詢預約相關的記錄（最近 7 天）
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const sevenDaysAgoStr = sevenDaysAgo.toISOString()
      
      let query = supabase
        .from('audit_log')
        .select('*')
        .eq('table_name', 'bookings')
        .gte('created_at', sevenDaysAgoStr)
        .order('created_at', { ascending: false })
        .limit(200)

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
        console.log('Fetched audit logs:', data)
        console.log('Total logs count:', data?.length || 0)
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
      // 直接從 TEXT 格式解析：2025-11-09T23:15:00
      const datetime = dateString.substring(0, 16) // 取到分鐘
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
      case 'create':
        return '#28a745'
      case 'update':
        return '#007bff'
      case 'delete':
        return '#dc3545'
      default:
        return '#666'
    }
  }

  const getOperationIcon = (action: string) => {
    switch (action) {
      case 'create':
        return '➕'
      case 'update':
        return '✏️'
      case 'delete':
        return '🗑️'
      default:
        return '📝'
    }
  }

  const getOperationText = (action: string) => {
    switch (action) {
      case 'create':
        return '新增預約'
      case 'update':
        return '修改預約'
      case 'delete':
        return '刪除預約'
      default:
        return '未知操作'
    }
  }

  return (
    <div style={{
      padding: '15px',
      maxWidth: '1400px',
      margin: '0 auto',
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
    }}>
      <PageHeader title="📝 編輯記錄" user={user} />

      {/* Search Bar */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '15px',
        marginBottom: '15px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}>
        <input
          type="text"
          placeholder="🔍 搜尋會員名稱、操作者或預約內容..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 16px',
            fontSize: '14px',
            border: '1px solid #dee2e6',
            borderRadius: '6px',
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = '#007bff'}
          onBlur={(e) => e.currentTarget.style.borderColor = '#dee2e6'}
        />
      </div>

      {/* Filters */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '15px',
        marginBottom: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilter('all')}
            style={{
              padding: '10px 20px',
              borderRadius: '6px',
              border: filter === 'all' ? '2px solid #007bff' : '1px solid #dee2e6',
              backgroundColor: filter === 'all' ? '#e7f3ff' : 'white',
              color: filter === 'all' ? '#007bff' : '#333',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            全部
          </button>
          <button
            onClick={() => setFilter('add')}
            style={{
              padding: '10px 20px',
              borderRadius: '6px',
              border: filter === 'add' ? '2px solid #28a745' : '1px solid #dee2e6',
              backgroundColor: filter === 'add' ? '#d4edda' : 'white',
              color: filter === 'add' ? '#28a745' : '#333',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            ➕ 新增
          </button>
          <button
            onClick={() => setFilter('edit')}
            style={{
              padding: '10px 20px',
              borderRadius: '6px',
              border: filter === 'edit' ? '2px solid #007bff' : '1px solid #dee2e6',
              backgroundColor: filter === 'edit' ? '#d1ecf1' : 'white',
              color: filter === 'edit' ? '#007bff' : '#333',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            ✏️ 修改
          </button>
          <button
            onClick={() => setFilter('delete')}
            style={{
              padding: '10px 20px',
              borderRadius: '6px',
              border: filter === 'delete' ? '2px solid #dc3545' : '1px solid #dee2e6',
              backgroundColor: filter === 'delete' ? '#f8d7da' : 'white',
              color: filter === 'delete' ? '#dc3545' : '#333',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            🗑️ 刪除
          </button>
        </div>
      </div>

      {/* Results Count */}
      {!loading && logs.length > 0 && (
        <div style={{
          marginBottom: '12px',
          fontSize: '14px',
          color: '#666',
          padding: '0 4px',
        }}>
          {searchQuery ? (
            <>找到 <strong>{displayedLogs.length}</strong> 筆記錄（共 {logs.length} 筆）</>
          ) : (
            <>共 <strong>{logs.length}</strong> 筆記錄</>
          )}
        </div>
      )}

      {/* Logs */}
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
          {searchQuery ? '沒有符合的記錄' : '沒有記錄'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {displayedLogs.map((log) => (
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
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '12px',
                flexWrap: 'wrap',
                gap: '10px',
              }}>
                <div>
                  <span style={{
                    fontSize: '18px',
                    marginRight: '8px',
                  }}>
                    {getOperationIcon(log.action)}
                  </span>
                  <span style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: getOperationColor(log.action),
                  }}>
                    {getOperationText(log.action)}
                  </span>
                </div>
                <div style={{
                  fontSize: '13px',
                  color: '#666',
                }}>
                  {formatDateTime(log.created_at)}
                </div>
              </div>

              <div style={{
                fontSize: '14px',
                color: '#333',
                lineHeight: '1.6',
              }}>
                <div style={{ marginBottom: '8px' }}>
                  <strong>操作者：</strong>{log.user_email}
                </div>
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
                  {log.details}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
