import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/PageHeader'
import { Footer } from '../components/Footer'
import { useResponsive } from '../hooks/useResponsive'
import { useMemberSearch } from '../hooks/useMemberSearch'
import { getButtonStyle, getCardStyle, getInputStyle, getLabelStyle } from '../styles/designSystem'
import { isFacility } from '../utils/facility'
import { getLocalDateString } from '../utils/date'

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
  { value: 'voucher', label: '票券' },
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
        bookingsQuery = bookingsQuery.gte('start_at', thirtyDaysAgo.toISOString())
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

      const [coachesRes, driversRes, reportsRes, participantsRes, bookingMembersRes] = await Promise.all([
        supabase.from('booking_coaches').select('booking_id, coach_id, coaches(id, name)').in('booking_id', bookingIds),
        supabase.from('booking_drivers').select('booking_id, driver_id, coaches:driver_id(id, name)').in('booking_id', bookingIds),
        supabase.from('coach_reports').select('*').in('booking_id', bookingIds),
        supabase.from('booking_participants').select('*, members(name, nickname)').eq('is_deleted', false).in('booking_id', bookingIds),
        supabase.from('booking_members').select('booking_id, member_id, members(name, nickname)').in('booking_id', bookingIds)
      ])

      const bookingsWithRelations = validBookings.map((booking: any) => {
        const bookingCoaches = (coachesRes.data || [])
          .filter((bc: any) => bc.booking_id === booking.id)
          .map((bc: any) => ({ id: bc.coach_id, name: bc.coaches?.name || '' }))

        const bookingDrivers = (driversRes.data || [])
          .filter((bd: any) => bd.booking_id === booking.id)
          .map((bd: any) => ({ id: bd.driver_id, name: bd.coaches?.name || '' }))

        const coachReport = (reportsRes.data || []).find(r => r.booking_id === booking.id)
        
        const bookingParticipants = (participantsRes.data || [])
          .filter(p => p.booking_id === booking.id)
          .map(p => {
            // 如果有 member_id，優先使用 members 表的最新資料
            let displayName = p.participant_name
            if (p.member_id && p.members) {
              displayName = p.members.nickname || p.members.name
            }
            
            return {
              id: p.id,
              coach_id: p.coach_id,
              member_id: p.member_id,
              participant_name: displayName,
              duration_min: p.duration_min,
              payment_method: p.payment_method,
              notes: p.notes,
              status: p.status,
              is_deleted: p.is_deleted,
              transaction_id: p.transaction_id,
              replaces_id: p.replaces_id
            }
          })

        // 更新 contact_name - 從 booking_members 取得最新會員名字
        let updatedContactName = booking.contact_name
        const bookingMembers = (bookingMembersRes.data || []).filter((bm: any) => bm.booking_id === booking.id)
        if (bookingMembers.length > 0) {
          const memberNames = bookingMembers
            .map((bm: any) => bm.members?.nickname || bm.members?.name)
            .filter(Boolean)
          if (memberNames.length > 0) {
            updatedContactName = memberNames.join(', ')
          }
        }

        return {
          ...booking,
          contact_name: updatedContactName,
          coaches: bookingCoaches,
          drivers: bookingDrivers,
          coach_report: coachReport,
          participants: bookingParticipants
        }
      })

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
        
        // 篩選當天有預約的教練
        const coachMap = new Map<string, Coach>()
        bookingsWithRelations.forEach((booking: any) => {
          booking.coaches.forEach((coach: Coach) => {
            if (!coachMap.has(coach.id)) {
              coachMap.set(coach.id, coach)
            }
          })
          booking.drivers.forEach((driver: Coach) => {
            if (!coachMap.has(driver.id)) {
              coachMap.set(driver.id, driver)
            }
          })
        })
        const availableCoachList = Array.from(coachMap.values())
        setAvailableCoaches(availableCoachList)
        
        // 如果當前選中的教練不在可用列表中，切換到"全部"
        if (selectedCoachId !== 'all' && !availableCoachList.some(c => c.id === selectedCoachId)) {
          setSelectedCoachId('all')
        }
      } else {
        setAllBookings([])
        setAvailableCoaches(coaches) // 未回報模式顯示所有教練
      }

      if (selectedCoachId !== 'all') {
        filteredBookings = filteredBookings.filter((booking: any) => {
          const isCoach = booking.coaches.some((c: any) => c.id === selectedCoachId)
          const isDriver = booking.drivers.some((d: any) => d.id === selectedCoachId)
          return isCoach || isDriver
        })
      }

      if (viewMode === 'unreported') {
        filteredBookings = filteredBookings.filter((booking: any) => {
          if (selectedCoachId !== 'all') {
            const type = getReportType(booking, selectedCoachId)
            if (!type) return false

            const status = getReportStatus(booking, selectedCoachId)

            if (type === 'coach') return !status.hasCoachReport
            if (type === 'driver') return !status.hasDriverReport
            if (type === 'both') return !status.hasCoachReport || !status.hasDriverReport

            return false
          } else {
            const allCoachesReported = booking.coaches.every((coach: any) => {
              const type = getReportType(booking, coach.id)
              if (!type) return true
              const status = getReportStatus(booking, coach.id)
              if (type === 'coach') return status.hasCoachReport
              if (type === 'driver') return status.hasDriverReport
              if (type === 'both') return status.hasCoachReport && status.hasDriverReport
              return true
            })

            const allDriversReported = booking.drivers.every((driver: any) => {
              const status = getReportStatus(booking, driver.id)
              return status.hasDriverReport
            })

            const hasNoCoach = booking.coaches.length === 0
            if (hasNoCoach && booking.drivers.length > 0) {
              return !booking.participants || booking.participants.length === 0
            }

            return !allCoachesReported || !allDriversReported
          }
        })
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
    
    const hasCoachReport = booking.participants && booking.participants.length > 0 && 
      booking.coaches.some(c => c.id === coachId)
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
          status: 'pending'
        })
      }

      setParticipants(participants)
    } catch (error) {
      console.error('載入會員失敗:', error)
    }
  }

  const submitReport = async () => {
    if (reportType === 'driver' || reportType === 'both') {
      await submitDriverReport()
    }
    
    if (reportType === 'coach' || reportType === 'both') {
      await submitCoachReport()
    }
    
    alert('回報成功！')
    setReportingBookingId(null)
    loadBookings()
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
        reported_at: new Date().toISOString()
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

    const validParticipants = participants.filter(p => p.participant_name.trim())

    if (validParticipants.length === 0) {
      alert('請至少新增一位參與者')
      return
    }

    if (validParticipants.some(p => p.duration_min <= 0)) {
      alert('時數必須大於 0')
      return
    }

    try {
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
      const oldParticipantIds = new Set(validParticipants.filter(p => p.id).map(p => p.id))
      const participantsToSoftDelete = (oldParticipants || []).filter(old => !oldParticipantIds.has(old.id))

      if (participantsToSoftDelete.length > 0) {
        const { error: softDeleteError } = await supabase
          .from('booking_participants')
          .update({
            is_deleted: true,
            deleted_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .in('id', participantsToSoftDelete.map(p => p.id))

        if (softDeleteError) {
          console.error('軟刪除記錄失敗:', softDeleteError)
          throw new Error(`軟刪除記錄失敗: ${softDeleteError.message}`)
        }
      }

      // 步驟 3: 刪除舊的未刪除記錄（準備重新插入）
      const { error: deleteError } = await supabase
        .from('booking_participants')
        .delete()
        .eq('booking_id', reportingBookingId)
        .eq('coach_id', reportingCoachId)
        .eq('is_deleted', false)

      if (deleteError) {
        console.error('刪除舊記錄失敗:', deleteError)
        throw new Error(`刪除舊記錄失敗: ${deleteError.message}`)
      }

      // 步驟 4: 插入新的參與者記錄
      const participantsToInsert = validParticipants.map(p => ({
        booking_id: reportingBookingId,
        coach_id: reportingCoachId,
        member_id: p.member_id,
        participant_name: p.participant_name,
        duration_min: p.duration_min,
        payment_method: p.payment_method,
        notes: p.notes || null,
        status: p.member_id ? 'pending' : 'not_applicable',
        reported_at: new Date().toISOString(),
        replaces_id: p.id || null
      }))

      console.log('準備插入的參與者記錄:', participantsToInsert)

      const { error: insertError } = await supabase
        .from('booking_participants')
        .insert(participantsToInsert)

      if (insertError) {
        console.error('插入新記錄失敗:', insertError)
        throw new Error(`插入新記錄失敗: ${insertError.message}`)
      }
    } catch (error: any) {
      console.error('提交教練回報失敗:', error)
      const errorMsg = error.message || '未知錯誤'
      alert(`提交失敗：${errorMsg}\n\n請打開瀏覽器控制台 (F12) 查看詳細錯誤`)
      throw error
    }
  }

  const addParticipant = () => {
    const booking = bookings.find(b => b.id === reportingBookingId)
    setParticipants([
      ...participants,
      {
        member_id: null,
        participant_name: '',
        duration_min: booking?.duration_min || 60,
        payment_method: 'cash',
        status: 'pending'
      }
    ])
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
    updateParticipant(index, 'member_id', member.id)
    updateParticipant(index, 'participant_name', member.nickname || member.name)
    updateParticipant(index, 'status', 'pending')
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
            📅 按日期
          </button>
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
            ⚠️ 未回報
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
        </div>

        {/* 篩選區 */}
        <div style={{
          ...getCardStyle(isMobile),
          marginBottom: '24px',
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0
        }}>
          {/* 日期選擇 - 只在按日期模式顯示 */}
          {viewMode === 'date' && (
            <>
              {/* 統計摘要 */}
              {stats.total > 0 && (
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  marginBottom: '20px',
                  padding: '16px',
                  background: '#f8f9fa',
                  borderRadius: '8px',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ flex: 1, minWidth: isMobile ? '80px' : '100px' }}>
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>總預約</div>
                    <div style={{ fontSize: isMobile ? '24px' : '28px', fontWeight: 'bold', color: '#333' }}>{stats.total}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: isMobile ? '80px' : '100px' }}>
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>已回報</div>
                    <div style={{ fontSize: isMobile ? '24px' : '28px', fontWeight: 'bold', color: '#4caf50' }}>{stats.reported}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: isMobile ? '80px' : '100px' }}>
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>未回報</div>
                    <div style={{ fontSize: isMobile ? '24px' : '28px', fontWeight: 'bold', color: '#ff9800' }}>{stats.unreported}</div>
                  </div>
                </div>
              )}

              {/* 快捷日期按鈕 */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ ...getLabelStyle(isMobile), marginBottom: '8px' }}>日期</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
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
                  <button
                    onClick={() => setDateOffset(1)}
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
                    明天
                  </button>
                </div>
                <input 
                  type="date" 
                  value={selectedDate} 
                  onChange={(e) => setSelectedDate(e.target.value)} 
                  style={getInputStyle(isMobile)} 
                />
              </div>
            </>
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

      {/* 回報對話框 */}
      {reportingBookingId && reportingBooking && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px',
          overflow: 'auto'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: isMobile ? '24px' : '32px',
            maxWidth: '800px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: isMobile ? '20px' : '24px' }}>
              回報 - {reportingCoachName}
            </h2>

            {/* 預約資訊摘要 */}
            <div style={{ 
              padding: '12px', 
              background: '#f5f5f5', 
              borderRadius: '8px',
              marginBottom: '24px' 
            }}>
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                {reportingBooking.start_at.substring(0, 10)} {reportingBooking.start_at.substring(11, 16)} | {reportingBooking.boats?.name}
              </div>
              <div style={{ fontSize: '14px', color: '#666' }}>
                {reportingBooking.contact_name} • {reportingBooking.duration_min}分
              </div>
            </div>

            {/* 駕駛回報 */}
            {(reportType === 'driver' || reportType === 'both') && (
              <div style={{ 
                marginBottom: '24px',
                padding: '16px',
                background: '#e3f2fd',
                borderRadius: '8px'
              }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>
                  🚤 駕駛回報
                </h3>
                <div>
                  <label style={{ ...getLabelStyle(isMobile) }}>實際駕駛時數（分鐘）</label>
                  <input
                    type="number"
                    value={driverDuration}
                    onChange={(e) => setDriverDuration(parseInt(e.target.value) || 0)}
                    min="0"
                    style={getInputStyle(isMobile)}
                  />
                </div>
              </div>
            )}

            {/* 教練回報 */}
            {(reportType === 'coach' || reportType === 'both') && (
              <div>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>
                  🎓 教練回報（參與者）
                </h3>
                
                <div style={{ 
                  padding: '12px',
                  background: '#fff3e0',
                  borderRadius: '6px',
                  marginBottom: '16px',
                  fontSize: '14px'
                }}>
                  💡 提示：點擊姓名欄位可搜尋會員，或直接輸入客人姓名
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {participants.map((participant, index) => (
                    <div
                      key={index}
                      style={{
                        padding: '16px',
                        background: '#f8f9fa',
                        borderRadius: '8px',
                        position: 'relative'
                      }}
                    >
                      {participants.length > 1 && (
                        <button
                          onClick={() => removeParticipant(index)}
                          style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            padding: '4px 8px',
                            background: '#f44336',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          刪除
                        </button>
                      )}

                      {/* 會員狀態標籤 */}
                      <div style={{ marginBottom: '12px' }}>
                        {participant.member_id ? (
                          <span style={{
                            display: 'inline-block',
                            padding: '4px 12px',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}>
                            👤 會員
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-block',
                            padding: '4px 12px',
                            background: '#fff3e0',
                            color: '#e65100',
                            border: '1px solid #ffb74d',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}>
                            🔍 可搜尋會員或輸入客人姓名
                          </span>
                        )}
                      </div>

                      {/* 姓名輸入 + 會員搜尋 */}
                      <div style={{ marginBottom: '12px', position: 'relative' }}>
                        <label style={{ ...getLabelStyle(isMobile) }}>姓名</label>
                        <input
                          type="text"
                          value={participant.participant_name}
                          onChange={(e) => {
                            updateParticipant(index, 'participant_name', e.target.value)
                            setMemberSearchTerm(e.target.value)
                            handleSearchChange(e.target.value)
                          }}
                          style={getInputStyle(isMobile)}
                          placeholder="搜尋會員或輸入姓名"
                        />
                        
                        {/* 會員搜尋結果 */}
                        {memberSearchTerm && filteredMembers.length > 0 && (
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            maxHeight: '200px',
                            overflow: 'auto',
                            background: 'white',
                            border: '1px solid #ddd',
                            borderRadius: '6px',
                            marginTop: '4px',
                            zIndex: 10,
                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                          }}>
                            {filteredMembers.map(member => (
                              <div
                                key={member.id}
                                onClick={() => selectMember(index, member)}
                                style={{
                                  padding: '8px 12px',
                                  cursor: 'pointer',
                                  borderBottom: '1px solid #f0f0f0',
                                  transition: 'background 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                              >
                                <div style={{ fontWeight: '600' }}>
                                  {member.nickname || member.name}
                                </div>
                                {member.phone && (
                                  <div style={{ fontSize: '12px', color: '#666' }}>
                                    {member.phone}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 時數 */}
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ ...getLabelStyle(isMobile) }}>時數（分鐘）</label>
                        <input
                          type="number"
                          value={participant.duration_min}
                          onChange={(e) => updateParticipant(index, 'duration_min', parseInt(e.target.value) || 0)}
                          min="0"
                          style={getInputStyle(isMobile)}
                        />
                      </div>

                      {/* 付款方式 */}
                      <div>
                        <label style={{ ...getLabelStyle(isMobile) }}>付款方式</label>
                        <select
                          value={participant.payment_method}
                          onChange={(e) => updateParticipant(index, 'payment_method', e.target.value)}
                          style={getInputStyle(isMobile)}
                        >
                          {PAYMENT_METHODS.map(method => (
                            <option key={method.value} value={method.value}>
                              {method.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={addParticipant}
                  style={{
                    ...getButtonStyle('secondary'),
                    width: '100%',
                    marginTop: '16px'
                  }}
                >
                  + 新增客人
                </button>
              </div>
            )}

            {/* 按鈕 */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={() => setReportingBookingId(null)}
                style={{
                  ...getButtonStyle('secondary'),
                  flex: 1
                }}
              >
                取消
              </button>
              <button
                onClick={submitReport}
                style={{
                  ...getButtonStyle('primary'),
                  flex: 1
                }}
              >
                提交回報
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}

