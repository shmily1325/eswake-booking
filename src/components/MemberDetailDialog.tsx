import { useState, useEffect, type CSSProperties } from 'react'
import { supabase } from '../lib/supabase'
import { useResponsive } from '../hooks/useResponsive'
import { EditMemberDialog } from './EditMemberDialog'
import { TransactionDialog } from './TransactionDialog'
import { useToast } from './ui'
import { normalizeDate } from '../utils/date'
import { MemoRecordCheckbox } from './MemoRecordCheckbox'
import {
  designSystem,
  getBadgeStyle,
  getBookingChoiceStyle,
  getButtonStyle,
  getInputStyle,
  getLabelStyle,
  getTextStyle,
} from '../styles/designSystem'

const typeSize = (
  variant: keyof typeof designSystem.fontSize,
  isMobile: boolean,
) => designSystem.fontSize[variant][isMobile ? 'mobile' : 'desktop']

/** 詳情區塊標題 */
const getSectionHeadingStyle = (isMobile: boolean): CSSProperties => ({
  margin: '0 0 12px 0',
  ...getTextStyle('h3', isMobile),
  fontWeight: 700,
  letterSpacing: '-0.01em',
})

const sectionWrapperStyle: CSSProperties = {
  marginBottom: '28px',
}

const sectionToolbarStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '12px',
}

const getSectionHeadingInToolbarStyle = (isMobile: boolean): CSSProperties => ({
  ...getSectionHeadingStyle(isMobile),
  margin: 0,
})

/** 詳情內容面板：白底細框，取代灰底巢狀卡片 */
const sectionPanelStyle: CSSProperties = {
  background: designSystem.colors.background.card,
  borderRadius: designSystem.borderRadius.lg,
  padding: '12px 16px',
  border: `1px solid ${designSystem.colors.border.light}`,
  boxShadow: designSystem.shadows.elevation[1],
}

const getSectionEmptyStateStyle = (isMobile: boolean): CSSProperties => ({
  ...sectionPanelStyle,
  padding: '20px 16px',
  textAlign: 'center',
  color: designSystem.colors.text.secondary,
  fontSize: typeSize('bodySmall', isMobile),
})

/** 巢狀／主對話框共用 chrome */
const dialogOverlayStyle = (zIndex: number): CSSProperties => ({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex,
  padding: '20px',
})

const dialogPanelStyle = (maxWidth: string): CSSProperties => ({
  background: designSystem.colors.background.card,
  borderRadius: designSystem.borderRadius.lg,
  maxWidth,
  width: '100%',
  boxShadow: designSystem.shadows.lg,
  border: `1px solid ${designSystem.colors.border.light}`,
  overflow: 'hidden',
})

const dialogHeaderBarStyle: CSSProperties = {
  padding: '20px',
  borderBottom: `1px solid ${designSystem.colors.border.light}`,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  background: designSystem.colors.background.card,
}

const getDialogTitleStyle = (isMobile: boolean): CSSProperties => ({
  margin: 0,
  ...getTextStyle('h3', isMobile),
  fontWeight: 700,
  letterSpacing: '-0.02em',
})

const dialogCloseButtonStyle: CSSProperties = {
  border: 'none',
  background: 'none',
  fontSize: typeSize('h1', false),
  cursor: 'pointer',
  color: designSystem.colors.text.secondary,
  padding: '0 8px',
  lineHeight: 1,
}

const dialogBodyStyle: CSSProperties = {
  padding: '20px',
}

const dialogFooterStyle: CSSProperties = {
  padding: '16px 20px',
  borderTop: `1px solid ${designSystem.colors.border.light}`,
  display: 'flex',
  gap: '12px',
  justifyContent: 'flex-end',
  background: designSystem.colors.background.card,
}

const getFieldHintStyle = (isMobile: boolean): CSSProperties => ({
  fontSize: typeSize('caption', isMobile),
  color: designSystem.colors.text.disabled,
  marginTop: '8px',
})

const getQuietHintStyle = (isMobile: boolean): CSSProperties => ({
  fontSize: typeSize('bodySmall', isMobile),
  color: designSystem.colors.text.disabled,
  fontWeight: 400,
})

const requiredMarkStyle: CSSProperties = {
  color: designSystem.colors.danger[500],
}

/** 入會／續會贈送提醒（需人工判斷後至會員儲值記帳，不會自動加） */
const MEMBERSHIP_GIFT_CREDIT_HINT =
  '贈送提醒：30分鐘指定課程、40分鐘大船時數\n請至「會員儲值」記帳'

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

// 事件類型選項（value 不變；色階僅供顯示）
const EVENT_TYPES = [
  { value: '續約', label: '續約', color: designSystem.colors.success[500] },
  { value: '購買', label: '購買', color: designSystem.colors.info[500] },
  { value: '贈送', label: '贈送', color: '#7a6b8a' },
  { value: '使用', label: '使用', color: designSystem.colors.warning[500] },
  { value: '入會', label: '入會', color: '#8a5a6a' },
  { value: '備註', label: '備註', color: designSystem.colors.text.secondary },
]

interface MemberDetailDialogProps {
  open: boolean
  memberId: string | null
  onClose: () => void
  onUpdate: () => void
  onSwitchMember?: (memberId: string) => void  // 切換到另一個會員
  onArchiveMember?: (memberId: string) => Promise<void>
  onRestoreMember?: (memberId: string) => Promise<void>
}

export function MemberDetailDialog({
  open,
  memberId,
  onClose,
  onUpdate,
  onSwitchMember,
  onArchiveMember,
  onRestoreMember,
}: MemberDetailDialogProps) {
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
      // 載入會員、置板、LINE 綁定、備忘錄
      // 四個查詢都只依賴 memberId，並行送出可節省一輪 RTT（備忘錄不再延後到 partner 之後）
      const [memberResult, boardResult, lineBindingResult, notesResult] = await Promise.all([
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
          .eq('status', 'active'),
        // @ts-ignore - member_notes 表需要執行資料庫遷移後才會有類型
        supabase
          .from('member_notes')
          .select('*')
          .eq('member_id', memberId)
          .order('event_date', { ascending: true, nullsFirst: true })
          .order('created_at', { ascending: false })
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

      // 處理備忘錄結果（已於上方 Promise.all 並行查詢）
      if (notesResult.error) {
        console.error('載入備忘錄失敗:', notesResult.error)
      } else {
        setMemberNotes(notesResult.data || [])
      }
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
      toast.warning(MEMBERSHIP_GIFT_CREDIT_HINT, 8000)
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
        ...dialogOverlayStyle(1000),
        alignItems: isMobile ? 'flex-end' : 'center',
        padding: isMobile ? '0' : '20px',
      }}>
        <div style={{
          ...dialogPanelStyle(isMobile ? '100%' : '800px'),
          borderRadius: isMobile
            ? `${designSystem.borderRadius.lg} ${designSystem.borderRadius.lg} 0 0`
            : designSystem.borderRadius.lg,
          maxHeight: isMobile ? '95vh' : '90vh',
          overflow: 'auto',
          margin: isMobile ? 'auto 0 0 0' : 'auto',
          WebkitOverflowScrolling: 'touch',
        }}>
          {/* 標題欄 */}
          <div style={{
            ...dialogHeaderBarStyle,
            position: 'sticky',
            top: 0,
            zIndex: 1,
          }}>
            <h2 style={getDialogTitleStyle(isMobile)}>
              會員詳情
            </h2>
            <button
              onClick={onClose}
              style={dialogCloseButtonStyle}
              aria-label="關閉"
            >
              ×
            </button>
          </div>

          {loading ? (
            <div style={{
              padding: '50px',
              textAlign: 'center',
              color: designSystem.colors.text.secondary,
              fontSize: typeSize('body', isMobile),
            }}>載入中...</div>
          ) : !member ? (
            <div style={{
              padding: '50px',
              textAlign: 'center',
              color: designSystem.colors.text.secondary,
              fontSize: typeSize('body', isMobile),
            }}>找不到會員資料</div>
          ) : (
            <>
              {/* 內容區 */}
              <div style={{ padding: isMobile ? '16px' : '20px' }}>
                    {/* 基本資料 */}
                    <div style={sectionWrapperStyle}>
                      <div style={sectionToolbarStyle}>
                        <h3 style={getSectionHeadingInToolbarStyle(isMobile)}>基本資料</h3>
                        <button
                          onClick={() => setEditDialogOpen(true)}
                          style={getButtonStyle('outline', 'small', isMobile)}
                        >
                          編輯
                        </button>
                      </div>
                      <div style={{ ...sectionPanelStyle, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {/* 第一行：暱稱／姓名＋會籍類型 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{
                            ...getTextStyle('h3', isMobile),
                            fontWeight: 750,
                            letterSpacing: '-0.025em',
                          }}>
                            {member.nickname?.trim() ? member.nickname : member.name}
                          </span>
                          {member.nickname?.trim() && (
                            <span style={{ ...getTextStyle('bodySmall', isMobile), color: designSystem.colors.text.disabled }}>
                              ({member.name})
                            </span>
                          )}
                          <span style={getBadgeStyle(
                            member.membership_type === 'guest' ? 'warning' : 'info',
                            'small'
                          )}>
                            {getMembershipTypeLabel(member.membership_type || 'general')}
                          </span>
                        </div>
                        {/* 第二行：手機＋修改｜生日 */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: isMobile ? '10px' : '16px',
                          flexWrap: 'wrap',
                          fontSize: typeSize('body', isMobile),
                          color: designSystem.colors.text.primary,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: designSystem.colors.text.secondary }}>手機</span>
                            <span>{member.phone || <span style={{ color: designSystem.colors.text.disabled }}>未填寫</span>}</span>
                            <button
                              onClick={() => {
                                setQuickEditPhone(member.phone || '')
                                setQuickEditPhoneOpen(true)
                              }}
                              style={{
                                ...getButtonStyle('outline', 'small', isMobile),
                                padding: '2px 8px',
                                flexShrink: 0,
                              }}
                              title="修改手機號碼"
                            >
                              修改
                            </button>
                          </div>
                          {member.birthday && (
                            <div>
                              <span style={{ color: designSystem.colors.text.secondary }}>生日 </span>
                              {formatDate(member.birthday)}
                            </div>
                          )}
                        </div>
                        {/* 第三行：LINE＋移除綁定 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span
                            title={lineBound ? (lineUserId ? `已綁定 (${lineUserId})` : '已綁定') : '未綁定'}
                            style={getBadgeStyle(lineBound ? 'success' : 'default', 'small')}
                          >
                            {lineBound ? 'LINE 已綁定' : 'LINE 未綁定'}
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
                                ...getButtonStyle('outline', 'small', isMobile),
                                background: designSystem.colors.danger[50],
                                color: designSystem.colors.danger[700],
                                borderColor: `${designSystem.colors.danger[500]}66`,
                              }}
                              title="移除 LINE 綁定"
                            >
                              移除綁定
                            </button>
                          )}
                        </div>
                        {(onArchiveMember || onRestoreMember) && (
                          <div style={{
                            marginTop: '4px',
                            paddingTop: '10px',
                            borderTop: `1px solid ${designSystem.colors.border.light}`,
                            display: 'flex',
                            justifyContent: 'flex-end',
                          }}>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!memberId) return
                                if (member.status === 'inactive') {
                                  await onRestoreMember?.(memberId)
                                  await loadMemberData()
                                  onUpdate()
                                } else {
                                  const ok = window.confirm(`確定要隱藏「${member.nickname || member.name}」嗎？`)
                                  if (!ok) return
                                  await onArchiveMember?.(memberId)
                                  onClose()
                                }
                              }}
                              style={{
                                ...getButtonStyle('ghost', 'small', isMobile),
                                color: member.status === 'inactive'
                                  ? designSystem.colors.success[700]
                                  : designSystem.colors.text.secondary,
                                fontWeight: 500,
                                padding: '2px 4px',
                              }}
                            >
                              {member.status === 'inactive' ? '恢復此會員' : '隱藏此會員'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 會籍 - 會員 */}
                    {(member.membership_type === 'general' || member.membership_type === 'dual') && (
                      <div style={sectionWrapperStyle}>
                        <h3 style={getSectionHeadingStyle(isMobile)}>會籍</h3>
                        <div style={sectionPanelStyle}>
                          <div style={{ 
                            fontSize: typeSize('body', isMobile),
                            fontWeight: 600,
                            marginBottom: member.membership_type === 'dual' && member.partner ? '8px' : '14px',
                            color: member.membership_end_date && isExpired(member.membership_end_date)
                              ? designSystem.colors.danger[700]
                              : designSystem.colors.text.primary
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
                                fontSize: typeSize('bodySmall', isMobile), 
                                color: onSwitchMember ? designSystem.colors.info[700] : designSystem.colors.text.secondary, 
                                marginBottom: '14px',
                                cursor: onSwitchMember ? 'pointer' : 'default',
                                textDecoration: onSwitchMember ? 'underline' : 'none',
                                textDecorationStyle: 'dotted',
                                textUnderlineOffset: '2px'
                              }}
                              title={onSwitchMember ? `點擊查看 ${member.partner.nickname || member.partner.name} 的資料` : undefined}
                            >
                              配對：{member.partner.nickname || member.partner.name}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
                              style={getButtonStyle('primary', 'small', isMobile)}
                            >
                              續約
                            </button>
                            <button
                              onClick={handleConvertToGuest}
                              style={getButtonStyle('outline', 'small', isMobile)}
                            >
                              轉非會員
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 會籍 - 非會員 */}
                    {member.membership_type === 'guest' && (
                      <div style={sectionWrapperStyle}>
                        <h3 style={getSectionHeadingStyle(isMobile)}>會籍</h3>
                        <div style={sectionPanelStyle}>
                          <div style={{ fontSize: typeSize('body', isMobile), color: designSystem.colors.text.secondary, marginBottom: '14px' }}>
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
                            style={getButtonStyle('primary', 'small', isMobile)}
                          >
                            轉為會員
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 置板 */}
                    <div style={sectionWrapperStyle}>
                      <div style={sectionToolbarStyle}>
                        <h3 style={getSectionHeadingInToolbarStyle(isMobile)}>置板</h3>
                        <button
                          onClick={() => setAddBoardDialogOpen(true)}
                          style={getButtonStyle('secondary', 'small', isMobile)}
                        >
                          + 新增
                        </button>
                      </div>
                      {boardStorage.length === 0 ? (
                        <div style={getSectionEmptyStateStyle(isMobile)}>
                          尚無置板
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {boardStorage.map((board) => (
                            <div 
                              key={board.id} 
                              onClick={() => openBoardEditDialog(board)}
                              style={{
                                ...sectionPanelStyle,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '12px',
                                fontSize: typeSize('bodySmall', isMobile),
                                cursor: 'pointer',
                                transition: designSystem.transitions.normal,
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = designSystem.colors.text.secondary
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = designSystem.colors.border.light
                              }}
                            >
                              <div style={{ minWidth: 0 }}>
                                <span style={{ fontWeight: '600' }}>#{board.slot_number}</span>
                                <span style={{ color: designSystem.colors.text.secondary, margin: '0 6px' }}>·</span>
                                {board.start_date && <span style={{ color: designSystem.colors.text.secondary }}>{formatDate(board.start_date)}</span>}
                                {board.expires_at && <span style={{ color: designSystem.colors.text.secondary }}> → {formatDate(board.expires_at)}</span>}
                                {board.expires_at && isExpired(board.expires_at) && 
                                  <span style={{ color: designSystem.colors.danger[700], marginLeft: '6px' }}>(已過期)</span>
                                }
                                {board.notes && (
                                  <span style={{ color: designSystem.colors.text.secondary, marginLeft: '8px', fontSize: typeSize('caption', isMobile) }}>
                                    {board.notes.length > 10 ? board.notes.substring(0, 10) + '...' : board.notes}
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()  // 防止觸發卡片的點擊
                                  openBoardRenewDialog(board.id, board.slot_number, board.expires_at)
                                }}
                                style={getButtonStyle('outline', 'small', isMobile)}
                              >
                                +1年
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 備忘錄 */}
                    <div style={sectionWrapperStyle}>
                      <div style={sectionToolbarStyle}>
                        <h3 style={getSectionHeadingInToolbarStyle(isMobile)}>
                          備忘錄 {memberNotes.length > 0 && <span style={{ color: designSystem.colors.text.secondary, fontWeight: 'normal' }}>({memberNotes.length})</span>}
                        </h3>
                        <button
                          onClick={handleAddNote}
                          style={getButtonStyle('secondary', 'small', isMobile)}
                        >
                          + 新增
                        </button>
                      </div>
                      
                      {memberNotes.length === 0 ? (
                        <div style={getSectionEmptyStateStyle(isMobile)}>
                          尚無備忘錄
                        </div>
                      ) : (
                        <div style={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: '8px',
                          maxHeight: '500px',
                          overflowY: 'auto'
                        }}>
                          {memberNotes.map((note) => {
                            const eventType = EVENT_TYPES.find(t => t.value === note.event_type) || EVENT_TYPES[5]
                            return (
                              <div
                                key={note.id}
                                style={{
                                  background: designSystem.colors.background.main,
                                  borderRadius: `0 ${designSystem.borderRadius.md} ${designSystem.borderRadius.md} 0`,
                                  padding: '10px 12px',
                                  borderLeft: `3px solid ${eventType.color}`,
                                  borderTop: 'none',
                                  borderRight: 'none',
                                  borderBottom: 'none',
                                }}
                              >
                                <div style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'flex-start',
                                  gap: '8px',
                                }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      gap: '8px',
                                      marginBottom: '4px',
                                      flexWrap: 'wrap',
                                    }}>
                                      <span style={{
                                        fontSize: typeSize('caption', isMobile),
                                        fontWeight: 650,
                                        color: eventType.color,
                                      }}>
                                        {eventType.label}
                                      </span>
                                      <span style={{ color: designSystem.colors.text.secondary, fontSize: typeSize('caption', isMobile) }}>
                                        {note.event_date || ''}
                                      </span>
                                    </div>
                                    <div style={{ 
                                      fontSize: typeSize('bodySmall', isMobile), 
                                      color: designSystem.colors.text.primary,
                                      lineHeight: '1.45',
                                    }}>
                                      {note.description}
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                    <button
                                      onClick={() => handleEditNote(note)}
                                      style={{
                                        ...getButtonStyle('outline', 'small', isMobile),
                                        padding: '4px 8px',
                                      }}
                                    >
                                      編輯
                                    </button>
                                    <button
                                      onClick={() => handleDeleteNote(note.id)}
                                      style={{
                                        ...getButtonStyle('outline', 'small', isMobile),
                                        padding: '4px 8px',
                                        color: designSystem.colors.danger[700],
                                        borderColor: `${designSystem.colors.danger[500]}66`,
                                        background: designSystem.colors.danger[50],
                                      }}
                                    >
                                      刪除
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
                    <div style={sectionWrapperStyle}>
                      <h3 style={getSectionHeadingStyle(isMobile)}>金流</h3>
                      <div 
                        onClick={() => setTransactionDialogOpen(true)}
                        style={{ 
                          ...sectionPanelStyle,
                          cursor: 'pointer',
                          transition: designSystem.transitions.normal,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = designSystem.colors.text.secondary
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = designSystem.colors.border.light
                        }}
                      >
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(2, 1fr)',
                          gap: '12px',
                          fontSize: typeSize('bodySmall', isMobile),
                          textAlign: 'center',
                        }}>
                          {[
                            { label: '儲值', value: `$${(member.balance ?? 0).toLocaleString()}` },
                            { label: 'VIP票券', value: `$${(member.vip_voucher_amount ?? 0).toLocaleString()}` },
                            { label: '指定課', value: `${member.designated_lesson_minutes ?? 0}分` },
                            { label: 'G23船券', value: `${member.boat_voucher_g23_minutes ?? 0}分` },
                            { label: '黑豹/G21', value: `${member.boat_voucher_g21_panther_minutes ?? 0}分` },
                            { label: '贈送大船', value: `${member.gift_boat_hours ?? 0}分` },
                          ].map((item) => (
                            <div key={item.label}>
                              <div style={{ fontSize: typeSize('caption', isMobile), color: designSystem.colors.text.secondary, marginBottom: '4px' }}>
                                {item.label}
                              </div>
                              <div style={{ fontSize: typeSize('bodyLarge', isMobile), fontWeight: 750, color: designSystem.colors.text.primary }}>
                                {item.value}
                              </div>
                            </div>
                          ))}
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
        <div style={dialogOverlayStyle(2000)}>
          <div style={dialogPanelStyle('500px')}>
            <div style={dialogHeaderBarStyle}>
              <h2 style={getDialogTitleStyle(isMobile)}>新增置板</h2>
              <button
                onClick={() => {
                  setAddBoardDialogOpen(false)
                  setBoardFormData({ slot_number: '', start_date: '', expires_at: '', notes: '' })
                }}
                style={dialogCloseButtonStyle}
                aria-label="關閉"
              >
                &times;
              </button>
            </div>

            <div style={dialogBodyStyle}>
              <div style={{ marginBottom: '16px' }}>
                <label style={getLabelStyle(isMobile)}>
                  格位編號 <span style={requiredMarkStyle}>*</span>
                  <span style={{ ...getQuietHintStyle(isMobile), marginLeft: '8px' }}>（1-145）</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={boardFormData.slot_number}
                  onChange={(e) => {
                    const numValue = e.target.value.replace(/\D/g, '')
                    const num = Number(numValue)
                    if (num >= 1 && num <= 145) {
                      setBoardFormData({ ...boardFormData, slot_number: numValue })
                    } else if (numValue === '') {
                      setBoardFormData({ ...boardFormData, slot_number: '' })
                    }
                  }}
                  placeholder="請輸入格位編號"
                  style={getInputStyle(isMobile)}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={getLabelStyle(isMobile)}>
                  置板開始 <span style={getQuietHintStyle(isMobile)}>（選填）</span>
                </label>
                <input
                  type="date"
                  value={boardFormData.start_date}
                  onChange={(e) => setBoardFormData({ ...boardFormData, start_date: e.target.value })}
                  style={getInputStyle(isMobile)}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={getLabelStyle(isMobile)}>
                  置板到期 <span style={getQuietHintStyle(isMobile)}>（選填）</span>
                </label>
                <input
                  type="date"
                  value={boardFormData.expires_at}
                  onChange={(e) => setBoardFormData({ ...boardFormData, expires_at: e.target.value })}
                  style={getInputStyle(isMobile)}
                />
              </div>

              <div style={{ marginBottom: '0' }}>
                <label style={getLabelStyle(isMobile)}>
                  置板備註 <span style={getQuietHintStyle(isMobile)}>（選填）</span>
                </label>
                <input
                  type="text"
                  value={boardFormData.notes}
                  onChange={(e) => setBoardFormData({ ...boardFormData, notes: e.target.value })}
                  placeholder="例如：有三格"
                  style={getInputStyle(isMobile)}
                />
              </div>
            </div>

            <div style={dialogFooterStyle}>
              <button
                onClick={() => {
                  setAddBoardDialogOpen(false)
                  setBoardFormData({ slot_number: '', start_date: '', expires_at: '', notes: '' })
                }}
                style={getButtonStyle('outline', 'medium', isMobile)}
              >
                取消
              </button>
              <button
                onClick={handleAddBoard}
                style={getButtonStyle('primary', 'medium', isMobile)}
              >
                確認新增
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 新增/編輯備忘錄對話框 */}
      {noteDialogOpen && (
        <div style={dialogOverlayStyle(2000)}>
          <div style={dialogPanelStyle('500px')}>
            <div style={dialogHeaderBarStyle}>
              <h2 style={getDialogTitleStyle(isMobile)}>
                {editingNote ? '編輯備忘錄' : '新增備忘錄'}
              </h2>
              <button
                onClick={() => {
                  setNoteDialogOpen(false)
                  setEditingNote(null)
                  setNoteFormData({ event_date: '', event_type: '備註', description: '' })
                }}
                style={dialogCloseButtonStyle}
                aria-label="關閉"
              >
                &times;
              </button>
            </div>

            <div style={dialogBodyStyle}>
              <div style={{ marginBottom: '16px' }}>
                <label style={getLabelStyle(isMobile)}>
                  事件日期 <span style={requiredMarkStyle}>*</span>
                </label>
                <input
                  type="date"
                  value={noteFormData.event_date}
                  onChange={(e) => setNoteFormData({ ...noteFormData, event_date: e.target.value })}
                  style={getInputStyle(isMobile)}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={getLabelStyle(isMobile)}>事件類型</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {EVENT_TYPES.map((type) => {
                    const selected = noteFormData.event_type === type.value
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setNoteFormData({ ...noteFormData, event_type: type.value })}
                        style={{
                          ...getBookingChoiceStyle(selected),
                          padding: '8px 14px',
                          fontSize: typeSize('button', isMobile),
                          fontWeight: selected ? 600 : 500,
                          cursor: 'pointer',
                          transition: designSystem.transitions.normal,
                        }}
                      >
                        {type.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div style={{ marginBottom: '0' }}>
                <label style={getLabelStyle(isMobile)}>
                  說明 <span style={requiredMarkStyle}>*</span>
                </label>
                <textarea
                  value={noteFormData.description}
                  onChange={(e) => setNoteFormData({ ...noteFormData, description: e.target.value })}
                  placeholder="請輸入備忘錄內容..."
                  rows={4}
                  style={{
                    ...getInputStyle(isMobile),
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    minHeight: '96px',
                  }}
                />
              </div>
            </div>

            <div style={dialogFooterStyle}>
              <button
                onClick={() => {
                  setNoteDialogOpen(false)
                  setEditingNote(null)
                  setNoteFormData({ event_date: '', event_type: '備註', description: '' })
                }}
                style={getButtonStyle('outline', 'medium', isMobile)}
              >
                取消
              </button>
              <button
                onClick={handleSaveNote}
                style={getButtonStyle('primary', 'medium', isMobile)}
              >
                {editingNote ? '儲存' : '新增'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 續約/入會對話框 */}
      {renewDialogOpen && (
        <div style={dialogOverlayStyle(1100)}>
          <div style={{ ...dialogPanelStyle('400px'), width: '90%' }}>
            <div style={dialogHeaderBarStyle}>
              <h2 style={getDialogTitleStyle(isMobile)}>
                {member?.membership_type === 'guest' ? '轉為會員' : '會籍續約'}
              </h2>
              <button
                onClick={() => {
                  setRenewDialogOpen(false)
                  setRenewEndDate('')
                }}
                style={dialogCloseButtonStyle}
                aria-label="關閉"
              >
                ×
              </button>
            </div>

            <div style={dialogBodyStyle}>
              {/* 入會／續會贈送提醒：只提示政策，是否贈送／怎麼記仍由操作者判斷 */}
              <div
                role="note"
                style={{
                  marginBottom: '20px',
                  padding: '12px 14px',
                  background: designSystem.colors.background.main,
                  border: `1px solid ${designSystem.colors.border.light}`,
                  borderRadius: designSystem.borderRadius.lg,
                  color: designSystem.colors.text.secondary,
                  fontSize: typeSize('bodySmall', isMobile),
                  fontWeight: 500,
                  lineHeight: 1.5,
                }}
              >
                <div style={{ marginBottom: '6px', color: designSystem.colors.text.primary, fontWeight: 600 }}>
                  {member?.membership_type === 'guest' ? '入會贈送提醒' : '續會贈送提醒'}
                </div>
                <div>30分鐘指定課程 · 40分鐘大船時數</div>
                <div style={{ marginTop: '6px', fontSize: typeSize('caption', isMobile), color: designSystem.colors.text.disabled }}>
                  這裡只改會籍到期日，請至「會員儲值」記帳
                </div>
              </div>

              <div style={{ marginBottom: member?.membership_type === 'dual' && member?.partner ? '20px' : '0' }}>
                <label style={getLabelStyle(isMobile)}>
                  {member?.membership_type === 'guest' ? '會籍到期日' : '新的到期日'}
                </label>
                <input
                  type="date"
                  value={renewEndDate}
                  onChange={(e) => setRenewEndDate(e.target.value)}
                  style={getInputStyle(isMobile)}
                />
                {member?.membership_type === 'guest' ? (
                  <div style={getFieldHintStyle(isMobile)}>會籍開始日將設為今天</div>
                ) : (
                  <div style={getFieldHintStyle(isMobile)}>
                    目前到期：{member?.membership_end_date ? formatDate(member.membership_end_date) : '未設定'}
                  </div>
                )}
              </div>

              {/* 雙人會員選項 */}
              {member?.membership_type === 'dual' && member?.partner && (
                <div style={{
                  marginBottom: '0',
                  padding: '12px 14px',
                  background: renewBothPartners
                    ? designSystem.colors.info[50]
                    : designSystem.colors.background.main,
                  borderRadius: designSystem.borderRadius.lg,
                  border: renewBothPartners
                    ? `1.5px solid ${designSystem.colors.info[500]}`
                    : `1px solid ${designSystem.colors.border.light}`,
                }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    fontSize: typeSize('body', isMobile),
                    color: designSystem.colors.text.primary,
                  }}>
                    <input
                      type="checkbox"
                      checked={renewBothPartners}
                      onChange={(e) => setRenewBothPartners(e.target.checked)}
                      style={{
                        width: '18px',
                        height: '18px',
                        cursor: 'pointer',
                        accentColor: designSystem.colors.info[500],
                      }}
                    />
                    <span>
                      同時續約配對會員 <strong>{member.partner.nickname || member.partner.name}</strong>
                    </span>
                  </label>
                  <div style={{ ...getFieldHintStyle(isMobile), marginLeft: '28px' }}>
                    配對會員目前到期：{(member.partner as any).membership_end_date ? formatDate((member.partner as any).membership_end_date) : '未設定'}
                  </div>
                  {!renewBothPartners && (
                    <div style={{
                      fontSize: typeSize('caption', isMobile),
                      color: designSystem.colors.warning[700],
                      marginTop: '8px',
                      marginLeft: '28px',
                    }}>
                      不勾選會解除配對，雙方都變為一般會員
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={dialogFooterStyle}>
              <button
                onClick={() => {
                  setRenewDialogOpen(false)
                  setRenewEndDate('')
                }}
                style={getButtonStyle('outline', 'medium', isMobile)}
              >
                取消
              </button>
              <button
                onClick={handleRenew}
                style={getButtonStyle('primary', 'medium', isMobile)}
              >
                {member?.membership_type === 'guest' ? '確認轉為會員' : '確認續約'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 置板續約對話框 */}
      {boardRenewDialogOpen && renewingBoard && (
        <div style={dialogOverlayStyle(1100)}>
          <div style={{ ...dialogPanelStyle('400px'), width: '90%' }}>
            <div style={dialogHeaderBarStyle}>
              <h2 style={getDialogTitleStyle(isMobile)}>置板續約 #{renewingBoard.slot_number}</h2>
              <button
                onClick={() => {
                  setBoardRenewDialogOpen(false)
                  setBoardRenewEndDate('')
                  setRenewingBoard(null)
                }}
                style={dialogCloseButtonStyle}
                aria-label="關閉"
              >
                ×
              </button>
            </div>

            <div style={dialogBodyStyle}>
              <label style={getLabelStyle(isMobile)}>新的到期日</label>
              <input
                type="date"
                value={boardRenewEndDate}
                onChange={(e) => setBoardRenewEndDate(e.target.value)}
                style={getInputStyle(isMobile)}
              />
              <div style={getFieldHintStyle(isMobile)}>
                目前到期：{renewingBoard.expires_at ? formatDate(renewingBoard.expires_at) : '未設定'}
              </div>
            </div>

            <div style={dialogFooterStyle}>
              <button
                onClick={() => {
                  setBoardRenewDialogOpen(false)
                  setBoardRenewEndDate('')
                  setRenewingBoard(null)
                }}
                style={getButtonStyle('outline', 'medium', isMobile)}
              >
                取消
              </button>
              <button
                onClick={handleBoardRenew}
                style={getButtonStyle('primary', 'medium', isMobile)}
              >
                確認續約
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 置板編輯對話框 */}
      {boardEditDialogOpen && editingBoard && (
        <div style={dialogOverlayStyle(1100)}>
          <div style={{ ...dialogPanelStyle('400px'), width: '90%' }}>
            <div style={dialogHeaderBarStyle}>
              <h2 style={getDialogTitleStyle(isMobile)}>
                編輯置板 #{editingBoard.slot_number}
              </h2>
              <button
                onClick={() => {
                  setBoardEditDialogOpen(false)
                  setEditingBoard(null)
                }}
                style={dialogCloseButtonStyle}
                aria-label="關閉"
              >
                ×
              </button>
            </div>

            <div style={dialogBodyStyle}>
              <div style={{ marginBottom: '16px' }}>
                <label style={getLabelStyle(isMobile)}>開始日期</label>
                <input
                  type="date"
                  value={boardEditForm.start_date}
                  onChange={(e) => setBoardEditForm({ ...boardEditForm, start_date: e.target.value })}
                  style={getInputStyle(isMobile)}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={getLabelStyle(isMobile)}>到期日期</label>
                <input
                  type="date"
                  value={boardEditForm.expires_at}
                  onChange={(e) => setBoardEditForm({ ...boardEditForm, expires_at: e.target.value })}
                  style={getInputStyle(isMobile)}
                />
                <div style={getFieldHintStyle(isMobile)}>
                  目前：{editingBoard.expires_at || '未設定'}
                </div>
              </div>

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

              <div style={{ marginBottom: '0' }}>
                <label style={getLabelStyle(isMobile)}>備註</label>
                <input
                  type="text"
                  value={boardEditForm.notes}
                  onChange={(e) => setBoardEditForm({ ...boardEditForm, notes: e.target.value })}
                  placeholder="例如：有三格"
                  style={getInputStyle(isMobile)}
                />
              </div>
            </div>

            <div style={{ ...dialogFooterStyle, justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                onClick={() => {
                  if (confirm(`確定要移除置板 #${editingBoard.slot_number} 嗎？`)) {
                    handleDeleteBoard(editingBoard.id, editingBoard.slot_number)
                    setBoardEditDialogOpen(false)
                    setEditingBoard(null)
                  }
                }}
                style={{
                  ...getButtonStyle('outline', 'small', isMobile),
                  color: designSystem.colors.danger[700],
                  borderColor: `${designSystem.colors.danger[500]}66`,
                  background: designSystem.colors.danger[50],
                }}
              >
                移除置板
              </button>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => {
                    setBoardEditDialogOpen(false)
                    setEditingBoard(null)
                  }}
                  style={getButtonStyle('outline', 'medium', isMobile)}
                >
                  取消
                </button>
                <button
                  onClick={handleBoardEdit}
                  style={getButtonStyle('primary', 'medium', isMobile)}
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
        <div style={dialogOverlayStyle(2000)}>
          <div style={dialogPanelStyle('360px')}>
            <div style={dialogHeaderBarStyle}>
              <h2 style={getDialogTitleStyle(isMobile)}>修改手機號碼</h2>
              <button
                onClick={() => setQuickEditPhoneOpen(false)}
                disabled={savingPhone}
                style={{
                  ...dialogCloseButtonStyle,
                  opacity: savingPhone ? 0.5 : 1,
                  cursor: savingPhone ? 'not-allowed' : 'pointer',
                }}
                aria-label="關閉"
              >
                ×
              </button>
            </div>

            <div style={dialogBodyStyle}>
              <input
                type="tel"
                value={quickEditPhone}
                onChange={(e) => setQuickEditPhone(e.target.value)}
                placeholder="請輸入手機號碼"
                autoFocus
                style={getInputStyle(isMobile)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleQuickSavePhone()
                  } else if (e.key === 'Escape') {
                    setQuickEditPhoneOpen(false)
                  }
                }}
              />
              <div style={getFieldHintStyle(isMobile)}>格式：09 開頭的 10 位數字</div>
            </div>

            <div style={{ ...dialogFooterStyle, display: 'flex' }}>
              <button
                onClick={() => setQuickEditPhoneOpen(false)}
                disabled={savingPhone}
                style={{
                  ...getButtonStyle('outline', 'medium', isMobile),
                  flex: 1,
                  opacity: savingPhone ? 0.5 : 1,
                  cursor: savingPhone ? 'not-allowed' : 'pointer',
                }}
              >
                取消
              </button>
              <button
                onClick={handleQuickSavePhone}
                disabled={savingPhone}
                style={{
                  ...getButtonStyle('primary', 'medium', isMobile),
                  flex: 1,
                  opacity: savingPhone ? 0.6 : 1,
                  cursor: savingPhone ? 'not-allowed' : 'pointer',
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

