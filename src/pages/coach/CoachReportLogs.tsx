import { useState, useEffect } from 'react'
import { useAuthUser } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { Footer } from '../../components/Footer'
import { useResponsive } from '../../hooks/useResponsive'
import { getCardStyle } from '../../styles/designSystem'
import { getLocalDateString } from '../../utils/date'
import { extractDate, extractTime } from '../../utils/formatters'

interface ReportLog {
  id: number
  coach_id: string
  coach_email: string | null
  booking_id: number
  booking_start_at: string | null
  contact_name: string | null
  boat_name: string | null
  action_type: string
  participants_summary: string | null
  driver_duration_min: number | null
  changes_detail: any
  created_at: string | null
  coaches: {
    name: string
  } | null
}

export function CoachReportLogs() {
  const user = useAuthUser()
  const { isMobile } = useResponsive()
  
  const [logs, setLogs] = useState<ReportLog[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateString())
  const [viewMode, setViewMode] = useState<'date' | 'all'>('date')
  const [selectedCoachId, setSelectedCoachId] = useState<string>('all')
  const [coaches, setCoaches] = useState<Array<{ id: string; name: string }>>([])

  // 載入教練列表
  useEffect(() => {
    loadCoaches()
  }, [])

  // 載入日誌
  useEffect(() => {
    loadLogs()
  }, [selectedDate, viewMode, selectedCoachId])

  const loadCoaches = async () => {
    const { data } = await supabase
      .from('coaches')
      .select('id, name')
      .eq('status', 'active')
      .order('name')
    
    setCoaches(data || [])
  }

  const loadLogs = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('coach_report_logs')
        .select(`
          *,
          coaches:coach_id(name)
        `)
        .order('created_at', { ascending: false })

      if (viewMode === 'date') {
        const startOfDay = `${selectedDate}T00:00:00`
        const endOfDay = `${selectedDate}T23:59:59`
        query = query
          .gte('created_at', startOfDay)
          .lte('created_at', endOfDay)
      } else {
        // 最近 7 天
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        query = query.gte('created_at', sevenDaysAgo.toISOString())
      }

      if (selectedCoachId !== 'all') {
        query = query.eq('coach_id', selectedCoachId)
      }

      const { data, error } = await query.limit(100)

      if (error) throw error
      setLogs(data || [])
    } catch (error) {
      console.error('載入回報記錄失敗:', error)
    } finally {
      setLoading(false)
    }
  }

  const getActionLabel = (actionType: string) => {
    switch (actionType) {
      case 'create': return { text: '新增', color: '#4caf50', bg: '#e8f5e9' }
      case 'update': return { text: '修改', color: '#2196f3', bg: '#e3f2fd' }
      case 'delete': return { text: '刪除', color: '#f44336', bg: '#ffebee' }
      default: return { text: actionType, color: '#666', bg: '#f5f5f5' }
    }
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  }

  // 快捷日期按鈕
  const setDateOffset = (days: number) => {
    const date = new Date()
    date.setDate(date.getDate() + days)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    setSelectedDate(`${year}-${month}-${day}`)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
      <PageHeader 
        user={user} 
        title="回報記錄"
        showBaoLink={true}
        extraLinks={[
          { label: '← 回報管理', link: '/coach-admin' }
        ]}
      />
      
      <div style={{ 
        flex: 1, 
        padding: isMobile ? '16px' : '24px',
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%'
      }}>
        {/* 頁面標題 */}
        <h1 style={{ 
          fontSize: isMobile ? '24px' : '32px',
          fontWeight: 'bold',
          marginBottom: '24px',
          color: '#333'
        }}>
          📊 回報記錄
        </h1>

        {/* 篩選區 */}
        <div style={{
          ...getCardStyle(isMobile),
          marginBottom: '16px'
        }}>
          {/* 視圖模式切換 */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '16px'
          }}>
            <button
              onClick={() => setViewMode('date')}
              style={{
                padding: '8px 16px',
                background: viewMode === 'date' ? '#2196f3' : '#f5f5f5',
                color: viewMode === 'date' ? 'white' : '#666',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              📅 按日期
            </button>
            <button
              onClick={() => setViewMode('all')}
              style={{
                padding: '8px 16px',
                background: viewMode === 'all' ? '#2196f3' : '#f5f5f5',
                color: viewMode === 'all' ? 'white' : '#666',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              📋 最近 7 天
            </button>
          </div>

          {/* 日期選擇（按日期模式時顯示）*/}
          {viewMode === 'date' && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{
                fontSize: '13px',
                color: '#666',
                fontWeight: '600',
                marginBottom: '8px'
              }}>
                選擇日期
              </div>
              <div style={{
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap',
                alignItems: 'center'
              }}>
                {[
                  { label: '前天', offset: -2 },
                  { label: '昨天', offset: -1 },
                  { label: '今天', offset: 0 }
                ].map(({ label, offset }) => {
                  const targetDate = new Date()
                  targetDate.setDate(targetDate.getDate() + offset)
                  const targetDateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`
                  const isSelected = selectedDate === targetDateStr
                  
                  return (
                    <button
                      key={offset}
                      onClick={() => setDateOffset(offset)}
                      style={{
                        padding: '8px 16px',
                        background: isSelected ? '#2196f3' : '#e3f2fd',
                        color: isSelected ? 'white' : '#1976d2',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '600'
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
                <input 
                  type="date" 
                  value={selectedDate} 
                  onChange={(e) => setSelectedDate(e.target.value)} 
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
              </div>
            </div>
          )}

          {/* 教練篩選 */}
          <div>
            <div style={{
              fontSize: '13px',
              color: '#666',
              fontWeight: '600',
              marginBottom: '8px'
            }}>
              篩選教練
            </div>
            <div style={{
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={() => setSelectedCoachId('all')}
                style={{
                  padding: '6px 12px',
                  background: selectedCoachId === 'all' ? '#2196f3' : '#f5f5f5',
                  color: selectedCoachId === 'all' ? 'white' : '#666',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '500'
                }}
              >
                全部
              </button>
              {coaches.map(coach => (
                <button
                  key={coach.id}
                  onClick={() => setSelectedCoachId(coach.id)}
                  style={{
                    padding: '6px 12px',
                    background: selectedCoachId === coach.id ? '#2196f3' : '#f5f5f5',
                    color: selectedCoachId === coach.id ? 'white' : '#666',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '500'
                  }}
                >
                  {coach.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 統計 */}
        <div style={{
          ...getCardStyle(isMobile),
          marginBottom: '16px',
          background: '#e3f2fd'
        }}>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div>
              <span style={{ color: '#666', fontSize: '13px' }}>總筆數：</span>
              <span style={{ fontWeight: '600', fontSize: '16px' }}>{logs.length}</span>
            </div>
            <div>
              <span style={{ color: '#666', fontSize: '13px' }}>新增：</span>
              <span style={{ fontWeight: '600', fontSize: '16px', color: '#4caf50' }}>
                {logs.filter(l => l.action_type === 'create').length}
              </span>
            </div>
            <div>
              <span style={{ color: '#666', fontSize: '13px' }}>修改：</span>
              <span style={{ fontWeight: '600', fontSize: '16px', color: '#2196f3' }}>
                {logs.filter(l => l.action_type === 'update').length}
              </span>
            </div>
            <div>
              <span style={{ color: '#666', fontSize: '13px' }}>刪除：</span>
              <span style={{ fontWeight: '600', fontSize: '16px', color: '#f44336' }}>
                {logs.filter(l => l.action_type === 'delete').length}
              </span>
            </div>
          </div>
        </div>

        {/* 記錄列表 */}
        {loading ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px', 
            color: '#999',
            background: 'white',
            borderRadius: '12px'
          }}>
            載入中...
          </div>
        ) : logs.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px', 
            color: '#999',
            background: 'white',
            borderRadius: '12px'
          }}>
            沒有回報記錄
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {logs.map(log => {
              const action = getActionLabel(log.action_type)
              
              return (
                <div 
                  key={log.id}
                  style={{
                    ...getCardStyle(isMobile),
                    borderLeft: `4px solid ${action.color}`
                  }}
                >
                  {/* 標題行 */}
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '8px',
                    flexWrap: 'wrap',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        padding: '2px 8px',
                        background: action.bg,
                        color: action.color,
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        {action.text}
                      </span>
                      <span style={{ fontWeight: '600', color: '#333' }}>
                        {log.coaches?.name || '未知教練'}
                      </span>
                    </div>
                    <span style={{ color: '#999', fontSize: '13px' }}>
                      {extractDate(log.created_at || '')} {formatTime(log.created_at || '')}
                    </span>
                  </div>

                  {/* 預約資訊 */}
                  <div style={{ 
                    fontSize: '14px', 
                    color: '#666',
                    marginBottom: '8px'
                  }}>
                    <span style={{ marginRight: '8px' }}>📅</span>
                    {extractDate(log.booking_start_at || '')} {extractTime(log.booking_start_at || '')}
                    <span style={{ margin: '0 8px' }}>|</span>
                    {log.boat_name}
                    <span style={{ margin: '0 8px' }}>|</span>
                    {log.contact_name}
                  </div>

                  {/* 參與者摘要 */}
                  <div style={{ 
                    fontSize: '14px',
                    color: '#333',
                    background: '#f9f9f9',
                    padding: '8px 12px',
                    borderRadius: '6px'
                  }}>
                    {log.participants_summary}
                    {log.driver_duration_min && (
                      <span style={{ marginLeft: '12px', color: '#1976d2' }}>
                        🚤 駕駛 {log.driver_duration_min}分
                      </span>
                    )}
                  </div>

                  {/* 詳細資訊（可展開）*/}
                  {log.changes_detail && (
                    <details style={{ marginTop: '8px' }}>
                      <summary style={{ 
                        cursor: 'pointer', 
                        color: '#666',
                        fontSize: '12px'
                      }}>
                        查看詳細
                      </summary>
                      <pre style={{ 
                        fontSize: '11px', 
                        background: '#f5f5f5',
                        padding: '8px',
                        borderRadius: '4px',
                        overflow: 'auto',
                        marginTop: '8px'
                      }}>
                        {JSON.stringify(log.changes_detail, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}

