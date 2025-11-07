import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/PageHeader'
import { Footer } from '../components/Footer'

interface BackupPageProps {
  user: User
}

export function BackupPage({ user }: BackupPageProps) {
  const [loading, setLoading] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [exportType, setExportType] = useState<'bookings' | 'member_hours'>('bookings')

  const exportBookingsToCSV = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('bookings')
        .select(`
          *,
          boats:boat_id (name, color)
        `)
        .order('start_at', { ascending: false })

      if (startDate && endDate) {
        query = query
          .gte('start_at', `${startDate}T00:00:00`)
          .lte('start_at', `${endDate}T23:59:59`)
      }

      const { data: bookings, error } = await query

      if (error) throw error

      if (!bookings || bookings.length === 0) {
        alert('沒有數據可以導出')
        return
      }

      const bookingIds = bookings.map(b => b.id)
      
      // 並行查詢教練和參與者資料
      const [coachesResult, participantsResult, driversResult] = await Promise.all([
        supabase
          .from('booking_coaches')
          .select('booking_id, coaches:coach_id(name)')
          .in('booking_id', bookingIds),
        supabase
          .from('booking_participants')
          .select('booking_id, participant_name, duration_min, is_designated')
          .in('booking_id', bookingIds),
        supabase
          .from('bookings')
          .select('id, driver_coach_id')
          .in('id', bookingIds)
          .not('driver_coach_id', 'is', null)
      ])

      const coachesByBooking: { [key: number]: string[] } = {}
      for (const item of coachesResult.data || []) {
        const bookingId = item.booking_id
        const coach = (item as any).coaches
        if (coach) {
          if (!coachesByBooking[bookingId]) {
            coachesByBooking[bookingId] = []
          }
          coachesByBooking[bookingId].push(coach.name)
        }
      }
      
      const participantsByBooking: { [key: number]: Array<{ name: string, duration: number, designated: boolean }> } = {}
      for (const p of participantsResult.data || []) {
        if (!participantsByBooking[p.booking_id]) {
          participantsByBooking[p.booking_id] = []
        }
        participantsByBooking[p.booking_id].push({
          name: p.participant_name,
          duration: p.duration_min,
          designated: p.is_designated
        })
      }
      
      // 查詢駕駛名稱
      const driverIds = driversResult.data?.filter(b => b.driver_coach_id).map(b => b.driver_coach_id) || []
      const driversById: { [key: string]: string } = {}
      if (driverIds.length > 0) {
        const { data: driversData } = await supabase
          .from('coaches')
          .select('id, name')
          .in('id', driverIds)
        driversData?.forEach(d => {
          driversById[d.id] = d.name
        })
      }
      
      const driverByBooking: { [key: number]: string } = {}
      driversResult.data?.forEach(b => {
        if (b.driver_coach_id) {
          driverByBooking[b.id] = driversById[b.driver_coach_id] || ''
        }
      })

      const formatDateTime = (isoString: string | null): string => {
        if (!isoString) return ''
        const dt = isoString.substring(0, 16) // "2025-10-30T08:30"
        const [date, time] = dt.split('T')
        if (!date || !time) return ''
        const [year, month, day] = date.split('-')
        return `${year}/${month}/${day} ${time}`
      }

      let csv = '\uFEFF'
      csv += '預約人,預約日期,抵達時間,下水時間,預約時長(分鐘),船隻,教練,駕駛,活動類型,回報狀態,參與者,參與者時長,指定課,狀態,備註,創建時間\n'

      bookings.forEach(booking => {
        const boat = (booking as any).boats?.name || '未指定'
        const coaches = coachesByBooking[booking.id]?.join('/') || '未指定'
        const driver = driverByBooking[booking.id] || ''
        const activities = booking.activity_types?.join('+') || ''
        const notes = (booking.notes || '').replace(/"/g, '""').replace(/\n/g, ' ')
        
        const startTime = booking.start_at.substring(11, 16)
        const [startHour, startMin] = startTime.split(':').map(Number)
        const totalMinutes = startHour * 60 + startMin - 30
        const arrivalHour = Math.floor(totalMinutes / 60)
        const arrivalMin = totalMinutes % 60
        const arrivalTime = `${arrivalHour.toString().padStart(2, '0')}:${arrivalMin.toString().padStart(2, '0')}`
        
        const bookingDate = booking.start_at.substring(0, 10).replace(/-/g, '/')
        
        // 回報資訊
        const participants = participantsByBooking[booking.id] || []
        const hasReport = participants.length > 0
        const reportStatus = hasReport ? '已回報' : '未回報'
        
        const statusMap: { [key: string]: string } = {
          'Confirmed': '已確認',
          'Cancelled': '已取消'
        }
        const status = statusMap[booking.status] || booking.status

        if (participants.length > 0) {
          // 每個參與者一行
          participants.forEach((p, idx) => {
            const participantName = p.name
            const participantDuration = p.duration
            const isDesignated = p.designated ? '是' : '否'
            
            // 第一個參與者顯示完整預約資訊，其他只顯示參與者資訊
            if (idx === 0) {
              csv += `"${booking.contact_name}","${bookingDate}","${arrivalTime}","${startTime}",${booking.duration_min},"${boat}","${coaches}","${driver}","${activities}","${reportStatus}","${participantName}",${participantDuration},"${isDesignated}","${status}","${notes}","${formatDateTime(booking.created_at)}"\n`
            } else {
              csv += `"","","","",,"","","","","","${participantName}",${participantDuration},"${isDesignated}","","",""\n`
            }
          })
        } else {
          // 沒有回報的預約
          csv += `"${booking.contact_name}","${bookingDate}","${arrivalTime}","${startTime}",${booking.duration_min},"${boat}","${coaches}","${driver}","${activities}","${reportStatus}","","","","${status}","${notes}","${formatDateTime(booking.created_at)}"\n`
        }
      })

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `預約備份_${new Date().toISOString().split('T')[0]}.csv`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export error:', error)
      alert('❌ 導出失敗，請重試')
    } finally {
      setLoading(false)
    }
  }

  const exportMemberHoursToCSV = async () => {
    setLoading(true)
    try {
      // 查詢指定日期範圍內的參與者記錄
      let participantsQuery = supabase
        .from('booking_participants')
        .select(`
          *,
          bookings!inner(start_at, contact_name, boat_id)
        `)
        .order('bookings(start_at)', { ascending: true })

      if (startDate && endDate) {
        participantsQuery = participantsQuery
          .gte('bookings.start_at', `${startDate}T00:00:00`)
          .lte('bookings.start_at', `${endDate}T23:59:59`)
      }

      const { data: participants, error } = await participantsQuery

      if (error) throw error

      if (!participants || participants.length === 0) {
        alert('沒有數據可以導出')
        return
      }

      // 按會員分組統計
      const memberStats: {
        [key: string]: {
          name: string
          totalMinutes: number
          designatedMinutes: number
          normalMinutes: number
          records: Array<{
            date: string
            duration: number
            isDesignated: boolean
          }>
        }
      } = {}

      participants.forEach((p: any) => {
        const memberName = p.participant_name
        const booking = p.bookings
        const bookingDate = booking.start_at.substring(0, 10).replace(/-/g, '/')

        if (!memberStats[memberName]) {
          memberStats[memberName] = {
            name: memberName,
            totalMinutes: 0,
            designatedMinutes: 0,
            normalMinutes: 0,
            records: []
          }
        }

        memberStats[memberName].totalMinutes += p.duration_min
        if (p.is_designated) {
          memberStats[memberName].designatedMinutes += p.duration_min
        } else {
          memberStats[memberName].normalMinutes += p.duration_min
        }

        memberStats[memberName].records.push({
          date: bookingDate,
          duration: p.duration_min,
          isDesignated: p.is_designated
        })
      })

      // 生成CSV
      let csv = '\uFEFF'
      csv += '會員姓名,總時數(分鐘),指定課時數(分鐘),一般時數(分鐘),日期,單次時長(分鐘),是否指定課\n'

      Object.values(memberStats)
        .sort((a, b) => a.name.localeCompare(b.name, 'zh-TW'))
        .forEach(member => {
          member.records.forEach((record, idx) => {
            if (idx === 0) {
              // 第一筆顯示會員統計資訊
              csv += `"${member.name}",${member.totalMinutes},${member.designatedMinutes},${member.normalMinutes},"${record.date}",${record.duration},"${record.isDesignated ? '是' : '否'}"\n`
            } else {
              // 後續只顯示記錄詳情
              csv += `"","","","","${record.date}",${record.duration},"${record.isDesignated ? '是' : '否'}"\n`
            }
          })
        })

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `會員時數統計_${new Date().toISOString().split('T')[0]}.csv`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export error:', error)
      alert('❌ 導出失敗，請重試')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    if (exportType === 'bookings') {
      exportBookingsToCSV()
    } else {
      exportMemberHoursToCSV()
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
      padding: '15px'
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <PageHeader title="📦 匯出資料" user={user} showBaoLink={true} />

        {/* 备份选项 */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '15px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
        }}>
          <h2 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: '600', color: '#333' }}>
            導出資料 (CSV 格式)
          </h2>

          {/* 導出類型選擇 */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '12px',
              fontSize: '15px',
              color: '#333',
              fontWeight: '600'
            }}>
              📊 選擇導出類型
            </label>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* 選項 1: 完整預約記錄 */}
              <div
                onClick={() => setExportType('bookings')}
                style={{
                  padding: '16px',
                  border: exportType === 'bookings' ? '2px solid #667eea' : '2px solid #dee2e6',
                  borderRadius: '8px',
                  backgroundColor: exportType === 'bookings' ? '#f0f4ff' : 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
                  <input
                    type="radio"
                    checked={exportType === 'bookings'}
                    onChange={() => setExportType('bookings')}
                    style={{ marginTop: '4px', width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#333', marginBottom: '6px' }}>
                      📋 完整預約記錄（包含教練回報）
                    </div>
                    <div style={{ fontSize: '13px', color: '#666', lineHeight: '1.5' }}>
                      包含：預約人、日期時間、船隻、教練、駕駛、每個參與者的時長、是否指定課等完整資訊。適合查看詳細預約狀況與教練回報。
                    </div>
                  </div>
                </div>
              </div>

              {/* 選項 2: 會員時數統計 */}
              <div
                onClick={() => setExportType('member_hours')}
                style={{
                  padding: '16px',
                  border: exportType === 'member_hours' ? '2px solid #667eea' : '2px solid #dee2e6',
                  borderRadius: '8px',
                  backgroundColor: exportType === 'member_hours' ? '#f0f4ff' : 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
                  <input
                    type="radio"
                    checked={exportType === 'member_hours'}
                    onChange={() => setExportType('member_hours')}
                    style={{ marginTop: '4px', width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#333', marginBottom: '6px' }}>
                      ⏱️ 會員時數統計報表
                    </div>
                    <div style={{ fontSize: '13px', color: '#666', lineHeight: '1.5' }}>
                      按會員分組統計：總時數、指定課時數、一般時數，並列出每次參與記錄。適合核對會員消費與結算。
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#e7f3ff', borderRadius: '8px', border: '1px solid #b3d9ff' }}>
            <div style={{ fontSize: '14px', color: '#004085', marginBottom: '12px', fontWeight: '500' }}>
              📅 選擇日期範圍（選填）
            </div>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>
              不選擇日期則導出所有預約記錄
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '13px',
                  color: '#333',
                  fontWeight: '500'
                }}>
                  開始日期
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '14px',
                    border: '1px solid #dee2e6',
                    borderRadius: '6px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '13px',
                  color: '#333',
                  fontWeight: '500'
                }}>
                  結束日期
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '14px',
                    border: '1px solid #dee2e6',
                    borderRadius: '6px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleExport}
            disabled={loading}
            style={{
              width: '100%',
              padding: '16px',
              fontSize: '16px',
              fontWeight: '600',
              background: loading ? '#ccc' : 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 12px rgba(40, 167, 69, 0.3)',
              transition: 'all 0.2s'
            }}
          >
            {loading ? '⏳ 導出中...' : '💾 導出 CSV 文件'}
          </button>

          <div style={{
            marginTop: '20px',
            padding: '16px',
            backgroundColor: '#fff3cd',
            borderRadius: '8px',
            border: '1px solid #ffc107',
            fontSize: '13px',
            color: '#856404'
          }}>
            <div style={{ fontWeight: '600', marginBottom: '8px' }}>
              💡 使用說明：
            </div>
            {exportType === 'bookings' ? (
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                <li>CSV 文件可用 Excel 或 Google Sheets 打開</li>
                <li>包含預約人、船隻、教練、駕駛、回報狀態等完整信息</li>
                <li>如有多個參與者，會分多行顯示（第一行顯示完整預約資訊）</li>
                <li>所有時間已格式化為易讀格式（YYYY/MM/DD HH:mm）</li>
                <li>建議定期備份以確保數據安全</li>
              </ul>
            ) : (
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                <li>CSV 文件可用 Excel 或 Google Sheets 打開</li>
                <li>按會員分組，每個會員顯示總時數統計與明細</li>
                <li>可快速核對會員消費時數與指定課時數</li>
                <li>建議每月導出一次以進行核對與結算</li>
              </ul>
            )}
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  )
}

