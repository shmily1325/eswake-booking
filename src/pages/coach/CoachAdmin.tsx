import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { Footer } from '../../components/Footer'
import { TransactionDialog } from '../../components/TransactionDialog'
import { StatisticsTab } from '../../components/StatisticsTab'
import { useResponsive } from '../../hooks/useResponsive'
import { useMemberSearch } from '../../hooks/useMemberSearch'
import { getButtonStyle, getCardStyle, getInputStyle, getLabelStyle } from '../../styles/designSystem'
import { getLocalDateString, getLocalTimestamp } from '../../utils/date'
import { extractDate, extractTime } from '../../utils/formatters'
import type { Member } from '../../types/booking'

// ============ Types ============

interface MemberSearchResult {
  id: string
  name: string
  nickname: string | null
  phone: string | null
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
  notes?: string | null
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

type TabType = 'pending' | 'completed' | 'statistics'
type CompletedViewMode = 'booking' | 'coach'

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

// ============ Main Component ============

export function CoachAdmin({ user }: { user: User | null }) {
  const { isMobile } = useResponsive()
  
  // Tab 管理
  const [activeTab, setActiveTab] = useState<TabType>('pending')
  const [selectedDate, setSelectedDate] = useState(() => {
    // 默認為今天 (YYYY-MM-DD 格式)
    return getLocalDateString()
  })
  const [pendingViewMode, setPendingViewMode] = useState<'date' | 'all'>('date') // 默認：按日期查看（今天）
  const [loading, setLoading] = useState(false)

  // Tab 1: 待處理記錄 (合併會員 + 非會員)
  const [pendingReports, setPendingReports] = useState<PendingReport[]>([]) // status = 'pending'
  const [nonMemberReports, setNonMemberReports] = useState<PendingReport[]>([]) // status = 'not_applicable'
  
  // 處理扣款
  const [processingReport, setProcessingReport] = useState<PendingReport | null>(null)
  const [processingMember, setProcessingMember] = useState<Member | null>(null)
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
          members:member_id(id, name, nickname),
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
      // 判斷是月份查詢還是日期查詢
      let startOfDay: string
      let endOfDay: string
      
      if (selectedDate.length === 7) {
        // 月份格式 YYYY-MM
        const [year, month] = selectedDate.split('-')
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
        startOfDay = `${selectedDate}-01T00:00:00`
        endOfDay = `${selectedDate}-${String(lastDay).padStart(2, '0')}T23:59:59`
      } else {
        // 日期格式 YYYY-MM-DD
        startOfDay = `${selectedDate}T00:00:00`
        endOfDay = `${selectedDate}T23:59:59`
      }

      // 1. 載入教學記錄 (只載入已結案的 processed)
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
        .eq('status', 'processed')
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
            id, start_at, duration_min, contact_name, boat_id,
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

  // 扣款完成（不標記為已處理，允許繼續扣款）
  const handleTransactionComplete = async () => {
    if (!processingReport) return

    // 關閉對話框，但保持記錄在待處理列表
    setTransactionDialogOpen(false)
    setProcessingReport(null)
    setProcessingMember(null)
    
    // 重新載入（記錄仍會在待處理列表中）
    if (activeTab === 'pending') {
      await Promise.all([loadPendingReports(), loadNonMemberReports()])
    }
  }

  // 完成處理（標記為已處理，從待處理列表移除）
  const handleMarkAsComplete = async (report: PendingReport) => {
    if (!report.member_id) {
      alert('非會員記錄無法標記完成')
      return
    }

    try {
      // 檢查是否有相關交易記錄（在預約當天的交易）
      const bookingDate = report.bookings.start_at.substring(0, 10)
      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('id')
        .eq('member_id', report.member_id)
        .eq('transaction_date', bookingDate)
        .limit(1)

      if (txError) throw txError

      // 如果沒有交易記錄，給予警告
      if (!transactions || transactions.length === 0) {
        if (!confirm(`⚠️ 警告：此記錄尚未進行任何扣款操作！\n\n會員：${report.participant_name}\n日期：${bookingDate}\n\n確定要標記為已完成嗎？`)) {
          return
        }
      }
      // 有交易記錄，直接處理不確認

      const { error } = await supabase
        .from('booking_participants')
        .update({ 
          status: 'processed',
          updated_at: getLocalTimestamp()
        })
        .eq('id', report.id)

      if (error) throw error
      
      // 重新載入
      if (activeTab === 'pending') {
        await Promise.all([loadPendingReports(), loadNonMemberReports()])
      }
    } catch (error) {
      console.error('標記失敗:', error)
      alert('標記失敗')
    }
  }

  // 現金結清（不進入交易帳目）
  const handleCashSettlement = async (report: PendingReport) => {
    try {
      const { error } = await supabase
        .from('booking_participants')
        .update({ 
          status: 'processed',
          notes: report.notes ? `${report.notes} [現金結清]` : '[現金結清]',
          updated_at: getLocalTimestamp()
        })
        .eq('id', report.id)

      if (error) throw error
      
      // 重新載入
      if (activeTab === 'pending') {
        await Promise.all([loadPendingReports(), loadNonMemberReports()])
      }
    } catch (error) {
      console.error('標記失敗:', error)
      alert('標記失敗')
    }
  }

  // 關聯會員
  const handleLinkMember = async (report: PendingReport, member: MemberSearchResult) => {
    if (!report) return

    try {
      console.log('關聯會員 - 更新前:', {
        report_id: report.id,
        current_status: report.status,
        current_member_id: report.member_id,
        new_member_id: member.id,
        new_member_name: member.nickname || member.name,
        original_name: report.participant_name
      })

      // 保留原始非會員名字到備註
      const originalName = report.participant_name
      const notePrefix = `非會員：${originalName}`
      const newNotes = report.notes 
        ? `${notePrefix} ${report.notes}` 
        : notePrefix

      const { data, error } = await supabase
        .from('booking_participants')
        .update({
          member_id: member.id,
          participant_name: member.nickname || member.name,
          status: 'pending',
          notes: newNotes,
          updated_at: getLocalTimestamp()
        })
        .eq('id', report.id)
        .select()

      if (error) {
        console.error('更新失敗 - 錯誤詳情:', error)
        throw error
      }

      console.log('關聯會員 - 更新後:', data)

      // 先關閉對話框
      setShowMemberSearchDialog(false)
      setLinkingReport(null)
      setMemberSearchTerm('')
      
      // 重新載入資料
      await Promise.all([loadPendingReports(), loadNonMemberReports()])
      
      alert(`✅ 已成功關聯到會員：${member.nickname || member.name}\n\n原名「${originalName}」已記錄在備註中\n記錄已移至「會員待扣款」區域，請查看上方列表。`)
    } catch (error) {
      console.error('關聯會員失敗:', error)
      alert(`❌ 關聯會員失敗：${error instanceof Error ? error.message : '未知錯誤'}`)
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
          updated_at: getLocalTimestamp()
        })
        .eq('id', report.id)

      if (error) throw error

      // 重新載入資料
      await loadNonMemberReports()
      
      alert(`✅ 已成功結案：${report.participant_name}\n\n記錄已移至「已結案記錄」頁籤。`)
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
        title="💼 回報管理"
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
          💼 回報管理
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
            📋 待處理
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
            ✅ 已處理
          </button>
          <button
            onClick={() => setActiveTab('statistics')}
            style={{
              padding: '12px 24px',
              background: activeTab === 'statistics' ? '#2196f3' : 'transparent',
              color: activeTab === 'statistics' ? 'white' : '#666',
              border: 'none',
              borderBottom: activeTab === 'statistics' ? '3px solid #2196f3' : 'none',
              borderRadius: '8px 8px 0 0',
              cursor: 'pointer',
              fontSize: isMobile ? '14px' : '16px',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
          >
            📊 統計報表
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
              <div style={{ marginBottom: '16px' }}>
                <label style={{ ...getLabelStyle(isMobile), marginBottom: '8px' }}>查看模式</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => {
                      setPendingViewMode('date')
                      setSelectedDate(getLocalDateString())
                    }}
                    style={{
                      flex: isMobile ? 1 : 'none',
                      padding: '10px 20px',
                      background: pendingViewMode === 'date' ? '#4caf50' : '#e8f5e9',
                      color: pendingViewMode === 'date' ? '#fff' : '#2e7d32',
                      border: `2px solid ${pendingViewMode === 'date' ? '#4caf50' : '#81c784'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                      transition: 'all 0.2s',
                      boxShadow: pendingViewMode === 'date' ? '0 2px 8px rgba(76,175,80,0.3)' : 'none'
                    }}
                  >
                    🗓️ 今天
                  </button>
                  <button
                    onClick={() => setPendingViewMode('all')}
                    style={{
                      flex: isMobile ? 1 : 'none',
                      padding: '10px 20px',
                      background: pendingViewMode === 'all' ? '#ff9800' : '#fff3e0',
                      color: pendingViewMode === 'all' ? '#fff' : '#e65100',
                      border: `2px solid ${pendingViewMode === 'all' ? '#ff9800' : '#ffb74d'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                      transition: 'all 0.2s',
                      boxShadow: pendingViewMode === 'all' ? '0 2px 8px rgba(255,152,0,0.3)' : 'none'
                    }}
                  >
                    📋 查看全部
                  </button>
                </div>
              </div>

              {/* 日期選擇（僅在按日期查看時顯示） */}
              {pendingViewMode === 'date' && (
                <div>
                  <label style={{ ...getLabelStyle(isMobile), marginBottom: '8px' }}>
                    選擇日期
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    style={{
                      ...getInputStyle(isMobile),
                      fontSize: '15px',
                      fontWeight: '500'
                    }}
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
                              {extractDate(booking.start_at)} {extractTime(booking.start_at)} | {booking.boats?.name} ({booking.duration_min}分)
                            </div>
                            <div style={{ color: '#666', fontSize: '14px' }}>
                              預約人：{booking.contact_name}
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
                                    {/* 顯示原始非會員名字（從 notes 提取） */}
                                    {report.notes && report.notes.includes('非會員：') && (() => {
                                      const match = report.notes.match(/非會員：([^\s]+)/)
                                      if (match && match[1]) {
                                        return (
                                          <span style={{ 
                                            marginLeft: '8px',
                                            color: '#ff9800',
                                            fontSize: '14px',
                                            fontWeight: 'normal'
                                          }}>
                                            (非會員：{match[1]})
                                          </span>
                                        )
                                      }
                                      return null
                                    })()}
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
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                  <button
                                    onClick={() => handleProcessTransaction(report)}
                                    style={{
                                      ...getButtonStyle('primary'),
                                      padding: '8px 16px',
                                      fontSize: '14px'
                                    }}
                                  >
                                    💳 處理扣款
                                  </button>
                                  <button
                                    onClick={() => handleCashSettlement(report)}
                                    style={{
                                      padding: '8px 16px',
                                      fontSize: '14px',
                                      backgroundColor: '#28a745',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      fontWeight: '500',
                                      transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = '#218838'
                                      e.currentTarget.style.transform = 'translateY(-1px)'
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = '#28a745'
                                      e.currentTarget.style.transform = 'translateY(0)'
                                    }}
                                  >
                                    💵 現金結清
                                  </button>
                                  <button
                                    onClick={() => handleMarkAsComplete(report)}
                                    style={{
                                      padding: '8px 16px',
                                      fontSize: '14px',
                                      backgroundColor: '#17a2b8',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      fontWeight: '500',
                                      transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = '#138496'
                                      e.currentTarget.style.transform = 'translateY(-1px)'
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = '#17a2b8'
                                      e.currentTarget.style.transform = 'translateY(0)'
                                    }}
                                  >
                                    ✅ 完成處理
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
                              {extractDate(booking.start_at)} {extractTime(booking.start_at)} | {booking.boats?.name} ({booking.duration_min}分)
                            </div>
                            <div style={{ color: '#666', fontSize: '14px' }}>
                              預約人：{booking.contact_name}
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
              {/* 月份選擇 */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ ...getLabelStyle(isMobile), marginBottom: '8px' }}>
                  查詢期間
                </label>
                
                {/* 快捷按鈕 */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setSelectedDate(getLocalDateString())}
                    style={{
                      flex: isMobile ? 1 : 'none',
                      padding: '10px 20px',
                      background: selectedDate.length === 10 && selectedDate === getLocalDateString() 
                        ? '#4caf50' 
                        : '#e8f5e9',
                      color: selectedDate.length === 10 && selectedDate === getLocalDateString() 
                        ? '#fff' 
                        : '#2e7d32',
                      border: `2px solid ${selectedDate.length === 10 && selectedDate === getLocalDateString() 
                        ? '#4caf50' 
                        : '#81c784'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                      transition: 'all 0.2s',
                      boxShadow: selectedDate.length === 10 && selectedDate === getLocalDateString() 
                        ? '0 2px 8px rgba(76,175,80,0.3)' 
                        : 'none'
                    }}
                  >
                    🗓️ 今天
                  </button>
                  <button
                    onClick={() => {
                      const today = new Date()
                      const year = today.getFullYear()
                      const month = String(today.getMonth() + 1).padStart(2, '0')
                      setSelectedDate(`${year}-${month}`)
                    }}
                    style={{
                      flex: isMobile ? 1 : 'none',
                      padding: '10px 20px',
                      background: selectedDate.length === 7 ? '#2196f3' : '#e3f2fd',
                      color: selectedDate.length === 7 ? '#fff' : '#1976d2',
                      border: `2px solid ${selectedDate.length === 7 ? '#2196f3' : '#90caf9'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                      transition: 'all 0.2s'
                    }}
                  >
                    📅 本月
                  </button>
                </div>

                {/* 日期選擇器 */}
                <div style={{ marginTop: '12px' }}>
                  <label style={{ ...getLabelStyle(isMobile), marginBottom: '8px' }}>
                    或選擇其他日期
                  </label>
                  <input
                    type="date"
                    value={selectedDate.length === 10 ? selectedDate : ''}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    style={{
                      ...getInputStyle(isMobile),
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                  />
                </div>
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
                      transition: 'all 0.2s',
                      boxShadow: completedViewMode === 'booking' ? '0 2px 8px rgba(33,150,243,0.3)' : 'none'
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
                      transition: 'all 0.2s',
                      boxShadow: completedViewMode === 'coach' ? '0 2px 8px rgba(33,150,243,0.3)' : 'none'
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
                    padding: '16px',
                    background: '#f8f9fa',
                    borderRadius: '8px',
                    marginBottom: '24px'
                  }}>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#666' }}>
                      📊 {selectedDate.length === 10 ? '當日總計' : '當月總計'}
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
                      <div>
                        <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>總教學時數</div>
                        <div style={{ fontSize: isMobile ? '24px' : '28px', fontWeight: 'bold', color: '#333' }}>
                          {completedReports.reduce((sum, r) => sum + (r.duration_min || 0), 0)} 分
                        </div>
                        <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>
                          ({(completedReports.reduce((sum, r) => sum + (r.duration_min || 0), 0) / 60).toFixed(1)} 小時)
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>總駕駛時數</div>
                        <div style={{ fontSize: isMobile ? '24px' : '28px', fontWeight: 'bold', color: '#333' }}>
                          {completedDriverReports.reduce((sum, r) => sum + (r.driver_duration_min || 0), 0)} 分
                        </div>
                        <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>
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
                              {extractDate(stat.booking.start_at)} {extractTime(stat.booking.start_at)} | {stat.booking.boats?.name}
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
                                    {' • '}{LESSON_TYPES.find(lt => lt.value === record.lesson_type)?.label || '不指定'}
                                    {' • '}{PAYMENT_METHODS.find(m => m.value === record.payment_method)?.label}
                                  </div>
                                  {record.notes && (
                                    <div style={{ 
                                      color: record.notes.includes('[現金結清]') ? '#28a745' : '#999', 
                                      fontSize: '12px',
                                      marginTop: '4px',
                                      fontWeight: record.notes.includes('[現金結清]') ? '600' : 'normal'
                                    }}>
                                      💵 {record.notes}
                                    </div>
                                  )}
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
                              margin: '0 0 8px 0', 
                              fontSize: '14px', 
                              color: '#4caf50',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}>
                              🎓 教學明細 ({stat.teachingRecords.length}筆)
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {stat.teachingRecords.map((record: any) => (
                                <div
                                  key={record.id}
                                  style={{
                                    padding: '8px 10px',
                                    background: '#f8f9fa',
                                    borderRadius: '4px',
                                    fontSize: '13px',
                                    lineHeight: '1.5',
                                    color: '#333'
                                  }}
                                >
                                  <span style={{ fontWeight: '600', color: '#333' }}>
                                    {extractDate(record.bookings.start_at)} {extractTime(record.bookings.start_at)} {record.bookings.boats?.name}
                                  </span>
                                  <span style={{ fontWeight: 'normal', color: '#666' }}> • {record.members?.nickname || record.members?.name || record.participant_name}</span>
                                  {!record.member_id && <span style={{ color: '#ff9800', fontWeight: 'normal' }}> (非會員)</span>}
                                  <span style={{ fontWeight: 'normal', color: '#666' }}> {record.duration_min}分</span>
                                  <span style={{ color: '#999', fontSize: '12px', fontWeight: 'normal' }}> • {LESSON_TYPES.find(lt => lt.value === record.lesson_type)?.label || '不指定'}</span>
                                  <span style={{ color: '#999', fontSize: '12px', fontWeight: 'normal' }}> • {PAYMENT_METHODS.find(m => m.value === record.payment_method)?.label}</span>
                                  {record.notes && (
                                    <span style={{ 
                                      color: record.notes.includes('現金結清') ? '#28a745' : '#999',
                                      fontSize: '12px',
                                      marginLeft: '6px',
                                      fontWeight: record.notes.includes('現金結清') ? '600' : 'normal'
                                    }}>
                                      ({record.notes})
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 駕駛記錄 */}
                        {stat.drivingRecords.length > 0 && (
                          <div>
                            <h4 style={{ 
                              margin: '0 0 8px 0', 
                              fontSize: '14px', 
                              color: '#2196f3',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}>
                              🚤 駕駛明細 ({stat.drivingRecords.length}筆)
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {stat.drivingRecords.map((record: any) => (
                                <div
                                  key={record.id}
                                  style={{
                                    padding: '8px 10px',
                                    background: '#f8f9fa',
                                    borderRadius: '4px',
                                    fontSize: '13px',
                                    lineHeight: '1.5',
                                    color: '#333'
                                  }}
                                >
                                  <span style={{ fontWeight: '600', color: '#333' }}>
                                    {extractDate(record.bookings.start_at)} {extractTime(record.bookings.start_at)} {record.bookings.boats?.name}
                                  </span>
                                  <span style={{ fontWeight: 'normal', color: '#666' }}> • {record.driver_duration_min}分</span>
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

        {/* Tab 3: 統計報表 */}
        {activeTab === 'statistics' && (
          <StatisticsTab isMobile={isMobile} />
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
      {transactionDialogOpen && processingMember && processingReport && (
        <TransactionDialog
          open={transactionDialogOpen}
          member={processingMember}
          onClose={() => {
            setTransactionDialogOpen(false)
            setProcessingReport(null)
            setProcessingMember(null)
          }}
          onSuccess={handleTransactionComplete}
          defaultDescription={
            processingReport.notes 
              ? `${processingReport.bookings?.boats?.name} ${processingReport.duration_min}分 ${processingReport.coaches?.name}教練 (${processingReport.notes})`
              : `${processingReport.bookings?.boats?.name} ${processingReport.duration_min}分 ${processingReport.coaches?.name}教練`
          }
          defaultTransactionDate={processingReport.bookings?.start_at?.substring(0, 10)}
        />
      )}
    </div>
  )
}

