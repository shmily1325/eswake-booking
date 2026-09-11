import { useState, useEffect, useMemo, useRef } from 'react'
import { useAuthUser } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { AddMemberDialog } from '../../components/AddMemberDialog'
import { MemberDetailDialog } from '../../components/MemberDetailDialog'
import { Modal } from '../../components/ui/Modal'
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
import { setMemberActiveStatus } from '../../services/memberLifecycle'
import { membershipCountsAsActive } from '../../utils/membership'
import {
  generateMemberExpiryNotice,
  type MemberExpiryNoticeTemplates,
} from '../../utils/memberExpiryNotice'
import { useMemberExpiryNoticeTemplates } from '../../hooks/useMemberExpiryNoticeTemplates'
import { MemberStatusBadges } from '../../components/MemberStatusBadges'
import {
  designSystem,
  getBadgeStyle,
  getButtonStyle,
  getEmptyStateStyle,
  getFilterChipStyle,
  getFontSize,
  getInputStyle,
  getPageContentShellStyle,
  getSingleSelectFilterChipStyle,
} from '../../styles/designSystem'

const pageBg = designSystem.colors.background.main
const cardBorder = `1px solid ${designSystem.colors.border.light}`
const cardShadow = designSystem.shadows.elevation[1]
const cardShadowHover = designSystem.shadows.elevation[2]
type ExpiryTemplateType = 'membership' | 'board' | 'combined'
const EXPIRY_TEMPLATE_LABELS: Record<ExpiryTemplateType, string> = {
  membership: '只有會員',
  board: '只有置板',
  combined: '會員＋置板',
}
const EXPIRY_TEMPLATE_TOKENS = {
  year: '[年份]',
  recipient: '[會員名稱]',
  expiry_lines: '[到期資訊]',
  combined_price: '[合計金額]',
} as const

function toFriendlyExpiryTemplate(value: string): string {
  return Object.entries(EXPIRY_TEMPLATE_TOKENS).reduce(
    (template, [key, label]) => template.replaceAll(`{{${key}}}`, label),
    value,
  )
}

function toStoredExpiryTemplate(value: string): string {
  return Object.entries(EXPIRY_TEMPLATE_TOKENS).reduce(
    (template, [key, label]) => template.replaceAll(label, `{{${key}}}`),
    value,
  )
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
  line_binding_can_push?: boolean
  line_reminder_mapping_id?: string | null
  line_reminder_mapping_can_push?: boolean
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
  const [lineBindingFilter, setLineBindingFilter] = useState<'all' | 'bound' | 'rebind' | 'unbound'>('all')
  const [showExpiringDetails, setShowExpiringDetails] = useState(false) // 收合/展開到期詳情
  const [copiedExpiryMemberId, setCopiedExpiryMemberId] = useState<string | null>(null)
  const [editingExpiryMemberId, setEditingExpiryMemberId] = useState<string | null>(null)
  const [expiryNoticeDraft, setExpiryNoticeDraft] = useState('')
  const [sendingExpiryNotice, setSendingExpiryNotice] = useState(false)
  const [showExpiryTemplateEditor, setShowExpiryTemplateEditor] = useState(false)
  const [expiryTemplateType, setExpiryTemplateType] = useState<ExpiryTemplateType>('combined')
  const [expiryTemplateDrafts, setExpiryTemplateDrafts] = useState<MemberExpiryNoticeTemplates>({
    membership: '',
    board: '',
    combined: '',
  })
  const memberListRef = useRef<HTMLDivElement>(null)
  /** 列表備忘錄展開的會員 id（預設收合，只顯示最近幾則） */
  const [expandedMemoMemberIds, setExpandedMemoMemberIds] = useState<Set<string>>(() => new Set())
  const {
    templates: expiryNoticeTemplates,
    saveTemplates: saveExpiryNoticeTemplates,
    saveStatus: expiryTemplateSaveStatus,
  } = useMemberExpiryNoticeTemplates(user?.id)

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

  /** 會員管理僅限超級管理員（SUPER_ADMINS）；小編與其他帳號請用首頁「LINE 配對」等對應功能 */
  useEffect(() => {
    if (!user) return
    if (!userIsAdmin) {
      setLoading(false)
      toast.error('目前帳號無此功能權限')
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
        .select('id, name, nickname, membership_type, membership_end_date, status')
        .eq('status', 'active')
        .not('membership_end_date', 'is', null)
        .order('membership_end_date', { ascending: true }),

      // 獲取所有有到期日的置板
      supabase
        .from('board_storage')
        .select('member_id, slot_number, members:member_id(id, name, nickname, status), expires_at')
        .eq('status', 'active')
        .not('expires_at', 'is', null)
        .order('expires_at', { ascending: true })
    ])

    if (membershipResult.error || boardResult.error) {
      const error = membershipResult.error || boardResult.error
      console.error('載入到期資料失敗:', error)
      toast.error('會員資料已更新，但到期提醒刷新失敗，請重新整理頁面')
      return
    }

    if (membershipResult.data) {
      const filtered = membershipResult.data.filter((m: any) =>
        membershipCountsAsActive(m.membership_type) &&
        isEndDateInExpiryReminderWindow(m.membership_end_date, EXPIRING_SOON_DAYS)
      )

      setExpiringMemberships(filtered)
    }

    if (boardResult.data) {
      const filtered = boardResult.data.filter((b: any) =>
        b.members?.status === 'active' &&
        isEndDateInExpiryReminderWindow(b.expires_at, EXPIRING_SOON_DAYS)
      )

      const boardList = filtered.map((b: any) => {
        const member = b.members
        const displayName = member
          ? ((member.nickname && member.nickname.trim()) || member.name)
          : '未知'
        return {
          member_id: b.member_id,
          slot_number: b.slot_number,
          member_name: displayName,
          member_full_name: member?.name || displayName,
          member_nickname: member?.nickname || null,
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
          .select('member_id, line_user_id, last_liff_login_at, can_push')
          .eq('status', 'active')
      ])

      if (membersResult.error) throw membersResult.error
      if (boardResult.error) throw boardResult.error
      if (lineBindingsResult.error) throw lineBindingsResult.error

      const membersData = membersResult.data || []
      const boardData = boardResult.data || []
      const lineBindingsData = lineBindingsResult.data || []

      // 依已載入會員 ID 分批 + 分頁抓備忘錄（排序與原先整表查詢相同）
      const memberIds = membersData.map((m: { id: string }) => m.id)
      let reminderMappingsData: Array<{
        id: string
        member_id: string | null
        line_contact?: { friend_status?: string } | Array<{ friend_status?: string }> | null
      }> = []
      if (memberIds.length > 0) {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData.session?.access_token
        if (!token) throw new Error('登入已失效，請重新登入')
        const mappingBatches = await Promise.all(
          chunkArray(memberIds, 200).map(async (batch) => {
            const response = await fetch('/api/line-reminder-send', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                action: 'list_reminder_mappings',
                bookingIds: [],
                memberIds: batch,
              }),
            })
            const body = await response.json().catch(() => null) as {
              mappings?: typeof reminderMappingsData
              error?: string
            } | null
            if (!response.ok) throw new Error(body?.error || '載入 LINE 配對失敗')
            return body?.mappings ?? []
          }),
        )
        reminderMappingsData = mappingBatches.flat()
      }
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
      const memberIdToLineBinding: Record<string, {
        lineUserId: string
        lastLiffLoginAt: string | null
        canPush: boolean
      }> = {}
      lineBindingsData.forEach((b: any) => {
        if (b.member_id) {
          memberIdToLineBinding[b.member_id] = {
            lineUserId: b.line_user_id,
            lastLiffLoginAt: b.last_liff_login_at,
            canPush: b.can_push === true,
          }
        }
      })
      const memberIdToReminderMapping: Record<string, string> = {}
      reminderMappingsData.forEach((mapping) => {
        if (!mapping.member_id || memberIdToReminderMapping[mapping.member_id]) return
        const contact = Array.isArray(mapping.line_contact)
          ? mapping.line_contact[0]
          : mapping.line_contact
        if (contact?.friend_status === 'friend') {
          memberIdToReminderMapping[mapping.member_id] = mapping.id
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
        line_binding_can_push: memberIdToLineBinding[member.id]?.canPush === true,
        line_reminder_mapping_id: memberIdToReminderMapping[member.id] || null,
        line_reminder_mapping_can_push: Boolean(memberIdToReminderMapping[member.id]),
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
      await setMemberActiveStatus(memberId, false)

      toast.success('已隱藏會員')
      await Promise.all([loadMembers(true), loadExpiringData()])
    } catch (err: unknown) {
      console.error('隱藏會員失敗:', err)
      toast.error(err instanceof Error ? `隱藏會員失敗：${err.message}` : '隱藏會員失敗')
      throw err
    }
  }

  const handleRestoreMember = async (memberId: string) => {
    try {
      await setMemberActiveStatus(memberId, true)

      toast.success('已恢復會員')
      await Promise.all([loadMembers(true), loadExpiringData()])
    } catch (err: unknown) {
      console.error('恢復會員失敗:', err)
      toast.error(err instanceof Error ? `恢復會員失敗：${err.message}` : '恢復會員失敗')
      throw err
    }
  }

  // 使用 useMemo 快取過濾結果，避免不必要的重複計算
  const filteredMembers = useMemo(() => {
    let result = members

    // 篩選會員種類
    if (!isMobile && membershipTypeFilter !== 'all') {
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

    // 手機版以臨時搜尋為主，不套用桌面進階篩選
    if (!isMobile && expiringFilter === 'membership') {
      const expiringMemberIds = new Set(expiringMemberships.map((m: any) => m.id))
      result = result.filter(member => expiringMemberIds.has(member.id))
    } else if (!isMobile && expiringFilter === 'board') {
      const expiringBoardMemberIds = new Set(expiringBoards.map((b: any) => b.member_id))
      result = result.filter(member => expiringBoardMemberIds.has(member.id))
    }

    if (!isMobile && lineBindingFilter === 'bound') {
      result = result.filter(m =>
        (m.is_line_bound && m.line_binding_can_push) || m.line_reminder_mapping_can_push
      )
    } else if (!isMobile && lineBindingFilter === 'rebind') {
      result = result.filter(m =>
        m.is_line_bound && !m.line_binding_can_push && !m.line_reminder_mapping_can_push
      )
    } else if (!isMobile && lineBindingFilter === 'unbound') {
      result = result.filter(m => !m.is_line_bound && !m.line_reminder_mapping_can_push)
    }

    // 固定依最近更新排序；同時間或未更新時依暱稱穩定排列
    result = [...result].sort((a, b) => {
      const compareNickname = () => {
        const nameA = (a.nickname || a.name || '').toLowerCase()
        const nameB = (b.nickname || b.name || '').toLowerCase()
        return nameA.localeCompare(nameB, 'zh-TW')
      }
      if (!a.updated_at && !b.updated_at) return compareNickname()
      if (!a.updated_at) return 1
      if (!b.updated_at) return -1
      return b.updated_at.localeCompare(a.updated_at) || compareNickname()
    })

    return result
  }, [members, searchTerm, membershipTypeFilter, expiringFilter, lineBindingFilter, expiringMemberships, expiringBoards, isMobile])

  const expiryNoticeByMemberId = useMemo(() => {
    const notices = new Map<string, {
      name: string
      nickname: string | null
      membershipExpiresAt: string | null
      boards: Array<{ slotNumber: number; expiresAt: string }>
    }>()

    expiringMemberships.forEach((member: any) => {
      notices.set(member.id, {
        name: member.name,
        nickname: member.nickname,
        membershipExpiresAt: member.membership_end_date,
        boards: [],
      })
    })
    expiringBoards.forEach((board: any) => {
      const current = notices.get(board.member_id)
      const notice: {
        name: string
        nickname: string | null
        membershipExpiresAt: string | null
        boards: Array<{ slotNumber: number; expiresAt: string }>
      } = current ?? {
        name: board.member_full_name || board.member_name,
        nickname: board.member_nickname,
        membershipExpiresAt: null,
        boards: [],
      }
      notice.boards.push({
        slotNumber: board.slot_number,
        expiresAt: board.expires_at,
      })
      notices.set(board.member_id, notice)
    })
    return notices
  }, [expiringMemberships, expiringBoards])

  const handleOpenExpiryNotice = (memberId: string) => {
    const notice = expiryNoticeByMemberId.get(memberId)
    if (!notice) {
      toast.error('找不到這位會員的到期資料')
      return
    }
    setEditingExpiryMemberId(memberId)
    setExpiryNoticeDraft(generateMemberExpiryNotice(notice, expiryNoticeTemplates))
  }

  const handleOpenExpiryTemplateEditor = () => {
    setExpiryTemplateDrafts({
      membership: toFriendlyExpiryTemplate(expiryNoticeTemplates.membership),
      board: toFriendlyExpiryTemplate(expiryNoticeTemplates.board),
      combined: toFriendlyExpiryTemplate(expiryNoticeTemplates.combined),
    })
    setShowExpiryTemplateEditor(true)
  }

  const handleSaveExpiryTemplates = async () => {
    const invalidType = (Object.keys(expiryTemplateDrafts) as ExpiryTemplateType[]).find((type) => {
      const template = expiryTemplateDrafts[type]
      return !template.includes(EXPIRY_TEMPLATE_TOKENS.recipient) ||
        !template.includes(EXPIRY_TEMPLATE_TOKENS.expiry_lines)
    })
    if (invalidType) {
      setExpiryTemplateType(invalidType)
      toast.warning(`${EXPIRY_TEMPLATE_LABELS[invalidType]}範本需保留「[會員名稱]」和「[到期資訊]」`)
      return
    }

    const saved = await saveExpiryNoticeTemplates({
      membership: toStoredExpiryTemplate(expiryTemplateDrafts.membership),
      board: toStoredExpiryTemplate(expiryTemplateDrafts.board),
      combined: toStoredExpiryTemplate(expiryTemplateDrafts.combined),
    })
    if (!saved) {
      toast.error('通知範本儲存失敗')
      return
    }
    setShowExpiryTemplateEditor(false)
    toast.success('通知範本已儲存')
  }

  const handleCopyExpiryNotice = async () => {
    if (!editingExpiryMemberId || !expiryNoticeDraft.trim()) return
    try {
      await navigator.clipboard.writeText(expiryNoticeDraft)
      setCopiedExpiryMemberId(editingExpiryMemberId)
      toast.success('到期通知已複製')
      const copiedMemberId = editingExpiryMemberId
      setEditingExpiryMemberId(null)
      setExpiryNoticeDraft('')
      window.setTimeout(() => {
        setCopiedExpiryMemberId((current) => current === copiedMemberId ? null : current)
      }, 2000)
    } catch {
      toast.error('複製失敗，請確認瀏覽器已允許剪貼簿權限')
    }
  }

  const handleSendExpiryNotice = async () => {
    if (!editingExpiryMemberId || !expiryNoticeDraft.trim() || sendingExpiryNotice) return
    const member = members.find((item) => item.id === editingExpiryMemberId)
    const notice = expiryNoticeByMemberId.get(editingExpiryMemberId)
    const canReceiveLine = Boolean(
      member && (
        (member.is_line_bound && member.line_binding_can_push) ||
        member.line_reminder_mapping_can_push
      )
    )
    if (!member || !canReceiveLine || !notice) {
      toast.error('這位會員目前無法接收 LINE 訊息')
      return
    }
    if (!window.confirm(`確定直接傳送到期通知給「${member.nickname || member.name}」嗎？`)) return

    setSendingExpiryNotice(true)
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('登入已失效，請重新登入')
      const expiryKey = [
        notice.membershipExpiresAt || 'no-membership',
        ...notice.boards.map((board) => `${board.slotNumber}-${board.expiresAt}`),
      ].join(':')
      const response = await fetch('/api/line-reminder-send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: getVenueDateString(),
          recipients: [{
            recipientKey: `member-expiry:${member.id}:${expiryKey}`,
            memberId: member.id,
            ...(member.line_reminder_mapping_id
              ? { mappingId: member.line_reminder_mapping_id }
              : {}),
            contactName: member.name,
            bookingIds: [],
            message: expiryNoticeDraft,
          }],
        }),
      })
      const body = await response.json().catch(() => null) as {
        results?: Array<{ ok: boolean; alreadySent?: boolean; error?: string }>
        error?: string
      } | null
      const result = body?.results?.[0]
      if (!result) throw new Error(body?.error || 'LINE 傳送失敗')
      if (result.alreadySent) {
        toast.warning('今天已傳送過這份到期通知，本次未重複傳送')
        return
      }
      if (!result.ok) throw new Error(result.error || body?.error || 'LINE 傳送失敗')

      if (response.ok) {
        toast.success(`已傳送給 ${member.nickname || member.name}`)
      } else {
        toast.warning('訊息已傳送，但傳送紀錄儲存失敗；請勿重複傳送')
      }
      setEditingExpiryMemberId(null)
      setExpiryNoticeDraft('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'LINE 傳送失敗')
    } finally {
      setSendingExpiryNotice(false)
    }
  }

  const editingExpiryMember = editingExpiryMemberId
    ? members.find((member) => member.id === editingExpiryMemberId)
    : null
  const canSendEditingExpiryNotice = Boolean(
    editingExpiryMember && (
      (editingExpiryMember.is_line_bound && editingExpiryMember.line_binding_can_push) ||
      editingExpiryMember.line_reminder_mapping_can_push
    ),
  )

  const handleSearchExpiryMember = (memberId: string, fallbackName: string) => {
    const notice = expiryNoticeByMemberId.get(memberId)
    const searchName = notice?.nickname?.trim() || notice?.name || fallbackName
    setSearchTerm(searchName)
    setMembershipTypeFilter('all')
    setExpiringFilter('none')
    setLineBindingFilter('all')
    window.requestAnimationFrame(() => {
      memberListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const renderExpiryMemberSearch = (memberId: string, label: string) => (
    <button
      type="button"
      data-track="member_expiry_search"
      onClick={() => handleSearchExpiryMember(memberId, label)}
      title={`搜尋 ${label}`}
      style={{
        padding: isMobile ? '3px 2px' : '1px 2px',
        border: 'none',
        background: 'transparent',
        color: 'inherit',
        font: 'inherit',
        cursor: 'pointer',
        textDecoration: 'underline',
        textDecorationStyle: 'dotted',
        textUnderlineOffset: '3px',
      }}
    >
      {label}
    </button>
  )

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
            extraLinks={userIsAdmin ? [
              { label: '儲值', link: '/member-transaction' },
              { label: '🏄 置板', link: '/boards' },
            ] : undefined}
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
            userIsAdmin ? [
              { label: '儲值', link: '/member-transaction' },
              { label: '🏄 置板', link: '/boards' },
            ] : undefined
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
                data-track="member_search_clear"
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

        {/* 桌面版：類型一列、次要篩選／排序一列 */}
        {!isMobile && (
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
                { value: 'guest', label: '非會員', count: members.filter(m => m.membership_type === 'guest').length },
                { value: 'es', label: 'ES', count: members.filter(m => m.membership_type === 'es').length }
              ].map(type => (
                <button
                  key={type.value}
                  type="button"
                  data-track={`member_filter_type_${type.value}`}
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
                data-track="member_filter_expiring_membership"
                onClick={() => {
                  setExpiringFilter(expiringFilter === 'membership' ? 'none' : 'membership')
                  if (expiringFilter !== 'membership') setMembershipTypeFilter('all')
                }}
                disabled={expiringMemberships.length === 0}
                style={{
                  ...getButtonStyle('outline', 'small', false),
                  ...getSingleSelectFilterChipStyle(expiringFilter === 'membership', true),
                  opacity: expiringMemberships.length === 0 ? 0.5 : 1,
                  cursor: expiringMemberships.length > 0 ? 'pointer' : 'default',
                }}
              >
                會籍到期 ({expiringMemberships.length})
              </button>

              <button
                type="button"
                data-track="member_filter_expiring_board"
                onClick={() => {
                  setExpiringFilter(expiringFilter === 'board' ? 'none' : 'board')
                  if (expiringFilter !== 'board') setMembershipTypeFilter('all')
                }}
                disabled={expiringBoards.length === 0}
                style={{
                  ...getButtonStyle('outline', 'small', false),
                  ...getSingleSelectFilterChipStyle(expiringFilter === 'board', true),
                  opacity: expiringBoards.length === 0 ? 0.5 : 1,
                  cursor: expiringBoards.length > 0 ? 'pointer' : 'default',
                }}
              >
                置板到期 ({expiringBoards.length})
              </button>

              <div style={{ width: '1px', height: '22px', background: designSystem.colors.border.light, margin: '0 2px' }} />

              <button
                type="button"
                data-track="member_filter_line_bound"
                onClick={() => setLineBindingFilter(lineBindingFilter === 'bound' ? 'all' : 'bound')}
                style={{
                  ...getButtonStyle('outline', 'small', false),
                  ...getSingleSelectFilterChipStyle(lineBindingFilter === 'bound'),
                }}
              >
                LINE 可傳送 ({members.filter(m =>
                  (m.is_line_bound && m.line_binding_can_push) || m.line_reminder_mapping_can_push
                ).length})
              </button>

              <button
                type="button"
                data-track="member_filter_line_rebind"
                onClick={() => setLineBindingFilter(lineBindingFilter === 'rebind' ? 'all' : 'rebind')}
                style={{
                  ...getButtonStyle('outline', 'small', false),
                  ...getSingleSelectFilterChipStyle(lineBindingFilter === 'rebind', true),
                }}
              >
                需重新綁定 ({members.filter(m =>
                  m.is_line_bound && !m.line_binding_can_push && !m.line_reminder_mapping_can_push
                ).length})
              </button>

              <button
                type="button"
                data-track="member_filter_line_unbound"
                onClick={() => setLineBindingFilter(lineBindingFilter === 'unbound' ? 'all' : 'unbound')}
                style={{
                  ...getButtonStyle('outline', 'small', false),
                  ...getSingleSelectFilterChipStyle(lineBindingFilter === 'unbound'),
                }}
              >
                LINE 未綁定 ({members.filter(m =>
                  !m.is_line_bound && !m.line_reminder_mapping_can_push
                ).length})
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
                  data-track="member_filter_show_inactive"
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
          <div style={{ display: 'flex', alignItems: 'center', minHeight: '48px' }}>
            <button
              type="button"
              data-track={`member_expiring_${showExpiringDetails ? 'collapse' : 'expand'}`}
              onClick={() => setShowExpiringDetails(!showExpiringDetails)}
              style={{
                alignSelf: 'stretch',
                flex: 1,
                padding: '12px 16px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: getFontSize('button', isMobile),
                color: designSystem.colors.text.secondary,
              }}
            >
              到期詳情：會籍 {expiringMemberships.length} 位、置板 {expiringBoards.length} 位
            </button>
            {!isMobile && showExpiringDetails && (
              <button
                type="button"
                data-track="member_expiry_template_open"
                onClick={handleOpenExpiryTemplateEditor}
                style={{
                  ...getButtonStyle('secondary', 'small', false),
                  minHeight: '32px',
                }}
              >
                通知範本設定
              </button>
            )}
            <button
              type="button"
              data-track={`member_expiring_${showExpiringDetails ? 'collapse' : 'expand'}`}
              onClick={() => setShowExpiringDetails(!showExpiringDetails)}
              style={{
                alignSelf: 'stretch',
                padding: '12px 16px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: getFontSize('button', isMobile),
                color: designSystem.colors.text.secondary,
              }}
            >
              {showExpiringDetails ? '收合' : '展開'}
            </button>
          </div>

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
                          {expired.map((m: any, index: number) => {
                            const label = (m.nickname && m.nickname.trim()) || m.name
                            return (
                              <span key={m.id}>
                                {index > 0 && '、'}
                                {renderExpiryMemberSearch(m.id, label)}
                              </span>
                            )
                          })}
                        </span>
                      </div>
                    )}
                    {upcoming.length > 0 && (
                      <div>
                        <span style={{ fontSize: getFontSize('bodySmall', isMobile), color: designSystem.colors.warning[700], fontWeight: '600' }}>即將到期 ({upcoming.length})：</span>
                        <span style={{ fontSize: getFontSize('bodySmall', isMobile), color: designSystem.colors.text.secondary }}>
                          {upcoming.map((m: any, index: number) => {
                            const label = (m.nickname && m.nickname.trim()) || m.name
                            return (
                              <span key={m.id}>
                                {index > 0 && '、'}
                                {renderExpiryMemberSearch(m.id, label)}
                              </span>
                            )
                          })}
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
                          {expiredBoards.map((b: any, index: number) => (
                            <span key={`${b.member_id}:${b.slot_number}`}>
                              {index > 0 && '、'}
                              #{b.slot_number} {renderExpiryMemberSearch(b.member_id, b.member_name)}
                            </span>
                          ))}
                        </span>
                      </div>
                    )}
                    {upcomingBoards.length > 0 && (
                      <div>
                        <span style={{ fontSize: getFontSize('bodySmall', isMobile), color: designSystem.colors.info[700], fontWeight: '600' }}>即將到期置板 ({upcomingBoards.length})：</span>
                        <span style={{ fontSize: getFontSize('bodySmall', isMobile), color: designSystem.colors.text.secondary }}>
                          {upcomingBoards.map((b: any, index: number) => (
                            <span key={`${b.member_id}:${b.slot_number}`}>
                              {index > 0 && '、'}
                              #{b.slot_number} {renderExpiryMemberSearch(b.member_id, b.member_name)}
                            </span>
                          ))}
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
      <div ref={memberListRef} style={{
        display: 'grid',
        gap: '20px'
      }}>
        {filteredMembers.length === 0 ? (
          <div style={{ ...getEmptyStateStyle(isMobile), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div>
              {(searchTerm || (!isMobile && (
                membershipTypeFilter !== 'all' ||
                expiringFilter !== 'none' ||
                lineBindingFilter !== 'all'
              )))
                ? '找不到符合的會員'
                : '尚無會員資料'}
            </div>
            {(searchTerm || (!isMobile && (
              membershipTypeFilter !== 'all' ||
              expiringFilter !== 'none' ||
              lineBindingFilter !== 'all'
            ))) && (
              <button
                type="button"
                data-track="member_filter_clear"
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
            const cardBg = member.status === 'inactive'
              ? designSystem.colors.background.main
              : designSystem.colors.background.card
            const canReceiveLine =
              (member.is_line_bound && member.line_binding_can_push) ||
              member.line_reminder_mapping_can_push
            const hasReminderMapping =
              member.line_reminder_mapping_can_push && !member.line_binding_can_push
            return (
            <div
              key={member.id}
              data-track={`member_open:${member.nickname || member.name}`}
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
                    <h3 style={{ margin: 0, fontSize: getFontSize('h3', isMobile), fontWeight: 700, color: designSystem.colors.text.primary, letterSpacing: '-0.025em' }}>
                      {member.nickname && member.nickname.trim() ? member.nickname : member.name}
                    </h3>
                    {member.nickname && member.nickname.trim() && (
                      <span style={{ fontSize: getFontSize('bodySmall', isMobile), color: designSystem.colors.text.disabled }}>
                        ({member.name})
                      </span>
                    )}
                    <MemberStatusBadges
                      membershipType={member.membership_type}
                      membershipEndDate={member.membership_end_date}
                      boardExpiryDates={(member.board_slots ?? []).map(slot => slot.expires_at)}
                    />
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
                    {expiryNoticeByMemberId.has(member.id) && (
                      <button
                        type="button"
                        data-track="member_expiry_notice_open"
                        onClick={(event) => {
                          event.stopPropagation()
                          handleOpenExpiryNotice(member.id)
                        }}
                        aria-label={`預覽 ${(member.nickname && member.nickname.trim()) || member.name} 的到期通知`}
                        style={{
                          ...getButtonStyle('secondary', 'small', isMobile),
                          minHeight: isMobile ? '40px' : '32px',
                          marginLeft: 'auto',
                        }}
                      >
                        {copiedExpiryMemberId === member.id ? '已複製' : '到期通知'}
                      </button>
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
                          data-track="member_open_partner"
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
                        title={
                          canReceiveLine
                            ? (hasReminderMapping ? 'LINE 已配對，可傳送' : 'LINE 已綁定')
                            : !member.is_line_bound
                            ? 'LINE 未綁定'
                            : '需重新綁定'
                        }
                        style={getBadgeStyle(
                          canReceiveLine ? 'success' : !member.is_line_bound ? 'default' : 'warning',
                          'small',
                        )}
                      >
                        {canReceiveLine
                          ? (hasReminderMapping ? 'LINE 已配對' : 'LINE 已綁定')
                          : !member.is_line_bound
                          ? 'LINE 未綁定'
                          : '需重新綁定'}
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
                          data-track="member_unbind_line"
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
                    {membershipCountsAsActive(member.membership_type) &&
                      (member.membership_start_date || member.membership_end_date) && (
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
                      <div style={{ fontSize: getFontSize('button', isMobile), color: designSystem.colors.text.primary, fontWeight: 600 }}>
                        備忘錄 ({member.member_notes.length})
                      </div>
                      {allNotes.length > previewCount && (
                        <button
                          type="button"
                          data-track={`member_memo_${isExpanded ? 'collapse' : 'expand'}`}
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
                              fontWeight: 600,
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

      {/* Footer */}
      <Footer />
      </div>

      {/* 新增會員彈窗 */}
      <AddMemberDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onSuccess={() => {
          void Promise.all([loadMembers(true), loadExpiringData()])
        }}
      />

      {/* 會員詳情彈窗 */}
      <MemberDetailDialog
        open={detailDialogOpen}
        memberId={selectedMemberId}
        onClose={() => {
          setDetailDialogOpen(false)
          setSelectedMemberId(null)
        }}
        onUpdate={() => {
          void Promise.all([loadMembers(true), loadExpiringData()])
        }}
        onSwitchMember={(memberId) => setSelectedMemberId(memberId)}
        onArchiveMember={handleArchiveMember}
        onRestoreMember={handleRestoreMember}
      />

      <Modal
        isOpen={editingExpiryMemberId !== null}
        onClose={() => {
          if (sendingExpiryNotice) return
          setEditingExpiryMemberId(null)
          setExpiryNoticeDraft('')
        }}
        title="到期通知預覽"
        size="large"
        footer={
          <>
            <button
              type="button"
              data-track="member_expiry_notice_cancel"
              onClick={() => {
                setEditingExpiryMemberId(null)
                setExpiryNoticeDraft('')
              }}
              disabled={sendingExpiryNotice}
              style={{
                ...getButtonStyle('outline', 'medium', isMobile),
                minHeight: isMobile ? '44px' : undefined,
                flex: isMobile ? '1 1 0' : undefined,
              }}
            >
              取消
            </button>
            <button
              type="button"
              data-track="member_expiry_notice_copy"
              onClick={() => void handleCopyExpiryNotice()}
              disabled={!expiryNoticeDraft.trim() || sendingExpiryNotice}
              style={{
                ...getButtonStyle(
                  canSendEditingExpiryNotice ? 'outline' : 'primary',
                  'medium',
                  isMobile,
                ),
                minHeight: isMobile ? '44px' : undefined,
                flex: isMobile ? '1 1 0' : undefined,
              }}
            >
              複製
            </button>
            {canSendEditingExpiryNotice && (
              <button
                type="button"
                data-track="member_expiry_notice_send"
                onClick={() => void handleSendExpiryNotice()}
                disabled={!expiryNoticeDraft.trim() || sendingExpiryNotice}
                style={{
                  ...getButtonStyle('primary', 'medium', isMobile),
                  minHeight: isMobile ? '44px' : undefined,
                  flex: isMobile ? '1 1 0' : undefined,
                }}
              >
                {sendingExpiryNotice ? '傳送中…' : 'LINE傳送'}
              </button>
            )}
          </>
        }
      >
        <label
          htmlFor="expiry-notice-draft"
          style={{
            display: 'block',
            marginBottom: '8px',
            color: designSystem.colors.text.secondary,
            fontSize: getFontSize('bodySmall', isMobile),
          }}
        >
          {canSendEditingExpiryNotice
            ? '可修改本次通知，再選擇複製或直接傳送 LINE。'
            : '可修改本次通知內容，再複製到 LINE 傳送。'}
        </label>
        <textarea
          id="expiry-notice-draft"
          value={expiryNoticeDraft}
          onChange={(event) => setExpiryNoticeDraft(event.target.value)}
          rows={isMobile ? 15 : 22}
          style={{
            ...getInputStyle(isMobile),
            width: '100%',
            boxSizing: 'border-box',
            resize: 'vertical',
            lineHeight: '1.55',
            fontFamily: 'inherit',
          }}
        />
      </Modal>

      <Modal
        isOpen={showExpiryTemplateEditor}
        onClose={() => setShowExpiryTemplateEditor(false)}
        title="設定到期通知範本"
        size="large"
        footer={
          <>
            <button
              type="button"
              data-track="member_expiry_template_cancel"
              onClick={() => setShowExpiryTemplateEditor(false)}
              disabled={expiryTemplateSaveStatus === 'saving'}
              style={{
                ...getButtonStyle('outline', 'medium', isMobile),
                minHeight: isMobile ? '44px' : undefined,
                width: isMobile ? 'calc(50% - 4px)' : undefined,
              }}
            >
              取消
            </button>
            <button
              type="button"
              data-track="member_expiry_template_save"
              onClick={() => void handleSaveExpiryTemplates()}
              disabled={expiryTemplateSaveStatus === 'saving'}
              style={{
                ...getButtonStyle('primary', 'medium', isMobile),
                minHeight: isMobile ? '44px' : undefined,
                width: isMobile ? 'calc(50% - 4px)' : undefined,
              }}
            >
              {expiryTemplateSaveStatus === 'saving' ? '儲存中…' : '儲存範本'}
            </button>
          </>
        }
      >
        <div style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          marginBottom: '12px',
        }}>
          {(Object.keys(EXPIRY_TEMPLATE_LABELS) as ExpiryTemplateType[]).map((type) => (
            <button
              key={type}
              type="button"
              data-track={`member_expiry_template_type_${type}`}
              onClick={() => setExpiryTemplateType(type)}
              style={{
                ...getButtonStyle(
                  expiryTemplateType === type ? 'primary' : 'outline',
                  'small',
                  isMobile,
                ),
                minHeight: isMobile ? '40px' : undefined,
                flex: isMobile ? '1 1 88px' : undefined,
              }}
            >
              {EXPIRY_TEMPLATE_LABELS[type]}
            </button>
          ))}
        </div>
        <p style={{
          margin: '0 0 8px',
          color: designSystem.colors.text.secondary,
          fontSize: getFontSize('bodySmall', isMobile),
          lineHeight: '1.5',
        }}>
          方括號內的內容會由系統自動帶入。請保留「[會員名稱]」和「[到期資訊]」，其他文字可直接修改。
        </p>
        <textarea
          value={expiryTemplateDrafts[expiryTemplateType]}
          onChange={(event) => {
            const value = event.target.value
            setExpiryTemplateDrafts((current) => ({
              ...current,
              [expiryTemplateType]: value,
            }))
          }}
          rows={isMobile ? 16 : 25}
          aria-label={`${EXPIRY_TEMPLATE_LABELS[expiryTemplateType]}通知範本`}
          style={{
            ...getInputStyle(isMobile),
            width: '100%',
            boxSizing: 'border-box',
            resize: 'vertical',
            lineHeight: '1.55',
            fontFamily: 'inherit',
          }}
        />
      </Modal>

      <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
    </div>
  )
}

