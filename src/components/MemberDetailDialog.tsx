import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useResponsive } from '../hooks/useResponsive'
import { EditMemberDialog } from './EditMemberDialog'
import { TransactionDialog } from './TransactionDialog'
import { useToast } from './ui'
import { normalizeDate } from '../utils/date'
import { MemoRecordCheckbox } from './MemoRecordCheckbox'

interface Member {
  id: string
  name: string
  nickname: string | null
  birthday: string | null
  phone: string | null
  balance: number | null
  vip_voucher_amount: number | null
  designated_lesson_minutes: number | null
  boat_voucher_g23_minutes: number | null
  boat_voucher_g21_panther_minutes: number | null
  boat_voucher_g21_minutes: number | null
  gift_boat_hours: number | null
  free_hours: number | null
  free_hours_notes: string | null
  free_hours_used: number | null
  membership_end_date: string | null
  membership_start_date: string | null
  membership_type: string | null
  membership_partner_id: string | null
  board_slot_number: string | null
  board_expiry_date: string | null
  notes: string | null
  status: string | null
  created_at: string | null
  updated_at: string | null
  partner?: { id: string, name: string, nickname: string | null } | null
  // 衍生欄位：LINE 綁定
  is_line_bound?: boolean
  line_binding_user_id?: string | null
}

interface BoardStorage {
  id: number
  slot_number: number
  start_date: string | null
  expires_at: string | null
  notes: string | null
  status: string | null
}

interface MemberNote {
  id: number
  member_id: string
  event_date: string | null
  event_type: string
  description: string
  created_at: string | null
  updated_at: string | null
}

// 事件類型選項
const EVENT_TYPES = [
  { value: '續約', label: '續約', color: '#4caf50' },
  { value: '購買', label: '購買', color: '#2196f3' },
  { value: '贈送', label: '贈送', color: '#9c27b0' },
  { value: '使用', label: '使用', color: '#ff9800' },
  { value: '入會', label: '入會', color: '#e91e63' },
  { value: '備註', label: '備註', color: '#607d8b' },
]

interface MemberDetailDialogProps {
  open: boolean
  memberId: string | null
  onClose: () => void
  onUpdate: () => void
  onSwitchMember?: (memberId: string) => void  // 切換到另一個會員
}

export function MemberDetailDialog({ open, memberId, onClose, onUpdate, onSwitchMember }: MemberDetailDialogProps) {
  const { isMobile } = useResponsive()
  const toast = useToast()
  const [member, setMember] = useState<Member | null>(null)
  const [boardStorage, setBoardStorage] = useState<BoardStorage[]>([])
  const [memberNotes, setMemberNotes] = useState<MemberNote[]>([])
  const [loading, setLoading] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false)
  const [addBoardDialogOpen, setAddBoardDialogOpen] = useState(false)
  const [boardFormData, setBoardFormData] = useState({
    slot_number: '',
    start_date: '',
    expires_at: '',
    notes: ''
  })
  
  // 備忘錄相關狀態
  const [noteDialogOpen, setNoteDialogOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<MemberNote | null>(null)
  const [noteFormData, setNoteFormData] = useState({
    event_date: '',
    event_type: '備註',
    description: ''
  })

  // 會籍續約相關狀態
  const [renewDialogOpen, setRenewDialogOpen] = useState(false)
  const [renewEndDate, setRenewEndDate] = useState('')
  const [renewBothPartners, setRenewBothPartners] = useState(true) // 雙人會員是否一起續約

  // 置板續約相關狀態
  const [boardRenewDialogOpen, setBoardRenewDialogOpen] = useState(false)
  const [boardRenewEndDate, setBoardRenewEndDate] = useState('')
  const [renewingBoard, setRenewingBoard] = useState<{id: number, slot_number: number, expires_at: string | null} | null>(null)

  // 置板編輯相關狀態
  const [boardEditDialogOpen, setBoardEditDialogOpen] = useState(false)
  const [editingBoard, setEditingBoard] = useState<BoardStorage | null>(null)
  const [boardEditForm, setBoardEditForm] = useState({
    start_date: '',
    expires_at: '',
    notes: '',
    addToMemo: false,  // 預設不記錄，置板編輯通常是修正錯誤
    memoText: ''       // 記錄原因
  })

  // 快速編輯電話相關狀態
  const [quickEditPhoneOpen, setQuickEditPhoneOpen] = useState(false)
  const [quickEditPhone, setQuickEditPhone] = useState('')
  const [savingPhone, setSavingPhone] = useState(false)

  // LINE 綁定狀態
  const [lineBound, setLineBound] = useState(false)
  const [lineUserId, setLineUserId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setEditDialogOpen(false)
      setTransactionDialogOpen(false)
      setAddBoardDialogOpen(false)
      setNoteDialogOpen(false)
      setEditingNote(null)
      setRenewDialogOpen(false)
      setRenewEndDate('')
      setQuickEditPhoneOpen(false)
      setQuickEditPhone('')
      setBoardEditDialogOpen(false)
      setEditingBoard(null)
    }
  }, [open])

  useEffect(() => {
    if (open && memberId) {
      loadMemberData()
    }
  }, [open, memberId])

  const loadMemberData = async () => {
    if (!memberId) return
    
    setLoading(true)
    try {
      // 載入會員、置板與 LINE 綁定
      const [memberResult, boardResult, lineBindingResult] = await Promise.all([
        supabase
          .from('members')
          .select('*')
          .eq('id', memberId)
          .single(),
        supabase
          .from('board_storage')
          .select('*')
          .eq('member_id', memberId)
          .eq('status', 'active')
          .order('slot_number', { ascending: true }),
        supabase
          .from('line_bindings')
          .select('line_user_id')
          .eq('member_id', memberId)
          .eq('status', 'active')
      ])

      if (memberResult.error) throw memberResult.error
      
      const memberData = memberResult.data

      // LINE 綁定狀態
      const activeBinding = (lineBindingResult.data || [])[0]
      setLineBound(Boolean(activeBinding))
      setLineUserId(activeBinding?.line_user_id || null)
      
      // 如果有配對會員，載入配對會員資料
      let partnerData = null
      if (memberData.membership_partner_id) {
        const { data: partner } = await supabase
          .from('members')
          .select('id, name, nickname, membership_end_date')
          .eq('id', memberData.membership_partner_id)
          .single()
        partnerData = partner
      }
      
      setMember({ 
        ...memberData, 
        partner: partnerData,
        is_line_bound: Boolean(activeBinding),
        line_binding_user_id: activeBinding?.line_user_id || null
      })

      if (boardResult.error) throw boardResult.error
      setBoardStorage(boardResult.data || [])
      
      // 載入備忘錄
      loadMemberNotes()
    } catch (error) {
      console.error('載入會員資料失敗:', error)
      toast.error('載入會員資料失敗')
    } finally {
      setLoading(false)
    }
  }

  // 載入會員備忘錄
  const loadMemberNotes = async () => {
    if (!memberId) return
    
    try {
      // @ts-ignore - member_notes 表需要執行資料庫遷移後才會有類型
      const { data, error } = await supabase
        .from('member_notes')
        .select('*')
        .eq('member_id', memberId)
        .order('event_date', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: false })

      if (error) throw error
      setMemberNotes(data || [])
    } catch (error) {
      console.error('載入備忘錄失敗:', error)
    }
  }

  // 快速編輯電話
  const handleQuickSavePhone = async () => {
    if (!memberId) return
    
    const trimmedPhone = quickEditPhone.trim()
    if (trimmedPhone && !/^09\d{8}$/.test(trimmedPhone)) {
      toast.warning('手機號碼需為 09 開頭的 10 位數字')
      return
    }
    
    setSavingPhone(true)
    try {
      const { error } = await supabase
        .from('members')
        .update({ phone: trimmedPhone || null })
        .eq('id', memberId)
      
      if (error) throw error
      
      toast.success('手機號碼已更新')
      setQuickEditPhoneOpen(false)
      loadMemberData()
      onUpdate()
    } catch (error) {
      console.error('更新手機號碼失敗:', error)
      toast.error('更新失敗')
    } finally {
      setSavingPhone(false)
    }
  }

  // 新增/編輯備忘錄
  const handleSaveNote = async () => {
    if (!memberId || !noteFormData.event_date || !noteFormData.description.trim()) {
      toast.warning('請填寫日期和說明')
      return
    }

    try {
      if (editingNote) {
        // 編輯
        // @ts-ignore - member_notes 表需要執行資料庫遷移後才會有類型
        const { error } = await supabase
          .from('member_notes')
          .update({
            event_date: noteFormData.event_date,
            event_type: noteFormData.event_type,
            description: noteFormData.description.trim()
          })
          .eq('id', editingNote.id)

        if (error) throw error
        toast.success('備忘錄已更新')
      } else {
        // 新增
        // @ts-ignore - member_notes 表需要執行資料庫遷移後才會有類型
        const { error } = await supabase
          .from('member_notes')
          .insert([{
            member_id: memberId,
            event_date: noteFormData.event_date,
            event_type: noteFormData.event_type,
            description: noteFormData.description.trim()
          }])

        if (error) throw error
        toast.success('備忘錄已新增')
      }

      setNoteDialogOpen(false)
      setEditingNote(null)
      setNoteFormData({ event_date: '', event_type: '備註', description: '' })
      loadMemberNotes()
    } catch (error) {
      console.error('儲存備忘錄失敗:', error)
      toast.error('儲存失敗')
    }
  }

  // 刪除備忘錄
  const handleDeleteNote = async (noteId: number) => {
    if (!confirm('確定要刪除這則備忘錄嗎？')) return

    try {
      // @ts-ignore - member_notes 表需要執行資料庫遷移後才會有類型
      const { error } = await supabase
        .from('member_notes')
        .delete()
        .eq('id', noteId)

      if (error) throw error
      toast.success('備忘錄已刪除')
      loadMemberNotes()
    } catch (error) {
      console.error('刪除備忘錄失敗:', error)
      toast.error('刪除失敗')
    }
  }

  // 開啟編輯備忘錄
  const handleEditNote = (note: MemberNote) => {
    setEditingNote(note)
    setNoteFormData({
      event_date: note.event_date || '',
      event_type: note.event_type,
      description: note.description
    })
    setNoteDialogOpen(true)
  }

  // 開啟新增備忘錄
  const handleAddNote = () => {
    setEditingNote(null)
    setNoteFormData({ 
      event_date: new Date().toISOString().split('T')[0], 
      event_type: '備註', 
      description: '' 
    })
    setNoteDialogOpen(true)
  }

  // 不續約轉非會員
  const handleConvertToGuest = async () => {
    if (!member || !memberId) return
    
    const hasPartner = member.membership_type === 'dual' && member.membership_partner_id
    const partnerInfo = hasPartner ? `\n• 解除與 ${member.partner?.nickname || member.partner?.name || '配對會員'} 的配對關係` : ''
    
    const confirmMsg = `確定要將 ${member.nickname || member.name} 轉為非會員嗎？\n\n這會：\n• 會籍類型改為「非會員」\n• 清空會籍開始/到期日期${partnerInfo}\n• 新增一則備忘錄記錄\n\n儲值餘額和置板會保留。`
    if (!confirm(confirmMsg)) return

    try {
      // 1. 如果有配對，先解除配對關係
      if (hasPartner && member.membership_partner_id) {
        // 將配對會員改為一般會員，並清除配對
        await supabase
          .from('members')
          .update({
            membership_type: 'general',
            membership_partner_id: null
          })
          .eq('id', member.membership_partner_id)
        
        // 幫配對會員加一則備忘錄
        const today = new Date().toISOString().split('T')[0]
        // @ts-ignore
        await supabase.from('member_notes').insert([{
          member_id: member.membership_partner_id,
          event_date: today,
          event_type: '備註',
          description: `配對會員 ${member.nickname || member.name} 轉非會員，改為一般會員`
        }])
      }

      // 2. 更新會員資料
      const { error: updateError } = await supabase
        .from('members')
        .update({
          membership_type: 'guest',
          membership_start_date: null,
          membership_end_date: null,
          membership_partner_id: null
        })
        .eq('id', memberId)

      if (updateError) throw updateError

      // 3. 新增備忘錄
      const today = new Date().toISOString().split('T')[0]
      const oldEndDate = member.membership_end_date ? `（原到期：${member.membership_end_date}）` : ''
      // @ts-ignore
      await supabase
        .from('member_notes')
        .insert([{
          member_id: memberId,
          event_date: today,
          event_type: '備註',
          description: `會籍不續約，轉非會員${oldEndDate}`
        }])

      toast.success('已轉為非會員')
      loadMemberData()
      loadMemberNotes()
      onUpdate()
    } catch (error) {
      console.error('轉換失敗:', error)
      toast.error('轉換失敗')
    }
  }

  // 續約 / 轉會員
  const handleRenew = async () => {
    if (!member || !memberId || !renewEndDate) {
      toast.warning('請選擇新的到期日')
      return
    }

    const isGuest = member.membership_type === 'guest'
    const isDual = member.membership_type === 'dual'
    const hasPartner = isDual && member.membership_partner_id && member.partner
    const today = new Date().toISOString().split('T')[0]

    try {
      // 1. 更新會員資料
      const updateData: any = {
        membership_end_date: renewEndDate
      }
      
      // 如果是非會員轉會員，設定開始日期和類型
      if (isGuest) {
        updateData.membership_type = 'general'
        updateData.membership_start_date = today
      }

      const { error: updateError } = await supabase
        .from('members')
        .update(updateData)
        .eq('id', memberId)

      if (updateError) throw updateError

      // 2. 新增備忘錄
      // @ts-ignore
      await supabase
        .from('member_notes')
        .insert([{
          member_id: memberId,
          event_date: today,
          event_type: isGuest ? '入會' : '續約',
          description: isGuest ? `入會，會籍至 ${renewEndDate}` : `續約至 ${renewEndDate}`
        }])

      // 3. 處理雙人會員
      if (hasPartner && member.membership_partner_id) {
        if (renewBothPartners) {
          // 一起續約：更新配對會員的到期日
          await supabase
            .from('members')
            .update({ membership_end_date: renewEndDate })
            .eq('id', member.membership_partner_id)

          // 幫配對會員加備忘錄
          // @ts-ignore
          await supabase.from('member_notes').insert([{
            member_id: member.membership_partner_id,
            event_date: today,
            event_type: '續約',
            description: `續約至 ${renewEndDate}（與 ${member.nickname || member.name} 一起續約）`
          }])
        } else {
          // 只續自己：解除配對，雙方都變一般會員
          // 更新自己為一般會員
          await supabase
            .from('members')
            .update({ 
              membership_type: 'general',
              membership_partner_id: null 
            })
            .eq('id', memberId)

          // 更新配對會員為一般會員
          await supabase
            .from('members')
            .update({ 
              membership_type: 'general',
              membership_partner_id: null 
            })
            .eq('id', member.membership_partner_id)

          // 幫配對會員加備忘錄
          // @ts-ignore
          await supabase.from('member_notes').insert([{
            member_id: member.membership_partner_id,
            event_date: today,
            event_type: '備註',
            description: `配對會員 ${member.nickname || member.name} 單獨續約，解除配對，改為一般會員`
          }])

          // 幫自己加備忘錄（解除配對）
          // @ts-ignore
          await supabase.from('member_notes').insert([{
            member_id: memberId,
            event_date: today,
            event_type: '備註',
            description: `單獨續約，與 ${member.partner?.nickname || member.partner?.name} 解除配對，改為一般會員`
          }])
        }
      }

      const partnerMsg = hasPartner ? (renewBothPartners ? '（含配對會員）' : '（已解除配對）') : ''
      toast.success(isGuest ? '已轉為會員' : `續約成功${partnerMsg}`)
      setRenewDialogOpen(false)
      setRenewEndDate('')
      setRenewBothPartners(true)
      loadMemberData()
      loadMemberNotes()
      onUpdate()
    } catch (error) {
      console.error('操作失敗:', error)
      toast.error('操作失敗')
    }
  }

  const handleEditSuccess = () => {
    loadMemberData()
    onUpdate()
  }

  const handleTransactionSuccess = () => {
    loadMemberData()
    onUpdate()
  }

  const handleAddBoard = async () => {
    if (!memberId || !boardFormData.slot_number) {
      toast.warning('請輸入格位編號')
      return
    }

    const slotNumber = parseInt(boardFormData.slot_number)
    if (isNaN(slotNumber) || slotNumber < 1 || slotNumber > 145) {
      toast.warning('格位編號必須是 1-145 之間的數字')
      return
    }

    try {
      const { error } = await supabase
        .from('board_storage')
        .insert([{
          member_id: memberId,
          slot_number: slotNumber,
          start_date: boardFormData.start_date || null,
          expires_at: boardFormData.expires_at || null,
          notes: boardFormData.notes.trim() || null,
          status: 'active'
        }])

      if (error) {
        if (error.code === '23505') {
          toast.warning(`格位 ${slotNumber} 已被使用，請選擇其他格位`)
        } else {
          throw error
        }
        return
      }

      // 新增備忘錄
      const today = new Date().toISOString().split('T')[0]
      const expiryInfo = boardFormData.expires_at ? `，至 ${boardFormData.expires_at}` : ''
      // @ts-ignore
      await supabase.from('member_notes').insert([{
        member_id: memberId,
        event_date: boardFormData.start_date || today,
        event_type: '備註',
        description: `置板開始 #${slotNumber}${expiryInfo}`
      }])

      toast.success(`已新增格位 #${slotNumber}`)
      setBoardFormData({ slot_number: '', start_date: '', expires_at: '', notes: '' })
      setAddBoardDialogOpen(false)
      loadMemberData()
      loadMemberNotes()
      onUpdate()
    } catch (error) {
      console.error('新增置板失敗:', error)
      toast.error('新增置板失敗')
    }
  }

  const handleDeleteBoard = async (boardId: number, slotNumber: number) => {
    if (!confirm(`確定要刪除格位 #${slotNumber} 嗎？`)) {
      return
    }

    try {
      // 真正刪除記錄，而不是只改狀態
      const { error } = await supabase
        .from('board_storage')
        .delete()
        .eq('id', boardId)

      if (error) throw error

      // 新增備忘錄
      const today = new Date().toISOString().split('T')[0]
      // @ts-ignore
      await supabase.from('member_notes').insert([{
        member_id: memberId,
        event_date: today,
        event_type: '備註',
        description: `移除置板 #${slotNumber}`
      }])

      toast.success(`已刪除格位 #${slotNumber}`)
      loadMemberData()
      loadMemberNotes()
      onUpdate()
    } catch (error) {
      console.error('刪除置板失敗:', error)
      toast.error('刪除置板失敗')
    }
  }

  // 打開置板續約對話框
  const openBoardRenewDialog = (boardId: number, slotNumber: number, currentExpiry: string | null) => {
    const currentDate = currentExpiry ? new Date(currentExpiry) : new Date()
    const newExpiry = new Date(currentDate)
    newExpiry.setFullYear(newExpiry.getFullYear() + 1)
    setBoardRenewEndDate(newExpiry.toISOString().split('T')[0])
    setRenewingBoard({ id: boardId, slot_number: slotNumber, expires_at: currentExpiry })
    setBoardRenewDialogOpen(true)
  }

  // 執行置板續約
  const handleBoardRenew = async () => {
    if (!renewingBoard || !boardRenewEndDate) {
      toast.warning('請選擇新的到期日')
      return
    }

    try {
      const { error } = await supabase
        .from('board_storage')
        .update({ expires_at: boardRenewEndDate })
        .eq('id', renewingBoard.id)

      if (error) throw error

      // 新增備忘錄
      const today = new Date().toISOString().split('T')[0]
      // @ts-ignore
      await supabase.from('member_notes').insert([{
        member_id: memberId,
        event_date: today,
        event_type: '續約置板',
        description: `置板續約 #${renewingBoard.slot_number}，至 ${boardRenewEndDate}`
      }])

      toast.success(`格位 #${renewingBoard.slot_number} 已延長至 ${boardRenewEndDate}`)
      setBoardRenewDialogOpen(false)
      setBoardRenewEndDate('')
      setRenewingBoard(null)
      loadMemberData()
      loadMemberNotes()
      onUpdate()
    } catch (error) {
      console.error('置板續約失敗:', error)
      toast.error('置板續約失敗')
    }
  }

  // 打開置板編輯對話框
  const openBoardEditDialog = (board: BoardStorage) => {
    setEditingBoard(board)
    setBoardEditForm({
      start_date: board.start_date || '',
      expires_at: board.expires_at || '',
      notes: board.notes || '',
      addToMemo: false,  // 預設不記錄，因為置板編輯通常是修正錯誤
      memoText: ''       // 清空自訂文字
    })
    setBoardEditDialogOpen(true)
  }

  // 執行置板編輯
  const handleBoardEdit = async () => {
    if (!editingBoard) return

    try {
      const oldStartDate = editingBoard.start_date
      const oldExpiresAt = editingBoard.expires_at
      const newStartDate = boardEditForm.start_date || null
      const newExpiresAt = boardEditForm.expires_at || null

      const { error } = await supabase
        .from('board_storage')
        .update({
          start_date: newStartDate,
          expires_at: newExpiresAt,
          notes: boardEditForm.notes.trim() || null
        })
        .eq('id', editingBoard.id)

      if (error) throw error

      // 如果勾選「記錄到備忘錄」且日期有變更或有自訂文字
      if (boardEditForm.addToMemo) {
        const changes: string[] = []
        if (oldStartDate !== newStartDate) {
          changes.push(`開始日 ${oldStartDate || '無'} → ${newStartDate || '無'}`)
        }
        if (oldExpiresAt !== newExpiresAt) {
          changes.push(`到期日 ${oldExpiresAt || '無'} → ${newExpiresAt || '無'}`)
        }

        // 有日期變更或有自訂文字時，新增備忘錄
        if (changes.length > 0 || boardEditForm.memoText.trim()) {
          const today = new Date().toISOString().split('T')[0]
          let description = ''
          
          if (changes.length > 0) {
            description = `置板 #${editingBoard.slot_number} 修改：${changes.join('、')}`
          }
          if (boardEditForm.memoText.trim()) {
            description = description 
              ? `${description}（${boardEditForm.memoText.trim()}）` 
              : `置板 #${editingBoard.slot_number}：${boardEditForm.memoText.trim()}`
          }
          
          // @ts-ignore
          await supabase.from('member_notes').insert([{
            member_id: memberId,
            event_date: today,
            event_type: '備註',
            description
          }])
        }
      }

      toast.success(`置板 #${editingBoard.slot_number} 已更新`)
      setBoardEditDialogOpen(false)
      setEditingBoard(null)
      loadMemberData()
      if (boardEditForm.addToMemo) {
        loadMemberNotes()
      }
      onUpdate()
    } catch (error) {
      console.error('置板編輯失敗:', error)
      toast.error('置板編輯失敗')
    }
  }

  if (!open || !memberId) return null

  return (
    <>
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: isMobile ? '0' : '20px',
      }}>
        <div style={{
          background: 'white',
          borderRadius: isMobile ? '12px 12px 0 0' : '12px',
          maxWidth: isMobile ? '100%' : '800px',
          width: '100%',
          maxHeight: isMobile ? '95vh' : '90vh',
          overflow: 'auto',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          margin: isMobile ? 'auto 0 0 0' : 'auto',
          WebkitOverflowScrolling: 'touch',
        }}>
          {/* 標題欄 */}
          <div style={{
            padding: '20px',
            borderBottom: '1px solid #e0e0e0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'sticky',
            top: 0,
            background: 'white',
            zIndex: 1,
          }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
              會員詳情
            </h2>
            <button
              onClick={onClose}
              style={{
                border: 'none',
                background: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#666',
                padding: '0 8px',
              }}
            >
              ×
            </button>
          </div>

          {loading ? (
            <div style={{ padding: '50px', textAlign: 'center', color: '#666' }}>載入中...</div>
          ) : !member ? (
            <div style={{ padding: '50px', textAlign: 'center', color: '#666' }}>找不到會員資料</div>
          ) : (
            <>
              {/* 內容區 */}
              <div style={{ padding: isMobile ? '16px' : '20px' }}>
                    {/* 基本資料 */}
                    <div style={{ marginBottom: '24px' }}>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        marginBottom: '12px'
                      }}>
                        <h3 style={{ margin: 0, fontSize: '16px', color: '#333', fontWeight: '600' }}>👤 基本資料</h3>
                        <button
                          onClick={() => setEditDialogOpen(true)}
                          style={{
                            padding: '4px 12px',
                            background: '#f5f5f5',
                            color: '#666',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                        >
                          ✏️ 編輯
                        </button>
                      </div>
                      <div style={{ 
                        background: '#f8f9fa',
                        borderRadius: '8px',
                        padding: '12px 16px',
                      }}>
                        <div style={{ 
                          display: isMobile ? 'flex' : 'flex', 
                          flexDirection: isMobile ? 'column' : 'row',
                          flexWrap: isMobile ? 'nowrap' : 'wrap', 
                          gap: isMobile ? '8px' : '16px', 
                          fontSize: '14px' 
                        }}>
                          <div><span style={{ color: '#666' }}>姓名：</span>{member.name}</div>
                          {member.nickname && <div><span style={{ color: '#666' }}>暱稱：</span>{member.nickname}</div>}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: '#666' }}>手機：</span>
                            <span>{member.phone || <span style={{ color: '#999' }}>未填寫</span>}</span>
                            <button
                              onClick={() => {
                                setQuickEditPhone(member.phone || '')
                                setQuickEditPhoneOpen(true)
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: '2px 6px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                color: '#5a5a5a',
                                flexShrink: 0,
                              }}
                              title="修改手機號碼"
                            >
                              ✏️
                            </button>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span
                              title={lineBound ? (lineUserId ? `已綁定 (${lineUserId})` : '已綁定') : '未綁定'}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '2px 8px',
                                borderRadius: '999px',
                                fontSize: '12px',
                                fontWeight: 600,
                                background: lineBound ? '#e8f5e9' : '#f5f5f5',
                                color: lineBound ? '#2e7d32' : '#9e9e9e',
                                border: `1px solid ${lineBound ? '#a5d6a7' : '#e0e0e0'}`
                              }}
                            >
                              {lineBound ? '✅ LINE 已綁定' : '❌ LINE 未綁定'}
                            </span>
                            {lineBound && (
                              <button
                                onClick={async () => {
                                  if (!memberId) return
                                  const confirmed = window.confirm(`確定要移除「${member.nickname || member.name}」的 LINE 綁定嗎？`)
                                  if (!confirmed) return
                                  try {
                                    const { error } = await supabase
                                      .from('line_bindings')
                                      .update({ status: 'revoked' })
                                      .eq('member_id', memberId)
                                      .eq('status', 'active')
                                    if (error) throw error
                                    toast.success('已移除 LINE 綁定')
                                    await loadMemberData()
                                    onUpdate()
                                  } catch (err) {
                                    console.error('移除 LINE 綁定失敗:', err)
                                    toast.error('移除 LINE 綁定失敗')
                                  }
                                }}
                                style={{
                                  padding: '4px 8px',
                                  background: '#fdecec',
                                  color: '#b91c1c',
                                  border: '1px solid #f8b4b4',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                  fontWeight: 700
                                }}
                                title="移除 LINE 綁定"
                              >
                                移除綁定
                              </button>
                            )}
                          </div>
                          {member.birthday && <div><span style={{ color: '#666' }}>生日：</span>{formatDate(member.birthday)}</div>}
                          <div>
                            <span style={{ 
                              background: member.membership_type === 'guest' ? '#fff9e6' : '#e3f2fd',
                              color: member.membership_type === 'guest' ? '#856404' : '#1976d2',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}>
                              {getMembershipTypeLabel(member.membership_type || 'general')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 會籍 - 會員 */}
                    {(member.membership_type === 'general' || member.membership_type === 'dual') && (
                      <div style={{ marginBottom: '24px' }}>
                        <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#333', fontWeight: '600' }}>🎫 會籍</h3>
                        <div style={{ 
                          background: '#f8f9fa',
                          borderRadius: '8px',
                          padding: '12px 16px',
                        }}>
                          <div style={{ 
                            fontSize: '14px', 
                            marginBottom: '12px',
                            color: member.membership_end_date && isExpired(member.membership_end_date) ? '#f44336' : '#333'
                          }}>
                            {formatDate(member.membership_start_date) || '?'} → {formatDate(member.membership_end_date) || '?'}
                            {member.membership_end_date && isExpired(member.membership_end_date) && 
                              <span style={{ marginLeft: '8px', fontWeight: '600' }}>(已過期)</span>
                            }
                          </div>
                          {member.membership_type === 'dual' && member.partner && (
                            <div 
                              onClick={() => onSwitchMember?.(member.partner!.id)}
                              style={{ 
                                fontSize: '13px', 
                                color: onSwitchMember ? '#2196F3' : '#666', 
                                marginBottom: '12px',
                                cursor: onSwitchMember ? 'pointer' : 'default',
                                textDecoration: onSwitchMember ? 'underline' : 'none',
                                textDecorationStyle: 'dotted',
                                textUnderlineOffset: '2px'
                              }}
                              title={onSwitchMember ? `點擊查看 ${member.partner.nickname || member.partner.name} 的資料` : undefined}
                            >
                              🔗 配對：{member.partner.nickname || member.partner.name}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                            <button
                              onClick={() => {
                                const currentEnd = member.membership_end_date 
                                  ? new Date(member.membership_end_date) 
                                  : new Date()
                                const newEnd = new Date(currentEnd)
                                newEnd.setFullYear(newEnd.getFullYear() + 1)
                                setRenewEndDate(newEnd.toISOString().split('T')[0])
                                setRenewDialogOpen(true)
                              }}
                              style={{
                                padding: '6px 14px',
                                background: '#4caf50',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '13px',
                                fontWeight: '500',
                                cursor: 'pointer',
                              }}
                            >
                              🔄 續約
                            </button>
                            <button
                              onClick={handleConvertToGuest}
                              style={{
                                padding: '6px 14px',
                                background: 'white',
                                color: '#666',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '13px',
                                cursor: 'pointer',
                              }}
                            >
                              轉非會員
                            </button>
                          </div>
                          <div style={{ fontSize: '12px', color: '#999', lineHeight: '1.5' }}>
                            <div>• <strong>續約</strong>：設定新的到期日（預設+1年），會記錄到備忘錄</div>
                            <div>• <strong>轉非會員</strong>：清空會籍日期（資料在備忘錄），保留儲值和置板可繼續使用</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 會籍 - 非會員 */}
                    {member.membership_type === 'guest' && (
                      <div style={{ marginBottom: '24px' }}>
                        <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#333', fontWeight: '600' }}>🎫 會籍</h3>
                        <div style={{ 
                          background: '#f8f9fa',
                          borderRadius: '8px',
                          padding: '12px 16px',
                        }}>
                          <div style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>
                            目前為非會員
                          </div>
                          <button
                            onClick={() => {
                              const today = new Date()
                              const endDate = new Date(today)
                              endDate.setFullYear(endDate.getFullYear() + 1)
                              setRenewEndDate(endDate.toISOString().split('T')[0])
                              setRenewDialogOpen(true)
                            }}
                            style={{
                              padding: '6px 14px',
                              background: '#4caf50',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '13px',
                              fontWeight: '500',
                              cursor: 'pointer',
                            }}
                          >
                            🎫 轉為會員
                          </button>
                          <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                            設定會籍開始與到期日，會記錄到備忘錄
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 置板 */}
                    <div style={{ marginBottom: '24px' }}>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        marginBottom: '12px'
                      }}>
                        <h3 style={{ margin: 0, fontSize: '16px', color: '#333', fontWeight: '600' }}>🏄 置板</h3>
                        <button
                          onClick={() => setAddBoardDialogOpen(true)}
                          style={{
                            padding: '4px 12px',
                            background: '#5a5a5a',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                        >
                          + 新增
                        </button>
                      </div>
                      {boardStorage.length === 0 ? (
                        <div style={{ 
                          background: '#f8f9fa',
                          borderRadius: '8px',
                          padding: '16px',
                          textAlign: 'center', 
                          color: '#999', 
                          fontSize: '13px' 
                        }}>
                          尚無置板
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {boardStorage.map((board) => (
                            <div 
                              key={board.id} 
                              onClick={() => openBoardEditDialog(board)}
                              style={{
                                background: '#f8f9fa',
                                borderRadius: '6px',
                                padding: '10px 14px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                fontSize: '13px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                border: '1px solid transparent',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#e8f4fd'
                                e.currentTarget.style.borderColor = '#90caf9'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#f8f9fa'
                                e.currentTarget.style.borderColor = 'transparent'
                              }}
                            >
                              <div>
                                <span style={{ fontWeight: '600' }}>#{board.slot_number}</span>
                                {board.start_date && <span style={{ color: '#666', marginLeft: '8px' }}>{formatDate(board.start_date)}</span>}
                                {board.expires_at && <span style={{ color: '#666' }}> → {formatDate(board.expires_at)}</span>}
                                {board.expires_at && isExpired(board.expires_at) && 
                                  <span style={{ color: '#f44336', marginLeft: '6px' }}>(已過期)</span>
                                }
                                {board.notes && (
                                  <span style={{ color: '#999', marginLeft: '8px', fontSize: '12px' }}>
                                    📝 {board.notes.length > 10 ? board.notes.substring(0, 10) + '...' : board.notes}
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()  // 防止觸發卡片的點擊
                                  openBoardRenewDialog(board.id, board.slot_number, board.expires_at)
                                }}
                                style={{
                                  padding: '4px 10px',
                                  background: '#4caf50',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                }}
                              >
                                +1年
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 備忘錄 */}
                    <div style={{ marginBottom: '24px' }}>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        marginBottom: '12px'
                      }}>
                        <h3 style={{ margin: 0, fontSize: '16px', color: '#333', fontWeight: '600' }}>
                          📝 備忘錄 {memberNotes.length > 0 && <span style={{ color: '#999', fontWeight: 'normal' }}>({memberNotes.length})</span>}
                        </h3>
                        <button
                          onClick={handleAddNote}
                          style={{
                            padding: '4px 12px',
                            background: '#5a5a5a',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                        >
                          + 新增
                        </button>
                      </div>
                      
                      {memberNotes.length === 0 ? (
                        <div style={{ 
                          textAlign: 'center', 
                          padding: '30px 20px', 
                          color: '#999',
                          background: '#f8f9fa',
                          borderRadius: '8px',
                          border: '1px solid #e0e0e0'
                        }}>
                          <div style={{ fontSize: '32px', marginBottom: '8px' }}>📝</div>
                          <div style={{ fontSize: '14px' }}>尚無備忘錄</div>
                        </div>
                      ) : (
                        <div style={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: '10px',
                          maxHeight: '500px',
                          overflowY: 'auto'
                        }}>
                          {memberNotes.map((note) => {
                            const eventType = EVENT_TYPES.find(t => t.value === note.event_type) || EVENT_TYPES[5]
                            return (
                              <div
                                key={note.id}
                                style={{
                                  background: '#f8f9fa',
                                  borderRadius: '8px',
                                  padding: '12px',
                                  borderLeft: `4px solid ${eventType.color}`,
                                }}
                              >
                                <div style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'flex-start',
                                }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      gap: '8px',
                                      marginBottom: '4px',
                                    }}>
                                      <span style={{
                                        background: eventType.color,
                                        color: 'white',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        fontWeight: '600',
                                      }}>
                                        {eventType.label}
                                      </span>
                                      <span style={{ color: '#666', fontSize: '12px' }}>
                                        {note.event_date || ''}
                                      </span>
                                    </div>
                                    <div style={{ 
                                      fontSize: '13px', 
                                      color: '#333',
                                      lineHeight: '1.4',
                                    }}>
                                      {note.description}
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
                                    <button
                                      onClick={() => handleEditNote(note)}
                                      style={{
                                        padding: '4px 8px',
                                        background: '#e3f2fd',
                                        color: '#1976d2',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      onClick={() => handleDeleteNote(note.id)}
                                      style={{
                                        padding: '4px 8px',
                                        background: '#ffebee',
                                        color: '#d32f2f',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* 金流資訊 - 點擊可記帳 */}
                    <div style={{ marginBottom: '24px' }}>
                      <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#333', fontWeight: '600' }}>💰 金流</h3>
                      <div 
                        onClick={() => setTransactionDialogOpen(true)}
                        style={{ 
                          background: '#f8f9fa',
                          borderRadius: '8px',
                          padding: '12px 16px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          border: '2px solid transparent',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#e8f4e8'
                          e.currentTarget.style.borderColor = '#4caf50'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#f8f9fa'
                          e.currentTarget.style.borderColor = 'transparent'
                        }}
                      >
                        <div style={{ 
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '10px',
                          paddingBottom: '8px',
                          borderBottom: '1px solid #e0e0e0',
                        }}>
                          <span style={{ fontSize: '12px', color: '#4caf50', fontWeight: '500' }}>
                            點擊記帳 →
                          </span>
                        </div>
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(2, 1fr)',
                          gap: '10px',
                          fontSize: '13px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#666' }}>儲值</span>
                            <span style={{ fontWeight: '500' }}>${(member.balance ?? 0).toFixed(0)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#666' }}>VIP票券</span>
                            <span style={{ fontWeight: '500' }}>${(member.vip_voucher_amount ?? 0).toFixed(0)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#666' }}>G23船券</span>
                            <span style={{ fontWeight: '500' }}>{member.boat_voucher_g23_minutes ?? 0}分</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#666' }}>G21/黑豹</span>
                            <span style={{ fontWeight: '500' }}>{member.boat_voucher_g21_panther_minutes ?? 0}分</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#666' }}>贈送大船</span>
                            <span style={{ fontWeight: '500' }}>{member.gift_boat_hours ?? 0}分</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#666' }}>指定課</span>
                            <span style={{ fontWeight: '500' }}>{member.designated_lesson_minutes ?? 0}分</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {isMobile && (
                      <div style={{ height: '40px' }} />
                    )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 編輯會員對話框 */}
      {member && (
        <EditMemberDialog
          open={editDialogOpen}
          member={member}
          onClose={() => setEditDialogOpen(false)}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* 記帳對話框 */}
      {member && (
        <TransactionDialog
          open={transactionDialogOpen}
          member={member}
          onClose={() => setTransactionDialogOpen(false)}
          onSuccess={handleTransactionSuccess}
        />
      )}

      {/* 新增置板對話框 */}
      {addBoardDialogOpen && (
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
          zIndex: 2000,
          padding: '20px',
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
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
                新增置板
              </h2>
              <button
                onClick={() => {
                  setAddBoardDialogOpen(false)
                  setBoardFormData({ slot_number: '', start_date: '', expires_at: '', notes: '' })
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

            {/* 表單 */}
            <div style={{ padding: '20px' }}>
              {/* 格位編號 */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  格位編號 <span style={{ color: 'red' }}>*</span>
                  <span style={{ fontSize: '12px', color: '#999', marginLeft: '8px' }}>（1-145）</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={boardFormData.slot_number}
                  onChange={(e) => {
                    const numValue = e.target.value.replace(/\D/g, '') // 只允許數字
                    const num = Number(numValue)
                    if (num >= 1 && num <= 145) {
                      setBoardFormData({ ...boardFormData, slot_number: numValue })
                    } else if (numValue === '') {
                      setBoardFormData({ ...boardFormData, slot_number: '' })
                    }
                  }}
                  placeholder="請輸入格位編號"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '14px',
                  }}
                />
              </div>

              {/* 置板開始 */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#666' }}>
                  置板開始 <span style={{ fontSize: '13px' }}>（選填）</span>
                </label>
                <div style={{ display: 'flex' }}>
                  <input
                    type="date"
                    value={boardFormData.start_date}
                    onChange={(e) => setBoardFormData({ ...boardFormData, start_date: e.target.value })}
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

              {/* 置板到期 */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#666' }}>
                  置板到期 <span style={{ fontSize: '13px' }}>（選填）</span>
                </label>
                <div style={{ display: 'flex' }}>
                  <input
                    type="date"
                    value={boardFormData.expires_at}
                    onChange={(e) => setBoardFormData({ ...boardFormData, expires_at: e.target.value })}
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

              {/* 置板備註 */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#666' }}>
                  置板備註 <span style={{ fontSize: '13px' }}>（選填）</span>
                </label>
                <input
                  type="text"
                  value={boardFormData.notes}
                  onChange={(e) => setBoardFormData({ ...boardFormData, notes: e.target.value })}
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
            </div>

            {/* 按鈕 */}
            <div style={{
              padding: '20px',
              borderTop: '1px solid #e0e0e0',
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end',
            }}>
              <button
                onClick={() => {
                  setAddBoardDialogOpen(false)
                  setBoardFormData({ slot_number: '', start_date: '', expires_at: '', notes: '' })
                }}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  background: 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                取消
              </button>
              <button
                onClick={handleAddBoard}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '6px',
                  background: 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                }}
              >
                確認新增
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 新增/編輯備忘錄對話框 */}
      {noteDialogOpen && (
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
          zIndex: 2000,
          padding: '20px',
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
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
                {editingNote ? '✏️ 編輯備忘錄' : '➕ 新增備忘錄'}
              </h2>
              <button
                onClick={() => {
                  setNoteDialogOpen(false)
                  setEditingNote(null)
                  setNoteFormData({ event_date: '', event_type: '備註', description: '' })
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

            {/* 表單 */}
            <div style={{ padding: '20px' }}>
              {/* 事件日期 */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  事件日期 <span style={{ color: 'red' }}>*</span>
                </label>
                <div style={{ display: 'flex' }}>
                  <input
                    type="date"
                    value={noteFormData.event_date}
                    onChange={(e) => setNoteFormData({ ...noteFormData, event_date: e.target.value })}
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

              {/* 事件類型 */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  事件類型
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {EVENT_TYPES.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setNoteFormData({ ...noteFormData, event_type: type.value })}
                      style={{
                        padding: '8px 14px',
                        border: noteFormData.event_type === type.value 
                          ? `2px solid ${type.color}` 
                          : '2px solid #e0e0e0',
                        borderRadius: '20px',
                        background: noteFormData.event_type === type.value 
                          ? type.color 
                          : 'white',
                        color: noteFormData.event_type === type.value 
                          ? 'white' 
                          : '#666',
                        fontSize: '13px',
                        fontWeight: noteFormData.event_type === type.value ? '600' : 'normal',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 說明 */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  說明 <span style={{ color: 'red' }}>*</span>
                </label>
                <textarea
                  value={noteFormData.description}
                  onChange={(e) => setNoteFormData({ ...noteFormData, description: e.target.value })}
                  placeholder="請輸入備忘錄內容..."
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '16px', // 16px 防止 iOS 縮放
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            </div>

            {/* 按鈕 */}
            <div style={{
              padding: '20px',
              borderTop: '1px solid #e0e0e0',
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end',
            }}>
              <button
                onClick={() => {
                  setNoteDialogOpen(false)
                  setEditingNote(null)
                  setNoteFormData({ event_date: '', event_type: '備註', description: '' })
                }}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  background: 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                取消
              </button>
              <button
                onClick={handleSaveNote}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '6px',
                  background: '#5a5a5a',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                }}
              >
                {editingNote ? '儲存' : '新增'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 續約/入會對話框 */}
      {renewDialogOpen && (
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
          zIndex: 1100,
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            maxWidth: '400px',
            width: '90%',
            padding: '24px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px' }}>
              {member?.membership_type === 'guest' ? '🎫 轉為會員' : '🔄 會籍續約'}
            </h3>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#666' }}>
                {member?.membership_type === 'guest' ? '會籍到期日' : '新的到期日'}
              </label>
              <div style={{ display: 'flex' }}>
                <input
                  type="date"
                  value={renewEndDate}
                  onChange={(e) => setRenewEndDate(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '12px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              {member?.membership_type === 'guest' ? (
                <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                  會籍開始日將設為今天
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                  目前到期：{member?.membership_end_date ? formatDate(member.membership_end_date) : '未設定'}
                </div>
              )}
            </div>

            {/* 雙人會員選項 */}
            {member?.membership_type === 'dual' && member?.partner && (
              <div style={{ 
                marginBottom: '20px',
                padding: '12px',
                background: renewBothPartners ? '#e3f2fd' : '#fff3e0',
                borderRadius: '8px',
                border: renewBothPartners ? '1px solid #90caf9' : '1px solid #ffcc80',
              }}>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}>
                  <input
                    type="checkbox"
                    checked={renewBothPartners}
                    onChange={(e) => setRenewBothPartners(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span>
                    🔗 同時續約配對會員 <strong>{member.partner.nickname || member.partner.name}</strong>
                  </span>
                </label>
                <div style={{ fontSize: '12px', color: '#666', marginTop: '8px', marginLeft: '28px' }}>
                  配對會員目前到期：{(member.partner as any).membership_end_date ? formatDate((member.partner as any).membership_end_date) : '未設定'}
                </div>
                {!renewBothPartners && (
                  <div style={{ fontSize: '12px', color: '#e65100', marginTop: '8px', marginLeft: '28px' }}>
                    ⚠️ 不勾選會解除配對，雙方都變為一般會員
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setRenewDialogOpen(false)
                  setRenewEndDate('')
                }}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  background: 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                取消
              </button>
              <button
                onClick={handleRenew}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '6px',
                  background: 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                }}
              >
                {member?.membership_type === 'guest' ? '確認轉為會員' : '確認續約'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 置板續約對話框 */}
      {boardRenewDialogOpen && renewingBoard && (
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
          zIndex: 1100,
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            maxWidth: '400px',
            width: '90%',
            padding: '24px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px' }}>🏄 置板續約 #{renewingBoard.slot_number}</h3>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#666' }}>
                新的到期日
              </label>
              <div style={{ display: 'flex' }}>
                <input
                  type="date"
                  value={boardRenewEndDate}
                  onChange={(e) => setBoardRenewEndDate(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '12px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                目前到期：{renewingBoard.expires_at ? formatDate(renewingBoard.expires_at) : '未設定'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setBoardRenewDialogOpen(false)
                  setBoardRenewEndDate('')
                  setRenewingBoard(null)
                }}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  background: 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                取消
              </button>
              <button
                onClick={handleBoardRenew}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '6px',
                  background: 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                }}
              >
                確認續約
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 置板編輯對話框 */}
      {boardEditDialogOpen && editingBoard && (
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
          zIndex: 1100,
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            maxWidth: '400px',
            width: '90%',
            padding: '24px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px' }}>
              ✏️ 編輯置板 #{editingBoard.slot_number}
            </h3>
            
            {/* 開始日期 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#666' }}>
                開始日期
              </label>
              <div style={{ display: 'flex' }}>
                <input
                  type="date"
                  value={boardEditForm.start_date}
                  onChange={(e) => setBoardEditForm({ ...boardEditForm, start_date: e.target.value })}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '12px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* 到期日期 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#666' }}>
                到期日期
              </label>
              <div style={{ display: 'flex' }}>
                <input
                  type="date"
                  value={boardEditForm.expires_at}
                  onChange={(e) => setBoardEditForm({ ...boardEditForm, expires_at: e.target.value })}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '12px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ fontSize: '12px', color: '#999', marginTop: '6px' }}>
                目前：{editingBoard.expires_at || '未設定'}
              </div>
            </div>

            {/* 日期有變更時才顯示記錄選項 */}
            {(boardEditForm.start_date !== (editingBoard.start_date || '') ||
              boardEditForm.expires_at !== (editingBoard.expires_at || '')) && (
              <MemoRecordCheckbox
                checked={boardEditForm.addToMemo}
                onChange={(checked) => setBoardEditForm({ ...boardEditForm, addToMemo: checked })}
                inputValue={boardEditForm.memoText}
                onInputChange={(text) => setBoardEditForm({ ...boardEditForm, memoText: text })}
                inputPlaceholder="可輸入說明（選填），例如：出國暫停"
                hint="如僅修正錯誤可不勾選"
              />
            )}

            {/* 備註 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#666' }}>
                備註
              </label>
              <input
                type="text"
                value={boardEditForm.notes}
                onChange={(e) => setBoardEditForm({ ...boardEditForm, notes: e.target.value })}
                placeholder="例如：有三格"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '14px',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                onClick={() => {
                  if (confirm(`確定要移除置板 #${editingBoard.slot_number} 嗎？`)) {
                    handleDeleteBoard(editingBoard.id, editingBoard.slot_number)
                    setBoardEditDialogOpen(false)
                    setEditingBoard(null)
                  }
                }}
                style={{
                  padding: '10px 16px',
                  border: '1px solid #f44336',
                  borderRadius: '6px',
                  background: 'white',
                  color: '#f44336',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                🗑️ 移除置板
              </button>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => {
                    setBoardEditDialogOpen(false)
                    setEditingBoard(null)
                  }}
                  style={{
                    padding: '10px 20px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    background: 'white',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  取消
                </button>
                <button
                  onClick={handleBoardEdit}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '6px',
                    background: 'linear-gradient(135deg, #5a5a5a 0%, #4a4a4a 100%)',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                  }}
                >
                  儲存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 快速編輯手機號碼彈出框 */}
      {quickEditPhoneOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '360px',
              width: '100%',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            }}
          >
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px' }}>📱 修改手機號碼</h3>
            
            <div style={{ marginBottom: '20px' }}>
              <input
                type="tel"
                value={quickEditPhone}
                onChange={(e) => setQuickEditPhone(e.target.value)}
                placeholder="請輸入手機號碼"
                autoFocus
                style={{
                  width: '100%',
                  padding: '14px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '16px',
                }}
                onFocus={(e) => e.target.style.borderColor = '#5a5a5a'}
                onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleQuickSavePhone()
                  } else if (e.key === 'Escape') {
                    setQuickEditPhoneOpen(false)
                  }
                }}
              />
              <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                格式：09 開頭的 10 位數字
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setQuickEditPhoneOpen(false)}
                disabled={savingPhone}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  background: 'white',
                  cursor: savingPhone ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                }}
              >
                取消
              </button>
              <button
                onClick={handleQuickSavePhone}
                disabled={savingPhone}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: 'none',
                  borderRadius: '8px',
                  background: savingPhone ? '#ccc' : 'linear-gradient(135deg, #5a5a5a 0%, #4a4a4a 100%)',
                  color: 'white',
                  cursor: savingPhone ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                }}
              >
                {savingPhone ? '儲存中...' : '確認'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// 輔助函數
function getMembershipTypeLabel(type: string): string {
  switch (type) {
    case 'general': return '會員'
    case 'dual': return '雙人會員'
    case 'guest': return '非會員'
    case 'es': return 'ES'
    default: return type || '會員'
  }
}

function isExpired(dateString: string): boolean {
  const expiryDate = new Date(dateString)
  const today = new Date()
  return expiryDate < today
}

// 統一日期格式為 YYYY-MM-DD
function formatDate(dateStr: string | null): string {
  return normalizeDate(dateStr) || ''
}

