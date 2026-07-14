import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAllPaginated } from '../utils/supabasePaginate'
import { extractDate, extractTime, getLocalDateString } from '../utils/formatters'
import { useToast } from './ui'
import { DateRangePicker } from './DateRangePicker'
import { designSystem, getCardStyle, getFontSize, getInputStyle, getLabelStyle } from '../styles/designSystem'

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
  contactName?: string
}

interface ParticipantInfo {
  name: string
  memberName?: string
  duration: number
  lessonType: string
}

interface StatisticsTabProps {
  isMobile: boolean
  autoFilterCoachId?: string // 自动筛选特定教练（用于教练专用页面）
}

export function StatisticsTab({ isMobile, autoFilterCoachId }: StatisticsTabProps) {
  const toast = useToast()
  // 如果是教練專用模式，預設顯示本月；否則顯示今天
  const [selectedDate, setSelectedDate] = useState(() => {
    if (autoFilterCoachId) {
      const now = new Date()
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    }
    return getLocalDateString()
  })
  const [selectedCoachId, setSelectedCoachId] = useState<string>(autoFilterCoachId || 'all')
  const [loading, setLoading] = useState(false)
  const [allCoachStats, setAllCoachStats] = useState<CoachStats[]>([]) // 完整列表
  const [coachStats, setCoachStats] = useState<CoachStats[]>([]) // 顯示用的過濾列表
  const [expandedCoachId, setExpandedCoachId] = useState<string | null>(null)

  // 當 autoFilterCoachId 改變時，更新 selectedCoachId
  useEffect(() => {
    if (autoFilterCoachId) {
      setSelectedCoachId(autoFilterCoachId)
    }
  }, [autoFilterCoachId])

  useEffect(() => {
    // 換條件時先清空，避免新資料載入前畫面殘留前條件的統計數字
    setAllCoachStats([])
    setCoachStats([])
    loadPastData()
  }, [selectedDate, selectedCoachId])

  const loadPastData = async () => {
    if (!selectedDate) return
    
    setLoading(true)
    try {
      let startDate: string
      let endDateStr: string
      
      if (selectedDate.length === 10) {
        // 日期格式 YYYY-MM-DD
        startDate = selectedDate
        endDateStr = selectedDate
      } else {
        // 月份格式 YYYY-MM
        const [year, month] = selectedDate.split('-')
        startDate = `${year}-${month}-01`
        const endDate = new Date(parseInt(year), parseInt(month), 0).getDate()
        endDateStr = `${year}-${month}-${String(endDate).padStart(2, '0')}`
      }

      // 1. 載入教學記錄
      const teachingData = await fetchAllPaginated<any>(async (from, to) => {
        return supabase
          .from('booking_participants')
          .select(`
          *,
          bookings!inner(
            id, start_at, duration_min, boat_id, contact_name,
            boats(name)
          ),
          coaches:coach_id(id, name),
          members:member_id(name, nickname)
        `)
          .eq('status', 'processed')
          .eq('is_teaching', true)
          .eq('is_deleted', false)
          .gte('bookings.start_at', `${startDate}T00:00:00`)
          .lte('bookings.start_at', `${endDateStr}T23:59:59`)
          .order('id', { ascending: true })
          .range(from, to)
      })

      // 2. 載入駕駛記錄
      const drivingData = await fetchAllPaginated<any>(async (from, to) => {
        return supabase
          .from('coach_reports')
          .select(`
          *,
          bookings!inner(
            id, start_at, duration_min, boat_id, contact_name,
            boats(name)
          ),
          coaches:coach_id(id, name)
        `)
          .gte('bookings.start_at', `${startDate}T00:00:00`)
          .lte('bookings.start_at', `${endDateStr}T23:59:59`)
          .order('id', { ascending: true })
          .range(from, to)
      })

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

        const bookingId = record.bookings.id
        let detail = stats.details.find(d => d.bookingId === bookingId)
        
        if (!detail) {
          detail = {
            bookingId,
            date: extractDate(record.bookings.start_at),
            time: extractTime(record.bookings.start_at),
            boatName: record.bookings.boats?.name || '未知',
            duration: record.bookings.duration_min || 0,
            participants: [],
            contactName: record.bookings.contact_name || ''
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

        const bookingId = record.booking_id
        let detail = stats.details.find(d => d.bookingId === bookingId)
        
        if (!detail) {
          detail = {
            bookingId,
            date: extractDate(record.bookings.start_at),
            time: extractTime(record.bookings.start_at),
            boatName: record.bookings.boats?.name || '未知',
            duration: record.bookings.duration_min || 0,
            participants: [],
            contactName: record.bookings.contact_name || ''
          }
          stats.details.push(detail)
        }

        detail.driverDuration = record.driver_duration_min
      })

      // 計算總時數並排序
      const statsArray = Array.from(coachMap.values())
      statsArray.forEach(stats => {
        stats.totalMinutes = stats.teachingMinutes + stats.drivingMinutes
        stats.details.sort((a, b) => {
          const dateCompare = a.date.localeCompare(b.date)
          if (dateCompare !== 0) return dateCompare
          return a.time.localeCompare(b.time)
        })
      })

      statsArray.sort((a, b) => b.totalMinutes - a.totalMinutes)

      // 保存完整列表供下拉選單使用
      setAllCoachStats(statsArray)
      
      // 根據選擇過濾顯示
      const filteredStats = selectedCoachId === 'all' 
        ? statsArray 
        : statsArray.filter(s => s.coachId === selectedCoachId)

      setCoachStats(filteredStats)

    } catch (error) {
      console.error('載入數據失敗:', error)
      toast.error('載入數據失敗')
    } finally {
      setLoading(false)
    }
  }

  const getLessonTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      'undesignated': '不指定',
      'designated_paid': '指定（需收費）',
      'designated_free': '指定（不需收費）'
    }
    return labels[type] || type
  }

  const totalTeachingMinutes = coachStats.reduce((sum, s) => sum + s.teachingMinutes, 0)
  const totalDrivingMinutes = coachStats.reduce((sum, s) => sum + s.drivingMinutes, 0)
  const totalBookings = new Set(coachStats.flatMap(s => s.details.map(d => d.bookingId))).size

  return (
    <div>
      {/* 篩選區 */}
      <div style={{
        ...getCardStyle(isMobile),
        marginBottom: '24px'
      }}>
        {/* 查詢期間 - 簡化版 */}
        <div style={{ marginBottom: '20px' }}>
          <DateRangePicker
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            isMobile={isMobile}
            showTodayButton={!isMobile}
            label="查詢期間"
            simplified={true}
          />
        </div>

        {/* 教練篩選 - 只在非自動篩選模式下顯示 */}
        {!autoFilterCoachId && (
          <div>
            <label style={getLabelStyle(isMobile)}>
              篩選教練
            </label>
            <select
              value={selectedCoachId}
              onChange={(e) => setSelectedCoachId(e.target.value)}
              style={{
                ...getInputStyle(isMobile),
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              <option value="all">全部教練</option>
              {allCoachStats.map(stat => (
                <option key={stat.coachId} value={stat.coachId}>
                  {stat.coachName}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: designSystem.colors.text.secondary }}>
          載入中...
        </div>
      ) : coachStats.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: designSystem.colors.text.secondary }}>
          {selectedDate.length === 10 ? '當日無記錄' : '當月無記錄'}
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
              padding: '24px',
              background: designSystem.colors.background.card,
              borderRadius: designSystem.borderRadius.xl,
              boxShadow: designSystem.shadows.sm,
              borderLeft: `4px solid ${designSystem.colors.success[500]}`
            }}>
              <div style={{ fontSize: getFontSize('body', isMobile), color: designSystem.colors.text.secondary, marginBottom: '8px', fontWeight: '500' }}>
                🎓 教學時數
              </div>
              <div style={{ fontSize: getFontSize('h1', isMobile), fontWeight: 'bold', color: designSystem.colors.text.primary, marginBottom: '4px' }}>
                {totalTeachingMinutes}
              </div>
              <div style={{ fontSize: getFontSize('body', isMobile), color: designSystem.colors.text.disabled }}>
                分鐘 ({(totalTeachingMinutes / 60).toFixed(1)} 小時)
              </div>
            </div>

            <div style={{
              padding: '24px',
              background: designSystem.colors.background.card,
              borderRadius: designSystem.borderRadius.xl,
              boxShadow: designSystem.shadows.sm,
              borderLeft: `4px solid ${designSystem.colors.info[500]}`
            }}>
              <div style={{ fontSize: getFontSize('body', isMobile), color: designSystem.colors.text.secondary, marginBottom: '8px', fontWeight: '500' }}>
                🚤 駕駛時數
              </div>
              <div style={{ fontSize: getFontSize('h1', isMobile), fontWeight: 'bold', color: designSystem.colors.text.primary, marginBottom: '4px' }}>
                {totalDrivingMinutes}
              </div>
              <div style={{ fontSize: getFontSize('body', isMobile), color: designSystem.colors.text.disabled }}>
                分鐘 ({(totalDrivingMinutes / 60).toFixed(1)} 小時)
              </div>
            </div>

            <div style={{
              padding: '24px',
              background: designSystem.colors.background.card,
              borderRadius: designSystem.borderRadius.xl,
              boxShadow: designSystem.shadows.sm,
              borderLeft: `4px solid ${designSystem.colors.warning[500]}`
            }}>
              <div style={{ fontSize: getFontSize('body', isMobile), color: designSystem.colors.text.secondary, marginBottom: '8px', fontWeight: '500' }}>
                總預約數
              </div>
              <div style={{ fontSize: getFontSize('h1', isMobile), fontWeight: 'bold', color: designSystem.colors.text.primary, marginBottom: '4px' }}>
                {totalBookings}
              </div>
              <div style={{ fontSize: getFontSize('body', isMobile), color: designSystem.colors.text.disabled }}>
                筆記錄
              </div>
            </div>
          </div>

          {/* 圖表區 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: '16px',
            marginBottom: '24px'
          }}>
            {/* 教學時數圖表 */}
            <div style={{
              ...getCardStyle(isMobile),
              marginBottom: 0
            }}>
              <h3 style={{ 
                margin: '0 0 20px 0', 
                fontSize: getFontSize('h3', isMobile), 
                fontWeight: '700', 
                color: designSystem.colors.text.primary,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ 
                  display: 'inline-block',
                  width: '4px',
                  height: '20px',
                  background: designSystem.colors.success[500],
                  borderRadius: '2px'
                }}></span>
                🎓 教學時數對比
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {coachStats.map(stat => (
                  <div key={`teaching-${stat.coachId}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: getFontSize('bodySmall', isMobile), fontWeight: '600', color: designSystem.colors.text.primary }}>
                        {stat.coachName}
                      </span>
                      <span style={{ fontSize: getFontSize('caption', isMobile), color: designSystem.colors.text.secondary }}>
                        {stat.teachingMinutes}分 ({stat.teachingCount}筆)
                      </span>
                    </div>
                    <div style={{
                      width: '100%',
                      height: '24px',
                      background: designSystem.colors.success[50],
                      borderRadius: designSystem.borderRadius.md,
                      overflow: 'hidden'
                    }}>
                      <div
                        style={{
                          width: `${(stat.teachingMinutes / Math.max(...coachStats.map(s => s.teachingMinutes), 1)) * 100}%`,
                          height: '100%',
                          background: designSystem.colors.success[500],
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          paddingRight: '8px',
                          color: 'white',
                          fontSize: getFontSize('caption', true),
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
            <div style={{
              ...getCardStyle(isMobile),
              marginBottom: 0
            }}>
              <h3 style={{ 
                margin: '0 0 20px 0', 
                fontSize: getFontSize('h3', isMobile), 
                fontWeight: '700', 
                color: designSystem.colors.text.primary,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ 
                  display: 'inline-block',
                  width: '4px',
                  height: '20px',
                  background: designSystem.colors.info[500],
                  borderRadius: '2px'
                }}></span>
                🚤 駕駛時數對比
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {coachStats.map(stat => (
                  <div key={`driving-${stat.coachId}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: getFontSize('bodySmall', isMobile), fontWeight: '600', color: designSystem.colors.text.primary }}>
                        {stat.coachName}
                      </span>
                      <span style={{ fontSize: getFontSize('caption', isMobile), color: designSystem.colors.text.secondary }}>
                        {stat.drivingMinutes}分 ({stat.drivingCount}筆)
                      </span>
                    </div>
                    <div style={{
                      width: '100%',
                      height: '24px',
                      background: designSystem.colors.info[50],
                      borderRadius: designSystem.borderRadius.md,
                      overflow: 'hidden'
                    }}>
                      <div
                        style={{
                          width: `${(stat.drivingMinutes / Math.max(...coachStats.map(s => s.drivingMinutes), 1)) * 100}%`,
                          height: '100%',
                          background: designSystem.colors.info[500],
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          paddingRight: '8px',
                          color: 'white',
                          fontSize: getFontSize('caption', true),
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
            <h2 style={{ 
              margin: '0 0 16px 0', 
              fontSize: getFontSize('h2', isMobile), 
              fontWeight: '700', 
              color: designSystem.colors.text.primary,
            }}>
              教練細帳
            </h2>
            {coachStats.map(stat => (
              <div key={stat.coachId} style={{
                ...getCardStyle(isMobile),
                marginBottom: 0,
                border: expandedCoachId === stat.coachId
                  ? `1.5px solid ${designSystem.colors.primary[500]}`
                  : `1px solid ${designSystem.colors.border.light}`,
                transition: 'all 0.2s'
              }}>
                {/* 教練標題 */}
                <div
                  onClick={() => setExpandedCoachId(expandedCoachId === stat.coachId ? null : stat.coachId)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    padding: '8px 0',
                    userSelect: 'none'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <h3 style={{ 
                      margin: 0, 
                      fontSize: getFontSize('h3', isMobile), 
                      fontWeight: '700', 
                      color: designSystem.colors.text.primary,
                      marginBottom: '8px'
                    }}>
                      🎓 {stat.coachName}
                    </h3>
                    <div style={{ 
                      fontSize: getFontSize('body', isMobile), 
                      color: designSystem.colors.text.secondary,
                      display: 'flex',
                      gap: '16px',
                      flexWrap: 'wrap'
                    }}>
                      <span style={{ 
                        padding: '4px 12px', 
                        background: designSystem.colors.success[50],
                        color: designSystem.colors.success[700],
                        border: `1px solid ${designSystem.colors.success[500]}33`,
                        borderRadius: designSystem.borderRadius.md,
                        fontWeight: '500'
                      }}>
                        🎓 {stat.teachingMinutes}分 ({stat.teachingCount}筆)
                      </span>
                      <span style={{ 
                        padding: '4px 12px', 
                        background: designSystem.colors.info[50],
                        color: designSystem.colors.info[700],
                        border: `1px solid ${designSystem.colors.info[500]}33`,
                        borderRadius: designSystem.borderRadius.md,
                        fontWeight: '500'
                      }}>
                        🚤 {stat.drivingMinutes}分 ({stat.drivingCount}筆)
                      </span>
                    </div>
                  </div>
                  <div style={{ 
                    fontSize: getFontSize('h3', isMobile),
                    color: designSystem.colors.text.secondary,
                    marginLeft: '16px',
                    transition: 'transform 0.2s',
                    transform: expandedCoachId === stat.coachId ? 'rotate(90deg)' : 'rotate(0deg)'
                  }}>
                    ▶
                  </div>
                </div>

                {/* 細帳 */}
                {expandedCoachId === stat.coachId && (
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${designSystem.colors.border.light}`, overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: getFontSize('bodySmall', isMobile) }}>
                      <thead>
                        <tr style={{ background: designSystem.colors.background.hover }}>
                          <th style={{ padding: '10px', textAlign: 'left', borderBottom: `1px solid ${designSystem.colors.border.light}`, fontWeight: '600', color: designSystem.colors.text.secondary }}>日期時間</th>
                          <th style={{ padding: '10px', textAlign: 'left', borderBottom: `1px solid ${designSystem.colors.border.light}`, fontWeight: '600', color: designSystem.colors.text.secondary }}>船隻</th>
                          <th style={{ padding: '10px', textAlign: 'left', borderBottom: `1px solid ${designSystem.colors.border.light}`, fontWeight: '600', color: designSystem.colors.text.secondary }}>學員</th>
                          <th style={{ padding: '10px', textAlign: 'center', borderBottom: `1px solid ${designSystem.colors.border.light}`, fontWeight: '600', color: designSystem.colors.text.secondary }}>教學</th>
                          <th style={{ padding: '10px', textAlign: 'center', borderBottom: `1px solid ${designSystem.colors.border.light}`, fontWeight: '600', color: designSystem.colors.text.secondary }}>駕駛</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stat.details.map((detail, idx) => (
                          <tr key={`${detail.bookingId}-${idx}`} style={{ borderBottom: `1px solid ${designSystem.colors.border.light}` }}>
                            <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>
                              <div style={{ fontWeight: '600', color: designSystem.colors.text.primary }}>{detail.date}</div>
                              <div style={{ color: designSystem.colors.text.disabled, fontSize: getFontSize('caption', isMobile) }}>{detail.time}</div>
                              {detail.contactName && (
                                <div style={{ color: designSystem.colors.text.secondary, fontSize: getFontSize('caption', isMobile), marginTop: '2px' }}>{detail.contactName}</div>
                              )}
                            </td>
                            <td style={{ padding: '10px' }}>
                              <div style={{ color: designSystem.colors.text.secondary }}>{detail.boatName}</div>
                              <div style={{ color: designSystem.colors.text.disabled, fontSize: getFontSize('caption', isMobile) }}>({detail.duration}分)</div>
                            </td>
                            <td style={{ padding: '10px' }}>
                              {detail.participants.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {detail.participants.map((p, pIdx) => (
                                    <div key={pIdx}>
                                      {p.memberName ? (
                                        <span style={{ color: designSystem.colors.info[700], fontWeight: '600' }}>{p.memberName}</span>
                                      ) : (
                                        <span style={{ color: designSystem.colors.text.primary }}>{p.name}</span>
                                      )}
                                      <span style={{ color: designSystem.colors.text.disabled, fontSize: getFontSize('caption', isMobile), marginLeft: '4px' }}>
                                        {p.lessonType} {p.duration}分
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ color: designSystem.colors.text.disabled }}>-</span>
                              )}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              {detail.participants.length > 0 ? (
                                <span style={{ color: designSystem.colors.success[700], fontWeight: '600' }}>
                                  {detail.participants.reduce((sum, p) => sum + p.duration, 0)}分
                                </span>
                              ) : (
                                <span style={{ color: designSystem.colors.text.disabled }}>-</span>
                              )}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              {detail.driverDuration ? (
                                <span style={{ color: designSystem.colors.info[700], fontWeight: '600' }}>{detail.driverDuration}分</span>
                              ) : (
                                <span style={{ color: designSystem.colors.text.disabled }}>-</span>
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
    </div>
  )
}

