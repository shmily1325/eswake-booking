/**
 * Design thinking:
 * Current feel: emoji titles, green gradient CTAs, and loud nested board cards feel like a Material form kit.
 * Hierarchy: identity fields → membership → quiet gift hint → board slots → primary save.
 * Primary task: create a member (and optional boards) with calm chrome — no decorative emoji or gradients.
 */
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useResponsive } from '../hooks/useResponsive'
import { useToast } from './ui'
import { createMemberWithMembership } from '../services/memberLifecycle'
import {
  isMembershipType,
  getMembershipTypeLabel,
  MEMBERSHIP_GIFT_CREDIT_HINT,
  membershipAllowsDates,
} from '../utils/membership'
import {
  designSystem,
  getButtonStyle,
  getFontSize,
  getInputStyle,
  getLabelStyle,
  getTextStyle,
} from '../styles/designSystem'

interface AddMemberDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function AddMemberDialog({ open, onClose, onSuccess }: AddMemberDialogProps) {
  const { isMobile } = useResponsive()
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const submitLockRef = useRef(false)
  const [formData, setFormData] = useState({
    name: '',
    nickname: '',
    birthday: '',
    phone: '',
    membership_type: 'general',  // 預設為會員
    membership_start_date: '',
    membership_end_date: '',
    membership_partner_id: '',
    board_slot_number: '',
    board_expiry_date: '',
    free_hours: 0,
  })

  const [allMembers, setAllMembers] = useState<Array<{
    id: string
    name: string
    nickname: string | null
    membership_type: string | null
    membership_end_date: string | null
  }>>([])

  // 載入會員列表（用於配對選擇）
  const loadMembers = async () => {
    const { data } = await supabase
      .from('members')
      .select('id, name, nickname, membership_type, membership_end_date')
      .eq('status', 'active')
      .is('membership_partner_id', null)
      .neq('membership_type', 'dual')
      .neq('membership_type', 'es')
      .order('name')
    if (data) setAllMembers(data)
  }

  useEffect(() => {
    if (open) {
      loadMembers()
    } else {
      // 關閉時重置表單
      setFormData({
        name: '',
        nickname: '',
        birthday: '',
        phone: '',
        membership_type: 'general',
        membership_start_date: '',
        membership_end_date: '',
        membership_partner_id: '',
        board_slot_number: '',
        board_expiry_date: '',
        free_hours: 0,
      })
      setBoards([])
    }
  }, [open])

  const [boards, setBoards] = useState<Array<{
    slot_number: string
    start_date: string
    expires_at: string
    notes: string
  }>>([])

  const addBoard = () => {
    setBoards([...boards, { slot_number: '', start_date: '', expires_at: '', notes: '' }])
  }

  const removeBoard = (index: number) => {
    setBoards(boards.filter((_, i) => i !== index))
  }

  const updateBoard = (index: number, field: string, value: string) => {
    const newBoards = [...boards]
    newBoards[index] = { ...newBoards[index], [field]: value }
    setBoards(newBoards)
  }

  const inputStyle = getInputStyle(isMobile)
  const quietHint = {
    fontSize: getFontSize('bodySmall', isMobile),
    color: designSystem.colors.text.disabled,
    fontWeight: 400 as const,
  }
  const requiredMark = { color: designSystem.colors.danger[500] }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast.warning('請輸入姓名')
      return
    }

    const trimmedPhone = formData.phone.trim()
    if (trimmedPhone && !/^09\d{8}$/.test(trimmedPhone)) {
      toast.warning('電話需為 09 開頭的 10 位數字')
      return
    }
    if (!isMembershipType(formData.membership_type)) {
      toast.warning('請選擇有效的會籍類型')
      return
    }
    if (formData.membership_type === 'dual' && !formData.membership_partner_id) {
      toast.warning('雙人會員必須選擇配對會員')
      return
    }
    if (formData.membership_type === 'dual' && !formData.membership_end_date) {
      toast.warning('雙人會員必須設定到期日')
      return
    }
    if (
      formData.membership_start_date &&
      formData.membership_end_date &&
      formData.membership_start_date > formData.membership_end_date
    ) {
      toast.warning('會員開始日期不能晚於截止日期')
      return
    }
    if (formData.membership_type === 'dual') {
      const partner = allMembers.find((candidate) => candidate.id === formData.membership_partner_id)
      if (!partner) {
        toast.warning('找不到可配對的會員，請重新選擇')
        return
      }
      const partnerSummary = [
        getMembershipTypeLabel(partner.membership_type),
        partner.membership_end_date ? `目前到期 ${partner.membership_end_date}` : '目前未設定到期日',
      ].join('、')
      if (!window.confirm(
        `確定與「${partner.nickname || partner.name}」建立雙人會籍嗎？\n\n${partnerSummary}\n雙方到期日將統一為 ${formData.membership_end_date}。`
      )) return
    }

    if (submitLockRef.current) return
    submitLockRef.current = true
    setLoading(true)
    try {
      const normalizedBoards = boards
        .filter((board) => board.slot_number)
        .map((board) => ({
          slot_number: Number(board.slot_number),
          start_date: board.start_date || null,
          expires_at: board.expires_at || null,
          notes: board.notes.trim() || null,
        }))

      await createMemberWithMembership({
        name: formData.name,
        nickname: formData.nickname,
        birthday: formData.birthday || null,
        phone: formData.phone,
        membershipType: formData.membership_type,
        membershipStartDate: formData.membership_start_date || null,
        membershipEndDate: formData.membership_end_date || null,
        membershipPartnerId: formData.membership_partner_id || null,
        boards: normalizedBoards,
      })

      toast.success('會員已新增')
      if (formData.membership_type === 'general' || formData.membership_type === 'dual') {
        toast.warning(MEMBERSHIP_GIFT_CREDIT_HINT, 8000)
      }
      onSuccess()
      onClose()  // useEffect 會在 open=false 時自動重置表單
    } catch (error: unknown) {
      console.error('新增會員失敗:', error)
      const message = error instanceof Error ? error.message : '未知錯誤'
      if (message.includes('格位')) {
        toast.error(message)
      } else {
        toast.error(`新增會員失敗: ${message}`)
      }
    } finally{
      submitLockRef.current = false
      setLoading(false)
    }
  }

  if (!open) return null

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
      zIndex: 1000,
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
        {/* 標題欄 */}
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
            新增會員
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

        {/* 內容區域 - Scrollable */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          WebkitOverflowScrolling: 'touch',
        }}>
          <form onSubmit={handleSubmit} id="add-member-form">
            {/* 姓名 */}
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

            {/* 暱稱 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={getLabelStyle(isMobile)}>
                暱稱 <span style={quietHint}>（選填，可輸入多個）</span>
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

            {/* 生日 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={getLabelStyle(isMobile)}>
                生日 <span style={quietHint}>（選填）</span>
              </label>
              <div style={{ display: 'flex' }}>
                <input
                  type="date"
                  value={formData.birthday}
                  onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                  style={{ ...inputStyle, flex: 1 }}
                />
              </div>
            </div>

            {/* 電話 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={getLabelStyle(isMobile)}>
                電話 <span style={quietHint}>（選填）</span>
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="請輸入電話"
                style={inputStyle}
              />
            </div>

            {/* 會籍類型 */}
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
                    membership_start_date: membershipType === 'guest' ? '' : formData.membership_start_date,
                    membership_end_date: membershipType === 'guest' ? '' : formData.membership_end_date,
                    membership_partner_id: membershipType === 'dual' ? formData.membership_partner_id : '',
                  })
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

            {(formData.membership_type === 'general' || formData.membership_type === 'dual') && (
              <div
                role="note"
                style={{
                  marginBottom: '16px',
                  padding: `${designSystem.spacing.sm} 0`,
                  color: designSystem.colors.warning[700],
                  fontSize: getFontSize('bodySmall', isMobile),
                  lineHeight: 1.55,
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 4 }}>入會贈送提醒</div>
                <div>30分鐘指定課程、40分鐘大船時數</div>
                <div style={{ marginTop: 4, color: designSystem.colors.text.secondary }}>
                  不會自動加額度，請至「會員儲值」記帳
                </div>
              </div>
            )}

            {/* 會員日期 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: '12px',
              marginBottom: '16px'
            }}>
              {/* 會員開始日期 */}
              <div style={{ minWidth: 0 }}>
                <label style={getLabelStyle(isMobile)}>
                  會員開始日期 <span style={quietHint}>（選填）</span>
                </label>
                <div style={{ display: 'flex' }}>
                  <input
                    type="date"
                    value={formData.membership_start_date}
                    onChange={(e) => setFormData({ ...formData, membership_start_date: e.target.value })}
                    disabled={!membershipAllowsDates(formData.membership_type)}
                    style={{ ...inputStyle, flex: 1, opacity: membershipAllowsDates(formData.membership_type) ? 1 : 0.55 }}
                  />
                </div>
              </div>

              {/* 會員截止日期 */}
              <div style={{ minWidth: 0 }}>
                <label style={getLabelStyle(isMobile)}>
                  會員截止日期 <span style={quietHint}>（選填）</span>
                </label>
                <div style={{ display: 'flex' }}>
                  <input
                    type="date"
                    value={formData.membership_end_date}
                    onChange={(e) => setFormData({ ...formData, membership_end_date: e.target.value })}
                    disabled={!membershipAllowsDates(formData.membership_type)}
                    style={{ ...inputStyle, flex: 1, opacity: membershipAllowsDates(formData.membership_type) ? 1 : 0.55 }}
                  />
                </div>
              </div>
            </div>

            {/* 配對會員 - 只在選擇「雙人會籍」時顯示 */}
            {formData.membership_type === 'dual' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={getLabelStyle(isMobile)}>
                  配對會員 <span style={requiredMark}>*</span>
                </label>
                <select
                  value={formData.membership_partner_id}
                  onChange={(e) => setFormData({ ...formData, membership_partner_id: e.target.value })}
                  style={inputStyle}
                  required
                >
                  <option value="">請選擇配對會員</option>
                  {allMembers.map(member => (
                    <option key={member.id} value={member.id}>
                      {member.nickname || member.name}（{getMembershipTypeLabel(member.membership_type)}
                      {member.membership_end_date ? `，至 ${member.membership_end_date}` : ''}）
                    </option>
                  ))}
                </select>
                <div style={{
                  fontSize: getFontSize('caption', isMobile),
                  color: designSystem.colors.text.secondary,
                  marginTop: designSystem.spacing.xs,
                }}>
                  選擇後將自動建立雙向配對關係
                </div>
              </div>
            )}

            {/* 置板服務 */}
            <div style={{
              marginBottom: '16px',
              padding: designSystem.spacing.lg,
              background: designSystem.colors.background.main,
              borderRadius: designSystem.borderRadius.lg,
              border: `1px solid ${designSystem.colors.border.light}`,
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: boards.length > 0 ? designSystem.spacing.lg : 0,
                gap: designSystem.spacing.sm,
              }}>
                <span style={{
                  fontWeight: 600,
                  fontSize: getFontSize('body', isMobile),
                  color: designSystem.colors.text.primary,
                }}>
                  置板服務
                </span>
                <button
                  type="button"
                  onClick={addBoard}
                  style={getButtonStyle('outline', 'small', isMobile)}
                >
                  + 新增置板
                </button>
              </div>

              {/* 置板列表 */}
              {boards.map((board, index) => (
                <div key={index} style={{
                  marginTop: index > 0 ? designSystem.spacing.md : 0,
                  padding: designSystem.spacing.md,
                  background: designSystem.colors.background.card,
                  borderRadius: designSystem.borderRadius.md,
                  border: `1px solid ${designSystem.colors.border.light}`,
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: designSystem.spacing.md,
                    gap: designSystem.spacing.sm,
                  }}>
                    <span style={{
                      fontWeight: 500,
                      fontSize: getFontSize('bodySmall', isMobile),
                    }}>
                      置板 #{index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeBoard(index)}
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

                  {/* 格位編號 */}
                  <div style={{ marginBottom: designSystem.spacing.md }}>
                    <label style={{ ...getLabelStyle(isMobile), marginBottom: '6px' }}>
                      格位編號 <span style={requiredMark}>*</span>
                      <span style={{ ...quietHint, marginLeft: designSystem.spacing.sm }}>（1-145）</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={board.slot_number}
                      onChange={(e) => {
                        const numValue = e.target.value.replace(/\D/g, '') // 只允許數字
                        const num = Number(numValue)
                        if ((num >= 1 && num <= 145) || numValue === '') {
                          updateBoard(index, 'slot_number', numValue)
                        }
                      }}
                      placeholder="請輸入格位編號"
                      style={inputStyle}
                    />
                  </div>

                  {/* 置板開始 */}
                  <div style={{ marginBottom: designSystem.spacing.md }}>
                    <label style={{ ...getLabelStyle(isMobile), marginBottom: '6px' }}>
                      置板開始 <span style={quietHint}>（選填）</span>
                    </label>
                    <div style={{ display: 'flex' }}>
                      <input
                        type="date"
                        value={board.start_date}
                        onChange={(e) => updateBoard(index, 'start_date', e.target.value)}
                        style={{ ...inputStyle, flex: 1 }}
                      />
                    </div>
                  </div>

                  {/* 置板到期 */}
                  <div style={{ marginBottom: designSystem.spacing.md }}>
                    <label style={{ ...getLabelStyle(isMobile), marginBottom: '6px' }}>
                      置板到期 <span style={quietHint}>（選填）</span>
                    </label>
                    <div style={{ display: 'flex' }}>
                      <input
                        type="date"
                        value={board.expires_at}
                        onChange={(e) => updateBoard(index, 'expires_at', e.target.value)}
                        style={{ ...inputStyle, flex: 1 }}
                      />
                    </div>
                  </div>

                  {/* 置板備註 */}
                  <div>
                    <label style={{ ...getLabelStyle(isMobile), marginBottom: '6px' }}>
                      置板備註 <span style={quietHint}>（選填）</span>
                    </label>
                    <input
                      type="text"
                      value={board.notes}
                      onChange={(e) => updateBoard(index, 'notes', e.target.value)}
                      placeholder="例如：有三格"
                      style={inputStyle}
                    />
                  </div>
                </div>
              ))}
            </div>

          </form>
        </div>

        {/* 底部按鈕欄 - 固定底部 */}
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
            form="add-member-form"
            disabled={loading}
            style={{
              ...getButtonStyle('primary', 'large', isMobile),
              flex: 1,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
              minHeight: isMobile ? '48px' : '44px',
            }}
          >
            {loading ? '新增中...' : '確認新增'}
          </button>
        </div>
      </div>
    </div>
  )
}
