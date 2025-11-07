import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useResponsive } from '../hooks/useResponsive'

interface Member {
  id: string
  name: string
  balance: number
  designated_lesson_minutes: number
  boat_voucher_g23_minutes: number
  boat_voucher_g21_minutes: number
}

interface TransactionDialogProps {
  open: boolean
  member: Member
  onClose: () => void
  onSuccess: () => void
}

export function TransactionDialog({ open, member, onClose, onSuccess }: TransactionDialogProps) {
  const { isMobile } = useResponsive()
  const [loading, setLoading] = useState(false)
  const [transactionType, setTransactionType] = useState<'charge' | 'purchase' | 'consume' | 'refund' | 'adjust'>('charge')
  const [category, setCategory] = useState<'balance' | 'designated_lesson' | 'boat_voucher_g23' | 'boat_voucher_g21' | 'membership' | 'board_storage'>('balance')
  const [amount, setAmount] = useState('')
  const [minutes, setMinutes] = useState('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')

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

  const resetForm = () => {
    setTransactionType('charge')
    setCategory('balance')
    setAmount('')
    setMinutes('')
    setDescription('')
    setNotes('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const numAmount = amount ? parseFloat(amount) : null
      const numMinutes = minutes ? parseInt(minutes) : null

      // 根據交易類型計算新的餘額/分鐘數
      let newBalance = member.balance
      let newDesignatedMinutes = member.designated_lesson_minutes
      let newBoatVoucherG23Minutes = member.boat_voucher_g23_minutes
      let newBoatVoucherG21Minutes = member.boat_voucher_g21_minutes

      // 儲值：增加餘額
      if (transactionType === 'charge' && category === 'balance' && numAmount) {
        newBalance += numAmount
      }

      // 購買：扣除餘額，增加分鐘數
      if (transactionType === 'purchase' && numAmount && numMinutes) {
        newBalance -= Math.abs(numAmount) // 扣除餘額
        if (category === 'designated_lesson') {
          newDesignatedMinutes += Math.abs(numMinutes)
        } else if (category === 'boat_voucher_g23') {
          newBoatVoucherG23Minutes += Math.abs(numMinutes)
        } else if (category === 'boat_voucher_g21') {
          newBoatVoucherG21Minutes += Math.abs(numMinutes)
        }
      }

      // 消耗：扣除餘額或分鐘數
      if (transactionType === 'consume') {
        if (category === 'balance' && numAmount) {
          newBalance -= Math.abs(numAmount)
        } else if (category === 'designated_lesson' && numMinutes) {
          newDesignatedMinutes -= Math.abs(numMinutes)
        } else if (category === 'boat_voucher_g23' && numMinutes) {
          newBoatVoucherG23Minutes -= Math.abs(numMinutes)
        } else if (category === 'boat_voucher_g21' && numMinutes) {
          newBoatVoucherG21Minutes -= Math.abs(numMinutes)
        }
      }

      // 退款：退回餘額或分鐘數
      if (transactionType === 'refund') {
        if (category === 'balance' && numAmount) {
          newBalance += Math.abs(numAmount)
        } else if (category === 'designated_lesson' && numMinutes) {
          newDesignatedMinutes += Math.abs(numMinutes)
        } else if (category === 'boat_voucher_g23' && numMinutes) {
          newBoatVoucherG23Minutes += Math.abs(numMinutes)
        } else if (category === 'boat_voucher_g21' && numMinutes) {
          newBoatVoucherG21Minutes += Math.abs(numMinutes)
        }
      }

      // 調整：直接設定為輸入的值（可以是正負）
      if (transactionType === 'adjust') {
        if (category === 'balance' && numAmount !== null) {
          newBalance = member.balance + numAmount
        } else if (category === 'designated_lesson' && numMinutes !== null) {
          newDesignatedMinutes = member.designated_lesson_minutes + numMinutes
        } else if (category === 'boat_voucher_g23' && numMinutes !== null) {
          newBoatVoucherG23Minutes = member.boat_voucher_g23_minutes + numMinutes
        } else if (category === 'boat_voucher_g21' && numMinutes !== null) {
          newBoatVoucherG21Minutes = member.boat_voucher_g21_minutes + numMinutes
        }
      }

      // 確保不會變成負數
      if (newBalance < 0 || newDesignatedMinutes < 0 || newBoatVoucherG23Minutes < 0 || newBoatVoucherG21Minutes < 0) {
        alert('餘額或分鐘數不足！')
        setLoading(false)
        return
      }

      // 更新會員資料
      const { error: updateError } = await supabase
        .from('members')
        .update({
          balance: newBalance,
          designated_lesson_minutes: newDesignatedMinutes,
          boat_voucher_g23_minutes: newBoatVoucherG23Minutes,
          boat_voucher_g21_minutes: newBoatVoucherG21Minutes,
        })
        .eq('id', member.id)

      if (updateError) throw updateError

      // 準備交易記錄數據，包含船券類型
      const transactionData: any = {
        member_id: member.id,
        transaction_type: transactionType,
        category: category,
        amount: numAmount,
        minutes: numMinutes,
        balance_after: newBalance,
        designated_lesson_minutes_after: newDesignatedMinutes,
        boat_voucher_g23_minutes_after: newBoatVoucherG23Minutes,
        boat_voucher_g21_minutes_after: newBoatVoucherG21Minutes,
        description: description || getDefaultDescription(),
        notes: notes || null,
      }

      // 如果是船券相關，記錄船券類型
      if (category === 'boat_voucher_g23') {
        transactionData.boat_type = 'g23'
      } else if (category === 'boat_voucher_g21') {
        transactionData.boat_type = 'g21'
      }

      // 記錄交易
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert([transactionData])

      if (transactionError) throw transactionError

      alert('記賬成功！')
      resetForm()
      onSuccess()
      onClose()
    } catch (error) {
      console.error('記賬失敗:', error)
      alert('記賬失敗')
    } finally {
      setLoading(false)
    }
  }

  const getDefaultDescription = () => {
    const typeLabels = {
      charge: '儲值',
      purchase: '購買',
      consume: '消耗',
      refund: '退款',
      adjust: '調整',
    }
    const categoryLabels: Record<string, string> = {
      balance: '餘額',
      designated_lesson: '指定課',
      boat_voucher_g23: 'G23 船券',
      boat_voucher_g21: 'G21/黑豹 船券',
      membership: '會籍',
      board_storage: '置板',
    }
    return `${typeLabels[transactionType]} - ${categoryLabels[category]}`
  }

  if (!open) return null

  // 根據交易類型和類別決定顯示哪些輸入框
  const showAmount = category === 'balance' || transactionType === 'purchase'
  const showMinutes = (category === 'designated_lesson' || category === 'boat_voucher_g23' || category === 'boat_voucher_g21')

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
            💳 記賬 - {member.name}
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

        {/* 當前餘額顯示 */}
        <div style={{
          padding: '15px 20px',
          background: '#f8f9fa',
          borderBottom: '1px solid #e0e0e0',
        }}>
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>當前餘額</div>
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
            <div>
              <span style={{ fontWeight: 'bold', color: '#1890ff', fontSize: '18px' }}>
                ${member.balance.toFixed(0)}
              </span>
              <span style={{ color: '#999', fontSize: '13px', marginLeft: '5px' }}>餘額</span>
            </div>
            <div>
              <span style={{ fontWeight: 'bold', color: '#faad14', fontSize: '18px' }}>
                {member.designated_lesson_minutes}
              </span>
              <span style={{ color: '#999', fontSize: '13px', marginLeft: '5px' }}>分鐘 (指定課)</span>
            </div>
            <div>
              <span style={{ fontWeight: 'bold', color: '#52c41a', fontSize: '18px' }}>
                {member.boat_voucher_g23_minutes}
              </span>
              <span style={{ color: '#999', fontSize: '13px', marginLeft: '5px' }}>分鐘 (G23船券)</span>
            </div>
            <div>
              <span style={{ fontWeight: 'bold', color: '#13c2c2', fontSize: '18px' }}>
                {member.boat_voucher_g21_minutes}
              </span>
              <span style={{ color: '#999', fontSize: '13px', marginLeft: '5px' }}>分鐘 (G21船券)</span>
            </div>
          </div>
        </div>

        {/* 表單 */}
        <form onSubmit={handleSubmit}>
          <div style={{ padding: isMobile ? '16px' : '20px' }}>
            {/* 交易類型 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                交易類型 <span style={{ color: 'red' }}>*</span>
              </label>
              <select
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value as any)}
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
                required
              >
                <option value="charge">儲值 💰</option>
                <option value="purchase">購買 🛒</option>
                <option value="consume">消耗 💸</option>
                <option value="refund">退款 ↩️</option>
                <option value="adjust">調整 🔧</option>
              </select>
            </div>

            {/* 類別 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                類別 <span style={{ color: 'red' }}>*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
                required
              >
                <option value="balance">餘額</option>
                <option value="designated_lesson">指定課</option>
                <option value="boat_voucher_g23">🚤 G23 船券</option>
                <option value="boat_voucher_g21">⛵ G21/黑豹 船券</option>
                <option value="membership">會籍</option>
                <option value="board_storage">置板</option>
              </select>
            </div>

            {/* 金額 */}
            {showAmount && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  金額 (元) <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={transactionType === 'adjust' ? '輸入正數增加，負數減少' : '請輸入金額'}
                  style={inputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  step="0.01"
                  required
                />
              </div>
            )}

            {/* 分鐘數 */}
            {showMinutes && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  分鐘數 <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="number"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  placeholder={transactionType === 'adjust' ? '輸入正數增加，負數減少' : '請輸入分鐘數'}
                  style={inputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  step="1"
                  required
                />
              </div>
            )}

            {/* 購買時需要同時輸入金額和分鐘數 */}
            {transactionType === 'purchase' && showMinutes && (
              <div style={{
                padding: '12px',
                background: '#fff7e6',
                border: '1px solid #ffd591',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '13px',
                color: '#ad6800',
              }}>
                💡 購買時會扣除「金額」欄位的餘額，並增加「分鐘數」欄位的分鐘數
              </div>
            )}

            {/* 說明 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                說明
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={`預設：${getDefaultDescription()}`}
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

            {/* 備註 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                備註
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="選填"
                rows={2}
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                }}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

            {/* 操作說明 */}
            <div style={{
              padding: '12px',
              background: '#e6f7ff',
              border: '1px solid #91d5ff',
              borderRadius: '8px',
              fontSize: '13px',
              color: '#096dd9',
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>💡 操作說明</div>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                <li><strong>儲值</strong>：增加餘額</li>
                <li><strong>購買</strong>：扣除餘額，增加指定課/船券分鐘數</li>
                <li><strong>消耗</strong>：扣除餘額或分鐘數</li>
                <li><strong>退款</strong>：退回餘額或分鐘數</li>
                <li><strong>調整</strong>：手動調整任何數值（輸入正負數）</li>
              </ul>
            </div>
          </div>

          {/* 底部按鈕 */}
          <div style={{
            padding: '20px',
            borderTop: '1px solid #e0e0e0',
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
            position: 'sticky',
            bottom: 0,
            background: 'white',
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '10px 20px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                background: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
              }}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderRadius: '6px',
                background: loading ? '#ccc' : 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                color: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
              }}
            >
              {loading ? '處理中...' : '確認記賬'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

