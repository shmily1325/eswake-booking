import React, { useState, useEffect, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthUser } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { Footer } from '../../components/Footer'
import { useResponsive } from '../../hooks/useResponsive'
import {
  addYearsToDate,
  daysBetweenDates,
  EXPIRING_SOON_DAYS,
  getVenueDateString,
} from '../../utils/date'
import type { MemberBasic } from '../../types/common'
import { useToast, ToastContainer } from '../../components/ui'
import { MemoRecordCheckbox } from '../../components/MemoRecordCheckbox'
import { isAdmin } from '../../utils/auth'
import { moveBoardStorage } from '../../services/boardStorage'
import { buildBoardDateEditDescription } from '../../lib/boardOperations'
import {
  designSystem,
  getButtonStyle,
  getFontSize,
  getFormGroupStyle,
  getInputStyle,
  getLabelStyle,
  getPageContentShellStyle,
  getTextStyle,
} from '../../styles/designSystem'

const pageBg = designSystem.colors.background.main
const cardBorder = `1px solid ${designSystem.colors.border.light}`
const cardShadow = designSystem.shadows.elevation[1]

const dialogOverlayStyle: CSSProperties = {
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
}

const dialogPanelStyle: CSSProperties = {
  background: designSystem.colors.background.card,
  borderRadius: designSystem.borderRadius.lg,
  maxWidth: '500px',
  width: '100%',
  boxShadow: designSystem.shadows.lg,
  border: `1px solid ${designSystem.colors.border.light}`,
  maxHeight: '80vh',
  overflow: 'auto',
}

const dialogHeaderBarStyle: CSSProperties = {
  padding: '20px',
  borderBottom: `1px solid ${designSystem.colors.border.light}`,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  background: designSystem.colors.background.card,
  position: 'sticky',
  top: 0,
  zIndex: 1,
}

const dialogCloseButtonStyle: CSSProperties = {
  border: 'none',
  background: 'none',
  fontSize: getFontSize('h1', false),
  cursor: 'pointer',
  color: designSystem.colors.text.secondary,
  padding: '0 8px',
  lineHeight: 1,
}

const dialogBodyStyle: CSSProperties = {
  padding: '20px',
}

const dialogFooterStyle: CSSProperties = {
  display: 'flex',
  gap: '12px',
  marginTop: '8px',
  paddingTop: '20px',
  borderTop: `1px solid ${designSystem.colors.border.light}`,
  paddingBottom: 'max(40px, calc(env(safe-area-inset-bottom, 0px) + 24px))',
}

const getFieldMetaStyle = (isMobile: boolean): CSSProperties => ({
  fontSize: getFontSize('bodySmall', isMobile),
  color: designSystem.colors.text.secondary,
  fontWeight: 400,
})

const getQuietLabelStyle = (isMobile: boolean): CSSProperties => ({
  fontSize: getFontSize('caption', isMobile),
  color: designSystem.colors.text.secondary,
  marginBottom: designSystem.spacing.sm,
})

const searchResultsStyle: CSSProperties = {
  marginTop: designSystem.spacing.sm,
  maxHeight: '200px',
  overflowY: 'auto',
  border: `1px solid ${designSystem.colors.border.light}`,
  borderRadius: designSystem.borderRadius.lg,
  background: designSystem.colors.background.card,
}

const searchResultItemStyle: CSSProperties = {
  padding: '10px 12px',
  cursor: 'pointer',
  borderBottom: `1px solid ${designSystem.colors.border.light}`,
}

const dangerQuietButtonStyle = (isMobile: boolean): CSSProperties => ({
  ...getButtonStyle('outline', 'medium', isMobile),
  color: designSystem.colors.danger[700],
  borderColor: `${designSystem.colors.danger[500]}66`,
  background: designSystem.colors.danger[50],
  flex: 1,
})

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
  const [recordEditMemo, setRecordEditMemo] = useState(false)
  const [editMemoText, setEditMemoText] = useState('')
  
  // 更換會員相關狀態
  const [changeMemberSearch, setChangeMemberSearch] = useState('')
  const [changeMemberResults, setChangeMemberResults] = useState<MemberBasic[]>([])
  const [newMemberForChange, setNewMemberForChange] = useState<MemberBasic | null>(null)
  const [showMemberChange, setShowMemberChange] = useState(false)

  // 換格與續約各自為獨立操作，避免與一般資料修正混在同一次儲存。
  const [movingSlot, setMovingSlot] = useState<BoardSlot | null>(null)
  const [pendingMoveTarget, setPendingMoveTarget] = useState<number | null>(null)
  const [moveSaving, setMoveSaving] = useState(false)
  const [renewingSlot, setRenewingSlot] = useState<BoardSlot | null>(null)
  const [renewEndDate, setRenewEndDate] = useState('')
  const [renewSaving, setRenewSaving] = useState(false)
  
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

  useEffect(() => {
    loadBoardData()
  }, [])

  const getSlotInfo = (slotNumber: number): BoardSlot | null => {
    return boardSlots.find(s => s.slot_number === slotNumber) || null
  }

  const handleSlotClick = (slotInfo: BoardSlot | null, slotNumber: number) => {
    if (movingSlot) {
      if (slotInfo) {
        toast.warning(`格位 #${slotNumber} 已被使用，請選擇空位`)
        return
      }
      setPendingMoveTarget(slotNumber)
      return
    }

    const slot = slotInfo || { slot_number: slotNumber }
    setSelectedSlot(slot)
    setEditing(false)
    setRecordEditMemo(false)
    setEditMemoText('')
    setShowMemberChange(false)
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

  const startMovingSlot = (slot: BoardSlot) => {
    if (!slot.id) return
    setMovingSlot(slot)
    setPendingMoveTarget(null)
    setSelectedSlot(null)
    setEditing(false)
  }

  const cancelMovingSlot = () => {
    if (moveSaving) return
    setMovingSlot(null)
    setPendingMoveTarget(null)
  }

  const confirmMoveSlot = async () => {
    if (!movingSlot?.id || pendingMoveTarget === null) return

    setMoveSaving(true)
    try {
      await moveBoardStorage(movingSlot.id, pendingMoveTarget)
      toast.success(`置板已從 #${movingSlot.slot_number} 移到 #${pendingMoveTarget}`)
      setMovingSlot(null)
      setPendingMoveTarget(null)
      await loadBoardData()
    } catch (error) {
      console.error('移動置板失敗:', error)
      if (error instanceof Error && error.name === '23505') {
        toast.warning(`格位 #${pendingMoveTarget} 已被使用，請重新選擇空位`)
        setPendingMoveTarget(null)
        await loadBoardData()
      } else {
        toast.error(error instanceof Error ? `移動置板失敗：${error.message}` : '移動置板失敗')
      }
    } finally {
      setMoveSaving(false)
    }
  }

  const openBoardRenew = (slot: BoardSlot) => {
    setRenewingSlot(slot)
    setRenewEndDate(addYearsToDate(slot.expires_at || getVenueDateString(), 1))
    setSelectedSlot(null)
    setEditing(false)
  }

  const handleBoardRenew = async () => {
    if (!renewingSlot?.id || !renewingSlot.member_id || !renewEndDate) {
      toast.warning('請選擇新的到期日')
      return
    }

    setRenewSaving(true)
    try {
      const { error } = await supabase
        .from('board_storage')
        .update({ expires_at: renewEndDate })
        .eq('id', renewingSlot.id)
      if (error) throw error

      const { error: noteError } = await supabase.from('member_notes').insert([{
        member_id: renewingSlot.member_id,
        event_date: getVenueDateString(),
        event_type: '續約置板',
        description: `置板續約 #${renewingSlot.slot_number}，至 ${renewEndDate}`,
      }])
      if (noteError) throw noteError

      toast.success(`格位 #${renewingSlot.slot_number} 已續約至 ${renewEndDate}`)
      setRenewingSlot(null)
      setRenewEndDate('')
      await loadBoardData()
    } catch (error) {
      console.error('置板續約失敗:', error)
      toast.error('置板續約失敗')
    } finally {
      setRenewSaving(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!selectedSlot?.id) return

    const oldStartDate = selectedSlot.start_date || null
    const oldExpiry = selectedSlot.expires_at
    const newStartDate = editForm.start_date || null
    const newExpiry = editForm.expires_at || null
    const oldMemberId = selectedSlot.member_id
    const newMemberId = newMemberForChange?.id || oldMemberId

    try {
      // 更新置板資料
      const updateData: {
        start_date: string | null
        expires_at: string | null
        notes: string | null
        member_id?: string
      } = {
        start_date: newStartDate,
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

      const today = getVenueDateString()

      // 如果更換了會員，新增備忘錄到兩個會員
      if (newMemberForChange && newMemberId !== oldMemberId && oldMemberId) {
        const expiryInfo = newExpiry ? `，至 ${newExpiry}` : ''
        
        const { error: noteError } = await supabase.from('member_notes').insert([
          {
            member_id: oldMemberId,
            event_date: today,
            event_type: '備註',
            description: `移除置板 #${selectedSlot.slot_number}`
          },
          {
            member_id: newMemberForChange.id,
            event_date: today,
            event_type: '備註',
            description: `置板開始 #${selectedSlot.slot_number}${expiryInfo}`
          }
        ])
        if (noteError) throw noteError
      }
      // 一般日期修正只有在操作人選擇記錄時才寫備忘；續約走獨立流程。
      else if (newMemberId && recordEditMemo) {
        const description = buildBoardDateEditDescription({
          slotNumber: selectedSlot.slot_number,
          oldStartDate,
          newStartDate,
          oldExpiresAt: oldExpiry || null,
          newExpiresAt: newExpiry,
          memoText: editMemoText,
        })
        if (description) {
          const { error: noteError } = await supabase.from('member_notes').insert([{
            member_id: newMemberId,
            event_date: today,
            event_type: '備註',
            description,
          }])
          if (noteError) throw noteError
        }
      }

      if (newMemberForChange && newMemberId !== oldMemberId) {
        setShowMemberChange(false)
      }

      toast.success('已更新')
      setEditing(false)
      setRecordEditMemo(false)
      setEditMemoText('')
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
        const today = getVenueDateString()
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
      const today = getVenueDateString()
      const expiryInfo = newBoardForm.expires_at ? `，至 ${newBoardForm.expires_at}` : ''
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
    const isAvailableMoveTarget = Boolean(movingSlot && !isOccupied)
    
    // 計算到期狀態
    const getExpiryStatus = () => {
      if (!slotInfo?.expires_at) return 'normal'
      const daysUntilExpiry = daysBetweenDates(getVenueDateString(), slotInfo.expires_at)
      if (daysUntilExpiry === null) return 'normal'
      
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
          cursor: movingSlot && isOccupied ? 'not-allowed' : 'pointer',
          border: isAvailableMoveTarget
            ? `1.5px solid ${designSystem.colors.primary[300]}`
            : slotStyles.border,
          transition: designSystem.transitions.normal,
          height: isMobile ? '80px' : '90px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          position: 'relative',
          overflow: 'hidden',
        }}
        onMouseEnter={(e) => {
          if (isOccupied || isAvailableMoveTarget) {
            e.currentTarget.style.borderColor = designSystem.colors.text.secondary
            e.currentTarget.style.boxShadow = designSystem.shadows.sm
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.border = isAvailableMoveTarget
            ? `1.5px solid ${designSystem.colors.primary[300]}`
            : slotStyles.border
          e.currentTarget.style.boxShadow = 'none'
        }}
      >
        <div style={{ 
          fontSize: getFontSize('caption', isMobile),
          fontWeight: 600,
          opacity: 0.7,
          marginBottom: '3px'
        }}>
          #{num}
        </div>
        
        {isOccupied && slotInfo ? (
          <>
            <div style={{ 
              fontSize: getFontSize('bodySmall', isMobile),
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
                fontSize: getFontSize('caption', isMobile),
                opacity: 0.85,
                marginTop: '3px',
                lineHeight: '1.2'
              }}>
                {slotInfo.expires_at}
              </div>
            )}
            
            {slotInfo.notes && (
              <div style={{ 
                fontSize: getFontSize('caption', isMobile),
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
            fontSize: getFontSize('bodySmall', isMobile),
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
          ...getTextStyle('h3', isMobile),
          fontWeight: 600,
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
          <PageHeader
            title="置板"
            user={user}
            showBaoLink={isAdmin(user)}
            extraLinks={[{ label: '會員', link: '/members' }]}
          />
          <div style={{
            padding: '40px',
            textAlign: 'center',
            fontSize: getFontSize('body', isMobile),
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
        <PageHeader
          title="置板"
          user={user}
          showBaoLink={isAdmin(user)}
          extraLinks={[{ label: '會員', link: '/members' }]}
        />

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
          <div style={{ fontSize: getFontSize('bodySmall', isMobile), color: designSystem.colors.text.secondary, marginBottom: designSystem.spacing.xs }}>總格位</div>
          <div style={{ ...getTextStyle('h2', isMobile), fontWeight: 700, color: designSystem.colors.text.primary }}>
            145
          </div>
        </div>
        <div>
          <div style={{ fontSize: getFontSize('bodySmall', isMobile), color: designSystem.colors.text.secondary, marginBottom: designSystem.spacing.xs }}>已使用</div>
          <div style={{ ...getTextStyle('h2', isMobile), fontWeight: 700, color: designSystem.colors.text.primary }}>
            {boardSlots.length}
          </div>
        </div>
        <div>
          <div style={{ fontSize: getFontSize('bodySmall', isMobile), color: designSystem.colors.text.secondary, marginBottom: designSystem.spacing.xs }}>空位</div>
          <div style={{ ...getTextStyle('h2', isMobile), fontWeight: 700, color: designSystem.colors.text.primary }}>
            {145 - boardSlots.length}
          </div>
        </div>
      </div>

      {movingSlot && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: designSystem.spacing.md,
          marginBottom: designSystem.spacing.lg,
          padding: `${designSystem.spacing.md} ${designSystem.spacing.lg}`,
          background: designSystem.colors.background.card,
          border: `1.5px solid ${designSystem.colors.primary[300]}`,
          borderRadius: designSystem.borderRadius.lg,
          boxShadow: designSystem.shadows.elevation[1],
          position: 'sticky',
          top: designSystem.spacing.md,
          zIndex: 10,
        }}>
          <div>
            <div style={{ ...getTextStyle('body', isMobile), fontWeight: 600 }}>
              正在移動 #{movingSlot.slot_number}
            </div>
            <div style={getFieldMetaStyle(isMobile)}>
              {movingSlot.member_nickname || movingSlot.member_name}，請在下方選擇一個空位
            </div>
          </div>
          <button
            onClick={cancelMovingSlot}
            disabled={moveSaving}
            style={{
              ...getButtonStyle('outline', 'small', isMobile),
              minHeight: isMobile ? '48px' : undefined,
            }}
          >
            取消
          </button>
        </div>
      )}

      {/* 置板區域 */}
      {BOARD_SECTIONS.map(section => renderSection(section))}

      {/* 格位詳情彈窗 */}
      {selectedSlot && (
        <div style={dialogOverlayStyle}>
          <div style={dialogPanelStyle}>
            <div style={dialogHeaderBarStyle}>
              <h2 style={{
                margin: 0,
                ...getTextStyle('h3', isMobile),
                fontWeight: 700,
                letterSpacing: '-0.02em',
              }}>
                格位 {selectedSlot.slot_number}
              </h2>
              <button
                onClick={() => {
                  setSelectedSlot(null)
                  setEditing(false)
                  setRecordEditMemo(false)
                  setEditMemoText('')
                  setShowMemberChange(false)
                  setIsAddingBoard(false)
                  setNewMemberForChange(null)
                  setChangeMemberSearch('')
                  setChangeMemberResults([])
                  setEditForm({ start_date: '', expires_at: '', notes: '' })
                }}
                style={dialogCloseButtonStyle}
                aria-label="關閉"
              >
                &times;
              </button>
            </div>

            <div style={dialogBodyStyle}>
              {selectedSlot.member_name ? (
                <>
                  {editing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowMemberChange((value) => !value)}
                        style={{
                          ...getButtonStyle('outline', 'small', isMobile),
                          marginBottom: designSystem.spacing.lg,
                        }}
                      >
                        {showMemberChange ? '收起更換會員' : '更換會員'}
                      </button>

                      {showMemberChange && (
                        <div style={getFormGroupStyle(isMobile)}>
                        <label style={getLabelStyle(isMobile)}>
                          會員{' '}
                          {!newMemberForChange && (
                            <span style={getFieldMetaStyle(isMobile)}>
                              （目前：{selectedSlot.member_nickname || selectedSlot.member_name}）
                            </span>
                          )}
                        </label>
                        <input
                          type="text"
                          value={changeMemberSearch}
                          onChange={(e) => {
                            setChangeMemberSearch(e.target.value)
                            searchMembersForChange(e.target.value)
                          }}
                          placeholder="搜尋會員姓名/暱稱..."
                          style={getInputStyle(isMobile)}
                        />

                        {changeMemberResults.length > 0 && !newMemberForChange && (
                          <div style={searchResultsStyle}>
                            {changeMemberResults.map((member) => (
                              <div
                                key={member.id}
                                onClick={() => {
                                  setNewMemberForChange(member)
                                  setChangeMemberSearch('')
                                  setChangeMemberResults([])
                                }}
                                style={searchResultItemStyle}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = designSystem.colors.background.main
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = designSystem.colors.background.card
                                }}
                              >
                                <div style={{ fontWeight: 500, color: designSystem.colors.text.primary }}>
                                  {member.name}
                                </div>
                                {member.nickname && (
                                  <div style={getFieldMetaStyle(isMobile)}>暱稱：{member.nickname}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {newMemberForChange && (
                          <div style={{
                            marginTop: designSystem.spacing.sm,
                            padding: designSystem.spacing.md,
                            background: newMemberForChange.id === selectedSlot.member_id
                              ? designSystem.colors.info[50]
                              : designSystem.colors.success[50],
                            borderRadius: designSystem.borderRadius.lg,
                            border: `1px solid ${designSystem.colors.border.light}`,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: designSystem.spacing.sm,
                          }}>
                            <div>
                              <div style={{
                                fontWeight: 500,
                                color: newMemberForChange.id === selectedSlot.member_id
                                  ? designSystem.colors.info[700]
                                  : designSystem.colors.success[700],
                                fontSize: getFontSize('body', isMobile),
                              }}>
                                {newMemberForChange.id === selectedSlot.member_id
                                  ? `維持原會員：${newMemberForChange.name}`
                                  : `更換為：${newMemberForChange.name}`}
                              </div>
                              {newMemberForChange.nickname && (
                                <div style={getFieldMetaStyle(isMobile)}>
                                  暱稱：{newMemberForChange.nickname}
                                </div>
                              )}
                              {newMemberForChange.id !== selectedSlot.member_id && (
                                <div style={{
                                  ...getFieldMetaStyle(isMobile),
                                  color: designSystem.colors.warning[700],
                                  marginTop: '4px',
                                }}>
                                  從「{selectedSlot.member_nickname || selectedSlot.member_name}」轉移
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => {
                                setNewMemberForChange(null)
                                setChangeMemberSearch('')
                              }}
                              style={dialogCloseButtonStyle}
                              aria-label="清除選擇"
                            >
                              &times;
                            </button>
                          </div>
                        )}
                        </div>
                      )}

                      <div style={getFormGroupStyle(isMobile)}>
                        <label style={getLabelStyle(isMobile)}>
                          開始日 <span style={getFieldMetaStyle(isMobile)}>（選填）</span>
                        </label>
                        <input
                          type="date"
                          value={editForm.start_date}
                          onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
                          style={{ ...getInputStyle(isMobile), boxSizing: 'border-box' }}
                        />
                      </div>

                      <div style={getFormGroupStyle(isMobile)}>
                        <label style={getLabelStyle(isMobile)}>
                          到期日 <span style={getFieldMetaStyle(isMobile)}>（選填）</span>
                        </label>
                        <input
                          type="date"
                          value={editForm.expires_at}
                          onChange={(e) => setEditForm({ ...editForm, expires_at: e.target.value })}
                          style={{ ...getInputStyle(isMobile), boxSizing: 'border-box' }}
                        />
                      </div>

                      <div style={getFormGroupStyle(isMobile)}>
                        <label style={getLabelStyle(isMobile)}>
                          備註 <span style={getFieldMetaStyle(isMobile)}>（選填）</span>
                        </label>
                        <input
                          type="text"
                          value={editForm.notes}
                          onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                          placeholder="例如：有三格"
                          style={getInputStyle(isMobile)}
                        />
                      </div>

                      {(editForm.start_date !== (selectedSlot.start_date || '') ||
                        editForm.expires_at !== (selectedSlot.expires_at || '')) && (
                        <MemoRecordCheckbox
                          checked={recordEditMemo}
                          onChange={setRecordEditMemo}
                          inputValue={editMemoText}
                          onInputChange={setEditMemoText}
                          inputPlaceholder="可輸入修正原因（選填）"
                          hint="一般日期修正可不記錄；正式續約請使用「續約」"
                        />
                      )}

                      <div style={dialogFooterStyle}>
                        <button
                          onClick={() => {
                            setEditing(false)
                            setRecordEditMemo(false)
                            setEditMemoText('')
                            setShowMemberChange(false)
                            setNewMemberForChange(null)
                            setChangeMemberSearch('')
                            setChangeMemberResults([])
                          }}
                          style={{ ...getButtonStyle('outline', 'medium', isMobile), flex: 1 }}
                        >
                          取消
                        </button>
                        <button
                          onClick={handleSaveEdit}
                          style={{ ...getButtonStyle('primary', 'medium', isMobile), flex: 1 }}
                        >
                          儲存
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ marginBottom: designSystem.spacing.lg }}>
                        <div style={getQuietLabelStyle(isMobile)}>會員</div>
                        <div style={{
                          ...getTextStyle('bodyLarge', isMobile),
                          fontWeight: 600,
                          letterSpacing: '-0.01em',
                        }}>
                          {selectedSlot.member_nickname || selectedSlot.member_name}
                          {selectedSlot.member_nickname && selectedSlot.member_name && (
                            <span style={{
                              ...getFieldMetaStyle(isMobile),
                              marginLeft: designSystem.spacing.sm,
                            }}>
                              ({selectedSlot.member_name})
                            </span>
                          )}
                        </div>
                      </div>

                      {selectedSlot.start_date && (
                        <div style={{ marginBottom: designSystem.spacing.lg }}>
                          <div style={getQuietLabelStyle(isMobile)}>開始日</div>
                          <div style={getTextStyle('body', isMobile)}>
                            {selectedSlot.start_date}
                          </div>
                        </div>
                      )}

                      {selectedSlot.expires_at && (
                        <div style={{ marginBottom: designSystem.spacing.lg }}>
                          <div style={getQuietLabelStyle(isMobile)}>到期日</div>
                          <div style={getTextStyle('body', isMobile)}>
                            {selectedSlot.expires_at}
                          </div>
                        </div>
                      )}

                      {selectedSlot.notes && (
                        <div style={{ marginBottom: designSystem.spacing.lg }}>
                          <div style={getQuietLabelStyle(isMobile)}>備註</div>
                          <div style={{
                            ...getTextStyle('bodySmall', isMobile),
                            color: designSystem.colors.text.secondary,
                          }}>
                            {selectedSlot.notes}
                          </div>
                        </div>
                      )}

                      <div style={{ ...dialogFooterStyle, flexDirection: 'column' }}>
                        <button
                          onClick={() => {
                            setEditing(true)
                            setRecordEditMemo(false)
                            setEditMemoText('')
                            setShowMemberChange(false)
                          }}
                          style={getButtonStyle('primary', 'medium', isMobile)}
                        >
                          編輯資料
                        </button>
                        <div style={{
                          display: 'flex',
                          gap: designSystem.spacing.sm,
                          flexWrap: isMobile ? 'wrap' : 'nowrap',
                        }}>
                          <button
                            onClick={() => openBoardRenew(selectedSlot)}
                            style={{
                              ...getButtonStyle('outline', 'small', isMobile),
                              flex: 1,
                              minWidth: isMobile ? '96px' : 0,
                              minHeight: isMobile ? '48px' : undefined,
                            }}
                          >
                            續約
                          </button>
                          <button
                            onClick={() => startMovingSlot(selectedSlot)}
                            style={{
                              ...getButtonStyle('outline', 'small', isMobile),
                              flex: 1,
                              minWidth: isMobile ? '96px' : 0,
                              minHeight: isMobile ? '48px' : undefined,
                            }}
                          >
                            移動格位
                          </button>
                          <button
                            onClick={handleDeleteBoard}
                            style={{
                              ...dangerQuietButtonStyle(isMobile),
                              flex: 1,
                              minWidth: isMobile ? '96px' : 0,
                              minHeight: isMobile ? '48px' : undefined,
                            }}
                          >
                            移除置板
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div>
                  {!isAddingBoard ? (
                    <div style={{
                      padding: `${designSystem.spacing.xxl} ${designSystem.spacing.lg}`,
                      textAlign: 'center',
                    }}>
                      <div style={{
                        ...getTextStyle('body', isMobile),
                        color: designSystem.colors.text.secondary,
                        marginBottom: designSystem.spacing.lg,
                      }}>
                        此格位尚未使用
                      </div>
                      <button
                        onClick={() => startAddingBoard(selectedSlot.slot_number)}
                        style={getButtonStyle('primary', 'medium', isMobile)}
                      >
                        新增置板
                      </button>
                    </div>
                  ) : (
                    <>
                      <div style={getFormGroupStyle(isMobile)}>
                        <label style={getLabelStyle(isMobile)}>
                          選擇會員 <span style={{ color: designSystem.colors.danger[500] }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={memberSearch}
                          onChange={(e) => {
                            setMemberSearch(e.target.value)
                            searchMembers(e.target.value)
                          }}
                          placeholder="搜尋會員姓名/暱稱..."
                          style={getInputStyle(isMobile)}
                        />

                        {searchResults.length > 0 && !selectedMember && (
                          <div style={searchResultsStyle}>
                            {searchResults.map((member) => (
                              <div
                                key={member.id}
                                onClick={() => {
                                  setSelectedMember(member)
                                  setMemberSearch(member.name)
                                  setSearchResults([])
                                }}
                                style={searchResultItemStyle}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = designSystem.colors.background.main
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = designSystem.colors.background.card
                                }}
                              >
                                <div style={{ fontWeight: 500, color: designSystem.colors.text.primary }}>
                                  {member.name}
                                </div>
                                {member.nickname && (
                                  <div style={getFieldMetaStyle(isMobile)}>暱稱：{member.nickname}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {selectedMember && (
                          <div style={{
                            marginTop: designSystem.spacing.sm,
                            padding: designSystem.spacing.md,
                            background: designSystem.colors.success[50],
                            borderRadius: designSystem.borderRadius.lg,
                            border: `1px solid ${designSystem.colors.border.light}`,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: designSystem.spacing.sm,
                          }}>
                            <div>
                              <div style={{
                                fontWeight: 500,
                                color: designSystem.colors.success[700],
                                fontSize: getFontSize('body', isMobile),
                              }}>
                                {selectedMember.name}
                              </div>
                              {selectedMember.nickname && (
                                <div style={getFieldMetaStyle(isMobile)}>
                                  暱稱：{selectedMember.nickname}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => {
                                setSelectedMember(null)
                                setMemberSearch('')
                              }}
                              style={dialogCloseButtonStyle}
                              aria-label="清除選擇"
                            >
                              &times;
                            </button>
                          </div>
                        )}
                      </div>

                      <div style={getFormGroupStyle(isMobile)}>
                        <label style={getLabelStyle(isMobile)}>
                          開始日 <span style={getFieldMetaStyle(isMobile)}>（選填）</span>
                        </label>
                        <input
                          type="date"
                          value={newBoardForm.start_date}
                          onChange={(e) => setNewBoardForm({ ...newBoardForm, start_date: e.target.value })}
                          style={{ ...getInputStyle(isMobile), boxSizing: 'border-box' }}
                        />
                      </div>

                      <div style={getFormGroupStyle(isMobile)}>
                        <label style={getLabelStyle(isMobile)}>
                          到期日 <span style={getFieldMetaStyle(isMobile)}>（選填）</span>
                        </label>
                        <input
                          type="date"
                          value={newBoardForm.expires_at}
                          onChange={(e) => setNewBoardForm({ ...newBoardForm, expires_at: e.target.value })}
                          style={{ ...getInputStyle(isMobile), boxSizing: 'border-box' }}
                        />
                      </div>

                      <div style={getFormGroupStyle(isMobile)}>
                        <label style={getLabelStyle(isMobile)}>
                          備註 <span style={getFieldMetaStyle(isMobile)}>（選填）</span>
                        </label>
                        <input
                          type="text"
                          value={newBoardForm.notes}
                          onChange={(e) => setNewBoardForm({ ...newBoardForm, notes: e.target.value })}
                          placeholder="例如：有三格"
                          style={getInputStyle(isMobile)}
                        />
                      </div>

                      <div style={dialogFooterStyle}>
                        <button
                          onClick={() => {
                            setIsAddingBoard(false)
                            setSelectedSlot(null)
                          }}
                          style={{ ...getButtonStyle('outline', 'medium', isMobile), flex: 1 }}
                        >
                          取消
                        </button>
                        <button
                          onClick={handleAddBoard}
                          disabled={!selectedMember}
                          style={{
                            ...getButtonStyle('primary', 'medium', isMobile),
                            flex: 1,
                            opacity: selectedMember ? 1 : 0.45,
                            cursor: selectedMember ? 'pointer' : 'not-allowed',
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

      {movingSlot && pendingMoveTarget !== null && (
        <div style={dialogOverlayStyle}>
          <div style={dialogPanelStyle}>
            <div style={dialogHeaderBarStyle}>
              <h2 style={{ margin: 0, ...getTextStyle('h3', isMobile), fontWeight: 700 }}>
                確認移動格位
              </h2>
              <button
                onClick={() => !moveSaving && setPendingMoveTarget(null)}
                disabled={moveSaving}
                style={dialogCloseButtonStyle}
                aria-label="關閉"
              >
                &times;
              </button>
            </div>
            <div style={dialogBodyStyle}>
              <div style={{ ...getTextStyle('bodyLarge', isMobile), fontWeight: 600 }}>
                #{movingSlot.slot_number} → #{pendingMoveTarget}
              </div>
              <div style={{ ...getFieldMetaStyle(isMobile), marginTop: designSystem.spacing.sm }}>
                {movingSlot.member_nickname || movingSlot.member_name}
              </div>
              <div style={{ ...getFieldMetaStyle(isMobile), marginTop: designSystem.spacing.lg }}>
                原開始日、到期日與備註會保留，系統只會新增一筆換格備忘。
              </div>
              <div style={dialogFooterStyle}>
                <button
                  onClick={() => setPendingMoveTarget(null)}
                  disabled={moveSaving}
                  style={{
                    ...getButtonStyle('outline', 'medium', isMobile),
                    flex: 1,
                    minHeight: isMobile ? '48px' : undefined,
                  }}
                >
                  返回選擇
                </button>
                <button
                  onClick={confirmMoveSlot}
                  disabled={moveSaving}
                  style={{
                    ...getButtonStyle('primary', 'medium', isMobile),
                    flex: 1,
                    opacity: moveSaving ? 0.6 : 1,
                    minHeight: isMobile ? '48px' : undefined,
                  }}
                >
                  {moveSaving ? '移動中...' : '確認移動'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {renewingSlot && (
        <div style={dialogOverlayStyle}>
          <div style={dialogPanelStyle}>
            <div style={dialogHeaderBarStyle}>
              <h2 style={{ margin: 0, ...getTextStyle('h3', isMobile), fontWeight: 700 }}>
                置板續約 #{renewingSlot.slot_number}
              </h2>
              <button
                onClick={() => {
                  if (renewSaving) return
                  setRenewingSlot(null)
                  setRenewEndDate('')
                }}
                disabled={renewSaving}
                style={dialogCloseButtonStyle}
                aria-label="關閉"
              >
                &times;
              </button>
            </div>
            <div style={dialogBodyStyle}>
              <div style={getFormGroupStyle(isMobile)}>
                <label style={getLabelStyle(isMobile)}>新的到期日</label>
                <input
                  type="date"
                  value={renewEndDate}
                  onChange={(e) => setRenewEndDate(e.target.value)}
                  disabled={renewSaving}
                  style={getInputStyle(isMobile)}
                />
                <div style={getFieldMetaStyle(isMobile)}>
                  目前到期：{renewingSlot.expires_at || '未設定'}
                </div>
              </div>
              <div style={dialogFooterStyle}>
                <button
                  onClick={() => {
                    setRenewingSlot(null)
                    setRenewEndDate('')
                  }}
                  disabled={renewSaving}
                  style={{
                    ...getButtonStyle('outline', 'medium', isMobile),
                    flex: 1,
                    minHeight: isMobile ? '48px' : undefined,
                  }}
                >
                  取消
                </button>
                <button
                  onClick={handleBoardRenew}
                  disabled={renewSaving}
                  style={{
                    ...getButtonStyle('primary', 'medium', isMobile),
                    flex: 1,
                    opacity: renewSaving ? 0.6 : 1,
                    minHeight: isMobile ? '48px' : undefined,
                  }}
                >
                  {renewSaving ? '續約中...' : '確認續約'}
                </button>
              </div>
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

