import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'
import { useNavigate } from 'react-router-dom'
import { AddMemberDialog } from '../components/AddMemberDialog'
import { MemberDetailDialog } from '../components/MemberDetailDialog'
import { PageHeader } from '../components/PageHeader'
import { Footer } from '../components/Footer'
import { useResponsive } from '../hooks/useResponsive'

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
  membership_type: string  // 'general', 'dual', 'board'
  membership_partner_id: string | null
  member_type: string  // 'guest' or 'member'
  board_slot_number: string | null
  board_expiry_date: string | null
  notes: string | null
  status: string
  created_at: string
  board_count?: number  // 置板數量（從 board_storage 計算）
  board_slots?: Array<{ slot_number: number; expires_at: string | null }>  // 置板詳細資訊
  partner?: Member | null  // 配對會員資料
}

interface MemberManagementProps {
  user: User
}

export function MemberManagement({ user }: MemberManagementProps) {
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
  const [membershipTypeFilter, setMembershipTypeFilter] = useState<string>('all') // 'all', 'general', 'dual', 'board'
  
  // TODO: Will use user for creating/updating members and permission control
  // Current user email will be logged for debugging
  console.log('Current user:', user.email)

  useEffect(() => {
    loadMembers()
  }, [showInactive])

  useEffect(() => {
    loadExpiringData()
  }, [])

  const getLocalDateString = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

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
        .select('slot_number, members(name, nickname), expires_at')
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

  const loadMembers = async () => {
    setLoading(true)
    try {
      // 並行查詢會員資料和置板資料（重要：從串行改為並行，提升載入速度）
      const [membersResult, boardResult] = await Promise.all([
        supabase
          .from('members')
          .select(`
            id, name, nickname, phone, birthday, notes, member_type, 
            balance, vip_voucher_amount, designated_lesson_minutes, 
            boat_voucher_g23_minutes, boat_voucher_g21_panther_minutes, 
            gift_boat_hours, membership_end_date, membership_start_date,
            membership_type, membership_partner_id,
            board_slot_number, board_expiry_date,
            status, created_at
          `)
          .eq('status', showInactive ? 'inactive' : 'active')
          .order('created_at', { ascending: false})
          .limit(200),  // 限制最多 200 筆，避免一次載入太多
        
        supabase
          .from('board_storage')
          .select('member_id, slot_number, expires_at')
          .eq('status', 'active')
          .order('slot_number', { ascending: true })
      ])

      if (membersResult.error) throw membersResult.error

      const membersData = membersResult.data || []
      const boardData = boardResult.data || []

      // 整理每個會員的置板資料
      const memberBoards: Record<string, Array<{ slot_number: number; expires_at: string | null }>> = {}
      boardData.forEach((board: any) => {
        if (!memberBoards[board.member_id]) {
          memberBoards[board.member_id] = []
        }
        memberBoards[board.member_id].push({
          slot_number: board.slot_number,
          expires_at: board.expires_at
        })
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
        partner: member.membership_partner_id ? partnersMap[member.membership_partner_id] : null
      }))

      setMembers(membersWithBoards)
    } catch (error) {
      console.error('載入會員失敗:', error)
      alert('載入會員失敗')
    } finally {
      setLoading(false)
    }
  }

  const handleArchiveMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('members')
        .update({ status: 'inactive' })
        .eq('id', memberId)
      
      if (error) throw error
      await loadMembers()
    } catch (err: any) {
      console.error('隱藏會員失敗:', err)
      alert('隱藏會員失敗')
    }
  }

  const handleRestoreMember = async (memberId: string) => {
    try {
      const { error} = await supabase
        .from('members')
        .update({ status: 'active' })
        .eq('id', memberId)
      
      if (error) throw error
      await loadMembers()
    } catch (err: any) {
      console.error('恢復會員失敗:', err)
      alert('恢復會員失敗')
    }
  }

  const handleExportMembers = async () => {
    try {
      // 載入所有會員（包含隱藏的）
      const { data: allMembers, error } = await supabase
        .from('members')
        .select(`
          id, name, nickname, phone, birthday, notes, member_type, 
          balance, vip_voucher_amount, designated_lesson_minutes, 
          boat_voucher_g23_minutes, boat_voucher_g21_panther_minutes, 
          gift_boat_hours, membership_end_date, membership_start_date,
          membership_type, membership_partner_id,
          status, created_at
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      if (!allMembers || allMembers.length === 0) {
        alert('沒有會員資料可以導出')
        return
      }

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
        '姓名', '暱稱', '會員類型', '會籍類型', '配對會員', 
        '會員開始日期', '會員截止日', '電話', '生日', '備註', '狀態'
      ]

      const rows = allMembers.map((member: any) => {
        // 會員類型
        const memberTypeLabel = member.member_type === 'member' ? '會員' : '客人'
        
        // 會籍類型
        let membershipTypeLabel = '一般會員'
        if (member.membership_type === 'dual') {
          membershipTypeLabel = '雙人會員'
        } else if (member.membership_type === 'board') {
          membershipTypeLabel = '置板'
        }
        
        // 配對會員
        const partnerName = member.membership_partner_id && partnersMap[member.membership_partner_id]
          ? (partnersMap[member.membership_partner_id].nickname || partnersMap[member.membership_partner_id].name)
          : ''

        return [
          member.name || '',
          member.nickname || '',
          memberTypeLabel,
          membershipTypeLabel,
          partnerName,
          member.membership_start_date || '',
          member.membership_end_date || '',
          member.phone || '',
          member.birthday || '',
          member.notes || '',
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

      alert(`✅ 成功導出 ${allMembers.length} 位會員資料`)
    } catch (err: any) {
      console.error('導出失敗:', err)
      alert('導出失敗: ' + err.message)
    }
  }

  // 使用 useMemo 快取過濾結果，避免不必要的重複計算
  const filteredMembers = useMemo(() => {
    let result = members
    
    // 篩選會員種類
    if (membershipTypeFilter !== 'all') {
      result = result.filter(member => {
        if (membershipTypeFilter === 'guest') {
          return member.member_type === 'guest'
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
    
    return result
  }, [members, searchTerm, membershipTypeFilter])

  if (loading) {
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center',
        fontSize: '18px',
        color: '#666'
      }}>
        載入中...
      </div>
    )
  }

  return (
    <div style={{ 
      padding: isMobile ? '12px' : '20px',
      minHeight: '100vh',
      background: '#f5f5f5'
    }}>
      <PageHeader title="👥 會員管理" user={user} showBaoLink={true} />

      {/* 快捷功能按鈕 */}
      <div style={{ 
        display: 'flex', 
        gap: isMobile ? '8px' : '12px', 
        marginBottom: isMobile ? '15px' : '20px',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={() => navigate('/member-import')}
          style={{
            flex: isMobile ? '1 1 100%' : '0 0 auto',
            padding: isMobile ? '12px 16px' : '10px 20px',
            background: 'white',
            color: '#666',
            border: '2px solid #e0e0e0',
            borderRadius: '8px',
            fontSize: isMobile ? '14px' : '15px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <span>📥</span>
          <span>匯入</span>
        </button>

        <button
          onClick={handleExportMembers}
          style={{
            flex: isMobile ? '1 1 100%' : '0 0 auto',
            padding: isMobile ? '12px 16px' : '10px 20px',
            background: 'white',
            color: '#666',
            border: '2px solid #e0e0e0',
            borderRadius: '8px',
            fontSize: isMobile ? '14px' : '15px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <span>📤</span>
          <span>匯出</span>
        </button>

        <button
          onClick={() => navigate('/boards')}
          style={{
            flex: isMobile ? '1 1 100%' : '0 0 auto',
            padding: isMobile ? '12px 16px' : '10px 20px',
            background: 'white',
            color: '#666',
            border: '2px solid #e0e0e0',
            borderRadius: '8px',
            fontSize: isMobile ? '14px' : '15px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <span>🏄</span>
          <span>置板管理</span>
        </button>
      </div>

      {/* 搜尋欄與篩選器 */}
      <div style={{ marginBottom: isMobile ? '15px' : '20px' }}>
        <input
          type="text"
          placeholder="搜尋會員（姓名、暱稱）"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: isMobile ? '10px 14px' : '12px 16px',
            border: '1px solid #dee2e6',
            borderRadius: '8px',
            fontSize: '14px',
            outline: 'none',
            transition: 'border-color 0.2s',
            background: 'white',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            marginBottom: '12px'
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = '#667eea'}
          onBlur={(e) => e.currentTarget.style.borderColor = '#dee2e6'}
        />
        
        {/* 會員種類篩選 */}
        <div style={{ 
          display: 'flex', 
          gap: '8px', 
          flexWrap: 'wrap'
        }}>
          {[
            { value: 'all', label: '全部' },
            { value: 'general', label: '一般會員' },
            { value: 'dual', label: '雙人會員' },
            { value: 'board', label: '置板會員' }
          ].map(type => (
            <button
              key={type.value}
              onClick={() => setMembershipTypeFilter(type.value)}
              style={{
                padding: '6px 14px',
                background: membershipTypeFilter === type.value ? '#667eea' : 'white',
                color: membershipTypeFilter === type.value ? 'white' : '#666',
                border: `1px solid ${membershipTypeFilter === type.value ? '#667eea' : '#ddd'}`,
                borderRadius: '6px',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontWeight: membershipTypeFilter === type.value ? '600' : 'normal'
              }}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* 到期提醒區塊 */}
      {(expiringMemberships.length > 0 || expiringBoards.length > 0) && (
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: isMobile ? '16px' : '20px',
          marginBottom: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          border: '1px solid #ffc107'
        }}>
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
              <>
                {expired.length > 0 && (
                  <div style={{ marginBottom: upcoming.length > 0 ? '16px' : '0' }}>
                    <div style={{ 
                      fontSize: isMobile ? '14px' : '15px',
                      fontWeight: '600',
                      color: '#666',
                      marginBottom: '8px'
                    }}>
                      ⚠️ 已過期會籍
                    </div>
                    <div style={{ 
                      display: 'flex', 
                      flexWrap: 'wrap', 
                      gap: '8px'
                    }}>
                      {expired.map((m: any, idx: number) => (
                        <div key={idx} style={{
                          padding: '6px 12px',
                          background: '#f5f5f5',
                          borderRadius: '6px',
                          fontSize: isMobile ? '12px' : '13px',
                          color: '#555',
                          fontWeight: '600'
                        }}>
                          {(m.nickname && m.nickname.trim()) || m.name} ({formatDate(m.membership_end_date)})
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {upcoming.length > 0 && (
                  <div>
                    <div style={{ 
                      fontSize: isMobile ? '14px' : '15px',
                      fontWeight: '600',
                      color: '#666',
                      marginBottom: '8px'
                    }}>
                      ⏰ 即將到期
                    </div>
                    <div style={{ 
                      display: 'flex', 
                      flexWrap: 'wrap', 
                      gap: '8px'
                    }}>
                      {upcoming.map((m: any, idx: number) => (
                        <div key={idx} style={{
                          padding: '6px 12px',
                          background: '#fff3cd',
                          borderRadius: '6px',
                          fontSize: isMobile ? '12px' : '13px',
                          color: '#666'
                        }}>
                          {(m.nickname && m.nickname.trim()) || m.name} ({formatDate(m.membership_end_date)})
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )
          })()}

          {expiringBoards.length > 0 && (() => {
            const today = getLocalDateString()
            const expiredBoards = expiringBoards.filter((b: any) => b.expires_at < today)
            const upcomingBoards = expiringBoards.filter((b: any) => b.expires_at >= today)
            
            return (
              <div style={{ marginTop: expiringMemberships.length > 0 ? '16px' : '0' }}>
                {expiredBoards.length > 0 && (
                  <div style={{ marginBottom: upcomingBoards.length > 0 ? '16px' : '0' }}>
                    <div style={{ 
                      fontSize: isMobile ? '14px' : '15px',
                      fontWeight: '600',
                      color: '#666',
                      marginBottom: '8px'
                    }}>
                      🏄 已過期置板
                    </div>
                    <div style={{ 
                      display: 'flex', 
                      flexWrap: 'wrap', 
                      gap: '8px'
                    }}>
                      {expiredBoards.map((b: any, idx: number) => (
                        <div key={idx} style={{
                          padding: '6px 12px',
                          background: '#f5f5f5',
                          borderRadius: '6px',
                          fontSize: isMobile ? '12px' : '13px',
                          color: '#555',
                          fontWeight: '600'
                        }}>
                          {b.slot_number}號 {b.member_name} ({formatDate(b.expires_at)})
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {upcomingBoards.length > 0 && (
                  <div>
                    <div style={{ 
                      fontSize: isMobile ? '14px' : '15px',
                      fontWeight: '600',
                      color: '#666',
                      marginBottom: '8px'
                    }}>
                      🏄 置板即將到期
                    </div>
                    <div style={{ 
                      display: 'flex', 
                      flexWrap: 'wrap', 
                      gap: '8px'
                    }}>
                      {upcomingBoards.map((b: any, idx: number) => (
                        <div key={idx} style={{
                          padding: '6px 12px',
                          background: '#e3f2fd',
                          borderRadius: '6px',
                          fontSize: isMobile ? '12px' : '13px',
                          color: '#666'
                        }}>
                          {b.slot_number}號 {b.member_name} ({formatDate(b.expires_at)})
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {/* 顯示已隱藏的切換開關 */}
      <div style={{ 
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          userSelect: 'none',
          gap: '8px'
        }}>
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            style={{
              width: '18px',
              height: '18px',
              cursor: 'pointer'
            }}
          />
          <span style={{ 
            fontSize: '14px', 
            color: '#666',
            fontWeight: '500'
          }}>
            顯示已隱藏的會員
          </span>
        </label>
      </div>

      {/* 統計資訊 */}
      <div style={{ 
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(3, 1fr)',
        gap: '12px',
        marginBottom: '20px'
      }}>
        <div style={{
          background: 'white',
          padding: isMobile ? '16px 12px' : '20px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '6px' }}>總人數</div>
          <div style={{ fontSize: isMobile ? '24px' : '32px', fontWeight: 'bold', color: '#2196F3' }}>
            {filteredMembers.length}
          </div>
        </div>
        
        <div style={{
          background: 'white',
          padding: isMobile ? '16px 12px' : '20px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '6px' }}>會員</div>
          <div style={{ fontSize: isMobile ? '24px' : '32px', fontWeight: 'bold', color: '#2196F3' }}>
            {filteredMembers.filter(m => m.member_type === 'member').length}
          </div>
        </div>

        <div style={{
          background: 'white',
          padding: isMobile ? '16px 12px' : '20px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '6px' }}>置板數</div>
          <div style={{ fontSize: isMobile ? '24px' : '32px', fontWeight: 'bold', color: '#2196F3' }}>
            {filteredMembers.reduce((sum, m) => sum + (m.board_count || 0), 0)}
          </div>
        </div>
      </div>

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
                background: 'white',
                padding: '20px',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                transition: 'all 0.2s',
                cursor: 'pointer',
                border: '2px solid transparent',
                position: 'relative'
              }}
              onClick={() => {
                setSelectedMemberId(member.id)
                setDetailDialogOpen(true)
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#667eea'
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(102, 126, 234, 0.2)'
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
                      top: '12px',
                      right: '12px',
                      background: member.status === 'inactive' ? '#4caf50' : '#f5f5f5',
                      color: member.status === 'inactive' ? 'white' : '#999',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      fontWeight: '500',
                      transition: 'all 0.2s',
                      zIndex: 10
                    }}
                  >
                    {member.status === 'inactive' ? '恢復' : '隱藏'}
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap', paddingRight: '60px' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
                      {member.nickname && member.nickname.trim() ? member.nickname : member.name}
                    </h3>
                    {member.nickname && member.nickname.trim() && (
                      <span style={{ fontSize: '13px', color: '#999' }}>
                        ({member.name})
                      </span>
                    )}
                    <span style={{ 
                      background: member.member_type === 'member' ? '#e3f2fd' : '#f5f5f5',
                      color: member.member_type === 'member' ? '#1976d2' : '#666',
                      padding: '3px 10px',
                      borderRadius: '12px',
                      fontWeight: 'bold',
                      fontSize: '12px'
                    }}>
                      {member.member_type === 'member' ? '👤 會員' : '👋 客人'}
                    </span>
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
                  </div>

                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    gap: '6px',
                    fontSize: '13px',
                    color: '#666'
                  }}>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                      {member.phone && (
                        <div>📱 {member.phone}</div>
                      )}
                      {member.birthday && (
                        <div>🎂 {formatDate(member.birthday)}</div>
                      )}
                      {member.partner && (
                        <div style={{ color: '#2196F3' }}>
                          🔗 配對：{member.partner.nickname || member.partner.name}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                      {member.membership_start_date && (
                        <div>📅 開始：{formatDate(member.membership_start_date)}</div>
                      )}
                      {member.membership_end_date && (
                        <div style={{ 
                          color: new Date(member.membership_end_date) < new Date() ? '#f44336' : '#666'
                        }}>
                          ⏰ 到期：{formatDate(member.membership_end_date)}
                          {new Date(member.membership_end_date) < new Date() && ' (已過期)'}
                        </div>
                      )}
                    </div>
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

                {/* 第二層：帳戶資料 */}
                <div style={{ 
                  background: '#fff',
                  padding: isMobile ? '8px' : '10px 12px',
                  borderRadius: '6px',
                  marginBottom: '10px',
                  border: '1px solid #e0e0e0'
                }}>
                  <div style={{ 
                    display: 'grid',
                    gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
                    gap: isMobile ? '8px' : '10px',
                    textAlign: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#999', marginBottom: '4px' }}>儲值</div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#f44336' }}>
                        ${(member.balance || 0).toLocaleString()}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '11px', color: '#999', marginBottom: '4px' }}>VIP票券</div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#9c27b0' }}>
                        ${(member.vip_voucher_amount || 0).toLocaleString()}
                      </div>
                    </div>
                    
                    <div>
                      <div style={{ fontSize: '11px', color: '#999', marginBottom: '4px' }}>指定課</div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#ff9800' }}>
                        {member.designated_lesson_minutes || 0}分
                      </div>
                    </div>
                    
                    <div>
                      <div style={{ fontSize: '11px', color: '#999', marginBottom: '4px' }}>G23券</div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#4caf50' }}>
                        {member.boat_voucher_g23_minutes || 0}分
                      </div>
                    </div>
                    
                    <div>
                      <div style={{ fontSize: '11px', color: '#999', marginBottom: '4px' }}>G21/黑豹</div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#13c2c2' }}>
                        {member.boat_voucher_g21_panther_minutes || 0}分
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '11px', color: '#999', marginBottom: '4px' }}>贈送大船</div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#eb2f96' }}>
                        {member.gift_boat_hours || 0}分
                      </div>
                    </div>
                  </div>
                </div>

                {/* 第三層：置板資料 */}
                {(member.board_slots && member.board_slots.length > 0) && (
                  <div style={{ 
                    fontSize: '13px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}>
                    {member.board_slots.map((slot, index) => {
                      const isExpired = slot.expires_at && new Date(slot.expires_at) < new Date()
                      return (
                        <div key={index} style={{ color: isExpired ? '#f44336' : '#2e7d32' }}>
                          🏄 置板 #{slot.slot_number} {slot.expires_at && `⏰到期：${formatDate(slot.expires_at)}`}
                          {isExpired && ' (已過期)'}
                        </div>
                      )
                    })}
                  </div>
                )}

              </div>
            </div>
          ))
        )}
      </div>

      {/* 新增會員按鈕 */}
      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <button
          onClick={() => setAddDialogOpen(true)}
          style={{
            padding: isMobile ? '12px 24px' : '14px 28px',
            background: 'linear-gradient(135deg, #5a5a5a 0%, #4a4a4a 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: isMobile ? '16px' : '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(90, 90, 90, 0.3)'
          }}
        >
          + 新增會員
        </button>
      </div>

      {/* Footer */}
      <Footer />

      {/* 新增會員彈窗 */}
      <AddMemberDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onSuccess={loadMembers}
      />

      {/* 會員詳情彈窗 */}
      <MemberDetailDialog
        open={detailDialogOpen}
        memberId={selectedMemberId}
        onClose={() => {
          setDetailDialogOpen(false)
          setSelectedMemberId(null)
        }}
        onUpdate={loadMembers}
      />

    </div>
  )
}

