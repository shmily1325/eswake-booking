import { useState, useEffect } from 'react'
import { useAuthUser } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { Footer } from '../../components/Footer'
import { StatisticsTab } from '../../components/StatisticsTab'
import { PendingDeductionItem } from '../../components/PendingDeductionItem'
import { DeductionDetails } from '../../components/DeductionDetails'
import { ExportReportButton } from '../../components/ExportReportButton'
import { DateRangePicker } from '../../components/DateRangePicker'
import { useResponsive } from '../../hooks/useResponsive'
import { useMemberSearch } from '../../hooks/useMemberSearch'
import { getButtonStyle, getCardStyle, getInputStyle, getLabelStyle } from '../../styles/designSystem'
import { getLocalDateString, getLocalTimestamp } from '../../utils/date'
import { extractDate, extractTime } from '../../utils/formatters'
import { useToast } from '../../components/ui'

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
  coach_id: string | null
  member_id: string | null
  participant_name: string
  duration_min: number
  payment_method: string
  lesson_type?: string | null
  status: string | null
  replaces_id: number | null
  notes?: string | null
  bookings: {
    id: number
    start_at: string
    duration_min: number
    contact_name: string
    boat_id: number
    boats: { id: number; name: string; color: string } | null
  }
  coaches: { id: string; name: string } | null
  old_participant?: any
}

type TabType = 'pending' | 'completed' | 'statistics' | 'billing'

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

export function CoachAdmin() {
  const user = useAuthUser()
  const { isMobile } = useResponsive()
  const toast = useToast()
  
  // Tab 管理
  const [activeTab, setActiveTab] = useState<TabType>('pending')
  const [selectedDate, setSelectedDate] = useState(() => {
    // 默認為今天 (YYYY-MM-DD 格式)
    return getLocalDateString()
  })
  const [pendingViewMode, setPendingViewMode] = useState<'date' | 'all'>('all') // 默認：查看全部
  const [loading, setLoading] = useState(false)
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null) // 最後刷新時間

  // Tab 1: 待處理記錄 (合併會員 + 非會員)
  const [pendingReports, setPendingReports] = useState<PendingReport[]>([]) // status = 'pending'
  const [nonMemberReports, setNonMemberReports] = useState<PendingReport[]>([]) // status = 'not_applicable'
  
  // 關聯會員
  const [linkingReport, setLinkingReport] = useState<PendingReport | null>(null)
  const [showMemberSearchDialog, setShowMemberSearchDialog] = useState(false)
  
  // 追蹤正在展開編輯的項目（用於暫停自動刷新）
  const [expandedReportIds, setExpandedReportIds] = useState<Set<number>>(new Set())
  
  // Tab 2: 已結案記錄
  const [completedReports, setCompletedReports] = useState<any[]>([])
  const [completedDriverReports, setCompletedDriverReports] = useState<any[]>([])
  
  // Email 到名字的映射（用於顯示提交者）
  const [emailToNameMap, setEmailToNameMap] = useState<Record<string, string>>({})
  
  // Tab 4: 代扣設定
  const [billingRelations, setBillingRelations] = useState<Array<{
    id: number
    participant_name: string
    billing_member_id: string
    billing_member_name: string
    billing_member_nickname: string | null
    notes: string | null
    created_at: string
  }>>([])
  const [newParticipantName, setNewParticipantName] = useState('')
  const [newBillingMemberId, setNewBillingMemberId] = useState('')
  const [newBillingMemberName, setNewBillingMemberName] = useState('')
  const [newBillingNotes, setNewBillingNotes] = useState('')
  const [showBillingMemberSearch, setShowBillingMemberSearch] = useState(false)
  const [addingBillingRelation, setAddingBillingRelation] = useState(false)
  
  // 會員搜尋（關聯會員 & 代扣設定共用）
  const [memberSearchTerm, setMemberSearchTerm] = useState('')
  const { 
    filteredMembers,
    handleSearchChange,
  } = useMemberSearch()
  
  // 非會員的代扣關係映射（participant_name -> member info）
  const [nonMemberBillingMap, setNonMemberBillingMap] = useState<Record<string, {
    memberId: string
    memberName: string
    memberNickname: string | null
  }>>({})

  // ============ 資料載入 ============

  // 載入 email 到名字的映射
  const loadEmailToNameMap = async () => {
    try {
      const { data, error } = await supabase
        .from('coaches')
        .select('name, user_email')
        .not('user_email', 'is', null)
      
      if (error) throw error
      
      const map: Record<string, string> = {}
      data?.forEach(coach => {
        if (coach.user_email) {
          map[coach.user_email] = coach.name
        }
      })
      setEmailToNameMap(map)
    } catch (error) {
      console.error('載入 email 映射失敗:', error)
    }
  }

  // 載入代扣關係
  const loadBillingRelations = async () => {
    try {
      const { data, error } = await supabase
        .from('billing_relations')
        .select(`
          id,
          participant_name,
          billing_member_id,
          notes,
          created_at,
          members:billing_member_id(name, nickname)
        `)
        .order('participant_name', { ascending: true })
      
      if (error) throw error
      
      const relations = (data || []).map((r: any) => ({
        id: r.id,
        participant_name: r.participant_name,
        billing_member_id: r.billing_member_id,
        billing_member_name: r.members?.name || '未知',
        billing_member_nickname: r.members?.nickname || null,
        notes: r.notes,
        created_at: r.created_at
      }))
      
      setBillingRelations(relations)
    } catch (error) {
      console.error('載入代扣關係失敗:', error)
    }
  }

  // 新增代扣關係
  const addBillingRelation = async () => {
    if (!newParticipantName.trim()) {
      toast.warning('請輸入參與者名稱')
      return
    }
    if (!newBillingMemberId) {
      toast.warning('請選擇代扣會員')
      return
    }

    setAddingBillingRelation(true)
    try {
      const { error } = await supabase
        .from('billing_relations')
        .insert({
          participant_name: newParticipantName.trim(),
          billing_member_id: newBillingMemberId,
          notes: newBillingNotes.trim() || null
        })
      
      if (error) {
        if (error.code === '23505') {
          toast.error(`「${newParticipantName}」已有代扣設定`)
        } else {
          throw error
        }
        return
      }
      
      toast.success(`已新增代扣關係：${newParticipantName} → ${newBillingMemberName}`)
      setNewParticipantName('')
      setNewBillingMemberId('')
      setNewBillingMemberName('')
      setNewBillingNotes('')
      loadBillingRelations()
    } catch (error) {
      console.error('新增代扣關係失敗:', error)
      toast.error('新增失敗')
    } finally {
      setAddingBillingRelation(false)
    }
  }

  // 刪除代扣關係
  const deleteBillingRelation = async (id: number, participantName: string) => {
    const confirmed = window.confirm(`確定要刪除「${participantName}」的代扣設定嗎？`)
    if (!confirmed) return

    try {
      const { error } = await supabase
        .from('billing_relations')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      toast.success(`已刪除「${participantName}」的代扣設定`)
      loadBillingRelations()
    } catch (error) {
      console.error('刪除代扣關係失敗:', error)
      toast.error('刪除失敗')
    }
  }

  // 根據 email 取得顯示名稱
  const getSubmitterName = (email: string | null | undefined): string | null => {
    if (!email) return null
    return emailToNameMap[email] || email.split('@')[0]
  }

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
            boats(id, name, color)
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
            boats(id, name, color)
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
      
      // 載入這些非會員的代扣關係
      if (data && data.length > 0) {
        const participantNames = data.map((r: any) => r.participant_name)
        loadNonMemberBillingRelations(participantNames)
      } else {
        setNonMemberBillingMap({})
      }
    } catch (error) {
      console.error('載入非會員記錄失敗:', error)
    } finally {
      setLoading(false)
    }
  }

  // 載入非會員的代扣關係
  const loadNonMemberBillingRelations = async (participantNames: string[]) => {
    try {
      const { data, error } = await supabase
        .from('billing_relations')
        .select(`
          participant_name,
          billing_member_id,
          members:billing_member_id(id, name, nickname)
        `)
        .in('participant_name', participantNames)
      
      if (error) throw error
      
      const map: Record<string, { memberId: string; memberName: string; memberNickname: string | null }> = {}
      data?.forEach((relation: any) => {
        if (relation.members) {
          map[relation.participant_name] = {
            memberId: relation.billing_member_id,
            memberName: relation.members.name,
            memberNickname: relation.members.nickname
          }
        }
      })
      setNonMemberBillingMap(map)
    } catch (error) {
      console.error('載入非會員代扣關係失敗:', error)
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
      // 不過濾 is_teaching，讓駕駛回報的「不指定」參與者也能顯示
      const { data: participantsData, error: participantsError } = await supabase
        .from('booking_participants')
        .select(`
          *,
          bookings!inner(
            id, start_at, duration_min, contact_name, boat_id,
            boats(name, color),
            booking_coaches(coach_id)
          ),
          coaches:coach_id(id, name),
          members:member_id(id, name, nickname)
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

      // 3. 載入交易記錄（用於顯示扣款詳情）
      if (participantsData && participantsData.length > 0) {
        const participantIds = participantsData.map(p => p.id)
        const { data: transactionsData, error: transactionsError } = await supabase
          .from('transactions')
          .select('*')
          .in('booking_participant_id', participantIds)
          .eq('transaction_type', 'consume')


        if (!transactionsError && transactionsData) {
          // 將交易記錄附加到對應的參與者記錄上
          const participantsWithTransactions = participantsData.map(participant => ({
            ...participant,
            transactions: transactionsData.filter(t => t.booking_participant_id === participant.id)
          }))
          
          setCompletedReports(participantsWithTransactions)
        } else {
          setCompletedReports(participantsData || [])
        }
      } else {
        setCompletedReports([])
      }

      // 過濾掉 driver_duration_min 為 null 的記錄（純教練的追蹤記錄）
      const actualDriverReports = (driverData || []).filter((r: any) => r.driver_duration_min !== null)
      setCompletedDriverReports(actualDriverReports)
    } catch (error) {
      console.error('載入已結案記錄失敗:', error)
    } finally {
      setLoading(false)
    }
  }

  // ============ 處理函數 ============

  // 舊版扣款函數已移除，功能已整合到 PendingDeductionItem 組件中

  // 關聯會員
  const handleLinkMember = async (report: PendingReport, member: MemberSearchResult) => {
    if (!report) return
    
    // 驗證用戶登入狀態
    if (!user?.email) {
      toast.error('連線逾時，請重新整理頁面後再試')
      return
    }

    // 防止重複點擊
    if (loading) return
    setLoading(true)

    try {

      // 保留原始名字到備註
      const originalName = report.participant_name
      const newNotes = report.notes 
        ? `${originalName} ${report.notes}` 
        : originalName

      const { error } = await supabase
        .from('booking_participants')
        .update({
          member_id: member.id,
          participant_name: member.nickname || member.name,
          status: 'pending',
          notes: newNotes,
          updated_at: getLocalTimestamp(),
          updated_by_email: user?.email || null
        })
        .eq('id', report.id)
        .select()

      if (error) {
        console.error('更新失敗 - 錯誤詳情:', error)
        throw error
      }

      // 先關閉對話框
      setShowMemberSearchDialog(false)
      setLinkingReport(null)
      setMemberSearchTerm('')
      
      // 重新載入資料
      await Promise.all([loadPendingReports(), loadNonMemberReports()])
      
      toast.success(`已成功關聯到會員：${member.nickname || member.name}\n\n原名「${originalName}」已記錄在備註中\n記錄已移至「會員待扣款」區域，請查看上方列表。`)
    } catch (error) {
      console.error('關聯會員失敗:', error)
      toast.error(`關聯會員失敗：${error instanceof Error ? error.message : '未知錯誤'}`)
      setLoading(false)
    }
  }

  // 直接結案非會員
  const handleCloseNonMemberReport = async (report: PendingReport) => {
    if (!report) return
    
    // 驗證用戶登入狀態
    if (!user?.email) {
      toast.error('連線逾時，請重新整理頁面後再試')
      return
    }

    if (!confirm(`確定要結案「${report.participant_name}」的記錄嗎？\n\n結案後此記錄將不會關聯到任何會員，僅保留時數統計。`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('booking_participants')
        .update({
          status: 'processed',
          updated_at: getLocalTimestamp(),
          updated_by_email: user?.email || null
        })
        .eq('id', report.id)

      if (error) throw error

      // 重新載入資料
      await loadNonMemberReports()
      
      toast.success(`已成功結案：${report.participant_name}\n\n記錄已移至「已結案記錄」頁籤。`)
    } catch (error) {
      console.error('結案失敗:', error)
      toast.error('結案失敗')
    }
  }

  // ============ Effects ============

  // 載入 email 到名字的映射
  useEffect(() => {
    loadEmailToNameMap()
  }, [])

  // 載入代扣關係（切換到代扣設定 Tab 時）
  useEffect(() => {
    if (activeTab === 'billing') {
      loadBillingRelations()
    }
  }, [activeTab])

  useEffect(() => {
    handleSearchChange(memberSearchTerm)
  }, [memberSearchTerm, handleSearchChange])

  useEffect(() => {
    if (activeTab === 'pending') {
      Promise.all([loadPendingReports(), loadNonMemberReports()]).then(() => {
        setLastRefreshTime(new Date())
      })
    } else if (activeTab === 'completed' && selectedDate) {
      loadCompletedReports().then(() => {
        setLastRefreshTime(new Date())
      })
    }
  }, [selectedDate, activeTab, pendingViewMode])

  // 自動刷新：每 30 秒重新載入列表（只在待處理 tab 且沒開對話框且沒有正在編輯的項目時）
  useEffect(() => {
    const interval = setInterval(() => {
      // 如果有項目正在展開編輯，暫停自動刷新避免資料丟失
      const hasExpandedItems = expandedReportIds.size > 0
      if (activeTab === 'pending' && !showMemberSearchDialog && !hasExpandedItems) {
        Promise.all([loadPendingReports(), loadNonMemberReports()]).then(() => {
          setLastRefreshTime(new Date())
        })
      }
    }, 30000) // 30秒
    
    return () => clearInterval(interval)
  }, [activeTab, showMemberSearchDialog, expandedReportIds, selectedDate, pendingViewMode])

  // ============ 資料處理 ============

  // 按預約分組 (待處理)
  const groupedPendingReports = (pendingReports || []).reduce((acc, report) => {
    const key = `${report.bookings?.id || 'unknown'}`
    if (!acc[key]) {
      acc[key] = {
        booking: report.bookings || {},
        reports: []
      }
    }
    acc[key].reports.push(report)
    return acc
  }, {} as Record<string, { booking: any; reports: PendingReport[] }>)

  // 按預約分組 (非會員)
  const groupedNonMemberReports = (nonMemberReports || []).reduce((acc, report) => {
    const key = `${report.bookings?.id || 'unknown'}`
    if (!acc[key]) {
      acc[key] = {
        booking: report.bookings || {},
        reports: []
      }
    }
    acc[key].reports.push(report)
    return acc
  }, {} as Record<string, { booking: any; reports: PendingReport[] }>)

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
      // 只有 is_teaching = true 的記錄才計入教學時數
      if (record.is_teaching) {
        stats[bookingId].totalTeachingMinutes += record.duration_min || 0
      }
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
      <div style={{ 
        flex: 1,
        maxWidth: '1400px', 
        width: '100%',
        margin: '0 auto',
        padding: isMobile ? '16px' : '32px',
        overflow: 'hidden'
      }}>
        <PageHeader 
          user={user!} 
          title="💼 回報管理"
          showBaoLink={true}
          extraLinks={[
            { label: '← 預約回報', link: '/coach-report' }
          ]}
        />
        {/* 最後更新時間 */}
        {lastRefreshTime && (
          <div style={{
            fontSize: '12px',
            color: '#888',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            marginBottom: '16px'
          }}>
            🔄 已更新 {lastRefreshTime.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        )}

        {/* Tab 切換 */}
        <div style={{ 
          display: 'flex',
          gap: '8px',
          marginBottom: '24px',
          borderBottom: '2px solid #e0e0e0',
          flexWrap: 'wrap'
        }}>
          <button
            data-track="coach_admin_tab_pending"
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
            data-track="coach_admin_tab_completed"
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
            data-track="coach_admin_tab_statistics"
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
          <button
            data-track="coach_admin_tab_billing"
            onClick={() => setActiveTab('billing')}
            style={{
              padding: '12px 24px',
              background: activeTab === 'billing' ? '#2196f3' : 'transparent',
              color: activeTab === 'billing' ? 'white' : '#666',
              border: 'none',
              borderBottom: activeTab === 'billing' ? '3px solid #2196f3' : 'none',
              borderRadius: '8px 8px 0 0',
              cursor: 'pointer',
              fontSize: isMobile ? '14px' : '16px',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
          >
            🔄 代扣設定
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
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {/* 全部待處理按鈕 */}
                <button
                  onClick={() => setPendingViewMode('all')}
                  style={{
                    padding: '10px 20px',
                    background: pendingViewMode === 'all' ? '#f57c00' : '#fff3e0',
                    color: pendingViewMode === 'all' ? 'white' : '#e65100',
                    border: `2px solid ${pendingViewMode === 'all' ? '#f57c00' : '#ffcc80'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'all 0.2s'
                  }}
                >
                  ⚠️ 全部待處理
                </button>

                {/* 日期按鈕 */}
                {[
                  { label: '今天', offset: 0 },
                  { label: '昨天', offset: -1 },
                  { label: '前天', offset: -2 }
                ].map(({ label, offset }) => {
                  const targetDate = new Date()
                  targetDate.setDate(targetDate.getDate() + offset)
                  const targetDateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`
                  const isSelected = pendingViewMode === 'date' && selectedDate === targetDateStr
                  
                  return (
                    <button
                      key={offset}
                      onClick={() => {
                        setPendingViewMode('date')
                        setSelectedDate(targetDateStr)
                      }}
                      style={{
                        padding: '10px 20px',
                        background: isSelected ? '#2196f3' : '#e3f2fd',
                        color: isSelected ? 'white' : '#1976d2',
                        border: `2px solid ${isSelected ? '#2196f3' : '#90caf9'}`,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '600',
                        transition: 'all 0.2s'
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                載入中...
              </div>
            ) : (
              <>
                {/* 會員待扣款 - 新版展開式介面 */}
                {pendingReports.length > 0 && (
                  <>
                    <h2 style={{ 
                      fontSize: isMobile ? '18px' : '20px',
                      fontWeight: '600',
                      marginBottom: '16px',
                      color: '#333'
                    }}>
                      待處理扣款 ({pendingReports.length})
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
                      {pendingReports.map(report => (
                        <PendingDeductionItem
                          key={report.id}
                          report={report}
                          onComplete={() => {
                            // 完成後清除展開狀態
                            setExpandedReportIds(prev => {
                              const next = new Set(prev)
                              next.delete(report.id)
                              return next
                            })
                            loadPendingReports()
                            loadNonMemberReports()
                          }}
                          submitterInfo={{
                            createdBy: getSubmitterName((report as any).created_by_email),
                            updatedBy: getSubmitterName((report as any).updated_by_email)
                          }}
                          onExpandChange={(reportId, isExpanded) => {
                            setExpandedReportIds(prev => {
                              const next = new Set(prev)
                              if (isExpanded) {
                                next.add(reportId)
                              } else {
                                next.delete(reportId)
                              }
                              return next
                            })
                          }}
                        />
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
                            <div style={{ fontWeight: '600', fontSize: '15px', marginBottom: '4px' }}>
                              {extractDate(booking.start_at)} {extractTime(booking.start_at)} | {booking.boats?.name} ({booking.duration_min}分)
                            </div>
                            <div style={{ color: '#666', fontSize: '13px' }}>
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
                                  <div style={{ fontWeight: '600', fontSize: '15px', marginBottom: '4px' }}>
                                    {report.participant_name}
                                    <span style={{
                                      marginLeft: '8px',
                                      padding: '2px 8px',
                                      background: '#ff9800',
                                      color: 'white',
                                      borderRadius: '4px',
                                      fontSize: '11px'
                                    }}>
                                      非會員
                                    </span>
                                  </div>
                                  <div style={{ color: '#666', fontSize: '13px' }}>
                                    {report.duration_min}分 • {PAYMENT_METHODS.find(m => m.value === report.payment_method)?.label} • {LESSON_TYPES.find(lt => lt.value === report.lesson_type)?.label || '不指定'}
                                    {report.coaches && ` • ${report.coaches.name}`}
                                  </div>
                                  {/* 提交者資訊 */}
                                  {(() => {
                                    const createdBy = getSubmitterName((report as any).created_by_email)
                                    const updatedBy = getSubmitterName((report as any).updated_by_email)
                                    if (!createdBy && !updatedBy) return null
                                    return (
                                      <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                                        {createdBy && updatedBy && createdBy !== updatedBy ? (
                                          <>📤 由 {createdBy} 回報，{updatedBy} 修改</>
                                        ) : createdBy ? (
                                          <>📤 由 {createdBy} 回報</>
                                        ) : updatedBy ? (
                                          <>📝 由 {updatedBy} 修改</>
                                        ) : null}
                                      </div>
                                    )
                                  })()}
                                </div>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                                  {/* 檢查是否有代扣關係 */}
                                  {nonMemberBillingMap[report.participant_name] ? (
                                    <button
                                      onClick={() => {
                                        const billingInfo = nonMemberBillingMap[report.participant_name]
                                        handleLinkMember(report, {
                                          id: billingInfo.memberId,
                                          name: billingInfo.memberName,
                                          nickname: billingInfo.memberNickname,
                                          phone: null
                                        })
                                      }}
                                      disabled={loading}
                                      style={{
                                        ...getButtonStyle('secondary'),
                                        padding: '8px 16px',
                                        fontSize: '14px',
                                        background: '#fff3e0',
                                        color: '#e65100',
                                        border: '2px solid #ffcc80',
                                        opacity: loading ? 0.6 : 1,
                                        cursor: loading ? 'not-allowed' : 'pointer'
                                      }}
                                    >
                                      🔗 關聯{nonMemberBillingMap[report.participant_name].memberNickname || nonMemberBillingMap[report.participant_name].memberName}
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setLinkingReport(report)
                                        setShowMemberSearchDialog(true)
                                      }}
                                      disabled={loading}
                                      style={{
                                        ...getButtonStyle('secondary'),
                                        padding: '8px 16px',
                                        fontSize: '14px',
                                        opacity: loading ? 0.6 : 1,
                                        cursor: loading ? 'not-allowed' : 'pointer'
                                      }}
                                    >
                                      🔗 關聯會員
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleCloseNonMemberReport(report)}
                                    disabled={loading}
                                    style={{
                                      ...getButtonStyle('primary'),
                                      padding: '8px 16px',
                                      fontSize: '14px',
                                      background: '#4caf50',
                                      opacity: loading ? 0.6 : 1,
                                      cursor: loading ? 'not-allowed' : 'pointer'
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
              {/* 查詢期間 + 匯出按鈕 */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                gap: '16px',
                flexWrap: 'wrap'
              }}>
                <div style={{ flex: 1, minWidth: isMobile ? '100%' : 'auto' }}>
                  <DateRangePicker
                    selectedDate={selectedDate}
                    onDateChange={setSelectedDate}
                    isMobile={isMobile}
                    showTodayButton={true}
                    label="查詢期間"
                    simplified={true}
                  />
                </div>
                
                {/* 匯出報表按鈕 - 只在桌面版顯示 */}
                {!isMobile && (
                  <ExportReportButton 
                    records={completedReports}
                    dateRange={selectedDate.length === 7 ? selectedDate : selectedDate}
                    isMobile={isMobile}
                  />
                )}
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                載入中...
              </div>
            ) : (
              <>
                {/* 總計卡片 */}
                {bookingStats.length > 0 && (
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
                          {completedReports.filter((r: any) => r.is_teaching).reduce((sum: number, r: any) => sum + (r.duration_min || 0), 0)} 分
                        </div>
                        <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>
                          ({(completedReports.filter((r: any) => r.is_teaching).reduce((sum: number, r: any) => sum + (r.duration_min || 0), 0) / 60).toFixed(1)} 小時)
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

                {/* 預約列表 */}
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
                            <div style={{ fontWeight: '600', fontSize: isMobile ? '15px' : '16px', marginBottom: '4px' }}>
                              {extractDate(stat.booking.start_at)} {extractTime(stat.booking.start_at)} | {stat.booking.boats?.name}
                            </div>
                            <div style={{ color: '#666', fontSize: isMobile ? '13px' : '14px' }}>
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

                        {/* 分離教練回報和駕駛回報的參與者 */}
                        {(() => {
                          // 根據預約上的原始角色來判斷（教練優先）
                          // 取得預約的教練 ID 列表
                          const bookingCoachIds = new Set(
                            (stat.booking?.booking_coaches || []).map((bc: any) => bc.coach_id)
                          )
                          
                          // 分離：
                          // - 如果回報者是預約的教練 → 教練回報
                          // - 如果回報者不是教練（是駕駛）→ 駕駛回報
                          const coachParticipants = stat.participants.filter((p: any) => bookingCoachIds.has(p.coach_id))
                          const driverParticipants = stat.participants.filter((p: any) => !bookingCoachIds.has(p.coach_id))
                          
                          return (
                            <>
                              {/* 教練回報 */}
                              {coachParticipants.length > 0 && (
                                <div style={{ marginBottom: (stat.driverReports.length > 0 || driverParticipants.length > 0) ? '16px' : 0 }}>
                                  <h4 style={{ 
                                    margin: '0 0 12px 0', 
                                    fontSize: '14px', 
                                    color: '#4caf50',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                  }}>
                                    🎓 教練回報
                                  </h4>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {coachParticipants.map((record: any) => (
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
                                        <DeductionDetails 
                                          transactions={record.transactions || []}
                                          paymentMethod={record.payment_method}
                                          notes={record.notes}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* 駕駛回報 */}
                              {(stat.driverReports.length > 0 || driverParticipants.length > 0) && (
                                <div>
                                  <h4 style={{ 
                                    margin: '0 0 12px 0', 
                                    fontSize: '14px', 
                                    color: '#2196f3',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                  }}>
                                    🚤 駕駛回報
                                  </h4>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {stat.driverReports.map((record: any) => {
                                      // 找出這個駕駛回報的參與者記錄
                                      const relatedParticipants = driverParticipants.filter((p: any) => p.coach_id === record.coach_id)
                                      
                                      return (
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
                                          <div style={{ color: '#666', marginBottom: relatedParticipants.length > 0 ? '8px' : 0 }}>
                                            駕駛時數：{record.driver_duration_min}分
                                          </div>
                                          
                                          {/* 顯示駕駛回報的參與者（含扣款資訊） */}
                                          {relatedParticipants.length > 0 && (
                                            <div style={{ 
                                              marginTop: '8px', 
                                              paddingTop: '8px', 
                                              borderTop: '1px dashed #90caf9'
                                            }}>
                                              {relatedParticipants.map((p: any) => (
                                                <div key={p.id} style={{ marginBottom: '8px' }}>
                                                  <div style={{ color: '#666' }}>
                                                    學員：{p.members?.nickname || p.members?.name || p.participant_name}
                                                    {!p.member_id && <span style={{ color: '#ff9800' }}> (非會員)</span>}
                                                    {' • '}{p.duration_min}分
                                                    {' • '}{LESSON_TYPES.find(lt => lt.value === p.lesson_type)?.label || '不指定'}
                                                    {' • '}{PAYMENT_METHODS.find(m => m.value === p.payment_method)?.label}
                                                  </div>
                                                  <DeductionDetails 
                                                    transactions={p.transactions || []}
                                                    paymentMethod={p.payment_method}
                                                    notes={p.notes}
                                                  />
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )}
                            </>
                          )
                        })()}
                      </div>
                    ))}

                    {bookingStats.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                        沒有已結案記錄
                      </div>
                    )}
                  </div>
              </>
            )}
          </>
        )}

        {/* Tab 3: 統計報表 */}
        {activeTab === 'statistics' && (
          <StatisticsTab isMobile={isMobile} />
        )}

        {/* Tab 4: 代扣設定 */}
        {activeTab === 'billing' && (
          <div style={{ ...getCardStyle(isMobile) }}>
            <h2 style={{ 
              fontSize: isMobile ? '18px' : '20px',
              fontWeight: '600',
              marginBottom: '20px',
              color: '#333'
            }}>
              🔄 代扣關係設定
            </h2>
            
            <div style={{
              background: '#fff3e0',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '24px',
              fontSize: '14px',
              color: '#e65100',
              lineHeight: 1.6
            }}>
              <strong>說明：</strong>設定代扣關係後，扣款時會自動帶入對應的代扣會員。
              <br />例如：設定「火腿 → Mandy」後，扣「火腿」的款項時會自動從 Mandy 扣款。
            </div>

            {/* 新增代扣關係表單 */}
            <div style={{
              background: '#f8f9fa',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '24px',
              border: '2px dashed #dee2e6'
            }}>
              <h3 style={{ 
                fontSize: '16px',
                fontWeight: '600',
                marginBottom: '16px',
                color: '#495057'
              }}>
                ➕ 新增代扣關係
              </h3>
              
              <div style={{ 
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: '16px',
                marginBottom: '16px'
              }}>
                {/* 參與者名稱 */}
                <div>
                  <label style={getLabelStyle(isMobile)}>參與者名稱</label>
                  <input
                    type="text"
                    value={newParticipantName}
                    onChange={(e) => setNewParticipantName(e.target.value)}
                    placeholder=""
                    style={{
                      ...getInputStyle(isMobile),
                      width: '100%'
                    }}
                  />
                </div>
                
                {/* 代扣會員 */}
                <div>
                  <label style={getLabelStyle(isMobile)}>代扣會員</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={newBillingMemberId ? newBillingMemberName : memberSearchTerm}
                      onChange={(e) => {
                        if (newBillingMemberId) {
                          // 已選擇會員，清除並開始新搜尋
                          setNewBillingMemberId('')
                          setNewBillingMemberName('')
                        }
                        setMemberSearchTerm(e.target.value)
                      }}
                      onFocus={() => setShowBillingMemberSearch(true)}
                      onBlur={() => {
                        // 延遲關閉，讓點擊事件先觸發
                        setTimeout(() => setShowBillingMemberSearch(false), 200)
                      }}
                      placeholder="搜尋會員..."
                      style={{
                        ...getInputStyle(isMobile),
                        width: '100%',
                        background: newBillingMemberId ? '#e8f5e9' : '#fff'
                      }}
                    />
                    {newBillingMemberId && (
                      <button
                        onClick={() => {
                          setNewBillingMemberId('')
                          setNewBillingMemberName('')
                          setMemberSearchTerm('')
                        }}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          fontSize: '16px',
                          cursor: 'pointer',
                          color: '#999'
                        }}
                      >
                        ✕
                      </button>
                    )}
                    {/* 搜尋結果下拉 */}
                    {showBillingMemberSearch && !newBillingMemberId && memberSearchTerm && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        background: 'white',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        zIndex: 100,
                        maxHeight: '200px',
                        overflow: 'auto'
                      }}>
                        {filteredMembers.length === 0 ? (
                          <div style={{ padding: '12px', textAlign: 'center', color: '#999' }}>
                            找不到會員
                          </div>
                        ) : (
                          filteredMembers.map(member => (
                            <div
                              key={member.id}
                              onClick={() => {
                                setNewBillingMemberId(member.id)
                                setNewBillingMemberName(member.nickname || member.name)
                                setShowBillingMemberSearch(false)
                                setMemberSearchTerm('')
                              }}
                              style={{
                                padding: '10px 12px',
                                cursor: 'pointer',
                                borderBottom: '1px solid #f0f0f0'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                              onTouchStart={(e) => e.currentTarget.style.background = '#eeeeee'}
                              onTouchEnd={(e) => e.currentTarget.style.background = 'white'}
                              onTouchCancel={(e) => e.currentTarget.style.background = 'white'}
                            >
                              <div style={{ fontWeight: '600' }}>
                                {member.nickname || member.name}
                              </div>
                              {member.nickname && member.name !== member.nickname && (
                                <div style={{ fontSize: '13px', color: '#666' }}>
                                  {member.name}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* 備註 */}
              <div style={{ marginBottom: '16px' }}>
                <label style={getLabelStyle(isMobile)}>備註（選填）</label>
                <input
                  type="text"
                  value={newBillingNotes}
                  onChange={(e) => setNewBillingNotes(e.target.value)}
                  placeholder=""
                  style={{
                    ...getInputStyle(isMobile),
                    width: '100%'
                  }}
                />
              </div>
              
              <button
                onClick={addBillingRelation}
                disabled={addingBillingRelation || !newParticipantName.trim() || !newBillingMemberId}
                style={{
                  ...getButtonStyle('success', 'medium', isMobile),
                  background: (!newParticipantName.trim() || !newBillingMemberId) ? '#ccc' : '#4CAF50',
                  cursor: (!newParticipantName.trim() || !newBillingMemberId) ? 'not-allowed' : 'pointer'
                }}
              >
                {addingBillingRelation ? '新增中...' : '✅ 新增代扣關係'}
              </button>
            </div>

            {/* 代扣關係列表 */}
            <h3 style={{ 
              fontSize: '16px',
              fontWeight: '600',
              marginBottom: '16px',
              color: '#495057'
            }}>
              📋 現有代扣關係 ({billingRelations.length})
            </h3>
            
            {billingRelations.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '40px',
                color: '#999',
                background: '#f8f9fa',
                borderRadius: '8px'
              }}>
                尚未設定任何代扣關係
              </div>
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                {billingRelations.map((relation) => (
                  <div
                    key={relation.id}
                    style={{
                      background: 'white',
                      borderRadius: '10px',
                      padding: '16px',
                      border: '1px solid #e0e0e0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}
                  >
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <div style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '4px'
                      }}>
                        <span style={{ fontWeight: '600', fontSize: '16px' }}>
                          {relation.participant_name}
                        </span>
                        <span style={{ color: '#999' }}>→</span>
                        <span style={{ 
                          fontWeight: '600',
                          fontSize: '16px',
                          color: '#ff9800'
                        }}>
                          {relation.billing_member_nickname || relation.billing_member_name}
                        </span>
                      </div>
                      {relation.notes && (
                        <div style={{ fontSize: '13px', color: '#666' }}>
                          📝 {relation.notes}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => deleteBillingRelation(relation.id, relation.participant_name)}
                      style={{
                        padding: '8px 16px',
                        background: '#fff',
                        color: '#f44336',
                        border: '1px solid #f44336',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '500',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f44336'
                        e.currentTarget.style.color = 'white'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#fff'
                        e.currentTarget.style.color = '#f44336'
                      }}
                    >
                      🗑️ 刪除
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
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
                      onTouchStart={(e) => e.currentTarget.style.background = '#eeeeee'}
                      onTouchEnd={(e) => e.currentTarget.style.background = 'transparent'}
                      onTouchCancel={(e) => e.currentTarget.style.background = 'transparent'}
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

      {/* 舊版 TransactionDialog 已移除，扣款功能已整合到 PendingDeductionItem 組件中 */}
    </div>
  )
}

