import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/PageHeader'

interface AuditLogEntry {
  id: number
  operation: string // '新增預約', '修改預約', '刪除預約'
  user_email: string
  student_name: string
  boat_name: string
  coach_names: string | null
  start_time: string
  duration_min: number
  activity_types: string[] | null
  notes: string | null
  changes: string | null
  created_at: string
}

interface AuditLogProps {
  user: User
}

export function AuditLog({ user }: AuditLogProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'add' | 'edit' | 'delete'>('all')

  useEffect(() => {
    fetchLogs()
  }, [filter])

  const fetchLogs = async () => {
    setLoading(true)
    
    try {
      let query = supabase
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (filter !== 'all') {
        const operationMap = {
          'add': '新增預約',
          'edit': '修改預約',
          'delete': '刪除預約',
        }
        query = query.eq('operation', operationMap[filter])
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

  const formatDateTime = (isoString: string) => {
    if (!isoString) return ''
    
    try {
      // 使用 Date 對象自動處理時區轉換
      const date = new Date(isoString)
      
      // 檢查是否為有效日期
      if (isNaN(date.getTime())) return ''
      
      // 獲取本地時間的各個部分
      const month = date.getMonth() + 1
      const day = date.getDate()
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      
      // 計算星期幾
      const weekdays = ['日', '一', '二', '三', '四', '五', '六']
      const weekday = weekdays[date.getDay()]
      
      return `${month}/${day} (週${weekday}) ${hours}:${minutes}`
    } catch (error) {
      console.error('Error formatting date:', error)
      return ''
    }
  }

  const getOperationColor = (operation: string) => {
    switch (operation) {
      case '新增預約':
        return '#28a745'
      case '修改預約':
        return '#007bff'
      case '刪除預約':
        return '#dc3545'
      default:
        return '#666'
    }
  }

  const getOperationIcon = (operation: string) => {
    switch (operation) {
      case '新增預約':
        return '➕'
      case '修改預約':
        return '✏️'
      case '刪除預約':
        return '🗑️'
      default:
        return '📝'
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
      ) : logs.length === 0 ? (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: 'white',
          borderRadius: '8px',
          color: '#999',
          fontSize: '16px',
        }}>
          沒有記錄
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {logs.map((log) => (
            <div
              key={log.id}
              style={{
                backgroundColor: 'white',
                borderRadius: '8px',
                padding: '16px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                borderLeft: `4px solid ${getOperationColor(log.operation)}`,
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
                    {getOperationIcon(log.operation)}
                  </span>
                  <span style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: getOperationColor(log.operation),
                  }}>
                    {log.operation}
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
                <div style={{ marginBottom: '8px' }}>
                  <strong>學生：</strong>{log.student_name} | 
                  <strong> 船：</strong>{log.boat_name} | 
                  <strong> 時長：</strong>{log.duration_min}分鐘
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <strong>教練：</strong>{log.coach_names || '未指定'}
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <strong>時間：</strong>{formatDateTime(log.start_time)}
                </div>
                {log.activity_types && log.activity_types.length > 0 && (
                  <div style={{ marginBottom: '8px' }}>
                    <strong>活動類型：</strong>{log.activity_types.join(', ')}
                  </div>
                )}
                {log.notes && (
                  <div style={{ marginBottom: '8px' }}>
                    <strong>備註：</strong>{log.notes}
                  </div>
                )}
                {log.changes && (
                  <div style={{
                    marginTop: '12px',
                    padding: '10px',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: '#555',
                  }}>
                    <strong>變更內容：</strong><br />
                    {log.changes}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
