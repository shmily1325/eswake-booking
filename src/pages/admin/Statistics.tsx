import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthUser } from '../../contexts/AuthContext'
import { PageHeader } from '../../components/PageHeader'
import { Footer } from '../../components/Footer'
import { useResponsive } from '../../hooks/useResponsive'
import { getCardStyle } from '../../styles/designSystem'
import { getLocalDateString } from '../../utils/date'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts'

interface MonthlyStats {
  month: string
  label: string
  bookingCount: number
  totalMinutes: number
  totalHours: number
}

interface CoachFutureBooking {
  coachId: string
  coachName: string
  bookings: {
    month: string
    label: string
    count: number
    minutes: number
  }[]
  totalCount: number
  totalMinutes: number
}

interface FutureMonthData {
  month: string
  label: string
  [coachName: string]: string | number
}

const CHART_COLORS = [
  '#4a90e2', '#50c878', '#ff6b6b', '#ffd93d', '#6c5ce7',
  '#a29bfe', '#fd79a8', '#00b894', '#e17055', '#0984e3'
]

export function Statistics() {
  const user = useAuthUser()
  const { isMobile } = useResponsive()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'trend' | 'future' | 'coach'>('trend')
  
  // 趨勢數據
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([])
  
  // 未來預約數據
  const [futureBookings, setFutureBookings] = useState<CoachFutureBooking[]>([])
  const [futureMonths, setFutureMonths] = useState<string[]>([])
  
  // 教練時數數據
  const [coachStats, setCoachStats] = useState<{
    coachId: string
    coachName: string
    teachingMinutes: number
    drivingMinutes: number
  }[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  useEffect(() => {
    loadAllData()
  }, [selectedPeriod])

  const loadAllData = async () => {
    setLoading(true)
    try {
      await Promise.all([
        loadMonthlyTrend(),
        loadFutureBookings(),
        loadCoachStats()
      ])
    } catch (error) {
      console.error('載入統計數據失敗:', error)
    } finally {
      setLoading(false)
    }
  }

  // 載入過去6個月的預約趨勢
  const loadMonthlyTrend = async () => {
    const months: MonthlyStats[] = []
    const now = new Date()
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      const monthStr = `${year}-${String(month).padStart(2, '0')}`
      const startDate = `${monthStr}-01`
      const endDate = new Date(year, month, 0).getDate()
      const endDateStr = `${monthStr}-${String(endDate).padStart(2, '0')}`
      
      const { data, error } = await supabase
        .from('bookings')
        .select('id, duration_min')
        .gte('start_at', `${startDate}T00:00:00`)
        .lte('start_at', `${endDateStr}T23:59:59`)
        .neq('status', 'cancelled')
      
      if (!error && data) {
        const totalMinutes = data.reduce((sum, b) => sum + (b.duration_min || 0), 0)
        months.push({
          month: monthStr,
          label: `${month}月`,
          bookingCount: data.length,
          totalMinutes,
          totalHours: Math.round(totalMinutes / 60 * 10) / 10
        })
      }
    }
    
    setMonthlyStats(months)
  }

  // 載入未來預約（按教練分組）
  const loadFutureBookings = async () => {
    const today = getLocalDateString()
    
    // 取得未來3個月的日期範圍
    const futureMonthsList: string[] = []
    const now = new Date()
    for (let i = 0; i < 3; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1)
      futureMonthsList.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
    }
    setFutureMonths(futureMonthsList)
    
    // 載入未來的預約
    const endDate = new Date(now.getFullYear(), now.getMonth() + 3, 0)
    const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`
    
    const { data: bookingsData, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        id, start_at, duration_min,
        booking_coaches(coach_id, coaches(id, name))
      `)
      .gte('start_at', `${today}T00:00:00`)
      .lte('start_at', `${endDateStr}T23:59:59`)
      .neq('status', 'cancelled')
    
    if (bookingsError) {
      console.error('載入未來預約失敗:', bookingsError)
      return
    }
    
    // 整理數據
    const coachMap = new Map<string, CoachFutureBooking>()
    
    bookingsData?.forEach((booking: any) => {
      const bookingMonth = booking.start_at.substring(0, 7)
      const coaches = booking.booking_coaches || []
      
      if (coaches.length === 0) {
        // 未指派教練的預約
        if (!coachMap.has('unassigned')) {
          coachMap.set('unassigned', {
            coachId: 'unassigned',
            coachName: '未指派',
            bookings: futureMonthsList.map(m => ({
              month: m,
              label: `${parseInt(m.split('-')[1])}月`,
              count: 0,
              minutes: 0
            })),
            totalCount: 0,
            totalMinutes: 0
          })
        }
        const coach = coachMap.get('unassigned')!
        const monthData = coach.bookings.find(b => b.month === bookingMonth)
        if (monthData) {
          monthData.count += 1
          monthData.minutes += booking.duration_min || 0
        }
        coach.totalCount += 1
        coach.totalMinutes += booking.duration_min || 0
      } else {
        coaches.forEach((bc: any) => {
          const coachId = bc.coach_id
          const coachName = bc.coaches?.name || '未知'
          
          if (!coachMap.has(coachId)) {
            coachMap.set(coachId, {
              coachId,
              coachName,
              bookings: futureMonthsList.map(m => ({
                month: m,
                label: `${parseInt(m.split('-')[1])}月`,
                count: 0,
                minutes: 0
              })),
              totalCount: 0,
              totalMinutes: 0
            })
          }
          
          const coach = coachMap.get(coachId)!
          const monthData = coach.bookings.find(b => b.month === bookingMonth)
          if (monthData) {
            monthData.count += 1
            monthData.minutes += booking.duration_min || 0
          }
          coach.totalCount += 1
          coach.totalMinutes += booking.duration_min || 0
        })
      }
    })
    
    // 排序並設置
    const sortedCoaches = Array.from(coachMap.values())
      .sort((a, b) => b.totalCount - a.totalCount)
    
    setFutureBookings(sortedCoaches)
  }

  // 載入教練時數統計
  const loadCoachStats = async () => {
    const [year, month] = selectedPeriod.split('-')
    const startDate = `${selectedPeriod}-01`
    const endDate = new Date(parseInt(year), parseInt(month), 0).getDate()
    const endDateStr = `${selectedPeriod}-${String(endDate).padStart(2, '0')}`
    
    // 載入教學記錄
    const { data: teachingData } = await supabase
      .from('booking_participants')
      .select(`
        coach_id, duration_min,
        coaches:coach_id(id, name),
        bookings!inner(start_at)
      `)
      .eq('status', 'processed')
      .eq('is_teaching', true)
      .eq('is_deleted', false)
      .gte('bookings.start_at', `${startDate}T00:00:00`)
      .lte('bookings.start_at', `${endDateStr}T23:59:59`)
    
    // 載入駕駛記錄
    const { data: drivingData } = await supabase
      .from('coach_reports')
      .select(`
        coach_id, driver_duration_min,
        coaches:coach_id(id, name),
        bookings!inner(start_at)
      `)
      .gte('bookings.start_at', `${startDate}T00:00:00`)
      .lte('bookings.start_at', `${endDateStr}T23:59:59`)
    
    // 整理數據
    const statsMap = new Map<string, {
      coachId: string
      coachName: string
      teachingMinutes: number
      drivingMinutes: number
    }>()
    
    teachingData?.forEach((record: any) => {
      const coachId = record.coach_id
      if (!coachId) return
      
      if (!statsMap.has(coachId)) {
        statsMap.set(coachId, {
          coachId,
          coachName: record.coaches?.name || '未知',
          teachingMinutes: 0,
          drivingMinutes: 0
        })
      }
      statsMap.get(coachId)!.teachingMinutes += record.duration_min || 0
    })
    
    drivingData?.forEach((record: any) => {
      const coachId = record.coach_id
      if (!coachId) return
      
      if (!statsMap.has(coachId)) {
        statsMap.set(coachId, {
          coachId,
          coachName: record.coaches?.name || '未知',
          teachingMinutes: 0,
          drivingMinutes: 0
        })
      }
      statsMap.get(coachId)!.drivingMinutes += record.driver_duration_min || 0
    })
    
    const sorted = Array.from(statsMap.values())
      .sort((a, b) => (b.teachingMinutes + b.drivingMinutes) - (a.teachingMinutes + a.drivingMinutes))
    
    setCoachStats(sorted)
  }

  // 計算未來預約的圖表數據
  const futureChartData = useMemo((): FutureMonthData[] => {
    if (futureMonths.length === 0) return []
    
    return futureMonths.map(month => {
      const data: FutureMonthData = {
        month,
        label: `${parseInt(month.split('-')[1])}月`
      }
      
      futureBookings.forEach(coach => {
        const monthData = coach.bookings.find(b => b.month === month)
        data[coach.coachName] = monthData?.count || 0
      })
      
      return data
    })
  }, [futureMonths, futureBookings])

  // 計算教練時數圓餅圖數據
  const coachPieData = useMemo(() => {
    return coachStats.map((coach, index) => ({
      name: coach.coachName,
      value: coach.teachingMinutes + coach.drivingMinutes,
      color: CHART_COLORS[index % CHART_COLORS.length]
    })).filter(d => d.value > 0)
  }, [coachStats])

  const totalFutureBookings = futureBookings.reduce((sum, c) => sum + c.totalCount, 0)
  const totalFutureMinutes = futureBookings.reduce((sum, c) => sum + c.totalMinutes, 0)

  const tabStyle = (isActive: boolean) => ({
    padding: isMobile ? '12px 16px' : '14px 24px',
    background: isActive ? 'linear-gradient(135deg, #4a90e2 0%, #1976d2 100%)' : 'white',
    color: isActive ? 'white' : '#666',
    border: isActive ? 'none' : '1px solid #e0e0e0',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: isMobile ? '14px' : '15px',
    fontWeight: isActive ? '600' : '500',
    transition: 'all 0.2s',
    boxShadow: isActive ? '0 4px 12px rgba(74, 144, 226, 0.3)' : 'none'
  })

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '80px' }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: isMobile ? '16px' : '24px'
      }}>
        <PageHeader 
          title="📊 Dashboard" 
          user={user}
          showBaoLink={true}
        />

        {/* Tab 切換 */}
        <div style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '24px',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => setActiveTab('trend')}
            style={tabStyle(activeTab === 'trend')}
          >
            📈 預約趨勢
          </button>
          <button
            onClick={() => setActiveTab('future')}
            style={tabStyle(activeTab === 'future')}
          >
            📅 未來預約
          </button>
          <button
            onClick={() => setActiveTab('coach')}
            style={tabStyle(activeTab === 'coach')}
          >
            👨‍🏫 教練時數
          </button>
        </div>

        {loading ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '60px', 
            color: '#999',
            fontSize: '16px'
          }}>
            載入統計數據中...
          </div>
        ) : (
          <div>
            {/* Tab 1: 預約趨勢 */}
            {activeTab === 'trend' && (
              <>
                {/* 摘要卡片 */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
                  gap: '16px',
                  marginBottom: '24px'
                }}>
                  <div style={{
                    ...getCardStyle(isMobile),
                    borderLeft: '4px solid #4a90e2',
                    marginBottom: 0
                  }}>
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>本月預約</div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#333' }}>
                      {monthlyStats[monthlyStats.length - 1]?.bookingCount || 0}
                    </div>
                    <div style={{ fontSize: '12px', color: '#999' }}>筆</div>
                  </div>
                  <div style={{
                    ...getCardStyle(isMobile),
                    borderLeft: '4px solid #50c878',
                    marginBottom: 0
                  }}>
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>本月時數</div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#333' }}>
                      {monthlyStats[monthlyStats.length - 1]?.totalHours || 0}
                    </div>
                    <div style={{ fontSize: '12px', color: '#999' }}>小時</div>
                  </div>
                  <div style={{
                    ...getCardStyle(isMobile),
                    borderLeft: '4px solid #ffd93d',
                    marginBottom: 0
                  }}>
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>6個月平均</div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#333' }}>
                      {Math.round(monthlyStats.reduce((sum, m) => sum + m.bookingCount, 0) / Math.max(monthlyStats.length, 1))}
                    </div>
                    <div style={{ fontSize: '12px', color: '#999' }}>筆/月</div>
                  </div>
                  <div style={{
                    ...getCardStyle(isMobile),
                    borderLeft: '4px solid #6c5ce7',
                    marginBottom: 0
                  }}>
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>6個月總計</div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#333' }}>
                      {monthlyStats.reduce((sum, m) => sum + m.bookingCount, 0)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#999' }}>筆</div>
                  </div>
                </div>

                {/* 預約量折線圖 */}
                <div style={{
                  ...getCardStyle(isMobile),
                  marginBottom: '24px'
                }}>
                  <h3 style={{ 
                    margin: '0 0 20px 0', 
                    fontSize: '17px', 
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span style={{ 
                      width: '4px', 
                      height: '20px', 
                      background: '#4a90e2', 
                      borderRadius: '2px',
                      display: 'inline-block'
                    }}></span>
                    近6個月預約趨勢
                  </h3>
                  <div style={{ width: '100%', height: isMobile ? 250 : 300 }}>
                    <ResponsiveContainer>
                      <LineChart data={monthlyStats}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip 
                          contentStyle={{ 
                            borderRadius: '8px', 
                            border: 'none',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                          }}
                          formatter={(value, name) => [
                            name === 'bookingCount' ? `${value} 筆` : `${value} 小時`,
                            name === 'bookingCount' ? '預約數' : '時數'
                          ]}
                        />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="bookingCount" 
                          name="預約數" 
                          stroke="#4a90e2" 
                          strokeWidth={3}
                          dot={{ fill: '#4a90e2', strokeWidth: 2, r: 5 }}
                          activeDot={{ r: 8 }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="totalHours" 
                          name="時數" 
                          stroke="#50c878" 
                          strokeWidth={3}
                          dot={{ fill: '#50c878', strokeWidth: 2, r: 5 }}
                          activeDot={{ r: 8 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 月份數據表格 */}
                <div style={getCardStyle(isMobile)}>
                  <h3 style={{ 
                    margin: '0 0 20px 0', 
                    fontSize: '17px', 
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span style={{ 
                      width: '4px', 
                      height: '20px', 
                      background: '#50c878', 
                      borderRadius: '2px',
                      display: 'inline-block'
                    }}></span>
                    月份數據明細
                  </h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                      <thead>
                        <tr style={{ background: '#f8f9fa' }}>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>月份</th>
                          <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e0e0e0' }}>預約數</th>
                          <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e0e0e0' }}>總分鐘</th>
                          <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e0e0e0' }}>總小時</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyStats.map((stat, idx) => (
                          <tr key={stat.month} style={{ 
                            background: idx === monthlyStats.length - 1 ? '#e3f2fd' : 'white'
                          }}>
                            <td style={{ padding: '12px', fontWeight: idx === monthlyStats.length - 1 ? '600' : '400' }}>
                              {stat.month}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'right' }}>{stat.bookingCount}</td>
                            <td style={{ padding: '12px', textAlign: 'right' }}>{stat.totalMinutes}</td>
                            <td style={{ padding: '12px', textAlign: 'right' }}>{stat.totalHours}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* Tab 2: 未來預約 */}
            {activeTab === 'future' && (
              <>
                {/* 摘要 */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)',
                  gap: '16px',
                  marginBottom: '24px'
                }}>
                  <div style={{
                    ...getCardStyle(isMobile),
                    borderLeft: '4px solid #4a90e2',
                    marginBottom: 0
                  }}>
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>未來3個月預約</div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#333' }}>
                      {totalFutureBookings}
                    </div>
                    <div style={{ fontSize: '12px', color: '#999' }}>筆</div>
                  </div>
                  <div style={{
                    ...getCardStyle(isMobile),
                    borderLeft: '4px solid #50c878',
                    marginBottom: 0
                  }}>
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>總預約時數</div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#333' }}>
                      {Math.round(totalFutureMinutes / 60 * 10) / 10}
                    </div>
                    <div style={{ fontSize: '12px', color: '#999' }}>小時</div>
                  </div>
                  <div style={{
                    ...getCardStyle(isMobile),
                    borderLeft: '4px solid #ffd93d',
                    marginBottom: 0
                  }}>
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>教練人數</div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#333' }}>
                      {futureBookings.filter(c => c.coachId !== 'unassigned').length}
                    </div>
                    <div style={{ fontSize: '12px', color: '#999' }}>人</div>
                  </div>
                </div>

                {/* 未來預約柱狀圖 */}
                <div style={{
                  ...getCardStyle(isMobile),
                  marginBottom: '24px'
                }}>
                  <h3 style={{ 
                    margin: '0 0 20px 0', 
                    fontSize: '17px', 
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span style={{ 
                      width: '4px', 
                      height: '20px', 
                      background: '#4a90e2', 
                      borderRadius: '2px',
                      display: 'inline-block'
                    }}></span>
                    未來3個月預約分佈（按教練）
                  </h3>
                  <div style={{ width: '100%', height: isMobile ? 300 : 350 }}>
                    <ResponsiveContainer>
                      <BarChart data={futureChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip 
                          contentStyle={{ 
                            borderRadius: '8px', 
                            border: 'none',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                          }}
                        />
                        <Legend />
                        {futureBookings.slice(0, 8).map((coach, index) => (
                          <Bar 
                            key={coach.coachId}
                            dataKey={coach.coachName}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                            stackId="a"
                            radius={index === futureBookings.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 教練未來預約列表 */}
                <div style={getCardStyle(isMobile)}>
                  <h3 style={{ 
                    margin: '0 0 20px 0', 
                    fontSize: '17px', 
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span style={{ 
                      width: '4px', 
                      height: '20px', 
                      background: '#50c878', 
                      borderRadius: '2px',
                      display: 'inline-block'
                    }}></span>
                    各教練未來預約統計
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {futureBookings.map((coach, index) => (
                      <div key={coach.coachId} style={{
                        padding: '16px',
                        background: '#f8f9fa',
                        borderRadius: '10px',
                        borderLeft: `4px solid ${CHART_COLORS[index % CHART_COLORS.length]}`
                      }}>
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          marginBottom: '12px'
                        }}>
                          <span style={{ fontSize: '16px', fontWeight: '600', color: '#333' }}>
                            {coach.coachName}
                          </span>
                          <span style={{ 
                            fontSize: '14px', 
                            fontWeight: '600',
                            color: CHART_COLORS[index % CHART_COLORS.length]
                          }}>
                            共 {coach.totalCount} 筆 / {Math.round(coach.totalMinutes / 60 * 10) / 10} 小時
                          </span>
                        </div>
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(3, 1fr)', 
                          gap: '8px' 
                        }}>
                          {coach.bookings.map(b => (
                            <div key={b.month} style={{
                              padding: '10px',
                              background: 'white',
                              borderRadius: '8px',
                              textAlign: 'center'
                            }}>
                              <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>
                                {b.label}
                              </div>
                              <div style={{ fontSize: '18px', fontWeight: '600', color: '#333' }}>
                                {b.count}
                              </div>
                              <div style={{ fontSize: '11px', color: '#666' }}>
                                {Math.round(b.minutes / 60 * 10) / 10}hr
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {futureBookings.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                        目前沒有未來預約
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Tab 3: 教練時數 */}
            {activeTab === 'coach' && (
              <>
                {/* 月份選擇 */}
                <div style={{
                  ...getCardStyle(isMobile),
                  marginBottom: '24px'
                }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    fontWeight: '600',
                    fontSize: '15px'
                  }}>
                    選擇月份
                  </label>
                  <input
                    type="month"
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                    style={{
                      padding: '12px 16px',
                      fontSize: '16px',
                      border: '2px solid #e0e0e0',
                      borderRadius: '8px',
                      width: isMobile ? '100%' : '200px'
                    }}
                  />
                </div>

                {coachStats.length > 0 ? (
                  <>
                    {/* 圓餅圖 */}
                    <div style={{
                      ...getCardStyle(isMobile),
                      marginBottom: '24px'
                    }}>
                      <h3 style={{ 
                        margin: '0 0 20px 0', 
                        fontSize: '17px', 
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span style={{ 
                          width: '4px', 
                          height: '20px', 
                          background: '#6c5ce7', 
                          borderRadius: '2px',
                          display: 'inline-block'
                        }}></span>
                        時數佔比
                      </h3>
                      <div style={{ width: '100%', height: isMobile ? 280 : 320 }}>
                        <ResponsiveContainer>
                          <PieChart>
                            <Pie
                              data={coachPieData}
                              cx="50%"
                              cy="50%"
                              outerRadius={isMobile ? 80 : 100}
                              innerRadius={isMobile ? 40 : 50}
                              dataKey="value"
                              label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                              labelLine={{ stroke: '#999', strokeWidth: 1 }}
                            >
                              {coachPieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip 
                              formatter={(value) => [`${value} 分鐘`, '總時數']}
                              contentStyle={{ 
                                borderRadius: '8px', 
                                border: 'none',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* 教練排行 */}
                    <div style={getCardStyle(isMobile)}>
                      <h3 style={{ 
                        margin: '0 0 20px 0', 
                        fontSize: '17px', 
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span style={{ 
                          width: '4px', 
                          height: '20px', 
                          background: '#ff6b6b', 
                          borderRadius: '2px',
                          display: 'inline-block'
                        }}></span>
                        教練時數排行
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {coachStats.map((coach, index) => {
                          const total = coach.teachingMinutes + coach.drivingMinutes
                          const maxTotal = Math.max(...coachStats.map(c => c.teachingMinutes + c.drivingMinutes))
                          
                          return (
                            <div key={coach.coachId}>
                              <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                marginBottom: '8px' 
                              }}>
                                <span style={{ fontWeight: '600', color: '#333' }}>
                                  {index + 1}. {coach.coachName}
                                </span>
                                <span style={{ color: '#666', fontSize: '14px' }}>
                                  共 {total} 分 ({Math.round(total / 60 * 10) / 10} 小時)
                                </span>
                              </div>
                              <div style={{
                                display: 'flex',
                                height: '28px',
                                borderRadius: '6px',
                                overflow: 'hidden',
                                background: '#f0f0f0'
                              }}>
                                <div style={{
                                  width: `${(coach.teachingMinutes / maxTotal) * 100}%`,
                                  background: 'linear-gradient(90deg, #4a90e2, #1976d2)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'white',
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  minWidth: coach.teachingMinutes > 0 ? '40px' : '0'
                                }}>
                                  {coach.teachingMinutes > 0 && `教 ${coach.teachingMinutes}`}
                                </div>
                                <div style={{
                                  width: `${(coach.drivingMinutes / maxTotal) * 100}%`,
                                  background: 'linear-gradient(90deg, #50c878, #2e7d32)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'white',
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  minWidth: coach.drivingMinutes > 0 ? '40px' : '0'
                                }}>
                                  {coach.drivingMinutes > 0 && `駕 ${coach.drivingMinutes}`}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{
                    ...getCardStyle(isMobile),
                    textAlign: 'center',
                    padding: '60px',
                    color: '#999'
                  }}>
                    {selectedPeriod} 無教練時數記錄
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <Footer />
      </div>
    </div>
  )
}

