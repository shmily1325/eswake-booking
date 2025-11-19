import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/PageHeader'
import { Footer } from '../components/Footer'
import { CoachReportFormDialog } from '../components/CoachReportFormDialog'
import { useResponsive } from '../hooks/useResponsive'
import { useMemberSearch } from '../hooks/useMemberSearch'
import { getButtonStyle, getCardStyle, getInputStyle, getLabelStyle } from '../styles/designSystem'
import { isFacility } from '../utils/facility'
import { getLocalDateString, getLocalTimestamp } from '../utils/date'
import {
  validateParticipants,
  calculateIsTeaching,
  calculateParticipantStatus
} from '../utils/participantValidation'
import {
  assembleBookingsWithRelations,
  extractAvailableCoaches,
  filterBookingsByCoach,
  filterUnreportedBookings,
  fetchBookingRelations
} from '../utils/bookingDataHelpers'

interface Coach {
  id: string
  name: string
}

interface MemberSearchResult {
  id: string
  name: string
  nickname: string | null
  phone: string | null
}

interface Booking {
  id: number
  start_at: string
  duration_min: number
  contact_name: string
  notes: string | null
  boat_id: number
  requires_driver: boolean
  boats: { name: string; color: string } | null
  coaches: Coach[]
  drivers: Coach[]
  coach_report?: {
    driver_duration_min: number
    reported_at: string
  }
  participants?: Participant[]
}

interface Participant {
  id?: number
  coach_id?: string | null
  member_id: string | null
  participant_name: string
  duration_min: number
  payment_method: string
  lesson_type: string  // 新增：教學方式
  notes?: string
  status?: string
  is_deleted?: boolean
  transaction_id?: number | null
  replaces_id?: number | null
}

interface CoachReportProps {
  user: User
}

const PAYMENT_METHODS = [
  { value: 'cash', label: '現金' },
  { value: 'transfer', label: '匯款' },
  { value: 'balance', label: '扣儲值' },
  { value: 'voucher', label: '票券' }
]

const LESSON_TYPES = [
  { value: 'undesignated', label: '不指定' },
  { value: 'designated_paid', label: '指定（需收費）' },
  { value: 'designated_free', label: '指定（不需收費）' }
]

export function CoachReport({ user }: CoachReportProps) {
  const { isMobile } = useResponsive()
  
  // 日期和教練篩選
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateString())
  const [selectedCoachId, setSelectedCoachId] = useState<string>('all') // 默認顯示"全部"
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [availableCoaches, setAvailableCoaches] = useState<Coach[]>([]) // 當天有預約的教練
  const [viewMode, setViewMode] = useState<'date' | 'unreported'>('date')
  
  // 預約列表
  const [bookings, setBookings] = useState<Booking[]>([])
  const [allBookings, setAllBookings] = useState<Booking[]>([]) // 用於統計
  const [loading, setLoading] = useState(false)
  
  // 回報表單
  const [reportingBookingId, setReportingBookingId] = useState<number | null>(null)
  const [reportType, setReportType] = useState<'coach' | 'driver' | 'both'>('coach')
  const [reportingCoachId, setReportingCoachId] = useState<string | null>(null)
  const [reportingCoachName, setReportingCoachName] = useState<string>('')
  const [driverDuration, setDriverDuration] = useState<number>(0)
  const [participants, setParticipants] = useState<Participant[]>([])
  
  // 會員搜尋
  const [memberSearchTerm, setMemberSearchTerm] = useState('')
  const { 
    filteredMembers,
    handleSearchChange 
  } = useMemberSearch()

  // 載入教練列表
  useEffect(() => {
    loadCoaches()
  }, [])

  // 載入預約列表
  useEffect(() => {
    loadBookings()
  }, [selectedDate, selectedCoachId, viewMode])

  useEffect(() => {
    handleSearchChange(memberSearchTerm)
  }, [memberSearchTerm, handleSearchChange])

  const loadCoaches = async () => {
    const { data, error } = await supabase
      .from('coaches')
      .select('id, name, status')
      .neq('status', 'archived')
      .order('name')
    
    if (error) {
      console.error('載入教練列表失敗:', error)
      return
    }
    
    setCoaches(data || [])
  }

  const loadBookings = async () => {
    setLoading(true)
    try {
      let bookingsQuery = supabase
        .from('bookings')
        .select(`
          id, start_at, duration_min, contact_name, notes, boat_id, requires_driver, status,
          boats(name, color)
        `)
        .eq('status', 'confirmed')
        .order('start_at')

      if (viewMode === 'date') {
        const startOfDay = `${selectedDate}T00:00:00`
        const endOfDay = `${selectedDate}T23:59:59`
        bookingsQuery = bookingsQuery
          .gte('start_at', startOfDay)
          .lte('start_at', endOfDay)
      } else {
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        const thirtyDaysAgoStr = getLocalDateString(thirtyDaysAgo) + 'T00:00:00'
        bookingsQuery = bookingsQuery.gte('start_at', thirtyDaysAgoStr)
      }

      const { data: bookingsData, error: bookingsError } = await bookingsQuery

      if (bookingsError) throw bookingsError

      const now = new Date()
      const validBookings = (bookingsData || []).filter(b => {
        const bookingEnd = new Date(new Date(b.start_at).getTime() + b.duration_min * 60000)
        return bookingEnd <= now
      })

      const bookingIds = validBookings.map(b => b.id)
      if (bookingIds.length === 0) {
        setBookings([])
        return
      }

      // 使用辅助函数查询和组装关联数据
      const relations = await fetchBookingRelations(bookingIds)
      const bookingsWithRelations = assembleBookingsWithRelations(validBookings, relations)

      let filteredBookings = bookingsWithRelations
      
      // 保存所有預約用於統計（按日期模式時）
      if (viewMode === 'date') {
        let statsBookings = bookingsWithRelations
        if (selectedCoachId !== 'all') {
          statsBookings = statsBookings.filter((booking: any) => {
            const isCoach = booking.coaches.some((c: any) => c.id === selectedCoachId)
            const isDriver = booking.drivers.some((d: any) => d.id === selectedCoachId)
            return isCoach || isDriver
          })
        }
        setAllBookings(statsBookings)
        
        // 使用辅助函数提取当天有预约的教练
        const availableCoachList = extractAvailableCoaches(bookingsWithRelations)
        setAvailableCoaches(availableCoachList)
        
        // 如果當前選中的教練不在可用列表中，切換到"全部"
        if (selectedCoachId !== 'all' && !availableCoachList.some(c => c.id === selectedCoachId)) {
          setSelectedCoachId('all')
        }
      } else {
        setAllBookings([])
        setAvailableCoaches(coaches) // 未回報模式顯示所有教練
      }

      // 使用辅助函数筛选预约
      filteredBookings = filterBookingsByCoach(filteredBookings, selectedCoachId)

      if (viewMode === 'unreported') {
        filteredBookings = filterUnreportedBookings(
          filteredBookings,
          selectedCoachId,
          getReportType,
          getReportStatus
        )
      }

      setBookings(filteredBookings)
    } catch (error) {
      console.error('載入預約失敗:', error)
    } finally {
      setLoading(false)
    }
  }

  const getReportType = (booking: Booking, coachId: string): 'coach' | 'driver' | 'both' | null => {
    const isCoach = booking.coaches.some(c => c.id === coachId)
    const isExplicitDriver = booking.drivers.some(d => d.id === coachId)
    const hasNoDriver = booking.drivers.length === 0
    const hasNoCoach = booking.coaches.length === 0
    
    const boatName = booking.boats?.name || ''
    const isFacilityBooking = isFacility(boatName)
    
    const isImplicitDriver = isCoach && hasNoDriver && !isFacilityBooking
    
    const needsCoachReport = isCoach
    const needsDriverReport = isExplicitDriver || isImplicitDriver
    
    // 純駕駛的預約（沒有教練，只有駕駛）需要同時回報駕駛時數和參與者
    if (hasNoCoach && isExplicitDriver) {
      return 'both'
    }
    
    if (needsCoachReport && needsDriverReport) {
      return 'both'
    } else if (needsCoachReport) {
      return 'coach'
    } else if (needsDriverReport) {
      return 'driver'
    }
    
    return null
  }

  const getReportStatus = (booking: Booking, coachId: string) => {
    const type = getReportType(booking, coachId)
    if (!type) return { hasCoachReport: false, hasDriverReport: false }
    
    const hasCoachReport = !!(booking.participants && booking.participants.length > 0 && 
      booking.coaches.some(c => c.id === coachId))
    const hasDriverReport = !!booking.coach_report
    
    return { hasCoachReport, hasDriverReport }
  }

  const startReportWithCoach = (booking: Booking, coachId: string) => {
    const type = getReportType(booking, coachId)
    if (!type) return
    
    const coach = booking.coaches.find(c => c.id === coachId) || booking.drivers.find(d => d.id === coachId)
    const coachName = coach?.name || ''
    
    setReportingBookingId(booking.id)
    setReportType(type)
    setReportingCoachId(coachId)
    setReportingCoachName(coachName)
    
    if (booking.coach_report) {
      setDriverDuration(booking.coach_report.driver_duration_min)
    } else {
      setDriverDuration(booking.duration_min)
    }
    
    if (booking.participants && booking.participants.length > 0) {
      const existingParticipants = booking.participants.filter(p => p.coach_id === coachId)
      setParticipants(existingParticipants)
    } else {
      loadBookingMembers(booking.id, booking.duration_min)
    }
  }

  const loadBookingMembers = async (bookingId: number, defaultDuration: number) => {
    try {
      const { data: bookingMembersData } = await supabase
        .from('booking_members')
        .select('member_id, members(id, name, nickname)')
        .eq('booking_id', bookingId)

      const { data: reportedParticipants } = await supabase
        .from('booking_participants')
        .select('member_id, participant_name, coach_id')
        .eq('booking_id', bookingId)
        .eq('is_deleted', false)
        .not('coach_id', 'is', null)

      const reportedMemberIds = new Set<string>()
      const reportedNames = new Set<string>()
      if (reportedParticipants) {
        reportedParticipants.forEach(rp => {
          if (rp.coach_id !== reportingCoachId) {
            if (rp.member_id) reportedMemberIds.add(rp.member_id)
            if (rp.participant_name) reportedNames.add(rp.participant_name.trim())
          }
        })
      }

      const availableMembers = (bookingMembersData || []).filter(
        (bm: any) => !reportedMemberIds.has(bm.member_id)
      )

      const participants: Participant[] = []
      const addedMemberIds = new Set<string>()
      
      availableMembers.forEach((bm: any) => {
        const member = bm.members
        addedMemberIds.add(bm.member_id)
        participants.push({
          member_id: bm.member_id,
          participant_name: member.nickname || member.name,
          duration_min: defaultDuration,
          payment_method: 'cash',
          lesson_type: 'undesignated',  // 默认不指定
          status: 'pending'
        })
      })

      const booking = bookings.find(b => b.id === bookingId)
      if (booking) {
        const contactNames = booking.contact_name.split(/[,，]/).map(n => n.trim()).filter(n => n)
        contactNames.forEach(contactName => {
          if (!reportedNames.has(contactName) && !participants.some(p => p.participant_name === contactName)) {
            const isExistingMember = participants.some(p => 
              p.participant_name.includes(contactName) || contactName.includes(p.participant_name)
            )
            
            if (!isExistingMember) {
              participants.push({
                member_id: null,
                participant_name: contactName,
                duration_min: defaultDuration,
                payment_method: 'cash',
                lesson_type: 'undesignated',  // 默认不指定
                status: 'not_applicable'
              })
            }
          }
        })
      }

      if (participants.length === 0) {
        participants.push({
          member_id: null,
          participant_name: '',
          duration_min: defaultDuration,
          payment_method: 'cash',
          lesson_type: 'undesignated',  // 默认不指定
          status: 'pending'
        })
      }

      setParticipants(participants)
    } catch (error) {
      console.error('載入會員失敗:', error)
    }
  }

  const submitReport = async () => {
    try {
      if (reportType === 'driver' || reportType === 'both') {
        await submitDriverReport()
      }
      
      if (reportType === 'coach' || reportType === 'both') {
        await submitCoachReport()
      }
      
      alert('回報成功！')
      setReportingBookingId(null)
      loadBookings()
    } catch (error) {
      // 錯誤已在子函數中處理，這裡不再重複顯示
      console.error('提交回報失敗:', error)
    }
  }

  const submitDriverReport = async () => {
    if (!reportingBookingId || !reportingCoachId) return

    console.log('提交駕駛回報:', {
      booking_id: reportingBookingId,
      coach_id: reportingCoachId,
      driver_duration_min: driverDuration
    })

    const { error } = await supabase
      .from('coach_reports')
      .upsert({
        booking_id: reportingBookingId,
        coach_id: reportingCoachId,
        driver_duration_min: driverDuration,
        reported_at: getLocalTimestamp()
      }, {
        onConflict: 'booking_id,coach_id'
      })

    if (error) {
      console.error('提交駕駛回報失敗:', error)
      throw new Error(`提交駕駛回報失敗: ${error.message}`)
    }
  }

  const submitCoachReport = async () => {
    if (!reportingBookingId || !reportingCoachId) {
      alert('缺少必要資訊')
      return
    }

    try {
      // 使用验证工具进行验证
      const validParticipants = validateParticipants(participants)
      
      // 檢查：如果是「會員」狀態但沒有選擇具體會員，提示用戶
      const memberStatusWithoutId = validParticipants.filter(
        p => p.status === 'pending' && !p.member_id
      )
      
      if (memberStatusWithoutId.length > 0) {
        const names = memberStatusWithoutId.map(p => p.participant_name || '(未填寫)').join('、')
        alert(`以下參與者標記為會員但尚未選擇：${names}\n\n請點擊該參與者從會員列表選擇，或刪除後改用「新增客人」`)
        return
      }
      
      // 继续提交流程
      // 步驟 1: 載入現有參與者記錄
      const { data: oldParticipants, error: fetchError } = await supabase
        .from('booking_participants')
        .select('*')
        .eq('booking_id', reportingBookingId)
        .eq('coach_id', reportingCoachId)
        .eq('is_deleted', false)

      if (fetchError) {
        console.error('載入現有記錄失敗:', fetchError)
        throw new Error(`載入現有記錄失敗: ${fetchError.message}`)
      }

      // 步驟 2: 軟刪除已移除的參與者
      const oldParticipantIds = new Set<number>()
      validParticipants.forEach((p: any) => {
        if (p.id !== undefined) {
          oldParticipantIds.add(p.id)
        }
      })
      const participantsToSoftDelete = (oldParticipants || []).filter(old => !oldParticipantIds.has(old.id))

      if (participantsToSoftDelete.length > 0) {
        const { error: softDeleteError } = await supabase
          .from('booking_participants')
          .update({
            is_deleted: true,
            deleted_at: getLocalTimestamp(),
            updated_at: getLocalTimestamp()
          })
          .in('id', participantsToSoftDelete.map(p => p.id))

        if (softDeleteError) {
          console.error('軟刪除記錄失敗:', softDeleteError)
          throw new Error(`軟刪除記錄失敗: ${softDeleteError.message}`)
        }
      }

      // 步驟 3 & 4: 更新現有記錄 + 插入新記錄
      const participantsToUpdate: any[] = []
      const participantsToInsert: any[] = []

      validParticipants.forEach((p: any) => {
        // 使用工具函数计算 is_teaching 和 status
        const isTeaching = calculateIsTeaching(p.lesson_type)
        const status = calculateParticipantStatus(p.member_id)
        
        console.log(`參與者 ${p.participant_name}:`, {
          member_id: p.member_id,
          status: status,
          is_teaching: isTeaching,
          is_會員: !!p.member_id
        })
        
        const recordData = {
          booking_id: reportingBookingId,
          coach_id: reportingCoachId,
          member_id: p.member_id,
          participant_name: p.participant_name,
          duration_min: p.duration_min,
          payment_method: p.payment_method,
          lesson_type: p.lesson_type,
          notes: p.notes || null,
          status: status,
          reported_at: getLocalTimestamp(),
          is_teaching: isTeaching
        }

        if (p.id) {
          // 現有記錄：更新
          participantsToUpdate.push({
            ...recordData,
            id: p.id,
            updated_at: getLocalTimestamp()
          })
        } else {
          // 新記錄：插入
          participantsToInsert.push(recordData)
        }
      })

      // 執行更新
      if (participantsToUpdate.length > 0) {
        for (const participant of participantsToUpdate) {
          const { id, ...updateData } = participant
          const { error: updateError } = await supabase
            .from('booking_participants')
            .update(updateData)
            .eq('id', id)

          if (updateError) {
            console.error('更新記錄失敗:', updateError)
            throw new Error(`更新記錄失敗: ${updateError.message}`)
          }
        }
      }

      // 執行插入
      if (participantsToInsert.length > 0) {
        console.log('準備插入的參與者記錄:', participantsToInsert)

        const { error: insertError } = await supabase
          .from('booking_participants')
          .insert(participantsToInsert)

        if (insertError) {
          console.error('插入新記錄失敗:', insertError)
          throw new Error(`插入新記錄失敗: ${insertError.message}`)
        }
      }
    } catch (error: any) {
      console.error('提交教練回報失敗:', error)
      const errorMsg = error.message || '未知錯誤'
      alert(`提交失敗：${errorMsg}\n\n請打開瀏覽器控制台 (F12) 查看詳細錯誤`)
      throw error
    }
  }

  // 新增參與者（統一入口）
  const addParticipant = () => {
    const booking = bookings.find(b => b.id === reportingBookingId)
    setParticipants([
      ...participants,
      {
        member_id: null,
        participant_name: '',
        duration_min: booking?.duration_min || 60,
        payment_method: 'cash',  // 默認現金
        lesson_type: 'undesignated',
        status: 'not_applicable'  // 默認非會員
      }
    ])
  }

  // 清除會員綁定
  const clearMember = (index: number) => {
    const updated = [...participants]
    updated[index] = {
      ...updated[index],
      member_id: null,
      payment_method: 'cash',
      status: 'not_applicable'
    }
    setParticipants(updated)
  }

  const removeParticipant = (index: number) => {
    setParticipants(participants.filter((_, i) => i !== index))
  }

  const updateParticipant = (index: number, field: keyof Participant, value: any) => {
    const updated = [...participants]
    updated[index] = { ...updated[index], [field]: value }
    setParticipants(updated)
  }

  const selectMember = (index: number, member: MemberSearchResult) => {
    // 一次性更新所有字段，選了會員自動調整收費方式
    const updated = [...participants]
    updated[index] = {
      ...updated[index],
      member_id: member.id,
      participant_name: member.nickname || member.name,
      payment_method: 'balance',  // 會員自動改為扣儲值
      status: 'pending'  // 會員狀態
    }
    setParticipants(updated)
    setMemberSearchTerm('')
  }

  const reportingBooking = bookings.find(b => b.id === reportingBookingId)

  // 快捷日期按鈕
  const setDateOffset = (days: number) => {
    const date = new Date()
    date.setDate(date.getDate() + days)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    setSelectedDate(`${year}-${month}-${day}`)
  }

  // 計算統計數據（更細緻的邏輯）
  const stats = {
    total: allBookings.length,
    reported: allBookings.filter(b => {
      if (selectedCoachId === 'all') {
        // 檢查所有教練和駕駛是否都已回報
        const hasCoaches = b.coaches.length > 0
        const hasDrivers = b.drivers.length > 0
        
        if (!hasCoaches && !hasDrivers) return false // 沒有教練也沒有駕駛
        
        // 檢查所有教練是否都已回報
        const allCoachesReported = b.coaches.length === 0 || b.coaches.every((coach: any) => {
          const type = getReportType(b, coach.id)
          if (!type) return true
          const status = getReportStatus(b, coach.id)
          if (type === 'coach') return status.hasCoachReport
          if (type === 'driver') return status.hasDriverReport
          if (type === 'both') return status.hasCoachReport && status.hasDriverReport
          return true
        })
        
        // 檢查所有駕駛是否都已回報
        const allDriversReported = b.drivers.length === 0 || b.drivers.every((driver: any) => {
          const status = getReportStatus(b, driver.id)
          return status.hasDriverReport
        })
        
        return allCoachesReported && allDriversReported
      } else {
        return b.participants && b.participants.some(p => p.coach_id === selectedCoachId)
      }
    }).length,
    unreported: allBookings.filter(b => {
      if (selectedCoachId !== 'all') {
        const type = getReportType(b, selectedCoachId)
        if (!type) return false
        const status = getReportStatus(b, selectedCoachId)
        if (type === 'coach') return !status.hasCoachReport
        if (type === 'driver') return !status.hasDriverReport
        if (type === 'both') return !status.hasCoachReport || !status.hasDriverReport
        return false
      } else {
        // 檢查是否有任何教練或駕駛未回報
        const hasCoaches = b.coaches.length > 0
        const hasDrivers = b.drivers.length > 0
        
        if (!hasCoaches && !hasDrivers) return false // 沒有教練也沒有駕駛，不算未回報
        
        // 檢查教練是否都已回報
        const allCoachesReported = b.coaches.length === 0 || b.coaches.every((coach: any) => {
          const type = getReportType(b, coach.id)
          if (!type) return true
          const status = getReportStatus(b, coach.id)
          if (type === 'coach') return status.hasCoachReport
          if (type === 'driver') return status.hasDriverReport
          if (type === 'both') return status.hasCoachReport && status.hasDriverReport
          return true
        })
        
        // 檢查駕駛是否都已回報
        const allDriversReported = b.drivers.length === 0 || b.drivers.every((driver: any) => {
          const status = getReportStatus(b, driver.id)
          return status.hasDriverReport
        })
        
        // 只要有任何一個未回報，就算未回報
        return !allCoachesReported || !allDriversReported
      }
    }).length
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
      <PageHeader 
        user={user} 
        title="預約回報"
        showBaoLink={true}
        extraLinks={[
          { label: '回報管理 →', link: '/coach-admin' }
        ]}
      />
      
      <div style={{ 
        flex: 1, 
        padding: isMobile ? '16px' : '24px',
        maxWidth: '1400px',
        margin: '0 auto',
        width: '100%'
      }}>
        {/* 標籤頁式視圖切換 */}
        <div style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '0',
          borderBottom: '2px solid #e0e0e0'
        }}>
            <button
              onClick={() => setViewMode('unreported')}
              style={{
              flex: isMobile ? 1 : 'none',
              padding: isMobile ? '14px 16px' : '14px 32px',
              background: viewMode === 'unreported' ? 'white' : 'transparent',
              color: viewMode === 'unreported' ? '#ff9800' : '#999',
              border: 'none',
              borderBottom: viewMode === 'unreported' ? '3px solid #ff9800' : '3px solid transparent',
                cursor: 'pointer',
              fontSize: isMobile ? '15px' : '16px',
              fontWeight: '600',
              transition: 'all 0.2s',
              marginBottom: '-2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
              }}
            >
            ⚠️ 查看全部
            {viewMode === 'unreported' && bookings.length > 0 && (
              <span style={{
                background: '#ff9800',
                color: 'white',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: 'bold'
              }}>
                {bookings.length}
              </span>
            )}
            </button>
            <button
              onClick={() => setViewMode('date')}
              style={{
              flex: isMobile ? 1 : 'none',
              padding: isMobile ? '14px 16px' : '14px 32px',
              background: viewMode === 'date' ? 'white' : 'transparent',
              color: viewMode === 'date' ? '#2196f3' : '#999',
              border: 'none',
              borderBottom: viewMode === 'date' ? '3px solid #2196f3' : '3px solid transparent',
                cursor: 'pointer',
              fontSize: isMobile ? '15px' : '16px',
              fontWeight: '600',
              transition: 'all 0.2s',
              marginBottom: '-2px'
              }}
            >
            📅 按日期查看
            </button>
          </div>

        {/* 統計摘要 - 獨立在外面 */}
        {viewMode === 'date' && stats.total > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
            gap: '16px',
            marginBottom: '24px'
          }}>
            <div style={{
              padding: '20px',
              background: 'white',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              borderLeft: '4px solid #90caf9'
            }}>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px', fontWeight: '500' }}>
                總預約
              </div>
              <div style={{ fontSize: isMobile ? '32px' : '36px', fontWeight: 'bold', color: '#333' }}>
                {stats.total}
              </div>
            </div>

            <div style={{
              padding: '20px',
              background: 'white',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              borderLeft: '4px solid #81c784'
            }}>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px', fontWeight: '500' }}>
                已回報
              </div>
              <div style={{ fontSize: isMobile ? '32px' : '36px', fontWeight: 'bold', color: '#333' }}>
                {stats.reported}
              </div>
            </div>

            <div style={{
              padding: '20px',
              background: 'white',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              borderLeft: '4px solid #ffb74d'
            }}>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px', fontWeight: '500' }}>
                未回報
              </div>
              <div style={{ fontSize: isMobile ? '32px' : '36px', fontWeight: 'bold', color: '#333' }}>
                {stats.unreported}
              </div>
            </div>
          </div>
        )}

        {/* 篩選區 */}
        <div style={{
          ...getCardStyle(isMobile),
          marginBottom: '24px',
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0
        }}>
          {/* 日期選擇 - 只在按日期模式顯示 */}
          {viewMode === 'date' && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ ...getLabelStyle(isMobile), marginBottom: '8px' }}>日期</label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setDateOffset(-2)}
                  style={{
                    flex: isMobile ? 1 : 'none',
                    padding: '10px 20px',
                    background: 'white',
                    color: '#666',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#2196f3'
                    e.currentTarget.style.color = '#2196f3'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e0e0e0'
                    e.currentTarget.style.color = '#666'
                  }}
                >
                  前天
                </button>
                <button
                  onClick={() => setDateOffset(-1)}
                  style={{
                    flex: isMobile ? 1 : 'none',
                    padding: '10px 20px',
                    background: 'white',
                    color: '#666',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#2196f3'
                    e.currentTarget.style.color = '#2196f3'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e0e0e0'
                    e.currentTarget.style.color = '#666'
                  }}
                >
                  昨天
                </button>
                <button
                  onClick={() => setDateOffset(0)}
                  style={{
                    flex: isMobile ? 1 : 'none',
                    padding: '10px 20px',
                    background: selectedDate === getLocalDateString() ? '#2196f3' : 'white',
                    color: selectedDate === getLocalDateString() ? 'white' : '#666',
                    border: `2px solid ${selectedDate === getLocalDateString() ? '#2196f3' : '#e0e0e0'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'all 0.2s'
                  }}
                >
                  今天
                </button>
              </div>
              <input 
                type="date" 
                value={selectedDate} 
                onChange={(e) => setSelectedDate(e.target.value)} 
                style={getInputStyle(isMobile)} 
              />
            </div>
          )}

          {/* 教練選擇 - 按鈕組 */}
          <div style={{ marginTop: viewMode === 'date' ? '16px' : 0 }}>
            <label style={{ ...getLabelStyle(isMobile), marginBottom: '12px' }}>教練</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setSelectedCoachId('all')}
                style={{
                  padding: '10px 20px',
                  background: selectedCoachId === 'all' ? '#2196f3' : 'white',
                  color: selectedCoachId === 'all' ? 'white' : '#666',
                  border: `2px solid ${selectedCoachId === 'all' ? '#2196f3' : '#e0e0e0'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
              >
                全部
              </button>
              {(viewMode === 'date' ? availableCoaches : coaches).map(coach => (
                <button
                  key={coach.id}
                  onClick={() => setSelectedCoachId(coach.id)}
                  style={{
                    padding: '10px 20px',
                    background: selectedCoachId === coach.id ? '#2196f3' : 'white',
                    color: selectedCoachId === coach.id ? 'white' : '#666',
                    border: `2px solid ${selectedCoachId === coach.id ? '#2196f3' : '#e0e0e0'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'all 0.2s'
                  }}
                >
                  {coach.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 預約列表 */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            載入中...
          </div>
        ) : bookings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            {viewMode === 'unreported' ? '沒有未回報的預約' : '沒有預約記錄'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {bookings.map(booking => {
              const displayCoaches = selectedCoachId === 'all' 
                ? booking.coaches 
                : booking.coaches.filter(c => c.id === selectedCoachId)
              
              const displayDrivers = selectedCoachId === 'all'
                ? booking.drivers
                : booking.drivers.filter(d => d.id === selectedCoachId)

              const shouldShow = displayCoaches.length > 0 || displayDrivers.length > 0

              if (!shouldShow) return null

              return (
                <div 
                  key={booking.id}
                  style={{
                    ...getCardStyle(isMobile),
                    borderLeft: `4px solid ${booking.boats?.color || '#ccc'}`
                  }}
                >
                  {/* 預約資訊 */}
                  <div style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #e0e0e0' }}>
                    <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '4px' }}>
                      {booking.start_at.substring(0, 10)} {booking.start_at.substring(11, 16)} | {booking.boats?.name} ({booking.duration_min}分)
                    </div>
                    <div style={{ color: '#666', fontSize: '14px' }}>
                      {booking.contact_name || '未命名'}
                    </div>
                    {booking.notes && (
                      <div style={{ color: '#999', fontSize: '13px', marginTop: '4px' }}>
                        備註：{booking.notes}
                      </div>
                    )}
                  </div>

                  {/* 教練列表 */}
                  {displayCoaches.length > 0 && (
                    <div style={{ marginBottom: displayDrivers.length > 0 ? '12px' : '0' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '20px', marginTop: '6px' }}>🎓</span>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {displayCoaches.map(coach => {
                          const reportType = getReportType(booking, coach.id)
                          const reportStatus = getReportStatus(booking, coach.id)
                          
                          return (
                            <div
                              key={coach.id}
                              style={{
                                  padding: '8px 12px',
                                background: '#f5f5f5',
                                borderRadius: '6px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '8px'
                              }}
                            >
                                <span style={{ fontWeight: '500' }}>
                                  {coach.name}
                                </span>
                              <button
                                onClick={() => startReportWithCoach(booking, coach.id)}
                                style={getButtonStyle('primary')}
                              >
                                {reportStatus.hasCoachReport || (reportType === 'both' && reportStatus.hasCoachReport && reportStatus.hasDriverReport)
                                  ? '修改回報'
                                  : '回報'}
                              </button>
                            </div>
                          )
                        })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 駕駛列表 */}
                  {displayDrivers.length > 0 && (
                    <div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '20px', marginTop: '6px' }}>🚤</span>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {displayDrivers.map(driver => {
                          const reportStatus = getReportStatus(booking, driver.id)
                          
                          return (
                            <div
                              key={driver.id}
                              style={{
                                  padding: '8px 12px',
                                background: '#f5f5f5',
                                borderRadius: '6px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '8px'
                              }}
                            >
                                <span style={{ fontWeight: '500' }}>
                                  {driver.name}
                                </span>
                              <button
                                onClick={() => startReportWithCoach(booking, driver.id)}
                                style={getButtonStyle('primary')}
                              >
                                {reportStatus.hasDriverReport ? '修改回報' : '回報'}
                              </button>
                            </div>
                          )
                        })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 回報對話框 - 使用新组件 */}
      <CoachReportFormDialog
        booking={reportingBooking}
        reportType={reportType}
        coachName={reportingCoachName}
        driverDuration={driverDuration}
        participants={participants}
        isMobile={isMobile}
        memberSearchTerm={memberSearchTerm}
        filteredMembers={filteredMembers}
        lessonTypes={LESSON_TYPES}
        paymentMethods={PAYMENT_METHODS}
        onDriverDurationChange={setDriverDuration}
        onParticipantUpdate={updateParticipant}
        onParticipantAdd={addParticipant}
        onParticipantRemove={removeParticipant}
        onClearMember={clearMember}
        onMemberSearch={(value) => {
          setMemberSearchTerm(value)
          handleSearchChange(value)
        }}
        onMemberSelect={selectMember}
        onSubmit={submitReport}
        onCancel={() => setReportingBookingId(null)}
      />

      <Footer />
    </div>
  )
}

