import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useResponsive } from '../hooks/useResponsive'
import { useToast } from './ui'
import { MemoRecordCheckbox } from './MemoRecordCheckbox'
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
  partner?: { id: string, name: string, nickname: string | null } | null
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
  const [boardSlots, setBoardSlots] = useState<Array<{id?: number, slot_number: string, start_date: string, expires_at: string}>>([])
  const [addToMemo, setAddToMemo] = useState(true)  // 是否記錄到備忘錄
  const [memoText, setMemoText] = useState('')  // 自訂備忘錄內容
  
  // 配對會員搜尋相關狀態
  const [partnerSearch, setPartnerSearch] = useState('')
  const [partnerSearchResults, setPartnerSearchResults] = useState<Array<{id: string, name: string, nickname: string | null}>>([])
  const [selectedPartner, setSelectedPartner] = useState<{id: string, name: string, nickname: string | null} | null>(null)
  
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
        .select('id, name, nickname, phone')
        .or(`name.ilike.%${query}%,nickname.ilike.%${query}%,phone.ilike.%${query}%`)
        .eq('status', 'active')
        .neq('id', member.id)  // 排除自己
        .limit(10)

      if (error) throw error
      setPartnerSearchResults(data || [])
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
      setPartnerSearch('')
      setPartnerSearchResults([])
      setSelectedPartner(null)
      return
    }

    loadBoardSlots()
    
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
        nickname: member.partner.nickname
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
  const handleRemoveBoardSlot = async (index: number) => {
    const slot = boardSlots[index]
    if (slot.id) {
      // 如果有 ID，從資料庫真正刪除
      const { error } = await supabase
        .from('board_storage')
        .delete()
        .eq('id', slot.id)
      
      if (error) {
        toast.error('刪除失敗：' + error.message)
        return
      }
      toast.success(`已刪除格位 #${slot.slot_number}`)
    }
    // 從列表中移除
    setBoardSlots(boardSlots.filter((_, i) => i !== index))
  }

  // 更新置板格位
  const handleUpdateBoardSlot = (index: number, field: 'slot_number' | 'start_date' | 'expires_at', value: string) => {
    const newSlots = [...boardSlots]
    newSlots[index][field] = value
    setBoardSlots(newSlots)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const trimmedPhone = formData.phone.trim()
      if (trimmedPhone && !/^09\d{8}$/.test(trimmedPhone)) {
        toast.warning('電話需為 09 開頭的 10 位數字')
        setLoading(false)
        return
      }

      // 1. 更新會員資料
      const { error } = await supabase
        .from('members')
        .update({
          name: formData.name,
          nickname: formData.nickname || null,
          birthday: formData.birthday || null,
          phone: formData.phone || null,
          membership_type: formData.membership_type,
          membership_start_date: formData.membership_start_date || null,
          membership_end_date: formData.membership_end_date || null,
          membership_partner_id: formData.membership_partner_id || null,
        })
        .eq('id', member.id)

      if (error) throw error

      // 處理置板格位
      for (const slot of boardSlots) {
        const slotNumber = parseInt(slot.slot_number)
        if (!slot.slot_number || slot.slot_number.trim() === '') {
          continue // 跳過空的格位
        }
        
        if (isNaN(slotNumber) || slotNumber < 1 || slotNumber > 145) {
          toast.warning(`格位編號 ${slot.slot_number} 必須是 1-145 之間的數字`)
          setLoading(false)
          return
        }

        if (slot.id) {
          // 更新現有置板
          const { error } = await supabase
            .from('board_storage')
            .update({
              slot_number: slotNumber,
              start_date: slot.start_date || null,
              expires_at: slot.expires_at || null,
              status: 'active'
            })
            .eq('id', slot.id)
          if (error) throw error
        } else {
          // 新增置板
          const { error } = await supabase
            .from('board_storage')
            .insert({
              member_id: member.id,
              slot_number: slotNumber,
              start_date: slot.start_date || null,
              expires_at: slot.expires_at || null,
              status: 'active'
            })
          if (error) {
            if (error.code === '23505') {
              toast.warning(`格位 ${slotNumber} 已被使用，請選擇其他格位`)
              setLoading(false)
              return
            }
            throw error
          }
        }
      }

      // 2. 處理配對變更
      const oldPartnerId = member.membership_partner_id
      const newPartnerId = formData.membership_partner_id || null

      if (oldPartnerId !== newPartnerId) {
        // 如果有舊配對，解除舊配對
        if (oldPartnerId) {
          await supabase
            .from('members')
            .update({ membership_partner_id: null })
            .eq('id', oldPartnerId)
        }

        // 如果有新配對，建立新配對（雙向）
        if (newPartnerId) {
          await supabase
            .from('members')
            .update({ membership_partner_id: member.id })
            .eq('id', newPartnerId)
        }
      }

      // 3. 如果勾選「記錄到備忘錄」，檢查變更並新增備忘錄
      if (addToMemo) {
        const changes: string[] = []
        const oldStartDate = member.membership_start_date || ''
        const oldEndDate = member.membership_end_date || ''
        const newStartDate = formData.membership_start_date || ''
        const newEndDate = formData.membership_end_date || ''

        if (oldStartDate !== newStartDate) {
          changes.push(`開始 ${oldStartDate || '無'} → ${newStartDate || '無'}`)
        }
        if (oldEndDate !== newEndDate) {
          changes.push(`到期 ${oldEndDate || '無'} → ${newEndDate || '無'}`)
        }

        // 有日期變更或有自訂文字時，新增備忘錄
        if (changes.length > 0 || memoText.trim()) {
          const today = new Date().toISOString().split('T')[0]
          let description = ''
          
          if (changes.length > 0) {
            description = `修改會籍日期：${changes.join('、')}`
          }
          if (memoText.trim()) {
            description = description ? `${description}（${memoText.trim()}）` : memoText.trim()
          }
          
          // @ts-ignore
          await supabase.from('member_notes').insert([{
            member_id: member.id,
            event_date: today,
            event_type: '備註',
            description
          }])
        }
      }

      onSuccess()
      onClose()
    } catch (error) {
      console.error('更新失敗:', error)
      toast.error('更新失敗')
    } finally {
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
                onChange={(e) => setFormData({ ...formData, membership_type: e.target.value })}
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
                  style={inputStyle}
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <label style={getLabelStyle(isMobile)}>會員截止日期</label>
                <input
                  type="date"
                  value={formData.membership_end_date}
                  onChange={(e) => setFormData({ ...formData, membership_end_date: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>

            {(formData.membership_start_date !== (member.membership_start_date || '') ||
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
                  配對會員{' '}
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
                  fontWeight: 650,
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
