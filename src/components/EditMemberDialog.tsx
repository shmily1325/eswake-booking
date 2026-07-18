import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useResponsive } from '../hooks/useResponsive'
import { useToast } from './ui'
import { MemoRecordCheckbox } from './MemoRecordCheckbox'
import { updateMemberMembership } from '../services/memberLifecycle'
import { getVenueDateString } from '../utils/date'
import {
  getMembershipTypeLabel,
  isMembershipType,
  membershipAllowsDates,
  membershipRequiresPartner,
} from '../utils/membership'
import {
  designSystem,
  getButtonStyle,
  getFontSize,
  getInputStyle,
  getLabelStyle,
  getTextStyle,
} from '../styles/designSystem'

interface Member {
  id: string
  name: string
  nickname: string | null
  birthday: string | null
  phone: string | null
  membership_type: string | null
  membership_start_date: string | null
  membership_end_date: string | null
  membership_partner_id: string | null
  gift_boat_hours: number | null
  notes: string | null
  partner?: {
    id: string
    name: string
    nickname: string | null
    membership_end_date?: string | null
  } | null
}

interface EditMemberDialogProps {
  open: boolean
  member: Member
  onClose: () => void
  onSuccess: () => void
}

export function EditMemberDialog({ open, member, onClose, onSuccess }: EditMemberDialogProps) {
  const { isMobile } = useResponsive()
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const submitLockRef = useRef(false)
  const [boardSlots, setBoardSlots] = useState<Array<{id?: number, slot_number: string, start_date: string, expires_at: string}>>([])
  const [deletedBoardIds, setDeletedBoardIds] = useState<number[]>([])
  const [addToMemo, setAddToMemo] = useState(true)  // 是否記錄到備忘錄
  const [memoText, setMemoText] = useState('')  // 自訂備忘錄內容

  // 配對會員搜尋相關狀態
  const [partnerSearch, setPartnerSearch] = useState('')
  const [partnerSearchResults, setPartnerSearchResults] = useState<Array<{
    id: string
    name: string
    nickname: string | null
    membership_type: string | null
    membership_end_date: string | null
  }>>([])
  const [selectedPartner, setSelectedPartner] = useState<{
    id: string
    name: string
    nickname: string | null
    membership_type?: string | null
    membership_end_date?: string | null
  } | null>(null)

  const [formData, setFormData] = useState({
    name: member.name,
    nickname: member.nickname || '',
    birthday: member.birthday || '',
    phone: member.phone || '',
    membership_type: member.membership_type || 'general',
    membership_start_date: member.membership_start_date || '',
    membership_end_date: member.membership_end_date || '',
    membership_partner_id: member.membership_partner_id || '',
  })

  // 搜尋配對會員
  const searchPartner = async (query: string) => {
    if (!query.trim()) {
      setPartnerSearchResults([])
      return
    }

    try {
      const { data, error } = await supabase
        .from('members')
        .select('id, name, nickname, phone, membership_type, membership_end_date, membership_partner_id')
        .or(`name.ilike.%${query}%,nickname.ilike.%${query}%,phone.ilike.%${query}%`)
        .eq('status', 'active')
        .neq('id', member.id)  // 排除自己
        .neq('membership_type', 'es')
        .neq('membership_type', 'dual')
        .limit(10)

      if (error) throw error
      setPartnerSearchResults((data || []).filter((candidate) =>
        !candidate.membership_partner_id || candidate.membership_partner_id === member.id
      ))
    } catch (error) {
      console.error('搜尋會員失敗:', error)
    }
  }

  // 載入會員的置板格位
  const loadBoardSlots = async () => {
    const { data } = await supabase
      .from('board_storage')
      .select('id, slot_number, start_date, expires_at')
      .eq('member_id', member.id)
      .eq('status', 'active')
      .order('slot_number')
    if (data) {
      setBoardSlots(data.map(slot => ({
        id: slot.id,
        slot_number: String(slot.slot_number),
        start_date: slot.start_date || '',
        expires_at: slot.expires_at || ''
      })))
    }
  }

  useEffect(() => {
    if (!open) {
      // 对话框关闭时重置状态
      setBoardSlots([])
      setDeletedBoardIds([])
      setPartnerSearch('')
      setPartnerSearchResults([])
      setSelectedPartner(null)
      return
    }

    loadBoardSlots()
    setDeletedBoardIds([])

    setFormData({
      name: member.name,
      nickname: member.nickname || '',
      birthday: member.birthday || '',
      phone: member.phone || '',
      membership_type: member.membership_type || 'general',
      membership_start_date: member.membership_start_date || '',
      membership_end_date: member.membership_end_date || '',
      membership_partner_id: member.membership_partner_id || '',
    })

    // 重置備忘錄相關狀態
    setAddToMemo(true)
    setMemoText('')

    // 如果已有配對會員，載入並設定為選中狀態
    if (member.membership_partner_id && member.partner) {
      setSelectedPartner({
        id: member.partner.id,
        name: member.partner.name,
        nickname: member.partner.nickname,
        membership_type: 'dual',
        membership_end_date: member.partner.membership_end_date,
      })
    } else {
      setSelectedPartner(null)
    }
    setPartnerSearch('')
    setPartnerSearchResults([])
  }, [member, open])

  // 添加新置板格位
  const handleAddBoardSlot = () => {
    setBoardSlots([...boardSlots, { slot_number: '', start_date: '', expires_at: '' }])
  }

  // 刪除置板格位
  const handleRemoveBoardSlot = (index: number) => {
    const slot = boardSlots[index]
    if (slot.id) {
      setDeletedBoardIds((prev) => [...prev, slot.id!])
    }
    setBoardSlots(boardSlots.filter((_, i) => i !== index))
  }

  // 更新置板格位
  const handleUpdateBoardSlot = (index: number, field: 'slot_number' | 'start_date' | 'expires_at', value: string) => {
    const newSlots = [...boardSlots]
    newSlots[index][field] = value
    setBoardSlots(newSlots)
  }

  const requiresGuestNormalization =
    formData.membership_type === 'guest' &&
    (
      member.membership_type !== 'guest' ||
      Boolean(member.membership_start_date) ||
      Boolean(member.membership_end_date) ||
      Boolean(member.membership_partner_id)
    )

  const membershipChanged =
    formData.membership_type !== (member.membership_type || 'general') ||
    formData.membership_start_date !== (member.membership_start_date || '') ||
    formData.membership_end_date !== (member.membership_end_date || '') ||
    formData.membership_partner_id !== (member.membership_partner_id || '')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitLockRef.current) return
    submitLockRef.current = true
    setLoading(true)

    try {
      const trimmedPhone = formData.phone.trim()
      if (trimmedPhone && !/^09\d{8}$/.test(trimmedPhone)) {
        toast.warning('電話需為 09 開頭的 10 位數字')
        setLoading(false)
        return
      }
      if (!isMembershipType(formData.membership_type)) {
        toast.warning('請選擇有效的會籍類型')
        setLoading(false)
        return
      }
      if (membershipRequiresPartner(formData.membership_type) && !formData.membership_partner_id) {
        toast.warning('雙人會員必須選擇配對會員')
        setLoading(false)
        return
      }
      if (membershipRequiresPartner(formData.membership_type) && !formData.membership_end_date) {
        toast.warning('雙人會員必須設定到期日')
        setLoading(false)
        return
      }
      if (
        formData.membership_start_date &&
        formData.membership_end_date &&
        formData.membership_start_date > formData.membership_end_date
      ) {
        toast.warning('會員開始日期不能晚於截止日期')
        setLoading(false)
        return
      }
      if (
        member.membership_type === 'guest' &&
        formData.membership_type !== 'guest' &&
        (!formData.membership_start_date || !formData.membership_end_date)
      ) {
        toast.warning('非會員轉為有效會籍時，必須設定開始日與截止日')
        setLoading(false)
        return
      }
      if (
        formData.membership_type === 'dual' &&
        (
          formData.membership_partner_id !== (member.membership_partner_id || '') ||
          selectedPartner?.membership_end_date !== formData.membership_end_date
        )
      ) {
        if (!selectedPartner) {
          toast.warning('請重新選擇可配對的會員')
          setLoading(false)
          return
        }
        const partnerSummary = [
          getMembershipTypeLabel(selectedPartner.membership_type),
          selectedPartner.membership_end_date
            ? `目前到期 ${selectedPartner.membership_end_date}`
            : '目前未設定到期日',
        ].join('、')
        if (!window.confirm(
          `確定與「${selectedPartner.nickname || selectedPartner.name}」建立雙人會籍嗎？\n\n${partnerSummary}\n雙方到期日將統一為 ${formData.membership_end_date}。`
        )) {
          setLoading(false)
          return
        }
      }

      for (const slot of boardSlots) {
        if (!slot.slot_number.trim()) continue
        const slotNumber = Number(slot.slot_number)
        if (!Number.isInteger(slotNumber) || slotNumber < 1 || slotNumber > 145) {
          toast.warning(`格位編號 ${slot.slot_number} 必須是 1-145 之間的數字`)
          setLoading(false)
          return
        }
      }

      // 會員、會籍、配對與置板在同一筆資料庫交易完成
      await updateMemberMembership({
        memberId: member.id,
        membershipType: formData.membership_type,
        membershipStartDate: formData.membership_type === 'guest'
          ? null
          : (formData.membership_start_date || null),
        membershipEndDate: formData.membership_type === 'guest'
          ? null
          : (formData.membership_end_date || null),
        membershipPartnerId: formData.membership_type === 'dual'
          ? (formData.membership_partner_id || null)
          : null,
        memo: requiresGuestNormalization || addToMemo ? memoText : null,
        recordNote: requiresGuestNormalization || (membershipChanged && addToMemo),
        profile: {
          name: formData.name,
          nickname: formData.nickname || null,
          birthday: formData.birthday || null,
          phone: formData.phone || null,
        },
        boards: boardSlots
          .filter((slot) => slot.slot_number.trim())
          .map((slot) => ({
            id: slot.id,
            slot_number: Number(slot.slot_number),
            start_date: slot.start_date || null,
            expires_at: slot.expires_at || null,
            notes: null,
          })),
        deletedBoardIds,
      })

      onSuccess()
      onClose()
    } catch (error) {
      console.error('更新失敗:', error)
      toast.error(error instanceof Error ? `更新失敗：${error.message}` : '更新失敗')
    } finally {
      submitLockRef.current = false
      setLoading(false)
    }
  }

  if (!open) return null

  const inputStyle = getInputStyle(isMobile)
  const typeSize = (variant: keyof typeof designSystem.fontSize) =>
    getFontSize(variant, isMobile)
  const requiredMark = { color: designSystem.colors.danger[500] }
  const quietHint = {
    fontSize: typeSize('bodySmall'),
    color: designSystem.colors.text.disabled,
    fontWeight: 400 as const,
  }

  return (
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
      zIndex: 1001,
      padding: isMobile ? '0' : '16px',
      overflowY: isMobile ? 'hidden' : 'auto',
    }}>
      <div style={{
        background: designSystem.colors.background.card,
        borderRadius: isMobile
          ? `${designSystem.borderRadius.lg} ${designSystem.borderRadius.lg} 0 0`
          : designSystem.borderRadius.lg,
        maxWidth: isMobile ? '100%' : '600px',
        width: '100%',
        maxHeight: isMobile ? '80vh' : '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: designSystem.shadows.lg,
        border: `1px solid ${designSystem.colors.border.light}`,
        margin: isMobile ? 'auto 0 0 0' : 'auto',
      }}>
        <div style={{
          padding: isMobile ? '20px 20px 16px' : '20px',
          borderBottom: `1px solid ${designSystem.colors.border.light}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
          background: designSystem.colors.background.card,
        }}>
          <h2 style={{
            margin: 0,
            ...getTextStyle('h3', isMobile),
            fontWeight: 700,
            letterSpacing: '-0.02em',
          }}>
            編輯會員資料
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="關閉"
            style={{
              border: 'none',
              background: 'none',
              fontSize: designSystem.fontSize.h1.desktop,
              cursor: loading ? 'not-allowed' : 'pointer',
              color: designSystem.colors.text.secondary,
              padding: '0 8px',
              opacity: loading ? 0.5 : 1,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          WebkitOverflowScrolling: 'touch',
        }}>
          <form onSubmit={handleSubmit} id="edit-member-form">
            <div style={{ marginBottom: '16px' }}>
              <label style={getLabelStyle(isMobile)}>
                姓名 <span style={requiredMark}>*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="請輸入姓名"
                style={inputStyle}
                required
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={getLabelStyle(isMobile)}>
                暱稱 <span style={quietHint}>（可輸入多個）</span>
              </label>
              <input
                type="text"
                value={formData.nickname}
                onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                placeholder="請輸入暱稱"
                maxLength={100}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={getLabelStyle(isMobile)}>生日</label>
              <input
                type="date"
                value={formData.birthday}
                onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={getLabelStyle(isMobile)}>電話</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="請輸入電話"
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={getLabelStyle(isMobile)}>
                會籍類型 <span style={requiredMark}>*</span>
              </label>
              <select
                value={formData.membership_type}
                onChange={(e) => {
                  const membershipType = e.target.value
                  setFormData({
                    ...formData,
                    membership_type: membershipType,
                    membership_start_date: membershipType === 'guest'
                      ? ''
                      : (member.membership_type === 'guest' && !formData.membership_start_date
                        ? getVenueDateString()
                        : formData.membership_start_date),
                    membership_end_date: membershipType === 'guest' ? '' : formData.membership_end_date,
                    membership_partner_id: membershipType === 'dual' ? formData.membership_partner_id : '',
                  })
                  if (membershipType !== 'dual') {
                    setSelectedPartner(null)
                    setPartnerSearch('')
                    setPartnerSearchResults([])
                  }
                }}
                style={inputStyle}
                required
              >
                <option value="general">會員</option>
                <option value="dual">雙人會員</option>
                <option value="guest">非會員</option>
                <option value="es">ES</option>
              </select>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: '12px',
              marginBottom: '16px',
            }}>
              <div style={{ minWidth: 0 }}>
                <label style={getLabelStyle(isMobile)}>會員開始日期</label>
                <input
                  type="date"
                  value={formData.membership_start_date}
                  onChange={(e) => setFormData({ ...formData, membership_start_date: e.target.value })}
                  disabled={!membershipAllowsDates(formData.membership_type)}
                  style={{
                    ...inputStyle,
                    opacity: membershipAllowsDates(formData.membership_type) ? 1 : 0.55,
                  }}
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <label style={getLabelStyle(isMobile)}>會員截止日期</label>
                <input
                  type="date"
                  value={formData.membership_end_date}
                  onChange={(e) => setFormData({ ...formData, membership_end_date: e.target.value })}
                  disabled={!membershipAllowsDates(formData.membership_type)}
                  style={{
                    ...inputStyle,
                    opacity: membershipAllowsDates(formData.membership_type) ? 1 : 0.55,
                  }}
                />
              </div>
            </div>

            {requiresGuestNormalization ? (
              <div style={{
                marginBottom: '16px',
                padding: '12px',
                color: designSystem.colors.warning[700],
                background: designSystem.colors.warning[50],
                border: `1px solid ${designSystem.colors.warning[500]}55`,
                borderRadius: designSystem.borderRadius.lg,
                fontSize: typeSize('bodySmall'),
                lineHeight: 1.5,
              }}>
                <div style={{ fontWeight: 600, marginBottom: '8px' }}>
                  儲存後將清除會籍日期、解除雙方配對，並自動建立備忘錄。
                </div>
                <input
                  type="text"
                  value={memoText}
                  onChange={(e) => setMemoText(e.target.value)}
                  placeholder="補充說明（選填）"
                  style={inputStyle}
                />
              </div>
            ) : (formData.membership_start_date !== (member.membership_start_date || '') ||
              formData.membership_end_date !== (member.membership_end_date || '')) && (
              <MemoRecordCheckbox
                checked={addToMemo}
                onChange={setAddToMemo}
                inputValue={memoText}
                onInputChange={setMemoText}
                inputPlaceholder="可輸入說明（選填），例如：出國請假、續約一年"
                hint="如僅修正錯誤可不勾選"
              />
            )}

            {formData.membership_type === 'dual' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={getLabelStyle(isMobile)}>
                  配對會員 <span style={requiredMark}>*</span>{' '}
                  {!selectedPartner && member.partner && (
                    <span style={quietHint}>
                      （目前：{member.partner.nickname || member.partner.name}）
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={partnerSearch}
                  onChange={(e) => {
                    setPartnerSearch(e.target.value)
                    searchPartner(e.target.value)
                  }}
                  placeholder="搜尋會員姓名/暱稱..."
                  style={inputStyle}
                />

                {partnerSearchResults.length > 0 && !selectedPartner && (
                  <div style={{
                    marginTop: '8px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    border: `1px solid ${designSystem.colors.border.light}`,
                    borderRadius: designSystem.borderRadius.lg,
                    background: designSystem.colors.background.card,
                  }}>
                    {partnerSearchResults.map((m) => (
                      <div
                        key={m.id}
                        onClick={() => {
                          setSelectedPartner(m)
                          setFormData({ ...formData, membership_partner_id: m.id })
                          setPartnerSearch('')
                          setPartnerSearchResults([])
                        }}
                        style={{
                          padding: '10px 12px',
                          cursor: 'pointer',
                          borderBottom: `1px solid ${designSystem.colors.border.light}`,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = designSystem.colors.background.main
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = designSystem.colors.background.card
                        }}
                      >
                        <div style={{ fontWeight: 500, color: designSystem.colors.text.primary }}>{m.name}</div>
                        {m.nickname && (
                          <div style={{ fontSize: typeSize('bodySmall'), color: designSystem.colors.text.secondary }}>
                            暱稱：{m.nickname}
                          </div>
                        )}
                        <div style={{ fontSize: typeSize('caption'), color: designSystem.colors.text.secondary }}>
                          {getMembershipTypeLabel(m.membership_type)}
                          {m.membership_end_date ? `，目前到期 ${m.membership_end_date}` : '，目前未設定到期日'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selectedPartner && (
                  <div style={{
                    marginTop: '8px',
                    padding: '12px 14px',
                    background: designSystem.colors.info[50],
                    border: `1px solid ${designSystem.colors.info[500]}55`,
                    borderRadius: designSystem.borderRadius.lg,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: designSystem.colors.info[700], fontSize: typeSize('body') }}>
                        {selectedPartner.id === member.membership_partner_id ? '維持原配對：' : '更換為：'}
                        {selectedPartner.name}
                      </div>
                      {selectedPartner.nickname && (
                        <div style={{ fontSize: typeSize('bodySmall'), color: designSystem.colors.text.secondary }}>
                          暱稱：{selectedPartner.nickname}
                        </div>
                      )}
                      {selectedPartner.id !== member.membership_partner_id && member.partner && (
                        <div style={{ fontSize: typeSize('caption'), color: designSystem.colors.warning[700], marginTop: '4px' }}>
                          從「{member.partner.nickname || member.partner.name}」更換
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPartner(null)
                        setFormData({ ...formData, membership_partner_id: '' })
                        setPartnerSearch('')
                      }}
                      style={{
                        ...getButtonStyle('ghost', 'small', isMobile),
                        padding: '4px 8px',
                        color: designSystem.colors.text.secondary,
                        flexShrink: 0,
                      }}
                      aria-label="清除配對"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            )}

            <div style={{
              background: designSystem.colors.background.main,
              padding: '16px',
              borderRadius: designSystem.borderRadius.lg,
              border: `1px solid ${designSystem.colors.border.light}`,
              marginBottom: '8px',
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
                gap: '12px',
              }}>
                <h3 style={{
                  margin: 0,
                  ...getTextStyle('body', isMobile),
                  fontWeight: 600,
                }}>
                  置板資訊
                </h3>
                <button
                  type="button"
                  onClick={handleAddBoardSlot}
                  style={getButtonStyle('secondary', 'small', isMobile)}
                >
                  + 新增格位
                </button>
              </div>

              {boardSlots.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  color: designSystem.colors.text.secondary,
                  fontSize: typeSize('bodySmall'),
                  padding: '20px 12px',
                }}>
                  尚無置板格位，點擊「新增格位」添加
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {boardSlots.map((slot, index) => (
                    <div key={index} style={{
                      background: designSystem.colors.background.card,
                      padding: '12px',
                      borderRadius: designSystem.borderRadius.lg,
                      border: `1px solid ${designSystem.colors.border.light}`,
                    }}>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                        gap: '12px',
                        marginBottom: '8px',
                      }}>
                        <div>
                          <label style={{ ...getLabelStyle(isMobile), marginBottom: '4px' }}>
                            格位編號 (1-145)
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={slot.slot_number}
                            onChange={(e) => {
                              const numValue = e.target.value.replace(/\D/g, '')
                              const num = Number(numValue)
                              if ((num >= 1 && num <= 145) || numValue === '') {
                                handleUpdateBoardSlot(index, 'slot_number', numValue)
                              }
                            }}
                            placeholder="例如：1"
                            style={inputStyle}
                          />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <label style={{ ...getLabelStyle(isMobile), marginBottom: '4px' }}>
                            開始日期
                          </label>
                          <input
                            type="date"
                            value={slot.start_date}
                            onChange={(e) => handleUpdateBoardSlot(index, 'start_date', e.target.value)}
                            style={inputStyle}
                          />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <label style={{ ...getLabelStyle(isMobile), marginBottom: '4px' }}>
                            到期日期
                          </label>
                          <input
                            type="date"
                            value={slot.expires_at}
                            onChange={(e) => handleUpdateBoardSlot(index, 'expires_at', e.target.value)}
                            style={inputStyle}
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveBoardSlot(index)}
                        style={{
                          ...getButtonStyle('outline', 'small', isMobile),
                          color: designSystem.colors.danger[700],
                          borderColor: `${designSystem.colors.danger[500]}66`,
                          background: designSystem.colors.danger[50],
                        }}
                      >
                        刪除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </form>
        </div>

        <div style={{
          padding: isMobile ? '12px 20px' : '16px 20px',
          borderTop: `1px solid ${designSystem.colors.border.light}`,
          background: designSystem.colors.background.card,
          display: 'flex',
          gap: isMobile ? '8px' : '12px',
          paddingBottom: isMobile
            ? 'max(20px, calc(env(safe-area-inset-bottom, 0px) + 12px))'
            : '16px',
          flexShrink: 0,
        }}>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              ...getButtonStyle('outline', 'large', isMobile),
              flex: 1,
              opacity: loading ? 0.5 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
              minHeight: isMobile ? '48px' : '44px',
            }}
          >
            取消
          </button>
          <button
            type="submit"
            form="edit-member-form"
            disabled={loading}
            style={{
              ...getButtonStyle('primary', 'large', isMobile),
              flex: 1,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
              minHeight: isMobile ? '48px' : '44px',
            }}
          >
            {loading ? '更新中...' : '確認更新'}
          </button>
        </div>
      </div>
    </div>
  )
}
