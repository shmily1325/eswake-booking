import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/PageHeader'

interface BackupPageProps {
  user: User
}

export function BackupPage({ user }: BackupPageProps) {
  const [loading, setLoading] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const exportToCSV = async () => {
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
      const { data: coachesData } = await supabase
        .from('booking_coaches')
        .select('booking_id, coaches:coach_id(name), coach_confirmed, confirmed_at, actual_duration_min')
        .in('booking_id', bookingIds)

      const coachesByBooking: { [key: number]: string[] } = {}
      const confirmByBooking: { [key: number]: { confirmed: boolean, confirmedAt: string | null, actualDuration: number | null } } = {}
      
      for (const item of coachesData || []) {
        const bookingId = item.booking_id
        const coach = (item as any).coaches
        if (coach) {
          if (!coachesByBooking[bookingId]) {
            coachesByBooking[bookingId] = []
          }
          coachesByBooking[bookingId].push(coach.name)
        }
        
        if (item.coach_confirmed) {
          confirmByBooking[bookingId] = {
            confirmed: true,
            confirmedAt: item.confirmed_at,
            actualDuration: item.actual_duration_min
          }
        } else if (!confirmByBooking[bookingId]) {
          confirmByBooking[bookingId] = {
            confirmed: false,
            confirmedAt: null,
            actualDuration: null
          }
        }
      }

      const formatDateTime = (isoString: string | null): string => {
        if (!isoString) return ''
        const dt = isoString.substring(0, 16) // "2025-10-30T08:30"
        const [date, time] = dt.split('T')
        if (!date || !time) return ''
        const [year, month, day] = date.split('-')
        return `${year}/${month}/${day} ${time}`
      }

      let csv = '\uFEFF'
      csv += '預約人,預約日期,抵達時間,下水時間,時長(分鐘),船隻,教練,活動類型,教練回報,回報時間,狀態,備註,創建時間\n'

      bookings.forEach(booking => {
        const boat = (booking as any).boats?.name || '未指定'
        const coaches = coachesByBooking[booking.id]?.join('/') || '未指定'
        const activities = booking.activity_types?.join('+') || ''
        const notes = (booking.notes || '').replace(/"/g, '""').replace(/\n/g, ' ')
        
        const startTime = booking.start_at.substring(11, 16)
        const [startHour, startMin] = startTime.split(':').map(Number)
        const totalMinutes = startHour * 60 + startMin - 30
        const arrivalHour = Math.floor(totalMinutes / 60)
        const arrivalMin = totalMinutes % 60
        const arrivalTime = `${arrivalHour.toString().padStart(2, '0')}:${arrivalMin.toString().padStart(2, '0')}`
        
        const bookingDate = booking.start_at.substring(0, 10).replace(/-/g, '/')
        
        const confirmInfo = confirmByBooking[booking.id]
        const coachConfirmed = confirmInfo?.confirmed ? '已回報' : '未回報'
        const confirmedAt = formatDateTime(confirmInfo?.confirmedAt || null)
        
        const statusMap: { [key: string]: string } = {
          'Confirmed': '已確認',
          'Cancelled': '已取消'
        }
        const status = statusMap[booking.status] || booking.status

        csv += `"${booking.contact_name}","${bookingDate}","${arrivalTime}","${startTime}",${booking.duration_min},"${boat}","${coaches}","${activities}","${coachConfirmed}","${confirmedAt}","${status}","${notes}","${formatDateTime(booking.created_at)}"\n`
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
            導出預約記錄 (CSV 格式)
          </h2>

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
            onClick={exportToCSV}
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
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              <li>CSV 文件可用 Excel 或 Google Sheets 打開</li>
              <li>包含學生、船隻、教練、時間、回報狀態等完整信息</li>
              <li>所有時間已格式化為易讀格式（YYYY/MM/DD HH:mm）</li>
              <li>建議定期備份以確保數據安全</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

