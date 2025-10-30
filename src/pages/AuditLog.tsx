import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { UserMenu } from '../components/UserMenu'

interface AuditLogEntry {
  id: number
  table_name: string
  operation: string
  record_id: string
  old_data: any
  new_data: any
  changed_fields: string[] | null
  changed_by: string
  changed_at: string
}

interface AuditLogProps {
  user: User
}

export function AuditLog({ user }: AuditLogProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'INSERT' | 'UPDATE' | 'DELETE'>('all')

  useEffect(() => {
    fetchLogs()
  }, [filter])

  const fetchLogs = async () => {
    setLoading(true)

    try {
      let query = supabase
        .from('audit_log')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(100)

      if (filter !== 'all') {
        query = query.eq('operation', filter)
      }

      const { data, error } = await query

      if (error) {
        console.error('❌ Error fetching audit logs:', error)
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
      } else {
        console.log('✅ Audit logs fetched:', data?.length || 0, 'records')
        console.log('First 3 records:', data?.slice(0, 3))
        setLogs(data || [])
      }
    } catch (err) {
      console.error('Fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`
  }

  const getOperationColor = (operation: string) => {
    switch (operation) {
      case 'INSERT': return '#28a745'
      case 'UPDATE': return '#ffc107'
      case 'DELETE': return '#dc3545'
      default: return '#6c757d'
    }
  }

  const getOperationIcon = (operation: string) => {
    switch (operation) {
      case 'INSERT': return '➕'
      case 'UPDATE': return '✏️'
      case 'DELETE': return '🗑️'
      default: return '📝'
    }
  }

  const renderDataDiff = (log: AuditLogEntry) => {
    if (log.operation === 'INSERT') {
      return (
        <div style={{ fontSize: '13px', color: '#666' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>新增資料：</div>
          <pre style={{ 
            background: '#f8f9fa',
            padding: '10px',
            borderRadius: '4px',
            overflow: 'auto',
            margin: 0,
            fontSize: '12px'
          }}>
            {JSON.stringify(log.new_data, null, 2)}
          </pre>
        </div>
      )
    }

    if (log.operation === 'DELETE') {
      return (
        <div style={{ fontSize: '13px', color: '#666' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>刪除資料：</div>
          <pre style={{ 
            background: '#f8f9fa',
            padding: '10px',
            borderRadius: '4px',
            overflow: 'auto',
            margin: 0,
            fontSize: '12px'
          }}>
            {JSON.stringify(log.old_data, null, 2)}
          </pre>
        </div>
      )
    }

    if (log.operation === 'UPDATE' && log.changed_fields) {
      return (
        <div style={{ fontSize: '13px', color: '#666' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
            修改欄位：{log.changed_fields.join(', ')}
          </div>
          <div style={{ display: 'grid', gap: '10px' }}>
            {log.changed_fields.map(field => (
              <div key={field} style={{
                background: '#f8f9fa',
                padding: '10px',
                borderRadius: '4px'
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>{field}:</div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '11px', color: '#999', marginBottom: '3px' }}>舊值</div>
                    <div style={{ 
                      background: '#fff3cd',
                      padding: '5px',
                      borderRadius: '3px',
                      fontSize: '12px',
                      wordBreak: 'break-word'
                    }}>
                      {JSON.stringify(log.old_data?.[field])}
                    </div>
                  </div>
                  <div style={{ fontSize: '16px', color: '#999' }}>→</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '11px', color: '#999', marginBottom: '3px' }}>新值</div>
                    <div style={{ 
                      background: '#d4edda',
                      padding: '5px',
                      borderRadius: '3px',
                      fontSize: '12px',
                      wordBreak: 'break-word'
                    }}>
                      {JSON.stringify(log.new_data?.[field])}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    }

    return null
  }

  return (
    <div style={{ 
      minHeight: '100vh',
      background: '#f8f9fa',
      padding: '15px'
    }}>
      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{ 
          background: 'white',
          borderRadius: '8px',
          padding: '15px',
          marginBottom: '15px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px'
        }}>
          <h1 style={{ 
            margin: 0,
            fontSize: '18px',
            color: '#000',
            fontWeight: '600'
          }}>
            編輯記錄
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link 
              to="/"
              style={{
                padding: '6px 12px',
                background: '#f8f9fa',
                color: '#333',
                textDecoration: 'none',
                borderRadius: '4px',
                fontSize: '13px',
                border: '1px solid #dee2e6',
                whiteSpace: 'nowrap'
              }}
            >
              ← 回主頁
            </Link>
            <UserMenu user={user} />
          </div>
        </div>

        {/* Filter buttons */}
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '15px',
          marginBottom: '15px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap'
        }}>
          {['all', 'INSERT', 'UPDATE', 'DELETE'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              style={{
                padding: '8px 16px',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                background: filter === f ? '#000' : '#fff',
                color: filter === f ? '#fff' : '#333',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              {f === 'all' ? '全部' : f === 'INSERT' ? '新增' : f === 'UPDATE' ? '修改' : '刪除'}
            </button>
          ))}
        </div>

        {/* Logs list */}
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              載入中...
            </div>
          ) : logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              沒有找到編輯記錄
            </div>
          ) : (
            <>
              <h2 style={{ 
                marginTop: 0,
                marginBottom: '20px',
                fontSize: '18px',
                color: '#333'
              }}>
                最近 {logs.length} 筆記錄
              </h2>
              <div style={{ 
                display: 'flex',
                flexDirection: 'column',
                gap: '15px'
              }}>
                {logs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      border: '2px solid #e0e0e0',
                      borderRadius: '10px',
                      padding: '20px',
                      borderLeftWidth: '6px',
                      borderLeftColor: getOperationColor(log.operation)
                    }}
                  >
                    {/* Header */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '15px',
                      flexWrap: 'wrap',
                      gap: '10px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '24px' }}>{getOperationIcon(log.operation)}</span>
                        <div>
                          <div style={{ 
                            display: 'inline-block',
                            padding: '4px 12px',
                            borderRadius: '20px',
                            background: getOperationColor(log.operation),
                            color: 'white',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            marginBottom: '5px'
                          }}>
                            {log.operation}
                          </div>
                          <div style={{ fontSize: '14px', color: '#666' }}>
                            表格：{log.table_name} | ID：{log.record_id}
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: '13px', color: '#999', textAlign: 'right' }}>
                        <div>{formatDate(log.changed_at)}</div>
                        <div style={{ marginTop: '3px' }}>操作者：{log.changed_by}</div>
                      </div>
                    </div>

                    {/* Data diff */}
                    {renderDataDiff(log)}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

