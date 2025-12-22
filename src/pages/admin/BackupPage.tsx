import { useState } from 'react'
import { useAuthUser } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { Footer } from '../../components/Footer'
import { extractDate, extractTime } from '../../utils/formatters'
import { getLocalDateString } from '../../utils/date'
import { useToast, ToastContainer } from '../../components/ui'

type ExportType = 'pure_bookings' | 'ledger' | 'coach_report'

export function BackupPage() {
  const user = useAuthUser()
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [fullBackupLoading, setFullBackupLoading] = useState(false)
  const [cloudBackupLoading, setCloudBackupLoading] = useState(false)
  // 預設日期為當月
  const [startDate, setStartDate] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [endDate, setEndDate] = useState(() => {
    const now = new Date()
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  })
  const [exportType, setExportType] = useState<ExportType>('pure_bookings')

  const isAnyLoading = loading || fullBackupLoading || cloudBackupLoading

  // 純預約記錄匯出
  const exportPureBookingsToCSV = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('bookings')
        .select(`
          *,
          boats:boat_id (name)
        `)
        .order('start_at', { ascending: true })

      if (startDate && endDate) {
        query = query
          .gte('start_at', `${startDate}T00:00:00`)
          .lte('start_at', `${endDate}T23:59:59`)
      }

      const { data: bookings, error } = await query

      if (error) throw error

      if (!bookings || bookings.length === 0) {
        toast.warning('沒有數據可以導出')
        return
      }

      const bookingIds = bookings.map(b => b.id)
      
      // 查詢教練資料
      const { data: coachesData } = await supabase
        .from('booking_coaches')
        .select('booking_id, coaches:coach_id(name)')
        .in('booking_id', bookingIds)

      const coachesByBooking: { [key: number]: string[] } = {}
      for (const item of coachesData || []) {
        const bookingId = item.booking_id
        const coach = (item as any).coaches
        if (coach) {
          if (!coachesByBooking[bookingId]) {
            coachesByBooking[bookingId] = []
          }
          coachesByBooking[bookingId].push(coach.name)
        }
      }

      // 查詢駕駛資訊
      const { data: bookingDrivers } = await supabase
        .from('booking_drivers')
        .select('booking_id, coaches:driver_id (name)')
        .in('booking_id', bookingIds)
      
      const driverByBooking: { [key: number]: string } = {}
      bookingDrivers?.forEach(bd => {
        if (bd.coaches) {
          const coach = bd.coaches as unknown as { name: string }
          driverByBooking[bd.booking_id] = coach.name
        }
      })

      let csv = '\uFEFF'
      csv += '預約人,預約日期,抵達時間,下水時間,預約時長(分鐘),船隻,教練,駕駛,活動類型,備註\n'

      bookings.forEach(booking => {
        const boat = (booking as any).boats?.name || '未指定'
        const coaches = coachesByBooking[booking.id]?.join('/') || '未指定'
        const driver = driverByBooking[booking.id] || ''
        const activities = booking.activity_types?.join('+') || ''
        const notes = (booking.notes || '').replace(/"/g, '""').replace(/\n/g, ' ')
        
        const startTime = extractTime(booking.start_at)
        const [startHour, startMin] = startTime.split(':').map(Number)
        const totalMinutes = startHour * 60 + startMin - 30
        const arrivalHour = Math.floor(totalMinutes / 60)
        const arrivalMin = totalMinutes % 60
        const arrivalTime = `${arrivalHour.toString().padStart(2, '0')}:${arrivalMin.toString().padStart(2, '0')}`
        
        const bookingDate = extractDate(booking.start_at).replace(/-/g, '/')

        csv += `"${booking.contact_name}","${bookingDate}","${arrivalTime}","${startTime}",${booking.duration_min},"${boat}","${coaches}","${driver}","${activities}","${notes}"\n`
      })

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `純預約記錄_${getLocalDateString()}.csv`
      link.click()
      URL.revokeObjectURL(url)
      toast.success('導出成功！')
    } catch (error) {
      console.error('Export error:', error)
      toast.error('導出失敗，請重試')
    } finally {
      setLoading(false)
    }
  }

  // 總帳匯出
  const exportLedgerToCSV = async () => {
    setLoading(true)
    try {
      if (!startDate || !endDate) {
        toast.warning('請選擇開始和結束日期')
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          member_id(name, nickname)
        `)
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate)
        .order('transaction_date', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) throw error

      if (!data || data.length === 0) {
        toast.warning('所選時間範圍內沒有交易記錄')
        return
      }

      const getCategoryLabel = (category: string) => {
        const labels: Record<string, string> = {
          balance: '儲值',
          vip_voucher: 'VIP票券',
          designated_lesson: '指定課',
          boat_voucher_g23: 'G23船券',
          boat_voucher_g21: '黑豹/G21船券',
          boat_voucher_g21_panther: '黑豹/G21船券',
          gift_boat_hours: '贈送大船',
          free_hours: '贈送時數',
          membership: '會籍',
          board_storage: '置板',
        }
        return labels[category] || category
      }

      const csvEscape = (str: string) => {
        if (!str) return ''
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      }

      const getChangeNumber = (t: any) => {
        const isAmount = t.category === 'balance' || t.category === 'vip_voucher'
        const value = isAmount ? (t.amount || 0) : (t.minutes || 0)
        const absValue = Math.abs(value)
        
        if (t.adjust_type === 'increase' || (!t.adjust_type && value > 0)) {
          return absValue
        } else if (t.adjust_type === 'decrease' || (!t.adjust_type && value < 0)) {
          return -absValue
        }
        return 0
      }

      const csv = [
        '\uFEFF' + ['會員', '日期', '項目', '變動', '說明', '備註'].join(','),
        ...data.map((t: any) => [
          csvEscape((t.member_id as any)?.nickname || (t.member_id as any)?.name || '未知'),
          t.transaction_date || t.created_at?.split('T')[0] || '',
          getCategoryLabel(t.category),
          getChangeNumber(t),
          csvEscape(t.description || ''),
          csvEscape(t.notes || ''),
        ].join(','))
      ].join('\n')

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `總帳_${startDate}_至_${endDate}.csv`
      link.click()
      toast.success('導出成功！')
    } catch (error) {
      console.error('Export error:', error)
      toast.error('導出失敗，請重試')
    } finally {
      setLoading(false)
    }
  }

  // 教練回報記錄匯出
  const exportCoachReportToCSV = async () => {
    setLoading(true)
    try {
      let bookingsQuery = supabase
        .from('bookings')
        .select(`
          id,
          start_at,
          duration_min,
          contact_name,
          boats:boat_id(name)
        `)
        .order('start_at', { ascending: true })

      if (startDate && endDate) {
        bookingsQuery = bookingsQuery
          .gte('start_at', `${startDate}T00:00:00`)
          .lte('start_at', `${endDate}T23:59:59`)
      }

      const { data: bookings, error: bookingsError } = await bookingsQuery

      if (bookingsError) throw bookingsError

      if (!bookings || bookings.length === 0) {
        toast.warning('沒有數據可以導出')
        return
      }

      const bookingIds = bookings.map(b => b.id)

      // 查詢教練、駕駛、參與者資料
      const [coachesResult, driversResult, coachReportsResult, participantsResult] = await Promise.all([
        supabase
          .from('booking_coaches')
          .select('booking_id, coaches:coach_id(name)')
          .in('booking_id', bookingIds),
        supabase
          .from('booking_drivers')
          .select('booking_id, coaches:driver_id(name)')
          .in('booking_id', bookingIds),
        supabase
          .from('coach_reports')
          .select('booking_id, driver_duration_min, coaches:coach_id(name)')
          .in('booking_id', bookingIds)
          .not('driver_duration_min', 'is', null),
        supabase
          .from('booking_participants')
          .select('booking_id, participant_name, duration_min, lesson_type, payment_method')
          .in('booking_id', bookingIds)
      ])

      // 建立預約ID到詳細資訊的映射
      const bookingInfoMap: {
        [key: number]: {
          date: string
          startTime: string
          contactName: string
          boatName: string
          duration: number
        }
      } = {}
      bookings.forEach(b => {
        const bookingDate = extractDate(b.start_at).replace(/-/g, '/')
        const startTime = extractTime(b.start_at)
        const boatName = (b as any).boats?.name || '未指定'
        bookingInfoMap[b.id] = {
          date: bookingDate,
          startTime,
          contactName: b.contact_name,
          boatName,
          duration: b.duration_min
        }
      })

      // 教練映射
      const coachesByBooking: { [key: number]: string[] } = {}
      coachesResult.data?.forEach(item => {
        const coachName = (item as any).coaches?.name
        if (coachName) {
          if (!coachesByBooking[item.booking_id]) {
            coachesByBooking[item.booking_id] = []
          }
          coachesByBooking[item.booking_id].push(coachName)
        }
      })

      // 駕駛映射（從 booking_drivers 取駕駛名字）
      const driversByBooking: { [key: number]: { name: string, duration: number } } = {}
      driversResult.data?.forEach(item => {
        const driverName = (item as any).coaches?.name
        if (driverName) {
          driversByBooking[item.booking_id] = {
            name: driverName,
            duration: 0
          }
        }
      })

      // 從 coach_reports 取駕駛時數
      coachReportsResult.data?.forEach(item => {
        if (driversByBooking[item.booking_id]) {
          driversByBooking[item.booking_id].duration = item.driver_duration_min || 0
        }
      })

      // 參與者映射
      const participantsByBooking: { [key: number]: Array<{
        name: string
        duration: number
        lessonType: string
        paymentMethod: string
      }> } = {}
      participantsResult.data?.forEach(p => {
        if (!participantsByBooking[p.booking_id]) {
          participantsByBooking[p.booking_id] = []
        }
        participantsByBooking[p.booking_id].push({
          name: p.participant_name,
          duration: p.duration_min,
          lessonType: p.lesson_type || '',
          paymentMethod: p.payment_method || ''
        })
      })

      const getLessonTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
          'undesignated': '不指定',
          'designated_paid': '指定（收費）',
          'designated_free': '指定（免費）'
        }
        return labels[type] || type
      }

      const getPaymentMethodLabel = (method: string) => {
        const labels: Record<string, string> = {
          'cash': '現金',
          'transfer': '匯款',
          'balance': '扣儲值',
          'voucher': '票券'
        }
        return labels[method] || method
      }

      let csv = '\uFEFF'
      csv += '日期,下水時間,預約人,船隻,教練,駕駛,駕駛時數,學員,學員時數,指定類型,付款方式\n'

      bookings.forEach(booking => {
        const info = bookingInfoMap[booking.id]
        const coaches = coachesByBooking[booking.id]?.join('/') || ''
        const driver = driversByBooking[booking.id]
        const participants = participantsByBooking[booking.id] || []

        if (participants.length > 0) {
          // 有回報的預約：每個學員一行
          participants.forEach((p, idx) => {
            if (idx === 0) {
              csv += `"${info.date}","${info.startTime}","${info.contactName}","${info.boatName}","${coaches}","${driver?.name || ''}",${driver?.duration || ''},"${p.name}",${p.duration},"${getLessonTypeLabel(p.lessonType)}","${getPaymentMethodLabel(p.paymentMethod)}"\n`
            } else {
              csv += `"","","","","","",,"${p.name}",${p.duration},"${getLessonTypeLabel(p.lessonType)}","${getPaymentMethodLabel(p.paymentMethod)}"\n`
            }
          })
        } else {
          // 未回報的預約
          csv += `"${info.date}","${info.startTime}","${info.contactName}","${info.boatName}","${coaches}","${driver?.name || ''}",${driver?.duration || ''},"（未回報）",,,""\n`
        }
      })

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `教練回報記錄_${getLocalDateString()}.csv`
      link.click()
      URL.revokeObjectURL(url)
      toast.success('導出成功！')
    } catch (error) {
      console.error('Export error:', error)
      toast.error('導出失敗，請重試')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    if (exportType === 'pure_bookings') {
      exportPureBookingsToCSV()
    } else if (exportType === 'ledger') {
      exportLedgerToCSV()
    } else {
      exportCoachReportToCSV()
    }
  }

  const backupFullDatabase = async () => {
    setFullBackupLoading(true)
    try {
      const response = await fetch('/api/backup-full-database', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || '備份失敗')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0]
      link.download = `eswake_backup_${timestamp}.sql`
      link.click()
      URL.revokeObjectURL(url)

      toast.success('完整資料庫備份成功！檔案已下載。')
    } catch (error) {
      console.error('Full backup error:', error)
      toast.error(`備份失敗：${(error as Error).message}`)
    } finally {
      setFullBackupLoading(false)
    }
  }

  const backupToCloudDrive = async () => {
    setCloudBackupLoading(true)
    try {
      const response = await fetch('/api/backup-to-cloud-drive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || '備份失敗')
      }

      const result = await response.json()
      
      if (result.fileUrl) {
        toast.success(
          `✅ ${result.message}\n\n` +
          `檔案名稱: ${result.fileName}\n` +
          `檔案大小: ${result.fileSize ? `${(parseInt(result.fileSize) / 1024).toFixed(2)} KB` : '未知'}\n` +
          `總記錄數: ${result.totalRecords} 筆\n\n` +
          `點擊確定後將在新視窗開啟 Google Drive`
        )
        window.open(result.fileUrl, '_blank')
      } else {
        toast.success(`✅ ${result.message}`)
      }
    } catch (error) {
      console.error('Cloud backup error:', error)
      toast.error(`備份失敗：${(error as Error).message}`)
    } finally {
      setCloudBackupLoading(false)
    }
  }

  const exportOptions: Array<{
    value: ExportType
    icon: string
    title: string
    description: string
  }> = [
    {
      value: 'pure_bookings',
      icon: '📋',
      title: '純預約記錄',
      description: '預約基本資訊：預約人、日期時間、船隻、教練、駕駛、活動類型、備註。'
    },
    {
      value: 'ledger',
      icon: '💰',
      title: '總帳',
      description: '所有交易記錄：會員、日期、項目、變動金額/分鐘數、說明、備註。'
    },
    {
      value: 'coach_report',
      icon: '🎓',
      title: '教練回報記錄',
      description: '教練回報明細：日期、預約人、船隻、教練、駕駛時數、學員、學員時數、指定類型、付款方式。'
    }
  ]

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
      padding: '15px'
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <PageHeader title="💾 匯出" user={user} showBaoLink={true} />

        {/* 資料導出區塊 */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '15px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
        }}>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600', color: '#333' }}>
            📊 資料導出
          </h2>
          <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#666' }}>
            選擇要導出的資料類型，可指定日期區間，導出為 CSV 格式
          </p>

          {/* 導出類型選擇 */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {exportOptions.map(option => (
                <div
                  key={option.value}
                  onClick={() => setExportType(option.value)}
                  style={{
                    padding: '14px 16px',
                    border: exportType === option.value ? '2px solid #667eea' : '2px solid #e0e0e0',
                    borderRadius: '8px',
                    backgroundColor: exportType === option.value ? '#f0f4ff' : 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
                    <input
                      type="radio"
                      checked={exportType === option.value}
                      onChange={() => setExportType(option.value)}
                      style={{ marginTop: '2px', width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '15px', fontWeight: '600', color: '#333', marginBottom: '4px' }}>
                        {option.icon} {option.title}
                      </div>
                      <div style={{ fontSize: '13px', color: '#666', lineHeight: '1.4' }}>
                        {option.description}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 日期區間選擇 */}
          <div style={{ 
            marginBottom: '20px', 
            padding: '16px', 
            backgroundColor: '#f8f9fa', 
            borderRadius: '8px',
            border: '1px solid #e0e0e0'
          }}>
            <div style={{ fontSize: '14px', color: '#333', marginBottom: '12px', fontWeight: '500' }}>
              📅 日期區間 {exportType === 'ledger' ? <span style={{ color: '#dc3545' }}>（必填）</span> : '（選填）'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '13px',
                  color: '#555'
                }}>
                  開始日期
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
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
                  color: '#555'
                }}>
                  結束日期
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '14px',
                    border: '1px solid #dee2e6',
                    borderRadius: '6px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
            {exportType !== 'ledger' && (
              <div style={{ fontSize: '12px', color: '#888', marginTop: '8px' }}>
                清空日期可導出所有資料
              </div>
            )}
          </div>

          <button
            onClick={handleExport}
            disabled={isAnyLoading}
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '16px',
              fontWeight: '600',
              background: loading ? '#ccc' : 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: isAnyLoading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 12px rgba(40, 167, 69, 0.3)',
              transition: 'all 0.2s'
            }}
          >
            {loading ? '⏳ 導出中...' : '📥 導出 CSV 檔案'}
          </button>
        </div>

        {/* 雲端備份區塊 */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '15px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
        }}>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600', color: '#1e40af' }}>
            ☁️ 雲端備份
          </h2>
          <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#666' }}>
            將完整資料庫備份（SQL 檔案）上傳到 Google Drive
          </p>
          
          <button
            onClick={backupToCloudDrive}
            disabled={isAnyLoading}
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '16px',
              fontWeight: '600',
              background: cloudBackupLoading ? '#ccc' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: isAnyLoading ? 'not-allowed' : 'pointer',
              boxShadow: cloudBackupLoading ? 'none' : '0 4px 12px rgba(59, 130, 246, 0.3)',
              transition: 'all 0.2s'
            }}
          >
            {cloudBackupLoading ? '⏳ 上傳中...' : '☁️ 備份到 Google Drive'}
          </button>

          <div style={{ 
            marginTop: '16px', 
            padding: '12px', 
            backgroundColor: '#f0f9ff', 
            borderRadius: '6px',
            fontSize: '13px',
            color: '#555'
          }}>
            <div style={{ marginBottom: '6px' }}>• 完整資料庫 SQL 檔案自動上傳到 Google Drive</div>
            <div style={{ marginBottom: '6px' }}>• 自動刪除超過 90 天的舊備份</div>
            <div>• 系統每天自動備份（UTC 02:00，台灣時間 10:00）</div>
          </div>
        </div>

        {/* 災難恢復備份區塊 */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '15px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
        }}>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600', color: '#dc3545' }}>
            🛡️ 災難恢復備份
          </h2>
          <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#666' }}>
            下載完整資料庫備份（SQL），用於在系統故障時恢復資料
          </p>

          <button
            onClick={backupFullDatabase}
            disabled={isAnyLoading}
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '16px',
              fontWeight: '600',
              background: fullBackupLoading ? '#ccc' : 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: isAnyLoading ? 'not-allowed' : 'pointer',
              boxShadow: fullBackupLoading ? 'none' : '0 4px 12px rgba(220, 53, 69, 0.3)',
              transition: 'all 0.2s'
            }}
          >
            {fullBackupLoading ? '⏳ 備份中...' : '💾 下載完整資料庫備份 (SQL)'}
          </button>

          <div style={{ 
            marginTop: '16px', 
            padding: '12px', 
            backgroundColor: '#fff5f5', 
            borderRadius: '6px',
            fontSize: '13px',
            color: '#555'
          }}>
            <div style={{ marginBottom: '6px' }}>• 包含所有表和數據，可直接匯入 PostgreSQL/Supabase 恢復</div>
            <div>• 建議每週下載一次，保存到本地硬碟</div>
          </div>
        </div>

        {/* 使用說明 */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '15px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          fontSize: '13px',
          color: '#666'
        }}>
          <div style={{ fontWeight: '600', marginBottom: '10px', color: '#333' }}>
            💡 使用說明
          </div>
          <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.8' }}>
            <li>CSV 檔案可用 Excel 或 Google Sheets 打開</li>
            <li>時間格式為 YYYY/MM/DD HH:mm，方便排序與篩選</li>
            <li>「總帳」需指定日期區間才能匯出</li>
            <li>雲端備份每天自動執行，也可手動觸發</li>
          </ul>
        </div>
      </div>

      <Footer />
      <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
    </div>
  )
}
