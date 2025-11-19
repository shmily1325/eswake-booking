import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useResponsive } from '../hooks/useResponsive'
import { getLocalTimestamp } from '../utils/date'

interface AddMemberDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function AddMemberDialog({ open, onClose, onSuccess }: AddMemberDialogProps) {
  const { isMobile } = useResponsive()
  const [loading, setLoading] = useState(false)
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
    notes: '',
  })
  
  const [allMembers, setAllMembers] = useState<Array<{id: string, name: string, nickname: string | null}>>([])
  
  // 載入會員列表（用於配對選擇）
  const loadMembers = async () => {
    const { data } = await supabase
      .from('members')
      .select('id, name, nickname')
      .eq('status', 'active')
      .order('name')
    if (data) setAllMembers(data)
  }
  
  useEffect(() => {
    if (open) loadMembers()
  }, [open])
  
  const [boards, setBoards] = useState<Array<{
    slot_number: string
    expires_at: string
    notes: string
  }>>([])

  const addBoard = () => {
    setBoards([...boards, { slot_number: '', expires_at: '', notes: '' }])
  }

  const removeBoard = (index: number) => {
    setBoards(boards.filter((_, i) => i !== index))
  }

  const updateBoard = (index: number, field: string, value: string) => {
    const newBoards = [...boards]
    newBoards[index] = { ...newBoards[index], [field]: value }
    setBoards(newBoards)
  }

  const inputStyle = {
    width: '100%',
    padding: isMobile ? '12px' : '10px',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    fontSize: isMobile ? '16px' : '14px',
    transition: 'border-color 0.2s',
  }

  const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = '#667eea'
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = '#e0e0e0'
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      alert('請輸入姓名')
      return
    }

    const trimmedPhone = formData.phone.trim()
    if (trimmedPhone && !/^09\d{8}$/.test(trimmedPhone)) {
      alert('電話需為 09 開頭的 10 位數字')
      return
    }

    setLoading(true)
    try {
      // 1. 新增會員
      const { data: newMember, error: memberError } = await supabase
        .from('members')
        .insert([{
          name: formData.name.trim(),
          nickname: formData.nickname.trim() || null,
          birthday: formData.birthday || null,
          phone: formData.phone.trim() || null,
          member_type: 'member',
          membership_type: formData.membership_type,
          membership_start_date: formData.membership_start_date || null,
          membership_end_date: formData.membership_end_date || null,
          membership_partner_id: formData.membership_partner_id || null,
          board_slot_number: formData.board_slot_number.trim() || null,
          board_expiry_date: formData.board_expiry_date || null,
          free_hours: formData.free_hours || 0,
          free_hours_used: 0,
          notes: formData.notes.trim() || null,
          balance: 0,
          designated_lesson_minutes: 0,
          boat_voucher_g23_minutes: 0,
          boat_voucher_g21_minutes: 0,
          status: 'active',
          created_at: getLocalTimestamp()
        }])
        .select()
        .single()

      if (memberError) throw memberError

      // 2. 如果有置板，批量插入置板記錄
      if (boards.length > 0) {
        const boardsToInsert = []
        
        for (const board of boards) {
          if (!board.slot_number) continue
          
          const slotNumber = parseInt(board.slot_number)
          if (isNaN(slotNumber) || slotNumber < 1 || slotNumber > 145) {
            throw new Error(`格位編號 ${board.slot_number} 必須是 1-145 之間的數字`)
          }
          
          boardsToInsert.push({
            member_id: newMember.id,
            slot_number: slotNumber,
            expires_at: board.expires_at || null,
            notes: board.notes.trim() || null,
            status: 'active',
          })
        }

        if (boardsToInsert.length > 0) {
          const { error: boardError } = await supabase
            .from('board_storage')
            .insert(boardsToInsert)

          if (boardError) {
            // 如果格位已被佔用
            if (boardError.code === '23505') {
              throw new Error('有格位已被使用，請檢查格位編號')
            }
            throw boardError
          }
        }
      }

      // 3. 如果選擇了配對會員，更新配對關係（雙向）
      if (formData.membership_partner_id) {
        await supabase
          .from('members')
          .update({ membership_partner_id: newMember.id })
          .eq('id', formData.membership_partner_id)
      }

      onSuccess()
      onClose()
      
      // 重置表單
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
        notes: '',
      })
      setBoards([])
    } catch (error) {
      console.error('新增會員失敗:', error)
      alert('新增會員失敗')
    } finally {
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
      padding: isMobile ? '0' : '20px',
    }}>
      <div style={{
        background: 'white',
        borderRadius: isMobile ? '12px 12px 0 0' : '12px',
        maxWidth: isMobile ? '100%' : '600px',
        width: '100%',
        maxHeight: isMobile ? '95vh' : '90vh',
        overflow: 'auto',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        margin: isMobile ? 'auto 0 0 0' : 'auto',
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
            新增會員
          </h2>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#666',
              padding: '0',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        {/* 表單 */}
        <form onSubmit={handleSubmit}>
          <div style={{ padding: isMobile ? '16px' : '20px' }}>
            {/* 姓名 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                姓名 <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="請輸入姓名"
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
                required
              />
            </div>

            {/* 暱稱 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#666' }}>
                暱稱 <span style={{ fontSize: '13px' }}>（選填，可輸入多個）</span>
              </label>
              <input
                type="text"
                value={formData.nickname}
                onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                placeholder="例如：阿明+那個男人"
                maxLength={100}
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

            {/* 生日 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#666' }}>
                生日 <span style={{ fontSize: '13px' }}>（選填）</span>
              </label>
              <input
                type="date"
                value={formData.birthday}
                onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

            {/* 電話 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#666' }}>
                電話 <span style={{ fontSize: '13px' }}>（選填）</span>
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="請輸入電話"
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

            {/* 會籍類型 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                會籍類型 <span style={{ color: 'red' }}>*</span>
              </label>
              <select
                value={formData.membership_type}
                onChange={(e) => setFormData({ ...formData, membership_type: e.target.value })}
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
                required
              >
                <option value="general">會員</option>
                <option value="dual">雙人會員</option>
                <option value="board">非會員</option>
              </select>
            </div>

            {/* 會員日期 */}
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: '12px',
              marginBottom: '16px'
            }}>
              {/* 會員開始日期 */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#666' }}>
                  會員開始日期 <span style={{ fontSize: '13px' }}>（選填）</span>
                </label>
                <input
                  type="date"
                  value={formData.membership_start_date}
                  onChange={(e) => setFormData({ ...formData, membership_start_date: e.target.value })}
                  style={inputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
              </div>

              {/* 會員截止日期 */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#666' }}>
                  會員截止日期 <span style={{ fontSize: '13px' }}>（選填）</span>
                </label>
                <input
                  type="date"
                  value={formData.membership_end_date}
                  onChange={(e) => setFormData({ ...formData, membership_end_date: e.target.value })}
                  style={inputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
              </div>
            </div>

            {/* 配對會員 - 只在選擇「雙人會籍」時顯示 */}
            {formData.membership_type === 'dual' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#2196F3' }}>
                  🔗 配對會員 <span style={{ fontSize: '13px' }}>（選填）</span>
                </label>
                <select
                  value={formData.membership_partner_id}
                  onChange={(e) => setFormData({ ...formData, membership_partner_id: e.target.value })}
                  style={inputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                >
                  <option value="">請選擇配對會員</option>
                  {allMembers.map(member => (
                    <option key={member.id} value={member.id}>
                      {member.nickname || member.name}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                  選擇後將自動建立雙向配對關係
                </div>
              </div>
            )}

            {/* 贈送時數 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#ff9800' }}>
                ⏱️ 贈送時數（分鐘） <span style={{ fontSize: '13px' }}>（選填）</span>
              </label>
              <input
                type="number"
                min="0"
                value={formData.free_hours}
                onChange={(e) => setFormData({ ...formData, free_hours: parseInt(e.target.value) || 0 })}
                placeholder="0"
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

            {/* 置板服務 */}
            <div style={{ 
              marginBottom: '16px',
              padding: '16px',
              background: '#f8f9fa',
              borderRadius: '8px',
              border: '2px solid #e0e0e0'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: boards.length > 0 ? '16px' : '0' }}>
                <span style={{ fontWeight: '500', fontSize: '15px' }}>🏄 置板服務</span>
                <button
                  type="button"
                  onClick={addBoard}
                  style={{
                    padding: '6px 12px',
                    background: 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  + 新增置板
                </button>
              </div>

              {/* 置板列表 */}
              {boards.map((board, index) => (
                <div key={index} style={{
                  marginTop: index > 0 ? '12px' : '0',
                  padding: '12px',
                  background: 'white',
                  borderRadius: '8px',
                  border: '1px solid #e0e0e0'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontWeight: '500', fontSize: '14px' }}>置板 #{index + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeBoard(index)}
                      style={{
                        padding: '4px 10px',
                        background: '#f44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      刪除
                    </button>
                  </div>

                  {/* 格位編號 */}
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '13px' }}>
                      格位編號 <span style={{ color: 'red' }}>*</span>
                      <span style={{ fontSize: '12px', color: '#999', marginLeft: '8px' }}>（1-145）</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="145"
                      value={board.slot_number}
                      onChange={(e) => updateBoard(index, 'slot_number', e.target.value)}
                      placeholder="請輸入格位編號"
                      style={{...inputStyle, fontSize: '14px', padding: '8px'}}
                    />
                  </div>

                  {/* 置板到期 */}
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '13px', color: '#666' }}>
                      置板到期 <span style={{ fontSize: '12px' }}>（選填）</span>
                    </label>
                    <input
                      type="date"
                      value={board.expires_at}
                      onChange={(e) => updateBoard(index, 'expires_at', e.target.value)}
                      style={{...inputStyle, fontSize: '14px', padding: '8px'}}
                    />
                  </div>

                  {/* 置板備註 */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '13px', color: '#666' }}>
                      置板備註 <span style={{ fontSize: '12px' }}>（選填）</span>
                    </label>
                    <input
                      type="text"
                      value={board.notes}
                      onChange={(e) => updateBoard(index, 'notes', e.target.value)}
                      placeholder="例如：有三格"
                      style={{...inputStyle, fontSize: '14px', padding: '8px'}}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* 備註 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#666' }}>
                備註 <span style={{ fontSize: '13px' }}>（選填）</span>
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="請輸入備註"
                rows={3}
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                }}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

            {isMobile && (
              <div style={{ height: '80px' }} />
            )}
          </div>

          {/* 底部按鈕 */}
          <div style={{            padding: isMobile ? '24px 20px calc(40px + env(safe-area-inset-bottom))' : '20px 20px 30px',
            borderTop: '1px solid #e0e0e0',
            display: 'flex',
            gap: isMobile ? '12px' : '12px',
            justifyContent: 'flex-end',
            flexDirection: isMobile ? 'column' : 'row',
            position: 'sticky',
            bottom: 0,
            background: 'white',
            zIndex: 10,
            boxShadow: '0 -4px 16px rgba(0,0,0,0.2)',
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: isMobile ? '16px 24px' : '12px 20px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                background: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: isMobile ? '17px' : '14px',
                minHeight: isMobile ? '52px' : '44px',
                flex: '1',
                fontWeight: isMobile ? '600' : 'normal',
                touchAction: 'manipulation',
              }}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: isMobile ? '16px 24px' : '12px 20px',
                border: 'none',
                borderRadius: '8px',
                background: loading ? '#ccc' : 'linear-gradient(135deg, #5a5a5a 0%, #4a4a4a 100%)',
                color: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: isMobile ? '17px' : '14px',
                fontWeight: 'bold',
                minHeight: isMobile ? '52px' : '44px',
                flex: '1',
                touchAction: 'manipulation',
              }}
            >
              {loading ? '新增中...' : '確認新增'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

