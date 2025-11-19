import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/PageHeader'
import { Footer } from '../components/Footer'
import { useResponsive } from '../hooks/useResponsive'
import { useRequireAdmin } from '../utils/auth'
import { getCardStyle } from '../styles/designSystem'
import { extractDate, extractTime } from '../utils/formatters'

interface CoachOverviewProps {
  user: User
}

type TabType = 'past' | 'future'

interface CoachStats {
  coachId: string
  coachName: string
  teachingMinutes: number
  teachingCount: number
  drivingMinutes: number
  drivingCount: number
  totalMinutes: number
  details: BookingDetail[]
}

interface BookingDetail {
  bookingId: number
    date: string
  time: string
  boatName: string
  duration: number
  participants: ParticipantInfo[]
  driverDuration?: number
}

interface ParticipantInfo {
  name: string
  memberName?: string
  duration: number
  lessonType: string
}

export function CoachOverview({ user }: CoachOverviewProps) {
  useRequireAdmin(user)
  const { isMobile } = useResponsive()

  const [activeTab, setActiveTab] = useState<TabType>('past')
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  })
  const [selectedCoachId, setSelectedCoachId] = useState<string>('all')
  const [loading, setLoading] = useState(false)

  const [coachStats, setCoachStats] = useState<CoachStats[]>([])
  const [expandedCoachId, setExpandedCoachId] = useState<string | null>(null)

  // 載入歷史數據
  const loadPastData = async () => {
    if (!selectedMonth) return
    
    setLoading(true)
    try {
      const [year, month] = selectedMonth.split('-')
      const startDate = `${year}-${month}-01`
      const endDate = new Date(parseInt(year), parseInt(month), 0).getDate()
      const endDateStr = `${year}-${month}-${String(endDate).padStart(2, '0')}`

      // 1. 載入教學記錄 (booking_participants)
      const { data: teachingData, error: teachingError } = await supabase
        .from('booking_participants')
        .select(`
          *,
          bookings!inner(
            id, start_at, duration_min, boat_id,
            boats(name)
          ),
          coaches:coach_id(id, name),
          members(name, nickname)
        `)
        .eq('status', 'processed')
        .eq('is_teaching', true)
        .eq('is_deleted', false)
        .gte('bookings.start_at', `${startDate} 00:00:00`)
        .lte('bookings.start_at', `${endDateStr} 23:59:59`)

      if (teachingError) throw teachingError

      // 2. 載入駕駛記錄 (coach_reports)
      const { data: drivingData, error: drivingError } = await supabase
        .from('coach_reports')
        .select(`
          *,
          bookings!inner(
            id, start_at, duration_min, boat_id,
            boats(name)
          ),
          coaches:coach_id(id, name)
        `)
        .gte('bookings.start_at', `${startDate} 00:00:00`)
        .lte('bookings.start_at', `${endDateStr} 23:59:59`)

      if (drivingError) throw drivingError

      // 3. 整理數據
      const coachMap = new Map<string, CoachStats>()

      // 處理教學記錄
      teachingData?.forEach((record: any) => {
        const coachId = record.coach_id
        const coachName = record.coaches?.name || '未知'
        
        if (!coachMap.has(coachId)) {
          coachMap.set(coachId, {
            coachId,
            coachName,
            teachingMinutes: 0,
            teachingCount: 0,
            drivingMinutes: 0,
            drivingCount: 0,
            totalMinutes: 0,
            details: []
          })
        }

        const stats = coachMap.get(coachId)!
        stats.teachingMinutes += record.duration_min || 0
        stats.teachingCount += 1

        // 查找或創建 booking detail
        const bookingId = record.bookings.id
        let detail = stats.details.find(d => d.bookingId === bookingId)
        
        if (!detail) {
          detail = {
              bookingId,
            date: extractDate(record.bookings.start_at),
            time: extractTime(record.bookings.start_at),
            boatName: record.bookings.boats?.name || '未知',
            duration: record.bookings.duration_min || 0,
            participants: []
          }
          stats.details.push(detail)
        }

        detail.participants.push({
          name: record.participant_name || '未命名',
          memberName: record.members?.nickname || record.members?.name,
          duration: record.duration_min || 0,
          lessonType: getLessonTypeLabel(record.lesson_type)
        })
      })

      // 處理駕駛記錄
      drivingData?.forEach((record: any) => {
        const coachId = record.coach_id
        const coachName = record.coaches?.name || '未知'
        
        if (!coachMap.has(coachId)) {
          coachMap.set(coachId, {
            coachId,
            coachName,
            teachingMinutes: 0,
            teachingCount: 0,
            drivingMinutes: 0,
            drivingCount: 0,
            totalMinutes: 0,
            details: []
          })
  }

        const stats = coachMap.get(coachId)!
        stats.drivingMinutes += record.driver_duration_min || 0
        stats.drivingCount += 1

        // 查找或創建 booking detail
        const bookingId = record.booking_id
        let detail = stats.details.find(d => d.bookingId === bookingId)
        
        if (!detail) {
          detail = {
            bookingId,
            date: extractDate(record.bookings.start_at),
            time: extractTime(record.bookings.start_at),
            boatName: record.bookings.boats?.name || '未知',
            duration: record.bookings.duration_min || 0,
            participants: []
          }
          stats.details.push(detail)
        }

        detail.driverDuration = record.driver_duration_min
      })

      // 計算總時數並排序
      const statsArray = Array.from(coachMap.values())
      statsArray.forEach(stats => {
        stats.totalMinutes = stats.teachingMinutes + stats.drivingMinutes
        // 按日期排序細帳
        stats.details.sort((a, b) => {
          const dateCompare = a.date.localeCompare(b.date)
          if (dateCompare !== 0) return dateCompare
          return a.time.localeCompare(b.time)
        })
      })

      // 按總時數降序排序
      statsArray.sort((a, b) => b.totalMinutes - a.totalMinutes)

      // 篩選教練
      const filteredStats = selectedCoachId === 'all' 
        ? statsArray 
        : statsArray.filter(s => s.coachId === selectedCoachId)

      setCoachStats(filteredStats)

    } catch (error) {
      console.error('載入數據失敗:', error)
      alert('載入數據失敗')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'past') {
      loadPastData()
    }
  }, [activeTab, selectedMonth, selectedCoachId])

  const getLessonTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      'undesignated': '不指定',
      'designated_paid': '指定（需收費）',
      'designated_free': '指定（不需收費）'
    }
    return labels[type] || type
      }

  // 統計摘要
  const totalTeachingMinutes = coachStats.reduce((sum, s) => sum + s.teachingMinutes, 0)
  const totalDrivingMinutes = coachStats.reduce((sum, s) => sum + s.drivingMinutes, 0)
  const totalBookings = new Set(coachStats.flatMap(s => s.details.map(d => d.bookingId))).size

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PageHeader user={user} title="教練工作報表" />
      
      <div style={{ 
        flex: 1, 
        padding: isMobile ? '16px' : '24px',
        maxWidth: '1400px',
        width: '100%',
        margin: '0 auto'
      }}>
        {/* 標題 */}
        <h1 style={{
          fontSize: isMobile ? '24px' : '32px',
          fontWeight: '700',
          marginBottom: '24px',
          color: '#333'
        }}>
          📊 教練工作報表
        </h1>

        {/* Tab 切換 */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '24px',
          borderBottom: '2px solid #e0e0e0'
        }}>
          <button
            onClick={() => setActiveTab('past')}
            style={{
              padding: isMobile ? '12px 24px' : '10px 20px',
              fontSize: isMobile ? '16px' : '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: activeTab === 'past' ? '#2196f3' : 'transparent',
              color: activeTab === 'past' ? 'white' : '#666',
              borderRadius: '8px 8px 0 0',
              border: 'none',
              borderBottom: activeTab === 'past' ? 'none' : '2px solid transparent',
              marginBottom: '-2px'
            }}
          >
            📅 歷史記錄
          </button>
          <button
            onClick={() => setActiveTab('future')}
            style={{
              padding: isMobile ? '12px 24px' : '10px 20px',
              fontSize: isMobile ? '16px' : '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: activeTab === 'future' ? '#2196f3' : 'transparent',
              color: activeTab === 'future' ? 'white' : '#666',
              borderRadius: '8px 8px 0 0',
              border: 'none',
              borderBottom: activeTab === 'future' ? 'none' : '2px solid transparent',
              marginBottom: '-2px'
            }}
          >
            🔮 未來預約
          </button>
        </div>

        {/* 歷史記錄 Tab */}
        {activeTab === 'past' && (
          <>
            {/* 篩選區 */}
            <div style={{
              ...getCardStyle(isMobile),
              marginBottom: '24px',
              display: 'flex',
              gap: '16px',
              flexWrap: 'wrap',
              alignItems: 'flex-end'
            }}>
              {/* 月份選擇 */}
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px', color: '#333' }}>
                  月份
              </label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
              </div>
          
          {/* 教練篩選 */}
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px', color: '#333' }}>
                  教練
            </label>
            <select
              value={selectedCoachId}
              onChange={(e) => setSelectedCoachId(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                fontSize: '14px'
              }}
            >
              <option value="all">全部教練</option>
                  {coachStats.map(stat => (
                    <option key={stat.coachId} value={stat.coachId}>
                      {stat.coachName}
                    </option>
              ))}
            </select>
          </div>
        </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                載入中...
              </div>
            ) : coachStats.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                本月無記錄
            </div>
            ) : (
              <>
                {/* 統計摘要 */}
            <div style={{ 
              display: 'grid', 
                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
                  gap: '16px',
              marginBottom: '24px'
            }}>
              <div style={{
                    padding: '16px',
                    background: '#f0f9ff',
                borderRadius: '8px',
                    border: '1px solid #bae6fd'
              }}>
                    <div style={{ fontSize: '13px', color: '#0369a1', marginBottom: '4px' }}>總教學時數</div>
                    <div style={{ fontSize: isMobile ? '24px' : '28px', fontWeight: 'bold', color: '#0c4a6e' }}>
                      {totalTeachingMinutes} 分
                    </div>
                    <div style={{ fontSize: '12px', color: '#0369a1' }}>
                      ({(totalTeachingMinutes / 60).toFixed(1)} 小時)
                </div>
              </div>

              <div style={{
                    padding: '16px',
                    background: '#f0fdf4',
                borderRadius: '8px',
                    border: '1px solid #bbf7d0'
              }}>
                    <div style={{ fontSize: '13px', color: '#15803d', marginBottom: '4px' }}>總駕駛時數</div>
                    <div style={{ fontSize: isMobile ? '24px' : '28px', fontWeight: 'bold', color: '#166534' }}>
                      {totalDrivingMinutes} 分
                    </div>
                    <div style={{ fontSize: '12px', color: '#15803d' }}>
                      ({(totalDrivingMinutes / 60).toFixed(1)} 小時)
                </div>
              </div>

              <div style={{
                    padding: '16px',
                    background: '#fef3c7',
                borderRadius: '8px',
                    border: '1px solid #fde047'
              }}>
                    <div style={{ fontSize: '13px', color: '#a16207', marginBottom: '4px' }}>總預約數</div>
                    <div style={{ fontSize: isMobile ? '24px' : '28px', fontWeight: 'bold', color: '#854d0e' }}>
                      {totalBookings} 筆
                </div>
              </div>
            </div>

                {/* 圖表區 - 並排顯示 */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                  gap: '16px',
                  marginBottom: '24px'
                }}>
                  {/* 教學時數圖表 */}
                  <div style={getCardStyle(isMobile)}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600', color: '#2196f3' }}>
                      🎓 教學時數對比
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {coachStats.map(stat => (
                        <div key={`teaching-${stat.coachId}`}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '600', color: '#333' }}>
                              {stat.coachName}
                          </span>
                            <span style={{ fontSize: '12px', color: '#666' }}>
                              {stat.teachingMinutes}分 ({stat.teachingCount}筆)
                          </span>
                        </div>
                        <div style={{
                          width: '100%',
                            height: '24px',
                            background: '#e3f2fd',
                            borderRadius: '6px',
                          overflow: 'hidden'
                        }}>
                            <div
                              style={{
                                width: `${(stat.teachingMinutes / Math.max(...coachStats.map(s => s.teachingMinutes), 1)) * 100}%`,
                            height: '100%',
                                background: 'linear-gradient(90deg, #2196f3, #1976d2)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                paddingRight: '8px',
                                color: 'white',
                                fontSize: '11px',
                                fontWeight: '600',
                            transition: 'width 0.3s'
                              }}
                            >
                              {stat.teachingMinutes > 0 && `${stat.teachingMinutes}分`}
                            </div>
                          </div>
                        </div>
                      ))}
                </div>
              </div>

                  {/* 駕駛時數圖表 */}
                  <div style={getCardStyle(isMobile)}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600', color: '#4caf50' }}>
                      🚤 駕駛時數對比
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {coachStats.map(stat => (
                        <div key={`driving-${stat.coachId}`}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '600', color: '#333' }}>
                              {stat.coachName}
                            </span>
                            <span style={{ fontSize: '12px', color: '#666' }}>
                              {stat.drivingMinutes}分 ({stat.drivingCount}筆)
                            </span>
          </div>
        <div style={{
                            width: '100%',
                            height: '24px',
                            background: '#e8f5e9',
                            borderRadius: '6px',
                            overflow: 'hidden'
        }}>
                            <div
            style={{
                                width: `${(stat.drivingMinutes / Math.max(...coachStats.map(s => s.drivingMinutes), 1)) * 100}%`,
                                height: '100%',
                                background: 'linear-gradient(90deg, #4caf50, #388e3c)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                paddingRight: '8px',
                                color: 'white',
                                fontSize: '11px',
                                fontWeight: '600',
                                transition: 'width 0.3s'
                              }}
                            >
                              {stat.drivingMinutes > 0 && `${stat.drivingMinutes}分`}
                            </div>
                          </div>
                        </div>
                      ))}
        </div>
          </div>
              </div>

                {/* 教練列表（可展開細帳） */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {coachStats.map(stat => (
                    <div key={stat.coachId} style={getCardStyle(isMobile)}>
                      {/* 教練標題 */}
                      <div
                        onClick={() => setExpandedCoachId(expandedCoachId === stat.coachId ? null : stat.coachId)}
                      style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          cursor: 'pointer',
                          padding: '4px 0'
                        }}
                      >
                        <div>
                          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#333' }}>
                            {stat.coachName}
                          </h3>
                          <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>
                            教學 {stat.teachingMinutes}分 ({stat.teachingCount}筆) | 駕駛 {stat.drivingMinutes}分 ({stat.drivingCount}筆)
                        </div>
                        </div>
                        <div style={{ fontSize: '24px' }}>
                          {expandedCoachId === stat.coachId ? '▼' : '▶'}
                        </div>
                      </div>

                      {/* 細帳 */}
                      {expandedCoachId === stat.coachId && (
                        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e0e0e0', overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead>
                              <tr style={{ background: '#f5f5f5' }}>
                                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontWeight: '600', color: '#666' }}>日期時間</th>
                                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontWeight: '600', color: '#666' }}>船隻</th>
                                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontWeight: '600', color: '#666' }}>學員</th>
                                <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #e0e0e0', fontWeight: '600', color: '#666' }}>教學</th>
                                <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #e0e0e0', fontWeight: '600', color: '#666' }}>駕駛</th>
                              </tr>
                            </thead>
                            <tbody>
                              {stat.details.map((detail, idx) => (
                                <tr key={`${detail.bookingId}-${idx}`} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                  <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>
                                    <div style={{ fontWeight: '600', color: '#333' }}>{detail.date}</div>
                                    <div style={{ color: '#999', fontSize: '12px' }}>{detail.time}</div>
                                  </td>
                                  <td style={{ padding: '10px' }}>
                                    <div style={{ color: '#666' }}>{detail.boatName}</div>
                                    <div style={{ color: '#999', fontSize: '12px' }}>({detail.duration}分)</div>
                                  </td>
                                  <td style={{ padding: '10px' }}>
                                    {detail.participants.length > 0 ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {detail.participants.map((p, pIdx) => (
                                          <div key={pIdx}>
                                            {p.memberName ? (
                                              <span style={{ color: '#2196f3', fontWeight: '600' }}>{p.memberName}</span>
                                            ) : (
                                              <span style={{ color: '#333' }}>{p.name}</span>
                                            )}
                                            <span style={{ color: '#999', fontSize: '12px', marginLeft: '4px' }}>
                                              {p.lessonType} {p.duration}分
                                            </span>
                              </div>
                            ))}
                          </div>
                                    ) : (
                                      <span style={{ color: '#999' }}>-</span>
                                    )}
                                  </td>
                                  <td style={{ padding: '10px', textAlign: 'center' }}>
                                    {detail.participants.length > 0 ? (
                                      <span style={{ color: '#2196f3', fontWeight: '600' }}>
                                        {detail.participants.reduce((sum, p) => sum + p.duration, 0)}分
                                      </span>
                                    ) : (
                                      <span style={{ color: '#999' }}>-</span>
                                    )}
                                  </td>
                                  <td style={{ padding: '10px', textAlign: 'center' }}>
                                    {detail.driverDuration ? (
                                      <span style={{ color: '#4caf50', fontWeight: '600' }}>{detail.driverDuration}分</span>
                                    ) : (
                                      <span style={{ color: '#999' }}>-</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
              </>
            )}
          </>
        )}

        {/* 未來預約 Tab */}
        {activeTab === 'future' && (
          <div style={{
                      ...getCardStyle(isMobile),
            textAlign: 'center',
            padding: '60px 20px',
            color: '#999'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔮</div>
            <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>未來預約統計</div>
            <div style={{ fontSize: '14px' }}>此功能即將推出</div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}
