import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/PageHeader'
import { Footer } from '../components/Footer'
import { TransactionDialog } from '../components/TransactionDialog'
import { useResponsive } from '../hooks/useResponsive'
import { useMemberSearch } from '../hooks/useMemberSearch'
import { getButtonStyle, getCardStyle, getInputStyle, getLabelStyle } from '../styles/designSystem'
import { getLocalDateString } from '../utils/date'

// ============ Types ============


interface MemberSearchResult {
  id: string
  name: string
  nickname: string | null
  phone: string | null
}

interface FullMember {
  id: string
  name: string
  nickname: string | null
  phone: string | null
  balance: number
  vip_voucher_amount: number
  designated_lesson_minutes: number
  boat_voucher_g23_minutes: number
  boat_voucher_g21_panther_minutes: number
  gift_boat_hours: number
}

interface PendingReport {
  id: number
  booking_id: number
  coach_id: string
  member_id: string | null
  participant_name: string
  duration_min: number
  payment_method: string
  status: string
  replaces_id: number | null
  bookings: {
    id: number
    start_at: string
    duration_min: number
    contact_name: string
    boat_id: number
    boats: { name: string; color: string } | null
  }
  coaches: { id: string; name: string } | null
  old_participant?: any
}

type TabType = 'pending' | 'completed'
type CompletedViewMode = 'booking' | 'coach'

const PAYMENT_METHODS = [
  { value: 'cash', label: '現金' },
  { value: 'transfer', label: '匯款' },
  { value: 'balance', label: '扣儲值' },
  { value: 'voucher', label: '票券' },
  { value: 'designated_paid', label: '指定（需收費）' },
  { value: 'designated_free', label: '指定（不需收費）' }
]

// ============ Main Component ============

export function CoachAdmin({ user }: { user: User | null }) {
  const { isMobile } = useResponsive()
  
  // Tab 管理
  const [activeTab, setActiveTab] = useState<TabType>('pending')
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateString())
  const [pendingViewMode, setPendingViewMode] = useState<'date' | 'all'>('date') // 新增：查看模式
  const [loading, setLoading] = useState(false)

  // Tab 1: 待處理記錄 (合併會員 + 非會員)
  const [pendingReports, setPendingReports] = useState<PendingReport[]>([]) // status = 'pending'
  const [nonMemberReports, setNonMemberReports] = useState<PendingReport[]>([]) // status = 'not_applicable'
  
  // 處理扣款
  const [processingReport, setProcessingReport] = useState<PendingReport | null>(null)
  const [processingMember, setProcessingMember] = useState<FullMember | null>(null)
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false)
  
  // 關聯會員
  const [linkingReport, setLinkingReport] = useState<PendingReport | null>(null)
  const [showMemberSearchDialog, setShowMemberSearchDialog] = useState(false)
  
  // Tab 2: 已結案記錄
  const [completedReports, setCompletedReports] = useState<any[]>([])
  const [completedDriverReports, setCompletedDriverReports] = useState<any[]>([])
  const [completedViewMode, setCompletedViewMode] = useState<CompletedViewMode>('booking')
  
  // 會員搜尋
  const [memberSearchTerm, setMemberSearchTerm] = useState('')
  const { 
    filteredMembers,
    handleSearchChange 
  } = useMemberSearch()

  // ============ 資料載入 ============

  // 載入待處理記錄 (會員)
  const loadPendingReports = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('booking_participants')
        .select(`
          *,
          bookings!inner(
            id, start_at, duration_min, contact_name, boat_id,
            boats(name, color)
          ),
          coaches:coach_id(id, name),
          old_participant:replaces_id(*)
        `)
        .eq('status', 'pending')
        .eq('is_deleted', false)

      // 根據查看模式決定是否過濾日期
      if (pendingViewMode === 'date') {
        const startOfDay = `${selectedDate}T00:00:00`
        const endOfDay = `${selectedDate}T23:59:59`
        query = query
          .gte('bookings.start_at', startOfDay)
          .lte('bookings.start_at', endOfDay)
      }

      query = query.order('bookings(start_at)')

      const { data, error } = await query

      if (error) throw error
      setPendingReports(data || [])
    } catch (error) {
      console.error('載入待處理記錄失敗:', error)
    } finally {
      setLoading(false)
    }
  }

  // 載入非會員記錄
  const loadNonMemberReports = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('booking_participants')
        .select(`
          *,
          bookings!inner(
            id, start_at, duration_min, contact_name, boat_id,
            boats(name, color)
          ),
          coaches:coach_id(id, name),
          old_participant:replaces_id(*)
        `)
        .eq('status', 'not_applicable')
        .eq('is_deleted', false)

      // 根據查看模式決定是否過濾日期
      if (pendingViewMode === 'date') {
        const startOfDay = `${selectedDate}T00:00:00`
        const endOfDay = `${selectedDate}T23:59:59`
        query = query
          .gte('bookings.start_at', startOfDay)
          .lte('bookings.start_at', endOfDay)
      }

      query = query.order('bookings(start_at)')

      const { data, error } = await query

      if (error) throw error
      setNonMemberReports(data || [])
    } catch (error) {
      console.error('載入非會員記錄失敗:', error)
    } finally {
      setLoading(false)
    }
  }

  // 載入已結案記錄
  const loadCompletedReports = async () => {
    setLoading(true)
    try {
      const startOfDay = `${selectedDate}T00:00:00`
      const endOfDay = `${selectedDate}T23:59:59`

      // 1. 載入教學記錄 (包含 processed 和 not_applicable)
      const { data: participantsData, error: participantsError } = await supabase
        .from('booking_participants')
        .select(`
          *,
          bookings!inner(
            id, start_at, duration_min, contact_name, boat_id,
            boats(name, color)
          ),
          coaches:coach_id(id, name),
          members(id, name, nickname)
        `)
        .in('status', ['processed', 'not_applicable'])
        .eq('is_deleted', false)
        .gte('bookings.start_at', startOfDay)
        .lte('bookings.start_at', endOfDay)
        .order('bookings(start_at)')

      if (participantsError) throw participantsError

      // 2. 載入駕駛記錄
      const { data: driverData, error: driverError } = await supabase
        .from('coach_reports')
        .select(`
          *,
          bookings!inner(
            id, start_at, duration_min, boat_id,
            boats(name, color)
          ),
          coaches:coach_id(id, name)
        `)
        .gte('bookings.start_at', startOfDay)
        .lte('bookings.start_at', endOfDay)
        .order('bookings(start_at)')

      if (driverError) throw driverError

      setCompletedReports(participantsData || [])
      setCompletedDriverReports(driverData || [])
    } catch (error) {
      console.error('載入已結案記錄失敗:', error)
    } finally {
      setLoading(false)
    }
  }

  // ============ 處理函數 ============

  // 處理會員扣款
  const handleProcessTransaction = async (report: PendingReport) => {
    if (!report.member_id) {
      alert('非會員無法處理扣款')
      return
    }

    try {
      const { data: memberData, error } = await supabase
        .from('members')
        .select('*')
        .eq('id', report.member_id)
        .single()

      if (error) throw error
      if (!memberData) {
        alert('找不到會員資料')
        return
      }

      setProcessingReport(report)
      setProcessingMember(memberData)
      setTransactionDialogOpen(true)
    } catch (error) {
      console.error('載入會員資料失敗:', error)
      alert('載入會員資料失敗')
    }
  }

  // 扣款完成
  const handleTransactionComplete = async () => {
    if (!processingReport) return

    try {
      const { error } = await supabase
        .from('booking_participants')
        .update({ 
          status: 'processed',
          updated_at: new Date().toISOString()
        })
        .eq('id', processingReport.id)

      if (error) throw error

      alert('處理完成！')
      setTransactionDialogOpen(false)
      setProcessingReport(null)
      setProcessingMember(null)
      
      // 重新載入
      if (activeTab === 'pending') {
        await Promise.all([loadPendingReports(), loadNonMemberReports()])
      }
    } catch (error) {
      console.error('更新狀態失敗:', error)
      alert('更新狀態失敗')
    }
  }

  // 關聯會員
  const handleLinkMember = async (report: PendingReport, member: MemberSearchResult) => {
    if (!report) return

    try {
      const { error } = await supabase
        .from('booking_participants')
        .update({
          member_id: member.id,
          participant_name: member.nickname || member.name,
          status: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', report.id)

      if (error) throw error

      alert(`已關聯到會員：${member.nickname || member.name}`)
      setShowMemberSearchDialog(false)
      setLinkingReport(null)
      setMemberSearchTerm('')
      
      // 重新載入
      await Promise.all([loadPendingReports(), loadNonMemberReports()])
    } catch (error) {
      console.error('關聯會員失敗:', error)
      alert('關聯會員失敗')
    }
  }

  // 直接結案非會員
  const handleCloseNonMemberReport = async (report: PendingReport) => {
    if (!report) return

    if (!confirm(`確定要結案「${report.participant_name}」的記錄嗎？\n\n結案後此記錄將不會關聯到任何會員，僅保留時數統計。`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('booking_participants')
        .update({
          status: 'processed',
          updated_at: new Date().toISOString()
        })
        .eq('id', report.id)

      if (error) throw error

      alert('已結案')
      
      // 重新載入
      await loadNonMemberReports()
    } catch (error) {
      console.error('結案失敗:', error)
      alert('結案失敗')
    }
  }

  // ============ Effects ============

  useEffect(() => {
    handleSearchChange(memberSearchTerm)
  }, [memberSearchTerm, handleSearchChange])

  useEffect(() => {
    if (activeTab === 'pending') {
      Promise.all([loadPendingReports(), loadNonMemberReports()])
    } else if (activeTab === 'completed' && selectedDate) {
      loadCompletedReports()
    }
  }, [selectedDate, activeTab, pendingViewMode])

  // ============ 資料處理 ============

  // 按預約分組 (待處理)
  const groupedPendingReports = pendingReports.reduce((acc, report) => {
    const key = `${report.bookings.id}`
    if (!acc[key]) {
      acc[key] = {
        booking: report.bookings,
        reports: []
      }
    }
    acc[key].reports.push(report)
    return acc
  }, {} as Record<string, { booking: any; reports: PendingReport[] }>)

  // 按預約分組 (非會員)
  const groupedNonMemberReports = nonMemberReports.reduce((acc, report) => {
    const key = `${report.bookings.id}`
    if (!acc[key]) {
      acc[key] = {
        booking: report.bookings,
        reports: []
      }
    }
    acc[key].reports.push(report)
    return acc
  }, {} as Record<string, { booking: any; reports: PendingReport[] }>)

  // 按教練統計 (已結案)
  const coachStats = (() => {
    const stats: Record<string, {
      coachId: string
      coachName: string
      teachingMinutes: number
      drivingMinutes: number
      teachingRecords: any[]
      drivingRecords: any[]
    }> = {}
    
    completedReports.forEach((record: any) => {
      const coachId = record.coach_id
      if (!coachId) return
      
      if (!stats[coachId]) {
        stats[coachId] = {
          coachId,
          coachName: record.coaches?.name || '未知教練',
          teachingMinutes: 0,
          drivingMinutes: 0,
          teachingRecords: [],
          drivingRecords: []
        }
      }
      
      stats[coachId].teachingMinutes += record.duration_min || 0
      stats[coachId].teachingRecords.push(record)
    })
    
    completedDriverReports.forEach((record: any) => {
      const coachId = record.coach_id
      if (!coachId) return
      
      if (!stats[coachId]) {
        stats[coachId] = {
          coachId,
          coachName: record.coaches?.name || '未知教練',
          teachingMinutes: 0,
          drivingMinutes: 0,
          teachingRecords: [],
          drivingRecords: []
        }
      }
      
      stats[coachId].drivingMinutes += record.driver_duration_min || 0
      stats[coachId].drivingRecords.push(record)
    })
    
    return Object.values(stats).sort((a, b) => a.coachName.localeCompare(b.coachName))
  })()

  // 按預約統計 (已結案)
  const bookingStats = (() => {
    const stats: Record<number, {
      booking: any
      participants: any[]
      driverReports: any[]
      totalTeachingMinutes: number
      totalDrivingMinutes: number
    }> = {}
    
    completedReports.forEach((record: any) => {
      const bookingId = record.booking_id
      if (!stats[bookingId]) {
        stats[bookingId] = {
          booking: record.bookings,
          participants: [],
          driverReports: [],
          totalTeachingMinutes: 0,
          totalDrivingMinutes: 0
        }
      }
      stats[bookingId].participants.push(record)
      stats[bookingId].totalTeachingMinutes += record.duration_min || 0
    })
    
    completedDriverReports.forEach((record: any) => {
      const bookingId = record.booking_id
      if (!stats[bookingId]) {
        stats[bookingId] = {
          booking: record.bookings,
          participants: [],
          driverReports: [],
          totalTeachingMinutes: 0,
          totalDrivingMinutes: 0
        }
      }
      stats[bookingId].driverReports.push(record)
      stats[bookingId].totalDrivingMinutes += record.driver_duration_min || 0
    })
    
    return Object.values(stats).sort((a, b) => 
      a.booking.start_at.localeCompare(b.booking.start_at)
    )
  })()

  // ============ Render ============

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
      <PageHeader 
        user={user!} 
        title="預約管理後台"
        showBaoLink={true}
        extraLinks={[
          { label: '← 預約回報', link: '/coach-report' }
        ]}
      />
      
      <div style={{ 
        flex: 1,
        maxWidth: '1400px', 
        width: '100%',
        margin: '0 auto',
        padding: isMobile ? '16px' : '32px'
      }}>
        <h1 style={{ 
          fontSize: isMobile ? '24px' : '32px',
          fontWeight: 'bold',
          marginBottom: '24px',
          color: '#333'
        }}>
          教練管理後台
        </h1>

        {/* Tab 切換 */}
        <div style={{ 
          display: 'flex',
          gap: '8px',
          marginBottom: '24px',
          borderBottom: '2px solid #e0e0e0',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => setActiveTab('pending')}
            style={{
              padding: '12px 24px',
              background: activeTab === 'pending' ? '#2196f3' : 'transparent',
              color: activeTab === 'pending' ? 'white' : '#666',
              border: 'none',
              borderBottom: activeTab === 'pending' ? '3px solid #2196f3' : 'none',
              borderRadius: '8px 8px 0 0',
              cursor: 'pointer',
              fontSize: isMobile ? '14px' : '16px',
              fontWeight: '600',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            待處理記錄
            {(pendingReports.length + nonMemberReports.length) > 0 && (
              <span style={{
                background: 'white',
                color: '#2196f3',
                borderRadius: '12px',
                padding: '2px 8px',
                fontSize: '12px',
                fontWeight: 'bold'
              }}>
                {pendingReports.length + nonMemberReports.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            style={{
              padding: '12px 24px',
              background: activeTab === 'completed' ? '#2196f3' : 'transparent',
              color: activeTab === 'completed' ? 'white' : '#666',
              border: 'none',
              borderBottom: activeTab === 'completed' ? '3px solid #2196f3' : 'none',
              borderRadius: '8px 8px 0 0',
              cursor: 'pointer',
              fontSize: isMobile ? '14px' : '16px',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
          >
            已結案記錄
          </button>
        </div>

        {/* Tab 1: 待處理記錄 */}
        {activeTab === 'pending' && (
          <>
            <div style={{
              ...getCardStyle(isMobile),
              marginBottom: '24px'
            }}>
              {/* 查看模式切換 */}
              <div style={{ marginBottom: pendingViewMode === 'date' ? '16px' : 0 }}>
                <label style={{ ...getLabelStyle(isMobile), marginBottom: '8px' }}>查看模式</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setPendingViewMode('date')}
                    style={{
                      flex: isMobile ? 1 : 'none',
                      padding: '10px 20px',
                      background: pendingViewMode === 'date' ? '#2196f3' : '#fff',
                      color: pendingViewMode === 'date' ? 'white' : '#666',
                      border: `2px solid ${pendingViewMode === 'date' ? '#2196f3' : '#e0e0e0'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                      transition: 'all 0.2s'
                    }}
                  >
                    📅 按日期查看
                  </button>
                  <button
                    onClick={() => setPendingViewMode('all')}
                    style={{
                      flex: isMobile ? 1 : 'none',
                      padding: '10px 20px',
                      background: pendingViewMode === 'all' ? '#ff9800' : '#fff',
                      color: pendingViewMode === 'all' ? 'white' : '#666',
                      border: `2px solid ${pendingViewMode === 'all' ? '#ff9800' : '#e0e0e0'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                      transition: 'all 0.2s'
                    }}
                  >
                    📋 查看全部
                  </button>
                </div>
              </div>

              {/* 日期選擇（僅在按日期查看時顯示） */}
              {pendingViewMode === 'date' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <label style={{ ...getLabelStyle(isMobile) }}>
                    日期
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    style={getInputStyle(isMobile)}
                  />
                </div>
              )}
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                載入中...
              </div>
            ) : (
              <>
                {/* 會員待扣款 */}
                {Object.keys(groupedPendingReports).length > 0 && (
                  <>
                    <h2 style={{ 
                      fontSize: isMobile ? '18px' : '20px',
                      fontWeight: '600',
                      marginBottom: '16px',
                      color: '#333'
                    }}>
                      會員待扣款 ({pendingReports.length})
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
                      {Object.values(groupedPendingReports).map(({ booking, reports }) => (
                        <div 
                          key={booking.id}
                          style={{
                            ...getCardStyle(isMobile),
                            borderLeft: '4px solid #2196f3'
                          }}
                        >
                          {/* 預約資訊 */}
                          <div style={{ 
                            marginBottom: '16px', 
                            paddingBottom: '12px', 
                            borderBottom: '1px solid #e0e0e0' 
                          }}>
                            <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '4px' }}>
                              {booking.start_at.substring(11, 16)} | {booking.boats?.name}
                            </div>
                            <div style={{ color: '#666', fontSize: '14px' }}>
                              {booking.contact_name}
                            </div>
                          </div>

                          {/* 參與者列表 */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {reports.map(report => (
                              <div
                                key={report.id}
                                style={{
                                  padding: '12px',
                                  background: '#f8f9fa',
                                  borderRadius: '8px',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  gap: '12px',
                                  flexWrap: isMobile ? 'wrap' : 'nowrap'
                                }}
                              >
                                <div style={{ flex: 1, minWidth: '200px' }}>
                                  <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                                    {report.participant_name}
                                    {report.replaces_id && (
                                      <span style={{
                                        marginLeft: '8px',
                                        padding: '2px 8px',
                                        background: '#ff9800',
                                        color: 'white',
                                        borderRadius: '4px',
                                        fontSize: '12px'
                                      }}>
                                        🔄 修改
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ color: '#666', fontSize: '14px' }}>
                                    {report.duration_min}分 • {PAYMENT_METHODS.find(m => m.value === report.payment_method)?.label}
                                    {report.coaches && ` • ${report.coaches.name}`}
                                  </div>
                                  {report.old_participant && (
                                    <div style={{ color: '#999', fontSize: '12px', marginTop: '4px' }}>
                                      原：{report.old_participant.duration_min}分 • {PAYMENT_METHODS.find(m => m.value === report.old_participant.payment_method)?.label}
                                    </div>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleProcessTransaction(report)}
                                  style={{
                                    ...getButtonStyle('primary'),
                                    padding: '8px 16px',
                                    fontSize: '14px'
                                  }}
                                >
                                  處理扣款
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* 非會員記錄 */}
                {Object.keys(groupedNonMemberReports).length > 0 && (
                  <>
                    <h2 style={{ 
                      fontSize: isMobile ? '18px' : '20px',
                      fontWeight: '600',
                      marginBottom: '16px',
                      color: '#333'
                    }}>
                      非會員記錄 ({nonMemberReports.length})
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {Object.values(groupedNonMemberReports).map(({ booking, reports }) => (
                        <div 
                          key={booking.id}
                          style={{
                            ...getCardStyle(isMobile),
                            borderLeft: '4px solid #ff9800'
                          }}
                        >
                          {/* 預約資訊 */}
                          <div style={{ 
                            marginBottom: '16px', 
                            paddingBottom: '12px', 
                            borderBottom: '1px solid #e0e0e0' 
                          }}>
                            <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '4px' }}>
                              {booking.start_at.substring(11, 16)} | {booking.boats?.name}
                            </div>
                            <div style={{ color: '#666', fontSize: '14px' }}>
                              {booking.contact_name}
                            </div>
                          </div>

                          {/* 參與者列表 */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {reports.map(report => (
                              <div
                                key={report.id}
                                style={{
                                  padding: '12px',
                                  background: '#fff3e0',
                                  borderRadius: '8px',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  gap: '12px',
                                  flexWrap: isMobile ? 'wrap' : 'nowrap'
                                }}
                              >
                                <div style={{ flex: 1, minWidth: '200px' }}>
                                  <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                                    {report.participant_name}
                                    <span style={{
                                      marginLeft: '8px',
                                      padding: '2px 8px',
                                      background: '#ff9800',
                                      color: 'white',
                                      borderRadius: '4px',
                                      fontSize: '12px'
                                    }}>
                                      非會員
                                    </span>
                                  </div>
                                  <div style={{ color: '#666', fontSize: '14px' }}>
                                    {report.duration_min}分 • {PAYMENT_METHODS.find(m => m.value === report.payment_method)?.label}
                                    {report.coaches && ` • ${report.coaches.name}`}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                                  <button
                                    onClick={() => {
                                      setLinkingReport(report)
                                      setShowMemberSearchDialog(true)
                                    }}
                                    style={{
                                      ...getButtonStyle('secondary'),
                                      padding: '8px 16px',
                                      fontSize: '14px'
                                    }}
                                  >
                                    🔗 關聯會員
                                  </button>
                                  <button
                                    onClick={() => handleCloseNonMemberReport(report)}
                                    style={{
                                      ...getButtonStyle('primary'),
                                      padding: '8px 16px',
                                      fontSize: '14px',
                                      background: '#4caf50'
                                    }}
                                  >
                                    ✓ 直接結案
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* 空狀態 */}
                {Object.keys(groupedPendingReports).length === 0 && 
                 Object.keys(groupedNonMemberReports).length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                    沒有待處理記錄
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Tab 2: 已結案記錄 */}
        {activeTab === 'completed' && (
          <>
            <div style={{
              ...getCardStyle(isMobile),
              marginBottom: '24px'
            }}>
              {/* 日期選擇 */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ ...getLabelStyle(isMobile) }}>
                  日期
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  style={getInputStyle(isMobile)}
                />
              </div>
              
              {/* 查看模式切換 */}
              <div>
                <label style={{ ...getLabelStyle(isMobile), marginBottom: '8px' }}>
                  查看模式
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setCompletedViewMode('booking')}
                    style={{
                      flex: isMobile ? 1 : 'none',
                      padding: '10px 20px',
                      background: completedViewMode === 'booking' ? '#2196f3' : '#fff',
                      color: completedViewMode === 'booking' ? 'white' : '#666',
                      border: `2px solid ${completedViewMode === 'booking' ? '#2196f3' : '#e0e0e0'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                      transition: 'all 0.2s'
                    }}
                  >
                    📋 按預約查看
                  </button>
                  <button
                    onClick={() => setCompletedViewMode('coach')}
                    style={{
                      flex: isMobile ? 1 : 'none',
                      padding: '10px 20px',
                      background: completedViewMode === 'coach' ? '#2196f3' : '#fff',
                      color: completedViewMode === 'coach' ? 'white' : '#666',
                      border: `2px solid ${completedViewMode === 'coach' ? '#2196f3' : '#e0e0e0'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                      transition: 'all 0.2s'
                    }}
                  >
                    👤 按教練統計
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                載入中...
              </div>
            ) : (
              <>
                {/* 總計卡片 */}
                {(completedViewMode === 'booking' ? bookingStats.length : coachStats.length) > 0 && (
                  <div style={{
                    ...getCardStyle(isMobile),
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    marginBottom: '24px'
                  }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>📊 當日總計</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
                      <div>
                        <div style={{ fontSize: '14px', opacity: 0.9 }}>總教學時數</div>
                        <div style={{ fontSize: '32px', fontWeight: 'bold', marginTop: '4px' }}>
                          {completedReports.reduce((sum, r) => sum + (r.duration_min || 0), 0)} 分
                        </div>
                        <div style={{ fontSize: '14px', opacity: 0.8, marginTop: '4px' }}>
                          ({(completedReports.reduce((sum, r) => sum + (r.duration_min || 0), 0) / 60).toFixed(1)} 小時)
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', opacity: 0.9 }}>總駕駛時數</div>
                        <div style={{ fontSize: '32px', fontWeight: 'bold', marginTop: '4px' }}>
                          {completedDriverReports.reduce((sum, r) => sum + (r.driver_duration_min || 0), 0)} 分
                        </div>
                        <div style={{ fontSize: '14px', opacity: 0.8, marginTop: '4px' }}>
                          ({(completedDriverReports.reduce((sum, r) => sum + (r.driver_duration_min || 0), 0) / 60).toFixed(1)} 小時)
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 按預約查看 */}
                {completedViewMode === 'booking' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {bookingStats.map(stat => (
                      <div
                        key={stat.booking.id}
                        style={{
                          ...getCardStyle(isMobile),
                          borderLeft: '4px solid #4caf50'
                        }}
                      >
                        {/* 預約資訊 */}
                        <div style={{ 
                          marginBottom: '16px', 
                          paddingBottom: '12px', 
                          borderBottom: '1px solid #e0e0e0',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '8px'
                        }}>
                          <div>
                            <div style={{ fontWeight: '600', fontSize: '18px', marginBottom: '4px' }}>
                              {stat.booking.start_at.substring(11, 16)} | {stat.booking.boats?.name}
                            </div>
                            <div style={{ color: '#666', fontSize: '14px' }}>
                              {stat.booking.contact_name}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '16px', fontSize: '14px' }}>
                            {stat.totalTeachingMinutes > 0 && (
                              <div>
                                <span style={{ color: '#666' }}>教學：</span>
                                <span style={{ fontWeight: '600', color: '#4caf50' }}>
                                  {stat.totalTeachingMinutes}分
                                </span>
                              </div>
                            )}
                            {stat.totalDrivingMinutes > 0 && (
                              <div>
                                <span style={{ color: '#666' }}>駕駛：</span>
                                <span style={{ fontWeight: '600', color: '#2196f3' }}>
                                  {stat.totalDrivingMinutes}分
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 教練回報 */}
                        {stat.participants.length > 0 && (
                          <div style={{ marginBottom: stat.driverReports.length > 0 ? '16px' : 0 }}>
                            <h4 style={{ 
                              margin: '0 0 12px 0', 
                              fontSize: '15px', 
                              color: '#4caf50',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}>
                              🎓 教練回報
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {stat.participants.map((record: any) => (
                                <div
                                  key={record.id}
                                  style={{
                                    padding: '10px',
                                    background: '#f1f8e9',
                                    borderRadius: '6px',
                                    fontSize: '13px'
                                  }}
                                >
                                  <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                                    教練：{record.coaches?.name || '未知'}
                                  </div>
                                  <div style={{ color: '#666' }}>
                                    學員：{record.members?.nickname || record.members?.name || record.participant_name}
                                    {!record.member_id && <span style={{ color: '#ff9800' }}> (非會員)</span>}
                                    {' • '}{record.duration_min}分
                                    {' • '}{PAYMENT_METHODS.find(m => m.value === record.payment_method)?.label}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 駕駛回報 */}
                        {stat.driverReports.length > 0 && (
                          <div>
                            <h4 style={{ 
                              margin: '0 0 12px 0', 
                              fontSize: '15px', 
                              color: '#2196f3',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}>
                              🚤 駕駛回報
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {stat.driverReports.map((record: any) => (
                                <div
                                  key={record.id}
                                  style={{
                                    padding: '10px',
                                    background: '#e3f2fd',
                                    borderRadius: '6px',
                                    fontSize: '13px'
                                  }}
                                >
                                  <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                                    駕駛：{record.coaches?.name || '未知'}
                                  </div>
                                  <div style={{ color: '#666' }}>
                                    駕駛時數：{record.driver_duration_min}分
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {bookingStats.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                        沒有已結案記錄
                      </div>
                    )}
                  </div>
                )}

                {/* 按教練統計 */}
                {completedViewMode === 'coach' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {coachStats.map(stat => (
                      <div
                        key={stat.coachId}
                        style={{
                          ...getCardStyle(isMobile),
                          borderLeft: '4px solid #2196f3'
                        }}
                      >
                        <div style={{ 
                          marginBottom: '16px', 
                          paddingBottom: '12px', 
                          borderBottom: '1px solid #e0e0e0',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '8px'
                        }}>
                          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                            {stat.coachName}
                          </h3>
                          <div style={{ display: 'flex', gap: '16px', fontSize: '14px' }}>
                            <div>
                              <span style={{ color: '#666' }}>教學：</span>
                              <span style={{ fontWeight: '600', color: '#4caf50' }}>
                                {stat.teachingMinutes}分 ({(stat.teachingMinutes / 60).toFixed(1)}h)
                              </span>
                            </div>
                            <div>
                              <span style={{ color: '#666' }}>駕駛：</span>
                              <span style={{ fontWeight: '600', color: '#2196f3' }}>
                                {stat.drivingMinutes}分 ({(stat.drivingMinutes / 60).toFixed(1)}h)
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* 教學記錄 */}
                        {stat.teachingRecords.length > 0 && (
                          <div style={{ marginBottom: '16px' }}>
                            <h4 style={{ 
                              margin: '0 0 12px 0', 
                              fontSize: '15px', 
                              color: '#4caf50',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}>
                              🎓 教學明細
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {stat.teachingRecords.map((record: any) => (
                                <div
                                  key={record.id}
                                  style={{
                                    padding: '10px',
                                    background: '#f1f8e9',
                                    borderRadius: '6px',
                                    fontSize: '13px'
                                  }}
                                >
                                  <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                                    {record.bookings.start_at.substring(11, 16)} | {record.bookings.boats?.name}
                                  </div>
                                  <div style={{ color: '#666' }}>
                                    學員：{record.members?.nickname || record.members?.name || record.participant_name}
                                    {!record.member_id && <span style={{ color: '#ff9800' }}> (非會員)</span>}
                                    {' • '}{record.duration_min}分
                                    {' • '}{PAYMENT_METHODS.find(m => m.value === record.payment_method)?.label}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 駕駛記錄 */}
                        {stat.drivingRecords.length > 0 && (
                          <div>
                            <h4 style={{ 
                              margin: '0 0 12px 0', 
                              fontSize: '15px', 
                              color: '#2196f3',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}>
                              🚤 駕駛明細
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {stat.drivingRecords.map((record: any) => (
                                <div
                                  key={record.id}
                                  style={{
                                    padding: '10px',
                                    background: '#e3f2fd',
                                    borderRadius: '6px',
                                    fontSize: '13px'
                                  }}
                                >
                                  <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                                    {record.bookings.start_at.substring(11, 16)} | {record.bookings.boats?.name}
                                  </div>
                                  <div style={{ color: '#666' }}>
                                    駕駛時數：{record.driver_duration_min}分
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {coachStats.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                        沒有已結案記錄
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      <Footer />

      {/* 關聯會員對話框 */}
      {showMemberSearchDialog && linkingReport && (
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
          padding: '16px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: isMobile ? '24px' : '32px',
            maxWidth: '500px',
            width: '100%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '20px' }}>
              關聯會員
            </h3>
            <div style={{ 
              padding: '12px', 
              background: '#f5f5f5', 
              borderRadius: '8px',
              marginBottom: '16px'
            }}>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
                當前記錄
              </div>
              <div style={{ fontWeight: '600' }}>
                {linkingReport.participant_name}
              </div>
              <div style={{ fontSize: '14px', color: '#666' }}>
                {linkingReport.duration_min}分 • {PAYMENT_METHODS.find(m => m.value === linkingReport.payment_method)?.label}
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ ...getLabelStyle(isMobile), marginBottom: '8px', display: 'block' }}>
                搜尋會員
              </label>
              <input
                type="text"
                placeholder="輸入姓名、暱稱或電話"
                value={memberSearchTerm}
                onChange={(e) => setMemberSearchTerm(e.target.value)}
                style={getInputStyle(isMobile)}
                autoFocus
              />
            </div>
            {memberSearchTerm && (
              <div style={{ 
                maxHeight: '300px', 
                overflow: 'auto',
                border: '1px solid #ddd',
                borderRadius: '8px',
                marginBottom: '16px'
              }}>
                {filteredMembers.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#999' }}>
                    找不到會員
                  </div>
                ) : (
                  filteredMembers.map(member => (
                    <div
                      key={member.id}
                      onClick={() => handleLinkMember(linkingReport, member)}
                      style={{
                        padding: '12px',
                        borderBottom: '1px solid #f0f0f0',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f8f9fa'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ fontWeight: '600' }}>
                        {member.nickname || member.name}
                      </div>
                      {member.nickname && member.name !== member.nickname && (
                        <div style={{ fontSize: '14px', color: '#666' }}>
                          {member.name}
                        </div>
                      )}
                      {member.phone && (
                        <div style={{ fontSize: '14px', color: '#999' }}>
                          {member.phone}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => {
                  setShowMemberSearchDialog(false)
                  setLinkingReport(null)
                  setMemberSearchTerm('')
                }}
                style={{
                  ...getButtonStyle('secondary'),
                  flex: 1
                }}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TransactionDialog */}
      {transactionDialogOpen && processingMember && (
        <TransactionDialog
          open={transactionDialogOpen}
          member={processingMember}
          onClose={() => {
            setTransactionDialogOpen(false)
            setProcessingReport(null)
            setProcessingMember(null)
          }}
          onSuccess={handleTransactionComplete}
        />
      )}
    </div>
  )
}

