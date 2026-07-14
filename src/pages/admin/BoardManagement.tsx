import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthUser } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { Footer } from '../../components/Footer'
import { useResponsive } from '../../hooks/useResponsive'
import { EXPIRING_SOON_DAYS } from '../../utils/date'
import type { MemberBasic } from '../../types/common'
import { useToast, ToastContainer } from '../../components/ui'
import { isAdmin } from '../../utils/auth'
import {
  designSystem,
  getPageContentShellStyle,
} from '../../styles/designSystem'

const pageBg = designSystem.colors.background.main
const cardBorder = `1px solid ${designSystem.colors.border.light}`
const cardShadow = designSystem.shadows.elevation[1]

interface BoardSlot {
  id?: number
  slot_number: number
  member_id?: string
  member_name?: string
  member_nickname?: string | null
  start_date?: string | null
  expires_at?: string | null
  notes?: string | null
  status?: string | null
}

// 置板區配置
const BOARD_SECTIONS = [
  { name: '第1排', start: 1, end: 30 },
  { name: '第2排', start: 31, end: 62 },
  { name: '第3排', start: 63, end: 94 },
  { name: '第4排', start: 95, end: 134 },
  { name: '第5排', start: 135, end: 145, upperOnly: true },
]

export function BoardManagement() {
  const user = useAuthUser()
  const navigate = useNavigate()
  const toast = useToast()
  const { isMobile } = useResponsive()
  const [boardSlots, setBoardSlots] = useState<BoardSlot[]>([])
  
  // 權限檢查：只有管理員可以進入
  useEffect(() => {
    if (user && !isAdmin(user)) {
      toast.error('您沒有權限訪問此頁面')
      navigate('/')
    }
  }, [user, navigate, toast])
  const [loading, setLoading] = useState(true)
  const [selectedSlot, setSelectedSlot] = useState<BoardSlot | null>(null)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    start_date: '',
    expires_at: '',
    notes: ''
  })
  
  // 更換會員相關狀態
  const [changeMemberSearch, setChangeMemberSearch] = useState('')
  const [changeMemberResults, setChangeMemberResults] = useState<MemberBasic[]>([])
  const [newMemberForChange, setNewMemberForChange] = useState<MemberBasic | null>(null)
  
  // 新增置板相關狀態
  const [isAddingBoard, setIsAddingBoard] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const [searchResults, setSearchResults] = useState<MemberBasic[]>([])
  const [selectedMember, setSelectedMember] = useState<MemberBasic | null>(null)
  const [newBoardForm, setNewBoardForm] = useState({
    start_date: '',
    expires_at: '',
    notes: ''
  })
  
  const loadBoardData = async () => {
    setLoading(true)
    try {
      // 載入所有置板資料及會員資訊
      const { data, error } = await supabase
        .from('board_storage')
        .select(`
          id,
          slot_number,
          member_id,
          start_date,
          expires_at,
          notes,
          status,
          members:member_id (
            name,
            nickname
          )
        `)
        .eq('status', 'active')
        .order('slot_number', { ascending: true })

      if (error) throw error

      const slots: BoardSlot[] = (data || []).map((item) => ({
        id: item.id,
        slot_number: item.slot_number,
        member_id: item.member_id,
        member_name: item.members?.name,
        member_nickname: item.members?.nickname,
        start_date: item.start_date,
        expires_at: item.expires_at,
        notes: item.notes,
        status: item.status,
      }))

      setBoardSlots(slots)
    } catch (error) {
      console.error('載入置板資料失敗:', error)
      toast.error('載入置板資料失敗')
    } finally {
      setLoading(false)
    }
  }

  const getSlotInfo = (slotNumber: number): BoardSlot | null => {
    return boardSlots.find(s => s.slot_number === slotNumber) || null
  }

  const handleSlotClick = (slotInfo: BoardSlot | null, slotNumber: number) => {
    const slot = slotInfo || { slot_number: slotNumber }
    setSelectedSlot(slot)
    setEditing(false)
    setNewMemberForChange(null)
    setChangeMemberSearch('')
    setChangeMemberResults([])
    if (slotInfo) {
      setEditForm({
        start_date: slotInfo.start_date || '',
        expires_at: slotInfo.expires_at || '',
        notes: slotInfo.notes || ''
      })
    }
  }

  const handleSaveEdit = async () => {
    if (!selectedSlot?.id) return

    const oldExpiry = selectedSlot.expires_at
    const newExpiry = editForm.expires_at || null
    const oldMemberId = selectedSlot.member_id
    const newMemberId = newMemberForChange?.id || oldMemberId

    try {
      // 更新置板資料
      const updateData: any = {
        start_date: editForm.start_date || null,
        expires_at: newExpiry,
        notes: editForm.notes.trim() || null,
      }
      
      // 如果有更換會員，也更新 member_id
      if (newMemberForChange && newMemberId !== oldMemberId) {
        updateData.member_id = newMemberId
      }

      const { error } = await supabase
        .from('board_storage')
        .update(updateData)
        .eq('id', selectedSlot.id)

      if (error) throw error

      const today = new Date().toISOString().split('T')[0]

      // 如果更換了會員，新增備忘錄到兩個會員
      if (newMemberForChange && newMemberId !== oldMemberId && oldMemberId) {
        const expiryInfo = newExpiry ? `，至 ${newExpiry}` : ''
        
        // @ts-ignore
        await supabase.from('member_notes').insert([
          {
            member_id: oldMemberId,
            event_date: today,
            event_type: '備註',
            description: `移除置板 #${selectedSlot.slot_number}`
          },
          {
            member_id: newMemberId,
            event_date: today,
            event_type: '備註',
            description: `置板開始 #${selectedSlot.slot_number}${expiryInfo}`
          }
        ])
      } 
      // 如果只是修改到期日（沒有更換會員），且到期日有變更，新增續約備忘錄
      else if (newMemberId && oldExpiry !== newExpiry && newExpiry) {
        // @ts-ignore
        await supabase.from('member_notes').insert([{
          member_id: newMemberId,
          event_date: today,
          event_type: '續約置板',
          description: `置板續約 #${selectedSlot.slot_number}，至 ${newExpiry}`
        }])
      }

      toast.success('已更新')
      setEditing(false)
      setNewMemberForChange(null)
      setChangeMemberSearch('')
      setChangeMemberResults([])
      setSelectedSlot(null)
      loadBoardData()
    } catch (error) {
      console.error('更新失敗:', error)
      toast.error('更新失敗')
    }
  }

  // 快速延長一年
  const handleExtendOneYear = () => {
    const currentExpiry = editForm.expires_at ? new Date(editForm.expires_at) : new Date()
    const newExpiry = new Date(currentExpiry)
    newExpiry.setFullYear(newExpiry.getFullYear() + 1)
    setEditForm({ ...editForm, expires_at: newExpiry.toISOString().split('T')[0] })
  }

  const handleDeleteBoard = async () => {
    if (!selectedSlot?.id) return
    
    if (!confirm(`確定要刪除格位 #${selectedSlot.slot_number} 嗎？`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('board_storage')
        .delete()
        .eq('id', selectedSlot.id)

      if (error) throw error

      // 新增備忘錄
      if (selectedSlot.member_id) {
        const today = new Date().toISOString().split('T')[0]
        // @ts-ignore
        await supabase.from('member_notes').insert([{
          member_id: selectedSlot.member_id,
          event_date: today,
          event_type: '備註',
          description: `移除置板 #${selectedSlot.slot_number}`
        }])
      }

      toast.success(`已刪除格位 #${selectedSlot.slot_number}`)
      setSelectedSlot(null)
      loadBoardData()
    } catch (error) {
      console.error('刪除失敗:', error)
      toast.error('刪除失敗')
    }
  }

  // 會員搜尋
  const searchMembers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    try {
      const { data, error } = await supabase
        .from('members')
        .select('id, name, nickname, phone')
        .or(`name.ilike.%${query}%,nickname.ilike.%${query}%,phone.ilike.%${query}%`)
        .eq('status', 'active')
        .limit(10)

      if (error) throw error
      setSearchResults(data || [])
    } catch (error) {
      console.error('搜尋會員失敗:', error)
    }
  }

  // 更換會員時的搜尋
  const searchMembersForChange = async (query: string) => {
    if (!query.trim()) {
      setChangeMemberResults([])
      return
    }

    try {
      const { data, error } = await supabase
        .from('members')
        .select('id, name, nickname, phone')
        .or(`name.ilike.%${query}%,nickname.ilike.%${query}%,phone.ilike.%${query}%`)
        .eq('status', 'active')
        .limit(10)

      if (error) throw error
      setChangeMemberResults(data || [])
    } catch (error) {
      console.error('搜尋會員失敗:', error)
    }
  }

  // 處理新增置板
  const handleAddBoard = async () => {
    if (!selectedMember || !selectedSlot) return

    try {
      const { error } = await supabase
        .from('board_storage')
        .insert({
          slot_number: selectedSlot.slot_number,
          member_id: selectedMember.id,
          start_date: newBoardForm.start_date || null,
          expires_at: newBoardForm.expires_at || null,
          notes: newBoardForm.notes.trim() || null,
          status: 'active'
        })

      if (error) throw error

      // 新增備忘錄
      const today = new Date().toISOString().split('T')[0]
      const expiryInfo = newBoardForm.expires_at ? `，至 ${newBoardForm.expires_at}` : ''
      // @ts-ignore
      await supabase.from('member_notes').insert([{
        member_id: selectedMember.id,
        event_date: newBoardForm.start_date || today,
        event_type: '備註',
        description: `置板開始 #${selectedSlot.slot_number}${expiryInfo}`
      }])

      toast.success(`已新增格位 #${selectedSlot.slot_number}`)

      // 重置狀態
      setIsAddingBoard(false)
      setSelectedSlot(null)
      setSelectedMember(null)
      setMemberSearch('')
      setSearchResults([])
      setNewBoardForm({ start_date: '', expires_at: '', notes: '' })
      
      loadBoardData()
    } catch (error) {
      console.error('新增置板失敗:', error)
      toast.error('新增置板失敗')
    }
  }

  // 開啟新增置板模式
  const startAddingBoard = (slotNumber: number) => {
    setSelectedSlot({ slot_number: slotNumber })
    setIsAddingBoard(true)
    setSelectedMember(null)
    setMemberSearch('')
    setSearchResults([])
    setNewBoardForm({ start_date: '', expires_at: '', notes: '' })
  }

  const renderSlotCard = (num: number) => {
    const slotInfo = getSlotInfo(num)
    const isOccupied = !!slotInfo
    
    // 計算到期狀態
    const getExpiryStatus = () => {
      if (!slotInfo?.expires_at) return 'normal'
      const today = new Date()
      const expiryDate = new Date(slotInfo.expires_at)
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      
      if (daysUntilExpiry < 0) return 'expired'
      if (daysUntilExpiry <= EXPIRING_SOON_DAYS) return 'expiring'
      return 'normal'
    }
    
    const expiryStatus = isOccupied ? getExpiryStatus() : 'empty'
    
    const getSlotStyles = () => {
      switch (expiryStatus) {
        case 'expired':
          return {
            background: designSystem.colors.danger[50],
            color: designSystem.colors.danger[700],
            border: `1px solid ${designSystem.colors.border.light}`,
          }
        case 'expiring':
          return {
            background: designSystem.colors.warning[50],
            color: designSystem.colors.warning[700],
            border: `1px solid ${designSystem.colors.border.light}`,
          }
        case 'normal':
          return {
            background: designSystem.colors.success[50],
            color: designSystem.colors.success[700],
            border: `1px solid ${designSystem.colors.border.light}`,
          }
        default:
          return {
            background: designSystem.colors.background.main,
            color: designSystem.colors.text.disabled,
            border: cardBorder,
          }
      }
    }
    
    const slotStyles = getSlotStyles()
    
    return (
      <div
        key={num}
        onClick={() => handleSlotClick(slotInfo, num)}
        style={{
          padding: isMobile ? '6px' : '8px',
          background: slotStyles.background,
          color: slotStyles.color,
          borderRadius: designSystem.borderRadius.md,
          cursor: 'pointer',
          border: slotStyles.border,
          transition: designSystem.transitions.normal,
          height: isMobile ? '80px' : '90px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          position: 'relative',
          overflow: 'hidden',
        }}
        onMouseEnter={(e) => {
          if (isOccupied) {
            e.currentTarget.style.borderColor = designSystem.colors.text.secondary
            e.currentTarget.style.boxShadow = designSystem.shadows.sm
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.border = slotStyles.border
          e.currentTarget.style.boxShadow = 'none'
        }}
      >
        <div style={{ 
          fontSize: isMobile ? '10px' : '11px', 
          fontWeight: 650,
          opacity: 0.7,
          marginBottom: '3px'
        }}>
          #{num}
        </div>
        
        {isOccupied && slotInfo ? (
          <>
            <div style={{ 
              fontSize: isMobile ? '12px' : '13px', 
              fontWeight: 700,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              lineHeight: '1.3'
            }}>
              {slotInfo.member_nickname || slotInfo.member_name}
            </div>
            
            {slotInfo.expires_at && (
              <div style={{ 
                fontSize: isMobile ? '9px' : '10px',
                opacity: 0.85,
                marginTop: '3px',
                lineHeight: '1.2'
              }}>
                {slotInfo.expires_at}
              </div>
            )}
            
            {slotInfo.notes && (
              <div style={{ 
                fontSize: isMobile ? '8px' : '9px',
                opacity: 0.9,
                marginTop: '2px',
                lineHeight: '1.2',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
              title={slotInfo.notes}
              >
                {slotInfo.notes.length > 8 ? slotInfo.notes.substring(0, 8) + '...' : slotInfo.notes}
              </div>
            )}
          </>
        ) : (
          <div style={{ 
            fontSize: isMobile ? '11px' : '12px',
            textAlign: 'center',
            marginTop: '6px'
          }}>
            空位
          </div>
        )}
      </div>
    )
  }

  const renderSection = (section: typeof BOARD_SECTIONS[0]) => {
    const slotPairs: Array<{ upper: number | null; lower: number | null }> = []
    
    if (section.upperOnly) {
      for (let i = section.start; i <= section.end; i++) {
        slotPairs.push({ upper: i, lower: null })
      }
    } else {
      for (let i = section.start; i <= section.end; i += 2) {
        const lower = i
        const upper = i + 1
        
        const hasLower = lower <= section.end
        const hasUpper = upper <= section.end
        
        slotPairs.push({
          upper: hasUpper ? upper : null,
          lower: hasLower ? lower : null
        })
      }
    }

    const columnsPerRow = isMobile ? 3 : 9
    
    return (
      <div key={section.name} style={{ marginBottom: '28px' }}>
        <h3 style={{ 
          margin: '0 0 12px 0', 
          fontSize: isMobile ? '15px' : '16px', 
          fontWeight: 650,
          color: designSystem.colors.text.primary,
          letterSpacing: '-0.01em',
        }}>
          {section.name} ({section.start}-{section.end})
        </h3>
        
        <div style={{ 
          background: designSystem.colors.background.card, 
          padding: isMobile ? '12px' : '16px', 
          borderRadius: designSystem.borderRadius.lg,
          border: cardBorder,
          boxShadow: cardShadow,
        }}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: `repeat(${columnsPerRow}, 1fr)`,
            gap: isMobile ? '8px' : '10px'
          }}>
            {slotPairs.map((pair, index) => (
              <React.Fragment key={index}>
                {index > 0 && index % columnsPerRow === 0 && (
                  <div style={{
                    gridColumn: `1 / -1`,
                    height: '1px',
                    background: designSystem.colors.border.light,
                    margin: '6px 0',
                  }} />
                )}
                
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '6px'
                }}>
                  {pair.upper && renderSlotCard(pair.upper)}
                  {pair.lower && renderSlotCard(pair.lower)}
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ 
        padding: isMobile ? '12px 16px' : '20px',
        minHeight: '100dvh',
        background: pageBg,
        paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
      }}>
        <div style={getPageContentShellStyle(isMobile)}>
          <PageHeader title="置板區管理" user={user} showBaoLink={isAdmin(user)} />
          <div style={{
            padding: '40px',
            textAlign: 'center',
            fontSize: '15px',
            color: designSystem.colors.text.secondary,
          }}>
            載入中...
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
      paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
    }}>
      <div style={getPageContentShellStyle(isMobile)}>
        <PageHeader title="置板區管理" user={user} showBaoLink={isAdmin(user)} />

      {/* 統計資訊 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: isMobile ? '10px' : '12px',
        marginTop: '4px',
        marginBottom: '20px',
        background: designSystem.colors.background.card,
        borderRadius: designSystem.borderRadius.lg,
        border: cardBorder,
        boxShadow: cardShadow,
        padding: isMobile ? '14px 12px' : '16px 20px',
        textAlign: 'center',
      }}>
        <div>
          <div style={{ fontSize: '12px', color: designSystem.colors.text.secondary, marginBottom: '4px' }}>總格位</div>
          <div style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: 750, color: designSystem.colors.text.primary }}>
            145
          </div>
        </div>
        <div>
          <div style={{ fontSize: '12px', color: designSystem.colors.text.secondary, marginBottom: '4px' }}>已使用</div>
          <div style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: 750, color: designSystem.colors.text.primary }}>
            {boardSlots.length}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '12px', color: designSystem.colors.text.secondary, marginBottom: '4px' }}>空位</div>
          <div style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: 750, color: designSystem.colors.text.primary }}>
            {145 - boardSlots.length}
          </div>
        </div>
      </div>

      {/* 置板區域 */}
      {BOARD_SECTIONS.map(section => renderSection(section))}

      {/* 格位詳情彈窗 */}
      {selectedSlot && (
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
          padding: '20px',
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            {/* 標題 */}
            <div style={{
              padding: '20px',
              borderBottom: '1px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
                格位 {selectedSlot.slot_number}
              </h2>
              <button
                onClick={() => {
                  setSelectedSlot(null)
                  setEditing(false)
                  setNewMemberForChange(null)
                  setChangeMemberSearch('')
                  setChangeMemberResults([])
                  setEditForm({ start_date: '', expires_at: '', notes: '' })
                }}
                style={{
                  border: 'none',
                  background: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666',
                }}
              >
                &times;
              </button>
            </div>

            {/* 內容 */}
            <div style={{ padding: '20px' }}>
              {selectedSlot.member_name ? (
                <>
                  {/* 編輯模式 */}
                  {editing ? (
                    <>
                      {/* 會員選擇（編輯模式） */}
                      <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                          會員 {newMemberForChange ? '' : <span style={{ fontSize: '13px', color: '#666' }}>（目前：{selectedSlot.member_nickname || selectedSlot.member_name}）</span>}
                        </label>
                        <input
                          type="text"
                          value={changeMemberSearch}
                          onChange={(e) => {
                            setChangeMemberSearch(e.target.value)
                            searchMembersForChange(e.target.value)
                          }}
                          placeholder="搜尋會員姓名/暱稱..."
                          style={{
                            width: '100%',
                            padding: '10px',
                            border: '2px solid #e0e0e0',
                            borderRadius: '8px',
                            fontSize: '14px',
                          }}
                        />

                        {/* 搜尋結果 */}
                        {changeMemberResults.length > 0 && !newMemberForChange && (
                          <div style={{
                            marginTop: '8px',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            border: '1px solid #e0e0e0',
                            borderRadius: '8px',
                            background: 'white'
                          }}>
                            {changeMemberResults.map((member) => (
                              <div
                                key={member.id}
                                onClick={() => {
                                  setNewMemberForChange(member)
                                  setChangeMemberSearch('')
                                  setChangeMemberResults([])
                                }}
                                style={{
                                  padding: '10px',
                                  cursor: 'pointer',
                                  borderBottom: '1px solid #f0f0f0'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                              >
                                <div style={{ fontWeight: '500' }}>{member.name}</div>
                                {member.nickname && (
                                  <div style={{ fontSize: '13px', color: '#666' }}>
                                    暱稱：{member.nickname}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* 已選擇的新會員（綠色框） */}
                        {newMemberForChange && (
                          <div style={{
                            marginTop: '8px',
                            padding: '12px',
                            background: newMemberForChange.id === selectedSlot.member_id ? '#e3f2fd' : '#e8f5e9',
                            borderRadius: '8px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <div>
                              <div style={{ fontWeight: '500', color: newMemberForChange.id === selectedSlot.member_id ? '#1976d2' : '#2e7d32' }}>
                                {newMemberForChange.id === selectedSlot.member_id ? '✓ 維持原會員：' : '🔄 更換為：'}{newMemberForChange.name}
                              </div>
                              {newMemberForChange.nickname && (
                                <div style={{ fontSize: '13px', color: '#666' }}>
                                  暱稱：{newMemberForChange.nickname}
                                </div>
                              )}
                              {newMemberForChange.id !== selectedSlot.member_id && (
                                <div style={{ fontSize: '12px', color: '#e65100', marginTop: '4px' }}>
                                  從「{selectedSlot.member_nickname || selectedSlot.member_name}」轉移
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => {
                                setNewMemberForChange(null)
                                setChangeMemberSearch('')
                              }}
                              style={{
                                padding: '4px 8px',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '18px'
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>

                      {/* 開始日 */}
                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                          開始日 <span style={{ fontSize: '13px', color: '#666' }}>（選填）</span>
                        </label>
                        <div style={{ display: 'flex' }}>
                          <input
                            type="date"
                            value={editForm.start_date}
                            onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
                            style={{
                              flex: 1,
                              minWidth: 0,
                              padding: '10px',
                              border: '2px solid #e0e0e0',
                              borderRadius: '8px',
                              fontSize: '16px',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>
                      </div>

                      {/* 到期日 */}
                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                          到期日 <span style={{ fontSize: '13px', color: '#666' }}>（選填）</span>
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input
                            type="date"
                            value={editForm.expires_at}
                            onChange={(e) => setEditForm({ ...editForm, expires_at: e.target.value })}
                            style={{
                              flex: 1,
                              minWidth: 0,
                              padding: '10px',
                              border: '2px solid #e0e0e0',
                              borderRadius: '8px',
                              fontSize: '16px',
                              boxSizing: 'border-box',
                            }}
                          />
                          <button
                            type="button"
                            onClick={handleExtendOneYear}
                            style={{
                              padding: '10px 16px',
                              background: '#4caf50',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              fontSize: '14px',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            +1年
                          </button>
                        </div>
                      </div>

                      {/* 備註 */}
                      <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                          備註 <span style={{ fontSize: '13px', color: '#666' }}>（選填）</span>
                        </label>
                        <input
                          type="text"
                          value={editForm.notes}
                          onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                          placeholder="例如：有三格"
                          style={{
                            width: '100%',
                            padding: '10px',
                            border: '2px solid #e0e0e0',
                            borderRadius: '8px',
                            fontSize: '14px',
                          }}
                        />
                      </div>

                      {/* 編輯按鈕 */}
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          onClick={() => {
                            setEditing(false)
                            setNewMemberForChange(null)
                            setChangeMemberSearch('')
                            setChangeMemberResults([])
                          }}
                          style={{
                            flex: 1,
                            padding: '10px',
                            background: '#f0f0f0',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                          }}
                        >
                          取消
                        </button>
                        <button
                          onClick={handleSaveEdit}
                          style={{
                            flex: 1,
                            padding: '10px',
                            background: 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                          }}
                        >
                          儲存
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* 會員資訊（檢視模式） */}
                      <div style={{ 
                        marginBottom: '20px',
                        padding: '16px',
                        background: '#f8f9fa',
                        borderRadius: '8px'
                      }}>
                        <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>會員</div>
                        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                          {selectedSlot.member_nickname || selectedSlot.member_name}
                          {selectedSlot.member_nickname && selectedSlot.member_name && (
                            <span style={{ 
                              fontSize: '14px', 
                              color: '#666', 
                              marginLeft: '8px',
                              fontWeight: 'normal'
                            }}>
                              ({selectedSlot.member_name})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 檢視模式其他資訊 */}
                      {selectedSlot.expires_at && (
                        <div style={{ marginBottom: '16px' }}>
                          <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>到期日</div>
                          <div style={{ fontSize: '16px' }}>{selectedSlot.expires_at}</div>
                        </div>
                      )}

                      {selectedSlot.notes && (
                        <div style={{ marginBottom: '16px' }}>
                          <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>備註</div>
                          <div style={{ fontSize: '14px', fontStyle: 'italic', color: '#999' }}>
                            {selectedSlot.notes}
                          </div>
                        </div>
                      )}

                      {/* 操作按鈕 */}
                      <div style={{ 
                        display: 'flex',
                        gap: '10px',
                        marginTop: '20px',
                        paddingTop: '20px',
                        borderTop: '1px solid #e0e0e0'
                      }}>
                        <button
                          onClick={() => setEditing(true)}
                          style={{
                            flex: 1,
                            padding: '10px 20px',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                          }}
                        >
                          ✏️ 編輯
                        </button>
                        <button
                          onClick={handleDeleteBoard}
                          style={{
                            flex: 1,
                            padding: '10px 20px',
                            background: '#f44336',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                          }}
                        >
                          🗑️ 刪除
                        </button>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div style={{ padding: '20px' }}>
                  {!isAddingBoard ? (
                    <div style={{ 
                      padding: '40px 20px',
                      textAlign: 'center',
                      color: '#999'
                    }}>
                      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏄</div>
                      <div style={{ fontSize: '16px', marginBottom: '20px' }}>此格位尚未使用</div>
                      <button
                        onClick={() => startAddingBoard(selectedSlot.slot_number)}
                        style={{
                          padding: '12px 24px',
                          background: 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '15px',
                          fontWeight: 'bold',
                          cursor: 'pointer'
                        }}
                      >
                        新增置板
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* 會員搜尋 */}
                      <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                          選擇會員 <span style={{ color: 'red' }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={memberSearch}
                          onChange={(e) => {
                            setMemberSearch(e.target.value)
                            searchMembers(e.target.value)
                          }}
                          placeholder="搜尋會員姓名/暱稱..."
                          style={{
                            width: '100%',
                            padding: '10px',
                            border: '2px solid #e0e0e0',
                            borderRadius: '8px',
                            fontSize: '14px',
                          }}
                        />
                        
                        {/* 搜尋結果 */}
                        {searchResults.length > 0 && !selectedMember && (
                          <div style={{
                            marginTop: '8px',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            border: '1px solid #e0e0e0',
                            borderRadius: '8px',
                            background: 'white'
                          }}>
                            {searchResults.map((member) => (
                              <div
                                key={member.id}
                                onClick={() => {
                                  setSelectedMember(member)
                                  setMemberSearch(member.name)
                                  setSearchResults([])
                                }}
                                style={{
                                  padding: '10px',
                                  cursor: 'pointer',
                                  borderBottom: '1px solid #f0f0f0'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                              >
                                <div style={{ fontWeight: '500' }}>{member.name}</div>
                                {member.nickname && (
                                  <div style={{ fontSize: '13px', color: '#666' }}>
                                    暱稱：{member.nickname}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* 已選擇的會員 */}
                        {selectedMember && (
                          <div style={{
                            marginTop: '8px',
                            padding: '12px',
                            background: '#e8f5e9',
                            borderRadius: '8px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <div>
                              <div style={{ fontWeight: '500' }}>{selectedMember.name}</div>
                              {selectedMember.nickname && (
                                <div style={{ fontSize: '13px', color: '#666' }}>
                                  暱稱：{selectedMember.nickname}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => {
                                setSelectedMember(null)
                                setMemberSearch('')
                              }}
                              style={{
                                padding: '4px 8px',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '18px'
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>

                      {/* 開始日 */}
                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                          開始日 <span style={{ fontSize: '13px', color: '#666' }}>（選填）</span>
                        </label>
                        <div style={{ display: 'flex' }}>
                          <input
                            type="date"
                            value={newBoardForm.start_date}
                            onChange={(e) => setNewBoardForm({ ...newBoardForm, start_date: e.target.value })}
                            style={{
                              flex: 1,
                              minWidth: 0,
                              padding: '10px',
                              border: '2px solid #e0e0e0',
                              borderRadius: '8px',
                              fontSize: '16px',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>
                      </div>

                      {/* 到期日 */}
                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                          到期日 <span style={{ fontSize: '13px', color: '#666' }}>（選填）</span>
                        </label>
                        <div style={{ display: 'flex' }}>
                          <input
                            type="date"
                            value={newBoardForm.expires_at}
                            onChange={(e) => setNewBoardForm({ ...newBoardForm, expires_at: e.target.value })}
                            style={{
                              flex: 1,
                              minWidth: 0,
                              padding: '10px',
                              border: '2px solid #e0e0e0',
                              borderRadius: '8px',
                              fontSize: '16px',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>
                      </div>

                      {/* 備註 */}
                      <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                          備註 <span style={{ fontSize: '13px', color: '#666' }}>（選填）</span>
                        </label>
                        <input
                          type="text"
                          value={newBoardForm.notes}
                          onChange={(e) => setNewBoardForm({ ...newBoardForm, notes: e.target.value })}
                          placeholder="例如：有三格"
                          style={{
                            width: '100%',
                            padding: '10px',
                            border: '2px solid #e0e0e0',
                            borderRadius: '8px',
                            fontSize: '14px',
                          }}
                        />
                      </div>

                      {/* 按鈕 */}
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          onClick={() => {
                            setIsAddingBoard(false)
                            setSelectedSlot(null)
                          }}
                          style={{
                            flex: 1,
                            padding: '12px',
                            background: '#f0f0f0',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                          }}
                        >
                          取消
                        </button>
                        <button
                          onClick={handleAddBoard}
                          disabled={!selectedMember}
                          style={{
                            flex: 1,
                            padding: '12px',
                            background: selectedMember ? 'linear-gradient(135deg, #5a5a5a 0%, #4a4a4a 100%)' : '#ccc',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            cursor: selectedMember ? 'pointer' : 'not-allowed'
                          }}
                        >
                          確認新增
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

        {/* Footer */}
        <Footer />
        <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
      </div>
    </div>
  )
}

