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
import { getLocalDateString } from '../../utils/date'

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
  board_count?: number  // 置板數量（從 board_storage 計算）
  board_slots?: Array<{ slot_number: number; start_date: string | null; expires_at: string | null }>  // 置板詳細資訊
  partner?: Member | null  // 配對會員資料
  member_notes?: MemberNote[]  // 會員備忘錄
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
  const [showExpiringDetails, setShowExpiringDetails] = useState(false) // 收合/展開到期詳情
  const [sortBy, setSortBy] = useState<string>('nickname') // 'nickname', 'balance', 'membership_end_date'

  useEffect(() => {
    loadMembers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInactive])

  useEffect(() => {
    loadExpiringData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 格式化日期為 YYYY-MM-DD
  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    
    // 格式 1: YYYY-MM-DD (已經是標準格式)
    if (dateStr.includes('-') && dateStr.split('-').length === 3) {
      const [year, month, day] = dateStr.split('-')
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    }
    // 格式 2: MM/DD/YYYY (轉換為 YYYY-MM-DD)
    else if (dateStr.includes('/')) {
      const parts = dateStr.split('/')
      if (parts.length === 3) {
        const [month, day, year] = parts
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      }
    }
    
    return dateStr
  }

  const loadExpiringData = async () => {
    // 計算30天後的日期
    const todayDate = new Date()
    const thirtyDaysLater = new Date(todayDate)
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30)
    const thirtyDaysLaterStr = `${thirtyDaysLater.getFullYear()}-${String(thirtyDaysLater.getMonth() + 1).padStart(2, '0')}-${String(thirtyDaysLater.getDate()).padStart(2, '0')}`

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
      // 在客戶端過濾：所有已過期 + 未來30天內到期
      const filtered = membershipResult.data.filter((m: any) => {
        if (!m.membership_end_date) return false
        
        // 轉換日期格式：MM/DD/YYYY -> YYYY-MM-DD
        let normalizedDate = m.membership_end_date
        if (m.membership_end_date.includes('/')) {
          const [month, day, year] = m.membership_end_date.split('/')
          normalizedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
        }
        
        // 只顯示 <= 今天+30天 的（包含所有已過期和即將到期）
        return normalizedDate <= thirtyDaysLaterStr
      })
      
      setExpiringMemberships(filtered)
    }
    
    if (boardResult.data) {
      // 在客戶端過濾：所有已過期 + 未來30天內到期
      const filtered = boardResult.data.filter((b: any) => {
        if (!b.expires_at) return false
        return b.expires_at <= thirtyDaysLaterStr
      })
      
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
      // 並行查詢會員資料、置板資料和備忘錄
      const [membersResult, boardResult, notesResult] = await Promise.all([
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
          .in('status', showInactive ? ['active', 'inactive'] : ['active'])
          .order('nickname', { ascending: true, nullsFirst: false })
          .limit(200),  // 限制最多 200 筆，避免一次載入太多
        
        supabase
          .from('board_storage')
          .select('member_id, slot_number, start_date, expires_at')
          .eq('status', 'active')
          .order('slot_number', { ascending: true }),
        
        // @ts-ignore - member_notes 表
        supabase
          .from('member_notes')
          .select('id, member_id, event_date, event_type, description')
          .order('event_date', { ascending: true, nullsFirst: true })
      ])

      if (membersResult.error) throw membersResult.error

      const membersData = membersResult.data || []
      const boardData = boardResult.data || []
      const notesData = notesResult.data || []

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

      // 合併資料
      const membersWithBoards = membersData.map((member: any) => ({
        ...member,
        board_slots: memberBoards[member.id] || [],
        board_count: memberBoards[member.id]?.length || 0,
        partner: member.membership_partner_id ? partnersMap[member.membership_partner_id] : null,
        member_notes: memberNotes[member.id] || []
      }))

      setMembers(membersWithBoards)
    } catch (error) {
      console.error('載入會員失敗:', error)
      toast.error('載入會員失敗')
    } finally {
      setLoading(false)
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

      const today = new Date().toISOString().split('T')[0]
      const hasPartner = member.membership_type === 'dual' && member.membership_partner_id

      // 1. 如果有配對，解除配對關係
      if (hasPartner && member.membership_partner_id) {
        const partnerId = member.membership_partner_id

        // 配對會員改為一般會員
        await supabase
          .from('members')
          .update({ 
            membership_type: 'general',
            membership_partner_id: null 
          })
          .eq('id', partnerId)

        // 幫配對會員加備忘錄
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
      const today = new Date().toISOString().split('T')[0]
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

  const handleExportMembers = async () => {
    try {
      // 並行載入會員資料和備忘錄
      const [membersResult, notesResult] = await Promise.all([
        supabase
          .from('members')
          .select(`
            id, name, nickname, phone, birthday, notes, 
            balance, vip_voucher_amount, designated_lesson_minutes, 
            boat_voucher_g23_minutes, boat_voucher_g21_panther_minutes, 
            gift_boat_hours, membership_end_date, membership_start_date,
            membership_type, membership_partner_id,
            status, created_at
          `)
          .order('created_at', { ascending: false }),
        // @ts-ignore
        supabase
          .from('member_notes')
          .select('member_id, event_date, event_type, description')
          .order('event_date', { ascending: true })
      ])

      if (membersResult.error) throw membersResult.error
      const allMembers = membersResult.data || []
      
      if (allMembers.length === 0) {
        toast.warning('沒有會員資料可以導出')
        return
      }

      // 整理備忘錄資料
      const notesData = notesResult.data || []
      const memberNotesMap: Record<string, string[]> = {}
      notesData.forEach((note: any) => {
        if (!memberNotesMap[note.member_id]) {
          memberNotesMap[note.member_id] = []
        }
        const noteStr = note.event_date 
          ? `${note.event_date} ${note.description}`
          : note.description
        memberNotesMap[note.member_id].push(noteStr)
      })

      // 載入配對會員資料
      const partnerIds = allMembers
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

      // 準備 CSV 內容
      const headers = [
        '姓名', '暱稱', '會籍類型', '配對會員', 
        '會員開始日期', '會員截止日', '電話', '生日', '備忘錄', '狀態'
      ]

      const rows = allMembers.map((member: any) => {
        // 會籍類型
        let membershipTypeLabel = '一般會員'
        if (member.membership_type === 'dual') {
          membershipTypeLabel = '雙人會員'
        } else if (member.membership_type === 'guest') {
          membershipTypeLabel = '非會員'
        } else if (member.membership_type === 'es') {
          membershipTypeLabel = 'ES'
        }
        
        // 配對會員
        const partnerName = member.membership_partner_id && partnersMap[member.membership_partner_id]
          ? (partnersMap[member.membership_partner_id].nickname || partnersMap[member.membership_partner_id].name)
          : ''

        // 備忘錄（用分號分隔）
        const notesStr = memberNotesMap[member.id]?.join(' ; ') || ''

        return [
          member.name || '',
          member.nickname || '',
          membershipTypeLabel,
          partnerName,
          member.membership_start_date || '',
          member.membership_end_date || '',
          member.phone || '',
          member.birthday || '',
          notesStr,
          member.status === 'active' ? '啟用' : '隱藏'
        ]
      })

      // 生成 CSV 內容
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => {
          // 處理包含逗號、換行符或雙引號的內容
          const cellStr = String(cell)
          if (cellStr.includes(',') || cellStr.includes('\n') || cellStr.includes('"')) {
            return `"${cellStr.replace(/"/g, '""')}"`
          }
          return cellStr
        }).join(','))
      ].join('\n')

      // 下載檔案
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      
      const today = new Date()
      const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
      link.setAttribute('download', `會員資料_${dateStr}.csv`)
      
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success(`成功導出 ${allMembers.length} 位會員資料`)
    } catch (err: any) {
      console.error('導出失敗:', err)
      toast.error('導出失敗: ' + err.message)
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

    // 排序
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'balance':
          // 餘額高到低
          return (b.balance || 0) - (a.balance || 0)
        case 'membership_end_date':
          // 會籍到期日近到遠（空值排最後）
          if (!a.membership_end_date && !b.membership_end_date) return 0
          if (!a.membership_end_date) return 1
          if (!b.membership_end_date) return -1
          return a.membership_end_date.localeCompare(b.membership_end_date)
        case 'nickname':
        default:
          // 暱稱 A-Z
          const nameA = (a.nickname || a.name || '').toLowerCase()
          const nameB = (b.nickname || b.name || '').toLowerCase()
          return nameA.localeCompare(nameB, 'zh-TW')
      }
    })
    
    return result
  }, [members, searchTerm, membershipTypeFilter, expiringFilter, expiringMemberships, expiringBoards, sortBy])


  if (loading) {
    return (
      <div style={{ 
        padding: isMobile ? '12px' : '20px',
        minHeight: '100vh',
        background: '#f5f5f5'
      }}>
        <PageHeader title="👥 會員管理" user={user} showBaoLink={true} />

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
            background: 'white', 
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }} />
          <div style={{ 
            width: '120px', 
            height: '48px', 
            background: '#e0e0e0', 
            borderRadius: '8px'
          }} />
        </div>

        {/* 會員列表骨架屏 */}
        <div style={{ 
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div 
              key={i}
              style={{
                padding: '16px',
                borderBottom: i < 7 ? '1px solid #f0f0f0' : 'none',
                display: 'flex',
                gap: '12px',
                alignItems: 'center'
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ 
                  width: '120px', 
                  height: '18px', 
                  background: '#e0e0e0', 
                  borderRadius: '4px',
                  marginBottom: '8px'
                }} />
                <div style={{ 
                  width: '80px', 
                  height: '14px', 
                  background: '#f0f0f0', 
                  borderRadius: '4px'
                }} />
              </div>
              <div style={{ 
                width: '60px', 
                height: '32px', 
                background: '#e0e0e0', 
                borderRadius: '6px'
              }} />
            </div>
          ))}
        </div>

        <Footer />
      </div>
    )
  }

  return (
    <div style={{ 
      padding: isMobile ? '12px 16px' : '20px',
      minHeight: '100vh',
      background: '#f5f5f5'
    }}>
      <PageHeader title="👥 會員管理" user={user} showBaoLink={true} />

      {/* 搜尋欄 + 新增會員按鈕 */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '12px',
        alignItems: 'center'
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
              width: '100%',
              padding: isMobile ? '10px 14px' : '12px 16px',
              paddingRight: searchTerm ? '40px' : '16px',
              border: '1px solid #dee2e6',
              borderRadius: '8px',
              fontSize: '14px',
              outline: 'none',
              background: 'white',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
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
                background: '#999',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '20px',
                height: '20px',
                fontSize: '12px',
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
          onClick={() => setAddDialogOpen(true)}
          style={{
            padding: isMobile ? '10px 16px' : '12px 20px',
            background: '#5a5a5a',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: isMobile ? '14px' : '14px',
            fontWeight: '600',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          + 新增會員
        </button>
      </div>

      {/* 統一篩選列 */}
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        flexWrap: 'wrap',
        marginBottom: '16px',
        alignItems: 'center'
      }}>
        {/* 會員類型篩選 */}
        {[
          { value: 'all', label: '全部', count: members.length },
          { value: 'member', label: '會員', count: members.filter(m => m.membership_type === 'general' || m.membership_type === 'dual').length },
          { value: 'general', label: '一般會員', count: members.filter(m => m.membership_type === 'general').length },
          { value: 'dual', label: '雙人會員', count: members.filter(m => m.membership_type === 'dual').length },
          { value: 'guest', label: '非會員', count: members.filter(m => m.membership_type === 'guest').length },
          { value: 'es', label: 'ES', count: members.filter(m => m.membership_type === 'es').length }
        ].map(type => (
          <button
            key={type.value}
            onClick={() => {
              setMembershipTypeFilter(type.value)
              setExpiringFilter('none')
            }}
            style={{
              padding: '6px 12px',
              background: membershipTypeFilter === type.value && expiringFilter === 'none' ? '#5a5a5a' : 'white',
              color: membershipTypeFilter === type.value && expiringFilter === 'none' ? 'white' : '#666',
              border: `1px solid ${membershipTypeFilter === type.value && expiringFilter === 'none' ? '#5a5a5a' : '#ddd'}`,
              borderRadius: '6px',
              fontSize: '13px',
              cursor: 'pointer',
              fontWeight: membershipTypeFilter === type.value && expiringFilter === 'none' ? '600' : 'normal'
            }}
          >
            {type.label} ({type.count})
          </button>
        ))}

        {/* 分隔線 */}
        <div style={{ width: '1px', height: '24px', background: '#ddd', margin: '0 4px' }} />

        {/* 到期篩選 */}
        <button
          onClick={() => {
            setExpiringFilter(expiringFilter === 'membership' ? 'none' : 'membership')
            if (expiringFilter !== 'membership') setMembershipTypeFilter('all')
          }}
          disabled={expiringMemberships.length === 0}
          style={{
            padding: '6px 12px',
            background: expiringFilter === 'membership' ? '#ff9800' : 'white',
            color: expiringFilter === 'membership' ? 'white' : (expiringMemberships.length > 0 ? '#ff9800' : '#ccc'),
            border: `1px solid ${expiringFilter === 'membership' ? '#ff9800' : (expiringMemberships.length > 0 ? '#ff9800' : '#ddd')}`,
            borderRadius: '6px',
            fontSize: '13px',
            cursor: expiringMemberships.length > 0 ? 'pointer' : 'default',
            fontWeight: expiringFilter === 'membership' ? '600' : 'normal',
            opacity: expiringMemberships.length === 0 ? 0.5 : 1
          }}
        >
          ⚠️ 會籍到期 ({expiringMemberships.length})
        </button>

        <button
          onClick={() => {
            setExpiringFilter(expiringFilter === 'board' ? 'none' : 'board')
            if (expiringFilter !== 'board') setMembershipTypeFilter('all')
          }}
          disabled={expiringBoards.length === 0}
          style={{
            padding: '6px 12px',
            background: expiringFilter === 'board' ? '#2196F3' : 'white',
            color: expiringFilter === 'board' ? 'white' : (expiringBoards.length > 0 ? '#2196F3' : '#ccc'),
            border: `1px solid ${expiringFilter === 'board' ? '#2196F3' : (expiringBoards.length > 0 ? '#2196F3' : '#ddd')}`,
            borderRadius: '6px',
            fontSize: '13px',
            cursor: expiringBoards.length > 0 ? 'pointer' : 'default',
            fontWeight: expiringFilter === 'board' ? '600' : 'normal',
            opacity: expiringBoards.length === 0 ? 0.5 : 1
          }}
        >
          🏄 置板到期 ({expiringBoards.length})
        </button>
        
        {/* 分隔線 */}
        <div style={{ width: '1px', height: '24px', background: '#ddd', margin: '0 4px' }} />

        {/* 排序選擇 */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          style={{
            padding: '6px 10px',
            border: '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '13px',
            background: 'white',
            cursor: 'pointer',
            color: '#666'
          }}
        >
          <option value="nickname">按暱稱</option>
          <option value="balance">按餘額</option>
          <option value="membership_end_date">按會籍到期</option>
        </select>
        
        {/* 包含已隱藏 */}
        <label style={{
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          gap: '6px',
          marginLeft: 'auto',
          fontSize: '13px',
          color: '#666'
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

      {/* 搜尋結果數量提示 */}
      {searchTerm && (
        <div style={{
          fontSize: '13px',
          color: '#666',
          marginBottom: '12px',
          padding: '8px 12px',
          background: '#f0f7ff',
          borderRadius: '6px',
          border: '1px solid #d0e3ff'
        }}>
          🔍 搜尋「{searchTerm}」找到 <strong>{filteredMembers.length}</strong> 位會員
        </div>
      )}

      {/* 到期詳情（收合式） */}
      {(expiringMemberships.length > 0 || expiringBoards.length > 0) && (
        <div style={{
          background: 'white',
          borderRadius: '8px',
          marginBottom: '16px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
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
              fontSize: '13px',
              color: '#666'
            }}
          >
            <span>
              📋 到期詳情：會籍 {expiringMemberships.length} 位、置板 {expiringBoards.length} 位
            </span>
            <span>{showExpiringDetails ? '▲ 收合' : '▼ 展開'}</span>
          </button>
          
          {showExpiringDetails && (
            <div style={{ padding: '0 16px 16px', borderTop: '1px solid #eee' }}>
              {expiringMemberships.length > 0 && (() => {
                const today = getLocalDateString()
                const expired = expiringMemberships.filter((m: any) => {
                  let normalizedDate = m.membership_end_date
                  if (m.membership_end_date.includes('/')) {
                    const [month, day, year] = m.membership_end_date.split('/')
                    normalizedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
                  }
                  return normalizedDate < today
                })
                const upcoming = expiringMemberships.filter((m: any) => {
                  let normalizedDate = m.membership_end_date
                  if (m.membership_end_date.includes('/')) {
                    const [month, day, year] = m.membership_end_date.split('/')
                    normalizedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
                  }
                  return normalizedDate >= today
                })
                return (
                  <div style={{ marginTop: '12px' }}>
                    {expired.length > 0 && (
                      <div style={{ marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#f44336', fontWeight: '600' }}>⚠️ 已過期 ({expired.length})：</span>
                        <span style={{ fontSize: '12px', color: '#666' }}>
                          {expired.map((m: any) => (m.nickname && m.nickname.trim()) || m.name).join('、')}
                        </span>
                      </div>
                    )}
                    {upcoming.length > 0 && (
                      <div>
                        <span style={{ fontSize: '12px', color: '#ff9800', fontWeight: '600' }}>⏰ 即將到期 ({upcoming.length})：</span>
                        <span style={{ fontSize: '12px', color: '#666' }}>
                          {upcoming.map((m: any) => (m.nickname && m.nickname.trim()) || m.name).join('、')}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })()}
              
              {expiringBoards.length > 0 && (() => {
                const today = getLocalDateString()
                const expiredBoards = expiringBoards.filter((b: any) => b.expires_at < today)
                const upcomingBoards = expiringBoards.filter((b: any) => b.expires_at >= today)
                return (
                  <div style={{ marginTop: expiringMemberships.length > 0 ? '12px' : '12px' }}>
                    {expiredBoards.length > 0 && (
                      <div style={{ marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#f44336', fontWeight: '600' }}>🏄 已過期置板 ({expiredBoards.length})：</span>
                        <span style={{ fontSize: '12px', color: '#666' }}>
                          {expiredBoards.map((b: any) => `#${b.slot_number} ${b.member_name}`).join('、')}
                        </span>
                      </div>
                    )}
                    {upcomingBoards.length > 0 && (
                      <div>
                        <span style={{ fontSize: '12px', color: '#2196F3', fontWeight: '600' }}>🏄 即將到期置板 ({upcomingBoards.length})：</span>
                        <span style={{ fontSize: '12px', color: '#666' }}>
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
        gap: '15px'
      }}>
        {filteredMembers.length === 0 ? (
          <div style={{
            background: 'white',
            padding: '40px',
            borderRadius: '12px',
            textAlign: 'center',
            color: '#999',
            fontSize: '16px'
          }}>
            {searchTerm ? '找不到符合的會員' : '尚無會員資料'}
          </div>
        ) : (
          filteredMembers.map(member => (
            <div
              key={member.id}
              style={{
                background: member.status === 'inactive' ? '#f5f5f5' : 'white',
                padding: '20px',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                transition: 'all 0.2s',
                cursor: 'pointer',
                border: '2px solid transparent',
                position: 'relative',
                opacity: member.status === 'inactive' ? 0.7 : 1
              }}
              onClick={() => {
                setSelectedMemberId(member.id)
                setDetailDialogOpen(true)
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#5a5a5a'
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(90, 90, 90, 0.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'transparent'
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'
              }}
            >
              {/* 上下分層式佈局 */}
              <div>
                
                {/* 第一層：會籍資料 */}
                <div style={{ 
                  background: '#f8f9fa',
                  padding: isMobile ? '12px' : '16px',
                  borderRadius: '8px',
                  marginBottom: '12px',
                  position: 'relative',
                  minWidth: 0,
                  maxWidth: '100%'
                }}>
                  {/* 隱藏/恢復按鈕 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (member.status === 'inactive') {
                        handleRestoreMember(member.id)
                      } else {
                        handleArchiveMember(member.id)
                      }
                    }}
                    style={{
                      position: 'absolute',
                      top: isMobile ? '8px' : '12px',
                      right: isMobile ? '8px' : '12px',
                      background: member.status === 'inactive' ? '#4caf50' : '#f5f5f5',
                      color: member.status === 'inactive' ? 'white' : '#999',
                      border: 'none',
                      borderRadius: '6px',
                      padding: isMobile ? '3px 8px' : '4px 10px',
                      fontSize: isMobile ? '11px' : '12px',
                      cursor: 'pointer',
                      fontWeight: '500',
                      transition: 'all 0.2s',
                      zIndex: 10
                    }}
                  >
                    {member.status === 'inactive' ? '恢復' : '隱藏'}
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '10px', marginBottom: '10px', flexWrap: 'wrap', paddingRight: isMobile ? '50px' : '60px' }}>
                    <h3 style={{ margin: 0, fontSize: isMobile ? '16px' : '18px', fontWeight: 'bold' }}>
                      {member.nickname && member.nickname.trim() ? member.nickname : member.name}
                    </h3>
                    {member.nickname && member.nickname.trim() && (
                      <span style={{ fontSize: isMobile ? '12px' : '13px', color: '#999' }}>
                        ({member.name})
                      </span>
                    )}
                    {member.membership_type !== 'es' && (
                      <span style={{ 
                        background: member.membership_type === 'guest' ? '#fff9e6' : '#e3f2fd',
                        color: member.membership_type === 'guest' ? '#856404' : '#1976d2',
                        padding: '3px 10px',
                        borderRadius: '12px',
                        fontWeight: 'bold',
                        fontSize: '12px'
                      }}>
                        {member.membership_type === 'guest' ? '🎫 非會員' : '👤 會員'}
                      </span>
                    )}
                    {member.membership_type === 'dual' && (
                      <span style={{ 
                        fontSize: '12px', 
                        color: '#fff',
                        background: '#2196F3',
                        padding: '3px 10px',
                        borderRadius: '12px',
                        fontWeight: '600'
                      }}>
                        雙人會籍
                      </span>
                    )}
                    {member.membership_type === 'es' && (
                      <span style={{ 
                        fontSize: '12px', 
                        color: '#fff',
                        background: '#888',
                        padding: '3px 10px',
                        borderRadius: '12px',
                        fontWeight: '600'
                      }}>
                        ES
                      </span>
                    )}
                    {member.status === 'inactive' && (
                      <span style={{ 
                        fontSize: '12px', 
                        color: '#fff',
                        background: '#9e9e9e',
                        padding: '3px 10px',
                        borderRadius: '12px',
                        fontWeight: '600'
                      }}>
                        已隱藏
                      </span>
                    )}
                  </div>

                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    gap: isMobile ? '4px' : '6px',
                    fontSize: isMobile ? '12px' : '13px',
                    color: '#666'
                  }}>
                    <div style={{ display: 'flex', gap: isMobile ? '10px' : '16px', flexWrap: 'wrap' }}>
                      {member.phone && (
                        <div>📱 {member.phone}</div>
                      )}
                      {member.birthday && (
                        <div>🎂 {formatDate(member.birthday)}</div>
                      )}
                      {member.partner && (
                        <div 
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedMemberId(member.partner!.id)
                            setDetailDialogOpen(true)
                          }}
                          style={{ 
                            color: '#2196F3', 
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            textDecorationStyle: 'dotted',
                            textUnderlineOffset: '2px'
                          }}
                          title={`點擊查看 ${member.partner.nickname || member.partner.name} 的資料`}
                        >
                          🔗 配對：{member.partner.nickname || member.partner.name}
                        </div>
                      )}
                    </div>
                    {(member.membership_start_date || member.membership_end_date) && (
                      <div style={{ 
                        color: member.membership_end_date && new Date(member.membership_end_date) < new Date() ? '#f44336' : '#666'
                      }}>
                        🎫 會籍：{member.membership_start_date ? formatDate(member.membership_start_date) : '?'} → {member.membership_end_date ? formatDate(member.membership_end_date) : '?'}
                        {member.membership_end_date && new Date(member.membership_end_date) < new Date() && ' (已過期)'}
                      </div>
                    )}
                    {/* 置板資訊 */}
                    {member.board_slots && member.board_slots.length > 0 && (
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '4px' }}>
                        {member.board_slots.map((slot, index) => {
                          const isExpired = slot.expires_at && new Date(slot.expires_at) < new Date()
                          return (
                            <div key={index} style={{ 
                              color: isExpired ? '#f44336' : '#2e7d32',
                              fontSize: '13px'
                            }}>
                              🏄 置板 #{slot.slot_number}：{slot.start_date ? formatDate(slot.start_date) : '?'} → {slot.expires_at ? formatDate(slot.expires_at) : '?'}
                              {isExpired && ' (已過期)'}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {member.notes && (
                    <div style={{ 
                      marginTop: '8px',
                      padding: '8px',
                      fontSize: '13px',
                      color: '#666',
                      background: '#f9f9f9',
                      borderRadius: '4px',
                      borderLeft: '3px solid #ddd',
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                      maxWidth: '100%',
                      lineHeight: '1.5'
                    }}>
                      💬 {member.notes}
                    </div>
                  )}
                </div>

                {/* 第二層：備忘錄 */}
                {member.member_notes && member.member_notes.length > 0 && (
                  <div style={{ 
                    background: '#fff',
                    padding: isMobile ? '10px' : '12px',
                    borderRadius: '6px',
                    marginBottom: '10px',
                    border: '1px solid #e0e0e0'
                  }}>
                    <div style={{ fontSize: '13px', color: '#555', marginBottom: '10px', fontWeight: '600' }}>
                      📝 備忘錄 ({member.member_notes.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {member.member_notes.slice(-10).map((note) => {
                        const eventColors: Record<string, string> = {
                          '續約': '#4caf50',
                          '購買': '#2196f3',
                          '贈送': '#9c27b0',
                          '使用': '#ff9800',
                          '入會': '#e91e63',
                          '備註': '#607d8b'
                        }
                        const color = eventColors[note.event_type] || '#607d8b'
                        return (
                          <div key={note.id} style={{
                            fontSize: '13px',
                            padding: '6px 10px',
                            borderLeft: `3px solid ${color}`,
                            color: '#333',
                            lineHeight: '1.4'
                          }}>
                            {note.event_date && (
                              <span style={{ color: '#888', marginRight: '8px' }}>
                                {note.event_date}
                              </span>
                            )}
                            {note.description}
                          </div>
                        )
                      })}
                      {member.member_notes.length > 10 && (
                        <div style={{ fontSize: '12px', color: '#999', textAlign: 'center', marginTop: '4px' }}>
                          還有 {member.member_notes.length - 10} 則較舊的備忘錄...
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </div>
          ))
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
          onClick={handleExportMembers}
          style={{
            padding: '10px 20px',
            background: 'white',
            color: '#666',
            border: '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          📤 匯出會員資料
        </button>
        <button
          onClick={() => navigate('/boards')}
          style={{
            padding: '10px 20px',
            background: 'white',
            color: '#666',
            border: '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          🏄 置板管理
        </button>
      </div>

      {/* Footer */}
      <Footer />

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
      />
      
      <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
    </div>
  )
}

