import { useState } from 'react'
import { useAuthUser } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { Footer } from '../../components/Footer'
import { extractDate, extractTime } from '../../utils/formatters'
import { getLocalDateString } from '../../utils/date'
import { useToast, ToastContainer } from '../../components/ui'

type ExportType = 'pure_bookings' | 'member_hours' | 'ledger' | 'coach_hours'

export function BackupPage() {
  const user = useAuthUser()
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [fullBackupLoading, setFullBackupLoading] = useState(false)
  const [cloudBackupLoading, setCloudBackupLoading] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [exportType, setExportType] = useState<ExportType>('pure_bookings')

  const isAnyLoading = loading || fullBackupLoading || cloudBackupLoading

  // 純預約記錄匯出（不含教練回報）
  const exportPureBookingsToCSV = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('bookings')
        .select(`
          *,
          boats:boat_id (name)
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
      csv += '預約人,預約日期,抵達時間,下水時間,預約時長(分鐘),船隻,教練,駕駛,活動類型,狀態,備註\n'

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
        
        const statusMap: { [key: string]: string } = {
          'Confirmed': '已確認',
          'Cancelled': '已取消'
        }
        const status = statusMap[booking.status || ''] || booking.status || ''

        csv += `"${booking.contact_name}","${bookingDate}","${arrivalTime}","${startTime}",${booking.duration_min},"${boat}","${coaches}","${driver}","${activities}","${status}","${notes}"\n`
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

  // 會員時數詳細記錄
  const exportMemberHoursToCSV = async () => {
    setLoading(true)
    try {
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
        toast.warning('沒有數據可以導出')
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

      participants.forEach((p) => {
        const memberName = p.participant_name
        const booking = p.bookings
        const bookingDate = extractDate(booking.start_at).replace(/-/g, '/')
        const isDesignated = p.payment_method === 'designated_paid' || p.payment_method === 'designated_free'

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
        if (isDesignated) {
          memberStats[memberName].designatedMinutes += p.duration_min
        } else {
          memberStats[memberName].normalMinutes += p.duration_min
        }

        memberStats[memberName].records.push({
          date: bookingDate,
          duration: p.duration_min,
          isDesignated: isDesignated
        })
      })

      let csv = '\uFEFF'
      csv += '會員姓名,日期,單次時長(分鐘),是否指定課,總時數(分鐘),指定課時數(分鐘),一般時數(分鐘)\n'

      Object.values(memberStats)
        .sort((a, b) => a.name.localeCompare(b.name, 'zh-TW'))
        .forEach(member => {
          member.records.forEach((record) => {
            csv += `"${member.name}","${record.date}",${record.duration},"${record.isDesignated ? '是' : '否'}",${member.totalMinutes},${member.designatedMinutes},${member.normalMinutes}\n`
          })
        })

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `會員時數記錄_${getLocalDateString()}.csv`
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

  // 預約對應總帳匯出
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
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })

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

      const getAfterNumber = (t: any) => {
        switch (t.category) {
          case 'balance':
            return t.balance_after ?? ''
          case 'vip_voucher':
            return t.vip_voucher_amount_after ?? ''
          case 'designated_lesson':
            return t.designated_lesson_minutes_after ?? ''
          case 'boat_voucher_g23':
            return t.boat_voucher_g23_minutes_after ?? ''
          case 'boat_voucher_g21':
          case 'boat_voucher_g21_panther':
            return t.boat_voucher_g21_panther_minutes_after ?? ''
          case 'gift_boat_hours':
            return t.gift_boat_hours_after ?? ''
          default:
            return ''
        }
      }

      const csv = [
        '\uFEFF' + ['會員', '日期', '項目', '變動', '交易後餘額', '說明', '備註'].join(','),
        ...data.map((t: any) => [
          csvEscape((t.member_id as any)?.nickname || (t.member_id as any)?.name || '未知'),
          t.transaction_date || t.created_at?.split('T')[0] || '',
          getCategoryLabel(t.category),
          getChangeNumber(t),
          getAfterNumber(t),
          csvEscape(t.description || ''),
          csvEscape(t.notes || ''),
        ].join(','))
      ].join('\n')

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `預約總帳_${startDate}_至_${endDate}.csv`
      link.click()
      toast.success('導出成功！')
    } catch (error) {
      console.error('Export error:', error)
      toast.error('導出失敗，請重試')
    } finally {
      setLoading(false)
    }
  }

  // 教練時數詳細記錄
  const exportCoachHoursToCSV = async () => {
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

      const [coachesResult, participantsResult] = await Promise.all([
        supabase
          .from('booking_coaches')
          .select('booking_id, coaches:coach_id(name)')
          .in('booking_id', bookingIds),
        supabase
          .from('booking_participants')
          .select('booking_id, participant_name, duration_min, lesson_type')
          .in('booking_id', bookingIds)
      ])

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

      const coachRecords: {
        [key: string]: {
          name: string
          records: Array<{
            date: string
            startTime: string
            contactName: string
            boatName: string
            participantName: string
            duration: number
            isDesignated: boolean
            hasReport: boolean
          }>
          totalMinutes: number
          designatedMinutes: number
          normalMinutes: number
        }
      } = {}

      coachesResult.data?.forEach((item) => {
        const coachName = item.coaches?.name
        if (!coachName) return

        if (!coachRecords[coachName]) {
          coachRecords[coachName] = {
            name: coachName,
            records: [],
            totalMinutes: 0,
            designatedMinutes: 0,
            normalMinutes: 0
          }
        }

        const participants = participantsResult.data?.filter(p => p.booking_id === item.booking_id) || []
        if (participants.length === 0) {
          const info = bookingInfoMap[item.booking_id]
          coachRecords[coachName].records.push({
            date: info?.date || '',
            startTime: info?.startTime || '',
            contactName: info?.contactName || '',
            boatName: info?.boatName || '未指定',
            participantName: '未回報',
            duration: info?.duration ?? 0,
            isDesignated: false,
            hasReport: false
          })
        } else {
          participants.forEach(p => {
            const isDesignated = p.lesson_type === 'designated_paid' || p.lesson_type === 'designated_free'
            
            coachRecords[coachName].records.push({
              date: bookingInfoMap[item.booking_id]?.date || '',
              startTime: bookingInfoMap[item.booking_id]?.startTime || '',
              contactName: bookingInfoMap[item.booking_id]?.contactName || '',
              boatName: bookingInfoMap[item.booking_id]?.boatName || '未指定',
              participantName: p.participant_name,
              duration: p.duration_min,
              isDesignated: isDesignated,
              hasReport: true
            })
            
            coachRecords[coachName].totalMinutes += p.duration_min
            if (isDesignated) {
              coachRecords[coachName].designatedMinutes += p.duration_min
            } else {
              coachRecords[coachName].normalMinutes += p.duration_min
            }
          })
        }
      })

      let csv = '\uFEFF'
      csv += '教練姓名,日期,開始時間,預約人,船隻,學員姓名/狀態,單次時長(分鐘),是否指定課,總時數(分鐘),指定課時數(分鐘),一般時數(分鐘)\n'

      Object.values(coachRecords)
        .sort((a, b) => a.name.localeCompare(b.name, 'zh-TW'))
        .forEach(coach => {
          coach.records.forEach(record => {
            const duration = record.hasReport ? record.duration : ''
            const isDesignatedLabel = record.hasReport ? (record.isDesignated ? '是' : '否') : ''
            csv += `"${coach.name}","${record.date}","${record.startTime}","${record.contactName}","${record.boatName}","${record.participantName}",${duration},"${isDesignatedLabel}",${coach.totalMinutes},${coach.designatedMinutes},${coach.normalMinutes}\n`
          })
        })

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `教練時數記錄_${getLocalDateString()}.csv`
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
    switch (exportType) {
      case 'pure_bookings':
        exportPureBookingsToCSV()
        break
      case 'member_hours':
        exportMemberHoursToCSV()
        break
      case 'ledger':
        exportLedgerToCSV()
        break
      case 'coach_hours':
        exportCoachHoursToCSV()
        break
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
      description: '僅包含預約基本資訊：預約人、日期時間、船隻、教練、駕駛、狀態。不含教練回報細節。'
    },
    {
      value: 'member_hours',
      icon: '⏱️',
      title: '會員時數詳細記錄',
      description: '每位會員的消費時數明細：姓名、日期、時長、是否指定課，以及累計統計。適合用於會員對帳。'
    },
    {
      value: 'ledger',
      icon: '💰',
      title: '預約對應總帳',
      description: '所有交易記錄：會員、日期、項目、變動金額/分鐘數、交易後餘額、說明。與儲值頁面的匯出總帳相同格式。'
    },
    {
      value: 'coach_hours',
      icon: '🎓',
      title: '教練時數詳細記錄',
      description: '每位教練的教學時數明細：日期、學員、時長、是否指定課，以及累計統計。適合用於教練薪資核算。'
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
                不選擇日期則導出所有資料
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
              background: isAnyLoading ? '#ccc' : 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: isAnyLoading ? 'not-allowed' : 'pointer',
              boxShadow: isAnyLoading ? 'none' : '0 4px 12px rgba(40, 167, 69, 0.3)',
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
              background: isAnyLoading ? '#ccc' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: isAnyLoading ? 'not-allowed' : 'pointer',
              boxShadow: isAnyLoading ? 'none' : '0 4px 12px rgba(59, 130, 246, 0.3)',
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
              background: isAnyLoading ? '#ccc' : 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: isAnyLoading ? 'not-allowed' : 'pointer',
              boxShadow: isAnyLoading ? 'none' : '0 4px 12px rgba(220, 53, 69, 0.3)',
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
            <li>「預約對應總帳」需指定日期區間才能匯出</li>
            <li>雲端備份每天自動執行，也可手動觸發</li>
          </ul>
        </div>
      </div>

      <Footer />
      <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
    </div>
  )
}
