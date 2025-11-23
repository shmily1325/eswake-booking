import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { Footer } from '../../components/Footer'
import { extractDate, extractTime } from '../../utils/formatters'
import { getLocalDateString } from '../../utils/date'
// import { Button, Card } from '../../components/ui' // TODO: 未來可使用

interface BackupPageProps {
  user: User
}

export function BackupPage({ user }: BackupPageProps) {
  const [loading, setLoading] = useState(false)
  const [backupLoading, setBackupLoading] = useState(false)
  const [fullBackupLoading, setFullBackupLoading] = useState(false)
  const [queryableBackupLoading, setQueryableBackupLoading] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [exportType, setExportType] = useState<'bookings' | 'member_hours' | 'coach_hours'>('bookings')

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
        // 使用 lesson_type 判斷是否為指定課
        const isDesignated = p.lesson_type === 'designated_paid' || p.lesson_type === 'designated_free'
        participantsByBooking[p.booking_id].push({
          name: p.participant_name,
          duration: p.duration_min,
          designated: isDesignated
        })
      }
      
      // 查詢駕駛資訊（從 booking_drivers 表）
      const { data: bookingDrivers } = await supabase
        .from('booking_drivers')
        .select(`
          booking_id,
          driver_id,
          coaches:driver_id (id, name)
        `)
      
      const driverByBooking: { [key: number]: string } = {}
      bookingDrivers?.forEach(bd => {
        if (bd.coaches) {
          const coach = bd.coaches as unknown as { id: string; name: string }
          driverByBooking[bd.booking_id] = coach.name
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
        
        const startTime = extractTime(booking.start_at)
        const [startHour, startMin] = startTime.split(':').map(Number)
        const totalMinutes = startHour * 60 + startMin - 30
        const arrivalHour = Math.floor(totalMinutes / 60)
        const arrivalMin = totalMinutes % 60
        const arrivalTime = `${arrivalHour.toString().padStart(2, '0')}:${arrivalMin.toString().padStart(2, '0')}`
        
        const bookingDate = extractDate(booking.start_at).replace(/-/g, '/')
        
        // 回報資訊
        const participants = participantsByBooking[booking.id] || []
        const hasReport = participants.length > 0
        const reportStatus = hasReport ? '已回報' : '未回報'
        
        const statusMap: { [key: string]: string } = {
          'Confirmed': '已確認',
          'Cancelled': '已取消'
        }
        const status = statusMap[booking.status || ''] || booking.status || ''

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
      link.download = `預約備份_${getLocalDateString()}.csv`
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
      // 查詢指定日期範圍內的參與者記錄（使用 booking_participants 表）
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

      console.log('會員時數查詢結果:', participants)
      console.log('查詢錯誤:', error)

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

      // 生成CSV（每一行都重複會員資訊，方便Excel篩選）
      let csv = '\uFEFF'
      csv += '會員姓名,日期,單次時長(分鐘),是否指定課,總時數(分鐘),指定課時數(分鐘),一般時數(分鐘)\n'

      Object.values(memberStats)
        .sort((a, b) => a.name.localeCompare(b.name, 'zh-TW'))
        .forEach(member => {
          member.records.forEach((record) => {
            // 每一行都顯示完整資訊，方便篩選
            csv += `"${member.name}","${record.date}",${record.duration},"${record.isDesignated ? '是' : '否'}",${member.totalMinutes},${member.designatedMinutes},${member.normalMinutes}\n`
          })
        })

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `會員時數統計_${getLocalDateString()}.csv`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export error:', error)
      alert('❌ 導出失敗，請重試')
    } finally {
      setLoading(false)
    }
  }

  const exportCoachHoursToCSV = async () => {
    setLoading(true)
    try {
      // 查詢指定日期範圍內的預約
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
        alert('沒有數據可以導出')
        return
      }

      const bookingIds = bookings.map(b => b.id)

      // 查詢教練和參與者資料
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

      // 按教練整理詳細記錄
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

        // 找到該預約的所有參與者
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
            // 使用 lesson_type 判斷是否為指定課
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

      // 生成CSV（每一行都重複教練資訊，方便Excel篩選）
      let csv = '\uFEFF'
      csv += '教練姓名,日期,開始時間,預約人,船隻,學員姓名/狀態,單次時長(分鐘),是否指定課,總時數(分鐘),指定課時數(分鐘),一般時數(分鐘)\n'

      Object.values(coachRecords)
        .sort((a, b) => a.name.localeCompare(b.name, 'zh-TW'))
        .forEach(coach => {
          coach.records.forEach(record => {
            // 每一行都顯示完整資訊，方便篩選
            const duration = record.hasReport ? record.duration : ''
            const isDesignatedLabel = record.hasReport ? (record.isDesignated ? '是' : '否') : ''
            csv += `"${coach.name}","${record.date}","${record.startTime}","${record.contactName}","${record.boatName}","${record.participantName}",${duration},"${isDesignatedLabel}",${coach.totalMinutes},${coach.designatedMinutes},${coach.normalMinutes}\n`
          })
        })

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `教練時數統計_${getLocalDateString()}.csv`
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
    } else if (exportType === 'member_hours') {
      exportMemberHoursToCSV()
    } else {
      exportCoachHoursToCSV()
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

      // 下载 SQL 文件
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0]
      link.download = `eswake_backup_${timestamp}.sql`
      link.click()
      URL.revokeObjectURL(url)

      alert('✅ 完整數據庫備份成功！\n\n文件已下載，請保存到 WD MY BOOK 硬盤。')
    } catch (error) {
      console.error('Full backup error:', error)
      alert(`❌ 備份失敗：${(error as Error).message}`)
    } finally {
      setFullBackupLoading(false)
    }
  }

  const backupQueryable = async () => {
    setQueryableBackupLoading(true)
    try {
      const response = await fetch('/api/backup-queryable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || '備份失敗')
      }

      // 下载 JSON 文件
      const data = await response.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0]
      link.download = `eswake_queryable_backup_${timestamp}.json`
      link.click()
      URL.revokeObjectURL(url)

      alert('✅ 可查詢備份成功！\n\n文件已下載，可用查詢工具打開。\n\n查詢工具：/backup-query-tool.html')
    } catch (error) {
      console.error('Queryable backup error:', error)
      alert(`❌ 備份失敗：${(error as Error).message}`)
    } finally {
      setQueryableBackupLoading(false)
    }
  }

  const backupToGoogleSheets = async () => {
    setBackupLoading(true)
    const startTime = Date.now()
    
    try {
      // 创建带超时的 fetch（60秒超时）
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000) // 60秒超时

      console.log('開始備份 (Google Sheets)...', { startDate, endDate })
      
      const response = await fetch('/api/backup-to-drive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          manual: true,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      const elapsed = Date.now() - startTime
      console.log(`收到响应 (${elapsed}ms)`, response.status)

      const result = await response.json()
      console.log('響應結果 (Google Sheets):', result)

      if (!response.ok) {
        const errorMsg = result.message || result.error || '備份失敗'
        const details = result.details ? `\n\n詳細資訊: ${result.details}` : ''
        const step = result.step ? `\n\n失敗步驟: ${result.step}` : ''
        const execTime = result.executionTime ? `\n\n執行時間: ${result.executionTime}ms` : ''
        throw new Error(`${errorMsg}${details}${step}${execTime}`)
      }

      const execTime = result.executionTime ? `\n\n執行時間: ${result.executionTime}ms` : ''
      
      if (result.sheetUrl) {
        alert(
          `✅ ${result.message}${execTime}\n\n` +
          `工作表名稱: ${result.sheetTitle}\n` +
          `備份筆數: ${result.bookingsCount} 筆\n\n` +
          `點擊確定後將在新視窗開啟 Google Sheets`
        )
        window.open(result.sheetUrl, '_blank')
      } else {
        alert(`✅ ${result.message}${execTime}`)
      }
    } catch (error) {
      const elapsed = Date.now() - startTime
      console.error('Backup error:', error, { elapsed: `${elapsed}ms` })
      
      let errorMessage = '備份失敗'
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = '❌ 備份超時（超過60秒）\n\n可能原因：\n1. 數據量太大\n2. Google Sheets API 響應慢\n3. 網絡連接問題\n\n請檢查 Vercel 函數日誌以獲取詳細信息'
        } else if (error.message) {
          errorMessage = `❌ ${error.message}`
        }
      } else {
        errorMessage = '❌ 備份失敗，請檢查環境變數設定'
      }
      
      errorMessage += `\n\n執行時間: ${elapsed}ms`
      errorMessage += '\n\n💡 調試提示：'
      errorMessage += '\n1. 打開瀏覽器開發者工具 (F12) → Console 查看詳細錯誤'
      errorMessage += '\n2. 檢查 Vercel Dashboard → Functions → backup-to-drive 的日誌'
      errorMessage += '\n3. 確認所有 Google Sheets / Supabase 環境變數已正確設定'
      
      alert(errorMessage)
    } finally {
      setBackupLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
      padding: '15px'
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <PageHeader title="💾 匯出" user={user} showBaoLink={true} />

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

              {/* 選項 2: 會員時數詳細記錄 */}
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
                      💰 會員時數詳細記錄（內有總對帳表）
                    </div>
                    <div style={{ fontSize: '13px', color: '#666', lineHeight: '1.5' }}>
                      每一行顯示：會員姓名、日期、時長、是否指定課、總時數、指定課時數、一般時數。每筆消費都重複顯示會員資訊，方便Excel篩選與透視分析。
                    </div>
                  </div>
                </div>
              </div>

              {/* 選項 3: 教練時數詳細記錄 */}
              <div
                onClick={() => setExportType('coach_hours')}
                style={{
                  padding: '16px',
                  border: exportType === 'coach_hours' ? '2px solid #667eea' : '2px solid #dee2e6',
                  borderRadius: '8px',
                  backgroundColor: exportType === 'coach_hours' ? '#f0f4ff' : 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
                  <input
                    type="radio"
                    checked={exportType === 'coach_hours'}
                    onChange={() => setExportType('coach_hours')}
                    style={{ marginTop: '4px', width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#333', marginBottom: '6px' }}>
                      🎓 教練時數詳細記錄（內有教練對帳表）
                    </div>
                    <div style={{ fontSize: '13px', color: '#666', lineHeight: '1.5' }}>
                      每一行顯示：教練姓名、日期、學員姓名、時長、是否指定課、總時數、指定課時數、一般時數。每次教學都重複顯示教練資訊，方便Excel篩選與核算薪資。
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

          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <button
              onClick={handleExport}
              disabled={loading || backupLoading || fullBackupLoading || queryableBackupLoading}
              style={{
                flex: 1,
                minWidth: '200px',
                padding: '16px',
                fontSize: '16px',
                fontWeight: '600',
                background: loading || backupLoading || fullBackupLoading || queryableBackupLoading ? '#ccc' : 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                cursor: loading || backupLoading || fullBackupLoading || queryableBackupLoading ? 'not-allowed' : 'pointer',
                boxShadow: loading || backupLoading || fullBackupLoading || queryableBackupLoading ? 'none' : '0 4px 12px rgba(40, 167, 69, 0.3)',
                transition: 'all 0.2s'
              }}
            >
              {loading ? '⏳ 導出中...' : '💾 導出 CSV 文件'}
            </button>
            <button
              onClick={backupToGoogleSheets}
              disabled={loading || backupLoading || fullBackupLoading || queryableBackupLoading}
              style={{
                flex: 1,
                minWidth: '200px',
                padding: '16px',
                fontSize: '16px',
                fontWeight: '600',
                background: loading || backupLoading || fullBackupLoading || queryableBackupLoading ? '#ccc' : 'linear-gradient(135deg, #4285f4 0%, #34a853 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                cursor: loading || backupLoading || fullBackupLoading || queryableBackupLoading ? 'not-allowed' : 'pointer',
                boxShadow: loading || backupLoading || fullBackupLoading || queryableBackupLoading ? 'none' : '0 4px 12px rgba(66, 133, 244, 0.3)',
                transition: 'all 0.2s'
              }}
            >
              {backupLoading ? '⏳ 備份中...' : '☁️ 備份到 Google Sheets'}
            </button>
          </div>

          {/* 完整备份和可查询备份 */}
          <div style={{
            marginTop: '20px',
            padding: '20px',
            backgroundColor: '#e7f3ff',
            borderRadius: '8px',
            border: '1px solid #b3d9ff'
          }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', fontWeight: '600', color: '#004085' }}>
              🛡️ 灾难恢复备份（推荐）
            </h3>
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '15px' }}>
              在网页和数据库挂掉时，可以使用这些备份文件查询预约和财务数据
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                onClick={backupFullDatabase}
                disabled={loading || backupLoading || fullBackupLoading || queryableBackupLoading}
                style={{
                  flex: 1,
                  minWidth: '200px',
                  padding: '16px',
                  fontSize: '16px',
                  fontWeight: '600',
                  background: loading || backupLoading || fullBackupLoading || queryableBackupLoading ? '#ccc' : 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: loading || backupLoading || fullBackupLoading || queryableBackupLoading ? 'not-allowed' : 'pointer',
                  boxShadow: loading || backupLoading || fullBackupLoading || queryableBackupLoading ? 'none' : '0 4px 12px rgba(220, 53, 69, 0.3)',
                  transition: 'all 0.2s'
                }}
              >
                {fullBackupLoading ? '⏳ 備份中...' : '💾 完整數據庫備份 (SQL)'}
              </button>
              <button
                onClick={backupQueryable}
                disabled={loading || backupLoading || fullBackupLoading || queryableBackupLoading}
                style={{
                  flex: 1,
                  minWidth: '200px',
                  padding: '16px',
                  fontSize: '16px',
                  fontWeight: '600',
                  background: loading || backupLoading || fullBackupLoading || queryableBackupLoading ? '#ccc' : 'linear-gradient(135deg, #fd7e14 0%, #e55a00 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: loading || backupLoading || fullBackupLoading || queryableBackupLoading ? 'not-allowed' : 'pointer',
                  boxShadow: loading || backupLoading || fullBackupLoading || queryableBackupLoading ? 'none' : '0 4px 12px rgba(253, 126, 20, 0.3)',
                  transition: 'all 0.2s'
                }}
              >
                {queryableBackupLoading ? '⏳ 備份中...' : '🔍 可查詢備份 (JSON)'}
              </button>
            </div>
            <div style={{ marginTop: '12px', fontSize: '12px', color: '#666' }}>
              <div>💡 <strong>完整数据库备份</strong>：包含所有表和数据，可直接导入恢复</div>
              <div style={{ marginTop: '5px' }}>💡 <strong>可查询备份</strong>：轻量级，可用查询工具打开（<a href="/backup-query-tool.html" target="_blank" style={{ color: '#0066cc' }}>打开查询工具</a>）</div>
            </div>
          </div>

          <div style={{
            marginTop: '20px',
            padding: '12px 16px',
            backgroundColor: '#fff3cd',
            borderRadius: '8px',
            border: '1px solid #ffc107',
            fontSize: '13px',
            color: '#856404',
            textAlign: 'left'
          }}>
            <div style={{ fontWeight: '600', marginBottom: '8px' }}>
              💡 使用說明：
            </div>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              <li>CSV 文件可用 Excel 或 Google Sheets 打開</li>
              <li>包含完整的預約、會員時數、教練時數等詳細資訊</li>
              <li>所有時間已格式化為易讀格式（YYYY/MM/DD HH:mm）</li>
              <li>系統會每天自動備份到 Google Sheets（根據 vercel.json 中的 cron 設定）</li>
              <li>也可以手動點擊「備份到 Google Sheets」按鈕立即備份</li>
              <li><strong>建議：</strong>每週備份一次完整數據庫，每天備份一次可查詢備份到 WD MY BOOK 硬盤</li>
            </ul>
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  )
}

