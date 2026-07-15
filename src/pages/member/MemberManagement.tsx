import { useState, useEffect, useMemo } from 'react'
import { useAuthUser } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { AddMemberDialog } from '../../components/AddMemberDialog'
import { MemberDetailDialog } from '../../components/MemberDetailDialog'
import { PageHeader } from '../../components/PageHeader'
import { Footer } from '../../components/Footer'
import { useResponsive } from '../../hooks/useResponsive'
import { useToast, ToastContainer } from '../../components/ui'
import {
  formatDbTimestampDisplay,
  getVenueDateString,
  normalizeDate,
  isDateExpired,
  isEndDateInExpiryReminderWindow,
  EXPIRING_SOON_DAYS
} from '../../utils/date'
import { isAdmin } from '../../utils/auth'
import { chunkArray, fetchAllPaginated, IN_FILTER_BATCH_SIZE } from '../../utils/supabasePaginate'
import {
  designSystem,
  getBadgeStyle,
  getButtonStyle,
  getEmptyStateStyle,
  getFilterChipStyle,
  getFontSize,
  getInputStyle,
  getPageContentShellStyle,
} from '../../styles/designSystem'

const pageBg = designSystem.colors.background.main
const cardBorder = `1px solid ${designSystem.colors.border.light}`
const cardShadow = designSystem.shadows.elevation[1]
const cardShadowHover = designSystem.shadows.elevation[2]

function membershipTypeBadge(type: string): { label: string; variant: 'info' | 'warning' | 'default' } {
  switch (type) {
    case 'guest':
      return { label: '非會員', variant: 'warning' }
    case 'dual':
      return { label: '雙人會籍', variant: 'info' }
    case 'es':
      return { label: 'ES', variant: 'default' }
    default:
      return { label: '一般會員', variant: 'info' }
  }
}

/** 備忘錄事件色（僅顯示；value 與 DB event_type 對齊） */
const NOTE_EVENT_COLORS: Record<string, string> = {
  續約: designSystem.colors.success[500],
  購買: designSystem.colors.info[500],
  贈送: '#7a6b8a',
  使用: designSystem.colors.warning[500],
  入會: '#8a5a6a',
  備註: designSystem.colors.text.secondary,
}

interface Member {
  id: string
  name: string
  nickname: string | null
  birthday: string | null
  phone: string | null
  balance: number
  vip_voucher_amount: number  // VIP 票券（金額）
  designated_lesson_minutes: number  // 指定課時數
  boat_voucher_g23_minutes: number  // G23船券（時數）
  boat_voucher_g21_panther_minutes: number  // G21/黑豹共通船券（時數）
  gift_boat_hours: number  // 贈送大船時數
  membership_end_date: string | null
  membership_start_date: string | null
  membership_type: string  // 'general', 'dual', 'guest', 'es' (一般會員、雙人會員、非會員、ES)
  membership_partner_id: string | null
  board_slot_number: string | null
  board_expiry_date: string | null
  notes: string | null
  status: string
  created_at: string
  updated_at: string | null
  board_count?: number  // 置板數量（從 board_storage 計算）
  board_slots?: Array<{ slot_number: number; start_date: string | null; expires_at: string | null }>  // 置板詳細資訊
  partner?: Member | null  // 配對會員資料
  member_notes?: MemberNote[]  // 會員備忘錄
  // LINE 綁定資訊（衍生欄位）
  line_binding_user_id?: string | null
  last_liff_login_at?: string | null
  is_line_bound?: boolean
}

interface MemberNote {
  id: number
  member_id: string
  event_date: string | null
  event_type: string
  description: string
}

export function MemberManagement() {
  const user = useAuthUser()
  const userIsAdmin = isAdmin(user)
  const toast = useToast()
  const { isMobile } = useResponsive()
  const navigate = useNavigate()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const [expiringMemberships, setExpiringMemberships] = useState<any[]>([])
  const [expiringBoards, setExpiringBoards] = useState<any[]>([])
  const [membershipTypeFilter, setMembershipTypeFilter] = useState<string>('all') // 'all', 'general', 'dual', 'guest'
  const [expiringFilter, setExpiringFilter] = useState<string>('none') // 'none', 'membership', 'board'
  const [lineBindingFilter, setLineBindingFilter] = useState<'all' | 'bound' | 'unbound'>('all')
  const [showExpiringDetails, setShowExpiringDetails] = useState(false) // 收合/展開到期詳情
  const [sortBy, setSortBy] = useState<string>('nickname') // 'nickname', 'balance', 'membership_end_date'
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc') // 升冪/降冪
  const [mobileFiltersExpanded, setMobileFiltersExpanded] = useState(false)
  /** 列表備忘錄展開的會員 id（預設收合，只顯示最近幾則） */
  const [expandedMemoMemberIds, setExpandedMemoMemberIds] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    if (!user || !userIsAdmin) return
    loadMembers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInactive, user, userIsAdmin])

  useEffect(() => {
    if (!user || !userIsAdmin) return
    loadExpiringData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userIsAdmin])

  /** 會員管理僅限超級管理員（SUPER_ADMINS）；小編與其他帳號請用首頁「會員電話」等對應功能 */
  useEffect(() => {
    if (!user) return
    if (!userIsAdmin) {
      setLoading(false)
      toast.error('會員管理僅限管理員使用')
      navigate('/')
    }
  }, [user, userIsAdmin, navigate, toast])

  // 格式化日期為 YYYY-MM-DD（顯示用）
  const formatDate = (dateStr: string) => {
    return normalizeDate(dateStr) || ''
  }

  const loadExpiringData = async () => {
    const [membershipResult, boardResult] = await Promise.all([
      // 獲取所有有會籍截止日的會員
      supabase
        .from('members')
        .select('name, nickname, membership_end_date, status')
        .not('membership_end_date', 'is', null)
        .order('membership_end_date', { ascending: true }),
      
      // 獲取所有有到期日的置板
      supabase
        .from('board_storage')
        .select('slot_number, members:member_id(name, nickname), expires_at')
        .eq('status', 'active')
        .not('expires_at', 'is', null)
        .order('expires_at', { ascending: true })
    ])

    if (membershipResult.data) {
      const filtered = membershipResult.data.filter((m: any) =>
        isEndDateInExpiryReminderWindow(m.membership_end_date, EXPIRING_SOON_DAYS)
      )
      
      setExpiringMemberships(filtered)
    }
    
    if (boardResult.data) {
      const filtered = boardResult.data.filter((b: any) =>
        isEndDateInExpiryReminderWindow(b.expires_at, EXPIRING_SOON_DAYS)
      )
      
      const boardList = filtered.map((b: any) => {
        const member = b.members
        const displayName = member 
          ? ((member.nickname && member.nickname.trim()) || member.name)
          : '未知'
        return {
          slot_number: b.slot_number,
          member_name: displayName,
          expires_at: b.expires_at
        }
      })
      
      setExpiringBoards(boardList)
    }
  }

  const loadMembers = async (silent = false) => {
    // silent 模式：不顯示 loading，用於更新後的靜默刷新，保持滾動位置
    if (!silent) {
      setLoading(true)
    }
    try {
      // 並行查詢會員資料、置板資料與 LINE 綁定（備忘錄改依會員 ID 分批，避免整表 notes）
      const [membersResult, boardResult, lineBindingsResult] = await Promise.all([
        supabase
          .from('members')
          .select(`
            id, name, nickname, phone, birthday, notes, 
            balance, vip_voucher_amount, designated_lesson_minutes, 
            boat_voucher_g23_minutes, boat_voucher_g21_panther_minutes, 
            gift_boat_hours, membership_end_date, membership_start_date,
            membership_type, membership_partner_id,
            board_slot_number, board_expiry_date,
            status, created_at, updated_at
          `)
          .in('status', showInactive ? ['active', 'inactive'] : ['active']),
        
        supabase
          .from('board_storage')
          .select('member_id, slot_number, start_date, expires_at')
          .eq('status', 'active')
          .order('slot_number', { ascending: true }),

        supabase
          .from('line_bindings')
          .select('member_id, line_user_id, last_liff_login_at')
          .eq('status', 'active')
      ])

      if (membersResult.error) throw membersResult.error

      const membersData = membersResult.data || []
      const boardData = boardResult.data || []
      const lineBindingsData = lineBindingsResult.data || []

      // 依已載入會員 ID 分批 + 分頁抓備忘錄（排序與原先整表查詢相同）
      const memberIds = membersData.map((m: { id: string }) => m.id)
      let notesData: Array<{ id: number; member_id: string; event_date: string | null; event_type: string | null; description: string | null }> = []
      if (memberIds.length > 0) {
        const idBatches = chunkArray(memberIds, IN_FILTER_BATCH_SIZE)
        const notesBatches = await Promise.all(
          idBatches.map((batch) =>
            fetchAllPaginated(async (from, to) => {
              // @ts-ignore - member_notes 表
              const { data, error } = await supabase
                .from('member_notes')
                .select('id, member_id, event_date, event_type, description')
                .in('member_id', batch)
                .order('event_date', { ascending: true, nullsFirst: true })
                .range(from, to)
              return { data, error }
            })
          )
        )
        notesData = notesBatches.flat()
      }

      // 整理每個會員的置板資料
      const memberBoards: Record<string, Array<{ slot_number: number; start_date: string | null; expires_at: string | null }>> = {}
      boardData.forEach((board: any) => {
        if (!memberBoards[board.member_id]) {
          memberBoards[board.member_id] = []
        }
        memberBoards[board.member_id].push({
          slot_number: board.slot_number,
          start_date: board.start_date,
          expires_at: board.expires_at
        })
      })

      // 整理每個會員的備忘錄
      const memberNotes: Record<string, MemberNote[]> = {}
      notesData.forEach((note: any) => {
        if (!memberNotes[note.member_id]) {
          memberNotes[note.member_id] = []
        }
        memberNotes[note.member_id].push(note)
      })

      // 載入配對會員資料
      const partnerIds = membersData
        .map((m: any) => m.membership_partner_id)
        .filter(Boolean)
      
      let partnersData: any[] = []
      if (partnerIds.length > 0) {
        const { data } = await supabase
          .from('members')
          .select('id, name, nickname')
          .in('id', partnerIds)
        partnersData = data || []
      }

      const partnersMap: Record<string, any> = {}
      partnersData.forEach(p => {
        partnersMap[p.id] = p
      })

      // 整理 LINE 綁定 map
      const memberIdToLineBinding: Record<string, { lineUserId: string; lastLiffLoginAt: string | null }> = {}
      lineBindingsData.forEach((b: any) => {
        if (b.member_id) {
          memberIdToLineBinding[b.member_id] = {
            lineUserId: b.line_user_id,
            lastLiffLoginAt: b.last_liff_login_at,
          }
        }
      })

      // 合併資料
      const membersWithBoards = membersData.map((member: any) => ({
        ...member,
        board_slots: memberBoards[member.id] || [],
        board_count: memberBoards[member.id]?.length || 0,
        partner: member.membership_partner_id ? partnersMap[member.membership_partner_id] : null,
        member_notes: memberNotes[member.id] || [],
        line_binding_user_id: memberIdToLineBinding[member.id]?.lineUserId || null,
        last_liff_login_at: memberIdToLineBinding[member.id]?.lastLiffLoginAt || null,
        is_line_bound: Boolean(memberIdToLineBinding[member.id])
      }))

      setMembers(membersWithBoards)
    } catch (error) {
      console.error('載入會員失敗:', error)
      toast.error('載入會員失敗')
    } finally {
      setLoading(false)
    }
  }

  const handleUnbindLine = async (memberId: string, memberDisplayName: string) => {
    try {
      const confirmed = window.confirm(`確定要移除「${memberDisplayName}」的 LINE 綁定嗎？`)
      if (!confirmed) return

      const { error } = await supabase
        .from('line_bindings')
        .update({ status: 'revoked' })
        .eq('member_id', memberId)
        .eq('status', 'active')

      if (error) throw error

      toast.success('已移除 LINE 綁定')
      await loadMembers(true)
    } catch (err) {
      console.error('移除 LINE 綁定失敗:', err)
      toast.error('移除 LINE 綁定失敗')
    }
  }

  const handleArchiveMember = async (memberId: string) => {
    try {
      // 先取得會員資料
      const { data: member } = await supabase
        .from('members')
        .select('id, name, nickname, membership_type, membership_partner_id')
        .eq('id', memberId)
        .single()

      if (!member) throw new Error('找不到會員')

      const today = getVenueDateString()
      const hasPartner = member.membership_type === 'dual' && member.membership_partner_id

      // 1. 如果有配對，解除配對關係
      if (hasPartner && member.membership_partner_id) {
        const partnerId = member.membership_partner_id

        // 配對會員改為一般會員 — 若失敗 throw，避免留下孤兒的 dual 配對
        const { error: partnerErr } = await supabase
          .from('members')
          .update({ 
            membership_type: 'general',
            membership_partner_id: null 
          })
          .eq('id', partnerId)
        if (partnerErr) throw new Error(`解除配對會員失敗: ${partnerErr.message}`)

        // 幫配對會員加備忘錄（活動紀錄，失敗不阻斷主流程）
        // @ts-ignore
        await supabase.from('member_notes').insert([{
          member_id: partnerId,
          event_date: today,
          event_type: '備註',
          description: `配對會員 ${member.nickname || member.name} 已隱藏，解除配對，改為一般會員`
        }])
      }

      // 2. 隱藏會員（清除配對）
      const { error } = await supabase
        .from('members')
        .update({ 
          status: 'inactive',
          membership_partner_id: null
        })
        .eq('id', memberId)
      
      if (error) throw error

      // 2.5 同步移除該會員的 LINE 綁定 — 若失敗 throw，避免「已隱藏但 LINE 還能登入」
      const { error: lineErr } = await supabase
        .from('line_bindings')
        .update({ status: 'revoked' })
        .eq('member_id', memberId)
        .eq('status', 'active')
      if (lineErr) throw new Error(`撤銷 LINE 綁定失敗: ${lineErr.message}`)

      // 3. 新增備忘錄
      // @ts-ignore
      await supabase.from('member_notes').insert([{
        member_id: memberId,
        event_date: today,
        event_type: '備註',
        description: '會員隱藏'
      }])

      toast.success('已隱藏會員')
      await loadMembers(true)
    } catch (err: any) {
      console.error('隱藏會員失敗:', err)
      toast.error('隱藏會員失敗')
    }
  }

  const handleRestoreMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('members')
        .update({ status: 'active' })
        .eq('id', memberId)
      
      if (error) throw error

      // 新增備忘錄
      const today = getVenueDateString()
      // @ts-ignore
      await supabase.from('member_notes').insert([{
        member_id: memberId,
        event_date: today,
        event_type: '備註',
        description: '會員恢復'
      }])

      toast.success('已恢復會員')
      await loadMembers(true)
    } catch (err: any) {
      console.error('恢復會員失敗:', err)
      toast.error('恢復會員失敗')
    }
  }

  // 使用 useMemo 快取過濾結果，避免不必要的重複計算
  const filteredMembers = useMemo(() => {
    let result = members
    
    // 篩選會員種類
    if (membershipTypeFilter !== 'all') {
      result = result.filter(member => {
        if (membershipTypeFilter === 'member') {
          return member.membership_type === 'general' || member.membership_type === 'dual'
        }
        return member.membership_type === membershipTypeFilter
      })
    }
    
    // 篩選搜尋文字
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase()
      result = result.filter(member => 
        member.name.toLowerCase().includes(lowerSearch) ||
        member.nickname?.toLowerCase().includes(lowerSearch)
      )
    }

    // 篩選到期會員
    if (expiringFilter === 'membership') {
      const expiringMemberNames = new Set(expiringMemberships.map((m: any) => m.name))
      const expiringMemberNicknames = new Set(expiringMemberships.map((m: any) => m.nickname).filter(Boolean))
      result = result.filter(member => 
        expiringMemberNames.has(member.name) || 
        (member.nickname && expiringMemberNicknames.has(member.nickname))
      )
    } else if (expiringFilter === 'board') {
      const expiringBoardMemberNames = new Set(expiringBoards.map((b: any) => b.member_name))
      result = result.filter(member => 
        expiringBoardMemberNames.has(member.name) || 
        expiringBoardMemberNames.has(member.nickname)
      )
    }

    if (lineBindingFilter === 'bound') {
      result = result.filter(m => m.is_line_bound)
    } else if (lineBindingFilter === 'unbound') {
      result = result.filter(m => !m.is_line_bound)
    }

    // 排序
    result = [...result].sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'updated_at':
          // 只依會員資料的實際更新時間排序，不受備忘錄活動日期影響
          const dateA = a.updated_at
          const dateB = b.updated_at
          // 空值永遠排最後
          if (!dateA && !dateB) return 0
          if (!dateA) return 1
          if (!dateB) return -1
          comparison = dateA.localeCompare(dateB)
          break
        case 'membership_end_date':
          const dateA_end = normalizeDate(a.membership_end_date)
          const dateB_end = normalizeDate(b.membership_end_date)
          // 空值永遠排最後（沒有會籍的排最後）
          if (!dateA_end && !dateB_end) return 0
          if (!dateA_end) return 1
          if (!dateB_end) return -1
          comparison = dateA_end.localeCompare(dateB_end)
          break
        case 'board_expiry':
          // 取會員最早的置板到期日
          const getEarliestBoardExpiry = (member: Member) => {
            if (!member.board_slots || member.board_slots.length === 0) return null
            const expiryDates = member.board_slots
              .map(slot => normalizeDate(slot.expires_at))
              .filter((d): d is string => d !== null)
            if (expiryDates.length === 0) return null
            return expiryDates.sort()[0] // 取最早的到期日
          }
          const boardA = getEarliestBoardExpiry(a)
          const boardB = getEarliestBoardExpiry(b)
          // 空值永遠排最後（沒有置板的排最後）
          if (!boardA && !boardB) return 0
          if (!boardA) return 1
          if (!boardB) return -1
          comparison = boardA.localeCompare(boardB)
          break
        case 'nickname':
        default:
          const nameA = (a.nickname || a.name || '').toLowerCase()
          const nameB = (b.nickname || b.name || '').toLowerCase()
          comparison = nameA.localeCompare(nameB, 'zh-TW')
          break
      }
      return sortOrder === 'desc' ? -comparison : comparison
    })
    
    return result
  }, [members, searchTerm, membershipTypeFilter, expiringFilter, lineBindingFilter, expiringMemberships, expiringBoards, sortBy, sortOrder])


  if (loading) {
    return (
      <div style={{ 
        padding: isMobile ? '12px 16px' : '20px',
        minHeight: '100dvh',
        background: pageBg,
        paddingBottom: 'max(20px, env(safe-area-inset-bottom))'
      }}>
        <div style={getPageContentShellStyle(isMobile)}>
          <PageHeader 
            title="會員" 
            user={user} 
            showBaoLink={isAdmin(user)} 
            extraLinks={userIsAdmin ? [{ label: '儲值', link: '/member-transaction' }] : undefined}
          />

          {/* 搜尋框骨架屏 */}
        <div style={{ 
          marginTop: '20px',
          marginBottom: '20px',
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <div style={{ 
            flex: 1, 
            minWidth: '200px',
            height: '48px', 
            background: designSystem.colors.background.card, 
            borderRadius: designSystem.borderRadius.lg,
            border: cardBorder,
          }} />
          <div style={{ 
            width: '120px', 
            height: '48px', 
            background: designSystem.colors.border.light, 
            borderRadius: designSystem.borderRadius.lg,
          }} />
        </div>

        {/* 會員列表骨架屏 */}
        <div style={{ display: 'grid', gap: '12px', marginTop: '16px' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{
              background: designSystem.colors.background.card,
              borderRadius: designSystem.borderRadius.lg,
              padding: isMobile ? '14px' : '18px 20px',
              border: cardBorder,
              boxShadow: cardShadow,
            }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
                <div style={{ width: '110px', height: '20px', background: designSystem.colors.border.light, borderRadius: '4px' }} />
                <div style={{ width: '48px', height: '18px', background: designSystem.colors.border.light, borderRadius: '10px' }} />
                <div style={{ width: '60px', height: '18px', background: designSystem.colors.border.light, borderRadius: '10px' }} />
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ width: '80px', height: '14px', background: designSystem.colors.border.light, borderRadius: '4px' }} />
                <div style={{ width: '100px', height: '14px', background: designSystem.colors.border.light, borderRadius: '4px' }} />
                <div style={{ width: '70px', height: '14px', background: designSystem.colors.border.light, borderRadius: '4px' }} />
              </div>
            </div>
          ))}
        </div>

          <Footer />
        </div>
      </div>
    )
  }

  return (
    <div style={{ 
      padding: isMobile ? '12px 16px' : '20px',
      minHeight: '100dvh',
      background: pageBg,
      paddingBottom: 'max(20px, env(safe-area-inset-bottom))'
    }}>
      <div style={getPageContentShellStyle(isMobile)}>
      {/* 桌面：整段 sticky；手機：僅搜尋列 sticky */}
      <div style={{
        position: isMobile ? 'static' : 'sticky',
        top: 0,
        zIndex: isMobile ? undefined : 100,
        background: pageBg,
        marginLeft: isMobile ? '-16px' : 0,
        marginRight: isMobile ? '-16px' : 0,
        marginTop: isMobile ? '-12px' : '-20px',
        paddingLeft: isMobile ? '16px' : 0,
        paddingRight: isMobile ? '16px' : 0,
        paddingTop: isMobile ? '12px' : '20px',
        paddingBottom: '12px',
        borderBottom: `1px solid ${designSystem.colors.border.light}`,
      }}>
        <PageHeader 
          title="會員" 
          user={user} 
          showBaoLink={isAdmin(user)} 
          extraLinks={
            userIsAdmin ? [{ label: '儲值', link: '/member-transaction' }] : undefined
          }
        />
        {/* 搜尋欄 + 新增會員按鈕 */}
        <div style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '12px',
          alignItems: 'center',
          ...(isMobile ? {
            position: 'sticky',
            top: 'env(safe-area-inset-top, 0px)',
            zIndex: 90,
            paddingTop: '6px',
            paddingBottom: '10px',
            background: pageBg,
            borderBottom: `1px solid ${designSystem.colors.border.light}`,
          } : {}),
        }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type="text"
              placeholder="搜尋會員（姓名、暱稱）"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                if (e.target.value && membershipTypeFilter !== 'all') {
                  setMembershipTypeFilter('all')
                }
              }}
              style={{
                ...getInputStyle(isMobile),
                width: '100%',
                paddingRight: searchTerm ? '40px' : undefined,
                boxSizing: 'border-box',
              }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: designSystem.colors.text.secondary,
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  fontSize: getFontSize('body', isMobile),
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✕
              </button>
            )}
          </div>
          <button
            data-track="member_add"
            onClick={() => setAddDialogOpen(true)}
            style={{
              ...getButtonStyle('primary', 'medium', isMobile),
              whiteSpace: 'nowrap',
            }}
          >
            + {isMobile ? '新增' : '新增會員'}
          </button>
        </div>

        {/* 篩選列 - 手機版用下拉選單，桌面版用按鈕 */}
        {isMobile ? (
          /* 手機版：可收合的篩選區 */
          <>
            {(() => {
              const filtersActive = membershipTypeFilter !== 'all' || expiringFilter !== 'none' || lineBindingFilter !== 'all'
              return (
            <button
              type="button"
              onClick={() => setMobileFiltersExpanded((v) => !v)}
              style={{
                width: '100%',
                marginBottom: '10px',
                padding: '10px 12px',
                border: cardBorder,
                borderRadius: designSystem.borderRadius.lg,
                fontSize: getFontSize('body', isMobile),
                background: mobileFiltersExpanded
                  ? designSystem.colors.background.card
                  : (filtersActive ? designSystem.colors.warning[50] : designSystem.colors.background.card),
                color: designSystem.colors.text.primary,
                cursor: 'pointer',
                textAlign: 'left',
                boxShadow: designSystem.shadows.xs,
              }}
            >
              {mobileFiltersExpanded
                ? '收合篩選與排序'
                : `篩選與排序（類型、LINE、排序）${filtersActive ? ' · 已套用' : ''}`}
            </button>
              )
            })()}
            {mobileFiltersExpanded && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              alignItems: 'stretch',
            }}>
              {/* 會員類型下拉選單 */}
              <div style={{ width: '100%' }}>
                <select
                  value={expiringFilter !== 'none' ? `expiring-${expiringFilter}` : membershipTypeFilter}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val.startsWith('expiring-')) {
                      const filter = val.replace('expiring-', '') as 'membership' | 'board'
                      setExpiringFilter(filter)
                      setMembershipTypeFilter('all')
                    } else {
                      setMembershipTypeFilter(val)
                      setExpiringFilter('none')
                    }
                  }}
                  style={{
                    ...getInputStyle(isMobile),
                    width: '100%',
                    paddingRight: '32px',
                    appearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: getFontSize('body', isMobile),
                    fontWeight: (membershipTypeFilter !== 'all' || expiringFilter !== 'none' || lineBindingFilter !== 'all') ? '500' : 'normal',
                  }}
                >
                  <option value="all">全部 ({members.length})</option>
                  <option value="member">會員 ({members.filter(m => m.membership_type === 'general' || m.membership_type === 'dual').length})</option>
                  <option value="general">一般 ({members.filter(m => m.membership_type === 'general').length})</option>
                  <option value="dual">雙人 ({members.filter(m => m.membership_type === 'dual').length})</option>
                  <option value="guest">非會員 ({members.filter(m => m.membership_type === 'guest').length})</option>
                  <option value="es">ES ({members.filter(m => m.membership_type === 'es').length})</option>
                  {expiringMemberships.length > 0 && (
                    <option value="expiring-membership">會籍到期 ({expiringMemberships.length})</option>
                  )}
                  {expiringBoards.length > 0 && (
                    <option value="expiring-board">置板到期 ({expiringBoards.length})</option>
                  )}
                </select>
              </div>

              {/* LINE 綁定狀態 */}
              <div style={{ width: '100%' }}>
                <select
                  value={lineBindingFilter}
                  onChange={(e) => setLineBindingFilter(e.target.value as 'all' | 'bound' | 'unbound')}
                  style={{
                    ...getInputStyle(isMobile),
                    width: '100%',
                    paddingRight: '32px',
                    appearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: getFontSize('body', isMobile),
                    fontWeight: lineBindingFilter !== 'all' ? '500' : 'normal',
                  }}
                >
                  <option value="all">LINE 全部 ({members.length})</option>
                  <option value="bound">LINE 已綁定 ({members.filter(m => m.is_line_bound).length})</option>
                  <option value="unbound">LINE 未綁定 ({members.filter(m => !m.is_line_bound).length})</option>
                </select>
              </div>

              {/* 排序下拉選單 + 方向按鈕 */}
              <div style={{ width: '100%', display: 'flex', gap: '6px' }}>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  style={{
                    ...getInputStyle(isMobile),
                    flex: 1,
                    minWidth: 0,
                    paddingRight: '32px',
                    appearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: getFontSize('body', isMobile),
                  }}
                >
                  <option value="nickname">暱稱</option>
                  <option value="updated_at">更新日期</option>
                  <option value="membership_end_date">會籍到期</option>
                  <option value="board_expiry">置板到期</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  style={{
                    ...getButtonStyle('outline', 'medium', isMobile),
                    minWidth: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title={sortOrder === 'asc' ? '升序（點擊切換）' : '降序（點擊切換）'}
                >
                  {sortOrder === 'asc' ? '▲' : '▼'}
                </button>
              </div>

              {/* 包含已隱藏 checkbox */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                gap: '6px',
                fontSize: getFontSize('button', isMobile),
                color: designSystem.colors.text.secondary,
                whiteSpace: 'nowrap',
                padding: '4px 0',
              }}>
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                包含已隱藏
              </label>
            </div>
            )}

            {/* 手機版結果數量 */}
            {(searchTerm || membershipTypeFilter !== 'all' || expiringFilter !== 'none' || lineBindingFilter !== 'all') && (
              <div style={{
                fontSize: getFontSize('button', isMobile),
                color: designSystem.colors.text.secondary,
                marginTop: '8px',
                textAlign: 'center',
              }}>
                {searchTerm ? `「${searchTerm}」` : ''} 找到 <strong>{filteredMembers.length}</strong> 位會員
              </div>
            )}
          </>
        ) : (
          /* 桌面版：類型一列、次要篩選／排序一列 */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}>
              {[
                { value: 'all', label: '全部', count: members.length },
                { value: 'member', label: '會員', count: members.filter(m => m.membership_type === 'general' || m.membership_type === 'dual').length },
                { value: 'general', label: '一般', count: members.filter(m => m.membership_type === 'general').length },
                { value: 'dual', label: '雙人', count: members.filter(m => m.membership_type === 'dual').length },
                { value: 'guest', label: '非會員', count: members.filter(m => m.membership_type === 'guest').length },
                { value: 'es', label: 'ES', count: members.filter(m => m.membership_type === 'es').length }
              ].map(type => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => {
                    setMembershipTypeFilter(type.value)
                    setExpiringFilter('none')
                  }}
                  style={{
                    ...getButtonStyle('outline', 'small', false),
                    ...getFilterChipStyle(
                      membershipTypeFilter === type.value && expiringFilter === 'none',
                      'info'
                    ),
                  }}
                >
                  {type.label} ({type.count})
                </button>
              ))}
            </div>

            <div style={{
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}>
              <button
                type="button"
                onClick={() => {
                  setExpiringFilter(expiringFilter === 'membership' ? 'none' : 'membership')
                  if (expiringFilter !== 'membership') setMembershipTypeFilter('all')
                }}
                disabled={expiringMemberships.length === 0}
                style={{
                  ...getButtonStyle('outline', 'small', false),
                  ...getFilterChipStyle(expiringFilter === 'membership', 'warning'),
                  opacity: expiringMemberships.length === 0 ? 0.5 : 1,
                  cursor: expiringMemberships.length > 0 ? 'pointer' : 'default',
                }}
              >
                會籍到期 ({expiringMemberships.length})
              </button>

              <button
                type="button"
                onClick={() => {
                  setExpiringFilter(expiringFilter === 'board' ? 'none' : 'board')
                  if (expiringFilter !== 'board') setMembershipTypeFilter('all')
                }}
                disabled={expiringBoards.length === 0}
                style={{
                  ...getButtonStyle('outline', 'small', false),
                  ...getFilterChipStyle(expiringFilter === 'board', 'info'),
                  opacity: expiringBoards.length === 0 ? 0.5 : 1,
                  cursor: expiringBoards.length > 0 ? 'pointer' : 'default',
                }}
              >
                置板到期 ({expiringBoards.length})
              </button>

              <button
                type="button"
                data-track="member_filter_line_bound"
                onClick={() => setLineBindingFilter(lineBindingFilter === 'bound' ? 'all' : 'bound')}
                style={{
                  ...getButtonStyle('outline', 'small', false),
                  ...getFilterChipStyle(lineBindingFilter === 'bound', 'info'),
                }}
              >
                LINE 已綁定 ({members.filter(m => m.is_line_bound).length})
              </button>

              <button
                type="button"
                data-track="member_filter_line_unbound"
                onClick={() => setLineBindingFilter(lineBindingFilter === 'unbound' ? 'all' : 'unbound')}
                style={{
                  ...getButtonStyle('outline', 'small', false),
                  ...getFilterChipStyle(lineBindingFilter === 'unbound', 'info'),
                }}
              >
                LINE 未綁定 ({members.filter(m => !m.is_line_bound).length})
              </button>

              <div style={{ width: '1px', height: '22px', background: designSystem.colors.border.light, margin: '0 2px' }} />

              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value)
                  setSortOrder('asc')
                }}
                aria-label="排序欄位"
                style={{
                  ...getInputStyle(false),
                  width: 'auto',
                  minWidth: '120px',
                  padding: '7px 28px 7px 12px',
                  appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 10px center',
                  cursor: 'pointer',
                  fontSize: getFontSize('button', isMobile),
                }}
              >
                <option value="nickname">暱稱</option>
                <option value="updated_at">最近更新</option>
                <option value="membership_end_date">會籍到期</option>
                <option value="board_expiry">置板到期</option>
              </select>
              <button
                type="button"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                style={{
                  ...getButtonStyle('outline', 'small', false),
                  minWidth: '40px',
                }}
                title={sortOrder === 'asc' ? '升序（點擊切換）' : '降序（點擊切換）'}
              >
                {sortOrder === 'asc' ? '▲' : '▼'}
              </button>

              <label style={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                gap: '6px',
                marginLeft: 'auto',
                fontSize: getFontSize('button', isMobile),
                color: designSystem.colors.text.secondary,
              }}>
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                包含已隱藏
              </label>
            </div>
          </div>
        )}
      </div>

      {!isMobile && (searchTerm || membershipTypeFilter !== 'all' || expiringFilter !== 'none' || lineBindingFilter !== 'all') && (
        <div style={{
          fontSize: getFontSize('button', isMobile),
          color: designSystem.colors.text.secondary,
          marginBottom: '12px',
          textAlign: 'center',
        }}>
          {searchTerm ? `「${searchTerm}」` : ''} 找到 <strong>{filteredMembers.length}</strong> 位會員
        </div>
      )}

      {/* 到期詳情（收合式） */}
      {(expiringMemberships.length > 0 || expiringBoards.length > 0) && (
        <div style={{
          background: designSystem.colors.background.card,
          borderRadius: designSystem.borderRadius.lg,
          marginBottom: '16px',
          border: cardBorder,
          boxShadow: cardShadow,
          overflow: 'hidden'
        }}>
          <button
            onClick={() => setShowExpiringDetails(!showExpiringDetails)}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: getFontSize('button', isMobile),
              color: designSystem.colors.text.secondary
            }}
          >
            <span>
              到期詳情：會籍 {expiringMemberships.length} 位、置板 {expiringBoards.length} 位
            </span>
            <span>{showExpiringDetails ? '收合' : '展開'}</span>
          </button>
          
          {showExpiringDetails && (
            <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${designSystem.colors.border.light}` }}>
              {expiringMemberships.length > 0 && (() => {
                const expired = expiringMemberships.filter((m: any) => isDateExpired(m.membership_end_date))
                const upcoming = expiringMemberships.filter((m: any) => !isDateExpired(m.membership_end_date))
                return (
                  <div style={{ marginTop: '12px' }}>
                    {expired.length > 0 && (
                      <div style={{ marginBottom: '8px' }}>
                        <span style={{ fontSize: getFontSize('bodySmall', isMobile), color: designSystem.colors.danger[700], fontWeight: '600' }}>已過期 ({expired.length})：</span>
                        <span style={{ fontSize: getFontSize('bodySmall', isMobile), color: designSystem.colors.text.secondary }}>
                          {expired.map((m: any) => (m.nickname && m.nickname.trim()) || m.name).join('、')}
                        </span>
                      </div>
                    )}
                    {upcoming.length > 0 && (
                      <div>
                        <span style={{ fontSize: getFontSize('bodySmall', isMobile), color: designSystem.colors.warning[700], fontWeight: '600' }}>即將到期 ({upcoming.length})：</span>
                        <span style={{ fontSize: getFontSize('bodySmall', isMobile), color: designSystem.colors.text.secondary }}>
                          {upcoming.map((m: any) => (m.nickname && m.nickname.trim()) || m.name).join('、')}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })()}
              
              {expiringBoards.length > 0 && (() => {
                const today = getVenueDateString()
                const expiredBoards = expiringBoards.filter((b: any) => b.expires_at < today)
                const upcomingBoards = expiringBoards.filter((b: any) => b.expires_at >= today)
                return (
                  <div style={{ marginTop: '12px' }}>
                    {expiredBoards.length > 0 && (
                      <div style={{ marginBottom: '8px' }}>
                        <span style={{ fontSize: getFontSize('bodySmall', isMobile), color: designSystem.colors.danger[700], fontWeight: '600' }}>已過期置板 ({expiredBoards.length})：</span>
                        <span style={{ fontSize: getFontSize('bodySmall', isMobile), color: designSystem.colors.text.secondary }}>
                          {expiredBoards.map((b: any) => `#${b.slot_number} ${b.member_name}`).join('、')}
                        </span>
                      </div>
                    )}
                    {upcomingBoards.length > 0 && (
                      <div>
                        <span style={{ fontSize: getFontSize('bodySmall', isMobile), color: designSystem.colors.info[700], fontWeight: '600' }}>即將到期置板 ({upcomingBoards.length})：</span>
                        <span style={{ fontSize: getFontSize('bodySmall', isMobile), color: designSystem.colors.text.secondary }}>
                          {upcomingBoards.map((b: any) => `#${b.slot_number} ${b.member_name}`).join('、')}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      )}

      {/* 會員列表 */}
      <div style={{ 
        display: 'grid',
        gap: '20px'
      }}>
        {filteredMembers.length === 0 ? (
          <div style={{ ...getEmptyStateStyle(isMobile), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div>
              {(searchTerm || membershipTypeFilter !== 'all' || expiringFilter !== 'none' || lineBindingFilter !== 'all')
                ? '找不到符合的會員'
                : '尚無會員資料'}
            </div>
            {(searchTerm || membershipTypeFilter !== 'all' || expiringFilter !== 'none' || lineBindingFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('')
                  setMembershipTypeFilter('all')
                  setExpiringFilter('none')
                  setLineBindingFilter('all')
                }}
                style={getButtonStyle('outline', 'small', isMobile)}
              >
                清除篩選
              </button>
            )}
          </div>
        ) : (
          filteredMembers.map(member => {
            const typeBadge = membershipTypeBadge(member.membership_type)
            const cardBg = member.status === 'inactive'
              ? designSystem.colors.background.main
              : designSystem.colors.background.card
            return (
            <div
              key={member.id}
              style={{
                background: cardBg,
                padding: isMobile ? '16px 16px' : '20px 22px',
                borderRadius: designSystem.borderRadius.lg,
                boxShadow: cardShadow,
                transition: designSystem.transitions.normal,
                cursor: 'pointer',
                border: cardBorder,
                position: 'relative',
                opacity: member.status === 'inactive' ? 0.72 : 1
              }}
              onClick={() => {
                setSelectedMemberId(member.id)
                setDetailDialogOpen(true)
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = designSystem.colors.text.secondary
                e.currentTarget.style.boxShadow = cardShadowHover
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = designSystem.colors.border.light
                e.currentTarget.style.boxShadow = cardShadow
              }}
              onTouchStart={(e) => {
                e.currentTarget.style.background = designSystem.colors.background.main
              }}
              onTouchEnd={(e) => {
                e.currentTarget.style.background = cardBg
              }}
              onTouchCancel={(e) => {
                e.currentTarget.style.background = cardBg
              }}
            >
              <div style={{ position: 'relative', minWidth: 0, maxWidth: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: getFontSize('h3', isMobile), fontWeight: 750, color: designSystem.colors.text.primary, letterSpacing: '-0.025em' }}>
                      {member.nickname && member.nickname.trim() ? member.nickname : member.name}
                    </h3>
                    {member.nickname && member.nickname.trim() && (
                      <span style={{ fontSize: getFontSize('bodySmall', isMobile), color: designSystem.colors.text.disabled }}>
                        ({member.name})
                      </span>
                    )}
                    <span style={getBadgeStyle(typeBadge.variant, 'small')}>
                      {typeBadge.label}
                    </span>
                    {member.status === 'inactive' && (
                      <span style={getBadgeStyle('default', 'small')}>已隱藏</span>
                    )}
                    {member.birthday && (() => {
                      const currentMonth = Number(getVenueDateString().slice(5, 7))
                      const birthMonth = Number(member.birthday.slice(5, 7))
                      return birthMonth === currentMonth
                    })() && (
                      <span style={{ ...getBadgeStyle('warning', 'small'), fontWeight: 500 }}>
                        本月壽星
                      </span>
                    )}
                  </div>

                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    gap: isMobile ? '4px' : '6px',
                    fontSize: getFontSize('bodySmall', isMobile),
                    color: designSystem.colors.text.disabled,
                  }}>
                    <div style={{ display: 'flex', gap: isMobile ? '10px' : '16px', flexWrap: 'wrap' }}>
                      {member.phone && (
                        <div>{member.phone}</div>
                      )}
                      {member.birthday && (
                        <div>生日 {formatDate(member.birthday)}</div>
                      )}
                      {member.partner && (
                        <div 
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedMemberId(member.partner!.id)
                            setDetailDialogOpen(true)
                          }}
                          style={{ 
                            color: designSystem.colors.info[700], 
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            textDecorationStyle: 'dotted',
                            textUnderlineOffset: '2px'
                          }}
                          title={`點擊查看 ${member.partner.nickname || member.partner.name} 的資料`}
                        >
                          配對：{member.partner.nickname || member.partner.name}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span
                        title={member.is_line_bound ? '已綁定 LINE' : '未綁定 LINE'}
                        style={getBadgeStyle(member.is_line_bound ? 'success' : 'default', 'small')}
                      >
                        {member.is_line_bound ? 'LINE 已綁定' : 'LINE 未綁定'}
                      </span>
                      {member.is_line_bound && member.last_liff_login_at && (
                        <span style={{
                          fontSize: getFontSize('bodySmall', isMobile),
                          color: designSystem.colors.text.secondary,
                        }}>
                          最後登入: {formatDbTimestampDisplay(member.last_liff_login_at)}
                        </span>
                      )}
                      {member.is_line_bound && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleUnbindLine(member.id, member.nickname || member.name)
                          }}
                          style={{
                            ...getButtonStyle('outline', 'small', isMobile),
                            background: designSystem.colors.danger[50],
                            color: designSystem.colors.danger[700],
                            borderColor: `${designSystem.colors.danger[500]}66`,
                            fontSize: getFontSize('bodySmall', isMobile),
                            fontWeight: 600,
                            padding: '4px 10px',
                          }}
                          title="移除 LINE 綁定"
                        >
                          移除綁定
                        </button>
                      )}
                    </div>
                    {(member.membership_start_date || member.membership_end_date) && (
                      <div style={{ 
                        color: isDateExpired(member.membership_end_date)
                          ? designSystem.colors.danger[700]
                          : designSystem.colors.text.secondary
                      }}>
                        會籍：{member.membership_start_date ? formatDate(member.membership_start_date) : '?'} → {member.membership_end_date ? formatDate(member.membership_end_date) : '?'}
                        {isDateExpired(member.membership_end_date) && ' (已過期)'}
                      </div>
                    )}
                    {member.board_slots && member.board_slots.length > 0 && (
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '2px' }}>
                        {member.board_slots.map((slot, index) => {
                          const slotExpired = isDateExpired(slot.expires_at)
                          return (
                            <div key={index} style={{ 
                              color: slotExpired
                                ? designSystem.colors.danger[700]
                                : designSystem.colors.success[700],
                              fontSize: getFontSize('button', isMobile)
                            }}>
                              置板 #{slot.slot_number}：{slot.start_date ? formatDate(slot.start_date) : '?'} → {slot.expires_at ? formatDate(slot.expires_at) : '?'}
                              {slotExpired && ' (已過期)'}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {member.notes && (
                    <div style={{ 
                      marginTop: '10px',
                      paddingTop: '10px',
                      fontSize: getFontSize('button', isMobile),
                      color: designSystem.colors.text.secondary,
                      borderTop: `1px solid ${designSystem.colors.border.light}`,
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                      maxWidth: '100%',
                      lineHeight: '1.5'
                    }}>
                      {member.notes}
                    </div>
                  )}
                </div>

                {member.member_notes && member.member_notes.length > 0 && (() => {
                  const allNotes = member.member_notes.slice(-10)
                  const previewCount = 2
                  const isExpanded = expandedMemoMemberIds.has(member.id)
                  const visibleNotes = isExpanded ? allNotes : allNotes.slice(-previewCount)
                  return (
                  <div style={{ 
                    marginTop: '12px',
                    paddingTop: '12px',
                    borderTop: `1px solid ${designSystem.colors.border.light}`,
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      marginBottom: '10px',
                    }}>
                      <div style={{ fontSize: getFontSize('button', isMobile), color: designSystem.colors.text.primary, fontWeight: 650 }}>
                        備忘錄 ({member.member_notes.length})
                      </div>
                      {allNotes.length > previewCount && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setExpandedMemoMemberIds((prev) => {
                              const next = new Set(prev)
                              if (next.has(member.id)) next.delete(member.id)
                              else next.add(member.id)
                              return next
                            })
                          }}
                          style={{
                            ...getButtonStyle('ghost', 'small', isMobile),
                            padding: '2px 8px',
                            fontSize: getFontSize('bodySmall', isMobile),
                            color: designSystem.colors.text.secondary,
                          }}
                        >
                          {isExpanded ? '收合' : '展開全部'}
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {visibleNotes.map((note) => {
                        const eventColor = NOTE_EVENT_COLORS[note.event_type] || designSystem.colors.text.secondary
                        return (
                          <div key={note.id} style={{
                            fontSize: getFontSize('button', isMobile),
                            padding: '8px 10px',
                            color: designSystem.colors.text.primary,
                            lineHeight: '1.45',
                            borderLeft: `3px solid ${eventColor}`,
                            background: designSystem.colors.background.main,
                            borderRadius: `0 ${designSystem.borderRadius.md} ${designSystem.borderRadius.md} 0`,
                          }}>
                            {note.event_date && (
                              <span style={{ color: designSystem.colors.text.secondary, marginRight: '8px' }}>
                                {note.event_date}
                              </span>
                            )}
                            <span style={{
                              color: eventColor,
                              fontWeight: 650,
                              fontSize: getFontSize('bodySmall', isMobile),
                              marginRight: '8px',
                            }}>
                              {note.event_type}
                            </span>
                            {note.description}
                          </div>
                        )
                      })}
                      {member.member_notes.length > 10 && isExpanded && (
                        <div style={{ fontSize: getFontSize('bodySmall', isMobile), color: designSystem.colors.text.secondary, textAlign: 'center', marginTop: '4px' }}>
                          還有 {member.member_notes.length - 10} 則較舊的備忘錄（詳情可見）...
                        </div>
                      )}
                    </div>
                  </div>
                  )
                })()}
            </div>
            )
          })
        )}
      </div>

      {/* 次要功能按鈕 */}
      <div style={{ 
        display: 'flex', 
        gap: '12px', 
        justifyContent: 'center',
        marginTop: '30px',
        marginBottom: '20px',
        flexWrap: 'wrap'
      }}>
        <button
          data-track="member_boards_link"
          onClick={() => navigate('/boards')}
          style={getButtonStyle('outline', 'small', isMobile)}
        >
          置板
        </button>
      </div>

      {/* Footer */}
      <Footer />
      </div>

      {/* 新增會員彈窗 */}
      <AddMemberDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onSuccess={() => loadMembers(true)}
      />

      {/* 會員詳情彈窗 */}
      <MemberDetailDialog
        open={detailDialogOpen}
        memberId={selectedMemberId}
        onClose={() => {
          setDetailDialogOpen(false)
          setSelectedMemberId(null)
        }}
        onUpdate={() => loadMembers(true)}
        onSwitchMember={(memberId) => setSelectedMemberId(memberId)}
        onArchiveMember={handleArchiveMember}
        onRestoreMember={handleRestoreMember}
      />
      
      <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
    </div>
  )
}

