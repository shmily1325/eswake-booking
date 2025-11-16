import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useResponsive } from '../hooks/useResponsive'

interface Member {
  id: string
  name: string
  nickname: string | null
  balance: number
  vip_voucher_amount: number
  designated_lesson_minutes: number
  boat_voucher_g23_minutes: number
  boat_voucher_g21_panther_minutes: number
  gift_boat_hours: number
}

interface TransactionDialogProps {
  open: boolean
  member: Member
  onClose: () => void
  onSuccess: () => void
}

interface Transaction {
  id: number
  created_at: string
  category: string
  adjust_type: string
  amount: number | null
  minutes: number | null
  description: string
  notes: string | null
  balance_after: number
  vip_voucher_amount_after: number
  designated_lesson_minutes_after: number
  boat_voucher_g23_minutes_after: number
  boat_voucher_g21_panther_minutes_after: number
  gift_boat_hours_after: number
}

// 六個項目的配置
const CATEGORIES = [
  { value: 'balance', label: '💰 儲值', unit: '元', type: 'amount' },
  { value: 'vip_voucher', label: '💎 VIP票券', unit: '元', type: 'amount' },
  { value: 'designated_lesson', label: '📚 指定課', unit: '分', type: 'minutes' },
  { value: 'boat_voucher_g23', label: '🚤 G23船券', unit: '分', type: 'minutes' },
  { value: 'boat_voucher_g21_panther', label: '⛵ G21/黑豹', unit: '分', type: 'minutes' },
  { value: 'gift_boat_hours', label: '🎁 贈送大船', unit: '分', type: 'minutes' },
]

export function TransactionDialog({ open, member, onClose, onSuccess }: TransactionDialogProps) {
  const { isMobile } = useResponsive()
  const [activeTab, setActiveTab] = useState<'transaction' | 'history'>('transaction')
  const [loading, setLoading] = useState(false)
  
  // 表單狀態
  const [category, setCategory] = useState('balance')
  const [adjustType, setAdjustType] = useState<'increase' | 'decrease'>('increase')
  const [value, setValue] = useState('')
  const [notes, setNotes] = useState('')
  
  // 交易記錄相關
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [loadingHistory, setLoadingHistory] = useState(false)

  const inputStyle = {
    width: '100%',
    padding: isMobile ? '12px' : '10px',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    fontSize: isMobile ? '16px' : '14px',
    transition: 'border-color 0.2s',
  }

  const resetForm = () => {
    setCategory('balance')
    setAdjustType('increase')
    setValue('')
    setNotes('')
  }

  // 加載交易記錄
  const loadTransactions = async () => {
    if (!selectedMonth) return
    
    setLoadingHistory(true)
    try {
      const [year, month] = selectedMonth.split('-')
      const startDate = `${year}-${month}-01`
      const endDate = new Date(parseInt(year), parseInt(month), 0).getDate()
      const endDateStr = `${year}-${month}-${String(endDate).padStart(2, '0')}`

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('member_id', member.id)
        .gte('created_at', startDate)
        .lte('created_at', endDateStr + 'T23:59:59')
        .order('created_at', { ascending: false })

      if (error) throw error
      setTransactions(data || [])
    } catch (error: any) {
      console.error('加載交易記錄失敗:', error)
      alert('加載交易記錄失敗')
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => {
    if (open && activeTab === 'history') {
      loadTransactions()
    }
  }, [open, activeTab, selectedMonth])

  useEffect(() => {
    if (!open) {
      resetForm()
      setActiveTab('transaction')
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const numValue = parseFloat(value)
    if (!numValue || numValue <= 0) {
      alert('請輸入有效的數值')
      return
    }

    setLoading(true)
    try {
      // 計算新值
      const delta = adjustType === 'increase' ? numValue : -numValue
      let updates: any = {}
      let afterValues: any = {
        balance_after: member.balance,
        vip_voucher_amount_after: member.vip_voucher_amount,
        designated_lesson_minutes_after: member.designated_lesson_minutes,
        boat_voucher_g23_minutes_after: member.boat_voucher_g23_minutes,
        boat_voucher_g21_panther_minutes_after: member.boat_voucher_g21_panther_minutes,
        gift_boat_hours_after: member.gift_boat_hours,
      }

      switch (category) {
        case 'balance':
          updates.balance = member.balance + delta
          afterValues.balance_after = updates.balance
          break
        case 'vip_voucher':
          updates.vip_voucher_amount = member.vip_voucher_amount + delta
          afterValues.vip_voucher_amount_after = updates.vip_voucher_amount
          break
        case 'designated_lesson':
          updates.designated_lesson_minutes = member.designated_lesson_minutes + delta
          afterValues.designated_lesson_minutes_after = updates.designated_lesson_minutes
          break
        case 'boat_voucher_g23':
          updates.boat_voucher_g23_minutes = member.boat_voucher_g23_minutes + delta
          afterValues.boat_voucher_g23_minutes_after = updates.boat_voucher_g23_minutes
          break
        case 'boat_voucher_g21_panther':
          updates.boat_voucher_g21_panther_minutes = member.boat_voucher_g21_panther_minutes + delta
          afterValues.boat_voucher_g21_panther_minutes_after = updates.boat_voucher_g21_panther_minutes
          break
        case 'gift_boat_hours':
          updates.gift_boat_hours = member.gift_boat_hours + delta
          afterValues.gift_boat_hours_after = updates.gift_boat_hours
          break
      }

      // 檢查是否會變成負數
      const newValue = Object.values(updates)[0] as number
      if (newValue < 0) {
        alert('餘額或時數不足，無法減少！')
        setLoading(false)
        return
      }

      // 更新會員資料
      const { error: updateError } = await supabase
        .from('members')
        .update(updates)
        .eq('id', member.id)

      if (updateError) throw updateError

      // 記錄交易
      const categoryConfig = CATEGORIES.find(c => c.value === category)
      const now = new Date()
      const createdAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
      
      const description = `${adjustType === 'increase' ? '增加' : '減少'} ${categoryConfig?.label} ${numValue}${categoryConfig?.unit}`
      
      const transactionData: any = {
        member_id: member.id,
        transaction_type: 'adjust',
        category: category,
        adjust_type: adjustType,
        amount: categoryConfig?.type === 'amount' ? numValue : null,
        minutes: categoryConfig?.type === 'minutes' ? numValue : null,
        description: description,
        notes: notes || null,
        created_at: createdAt,
        ...afterValues
      }

      const { error: transactionError } = await supabase
        .from('transactions')
        .insert([transactionData])

      if (transactionError) throw transactionError

      alert('記帳成功！')
      resetForm()
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('記帳失敗:', error)
      alert(`記帳失敗：${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const selectedCategory = CATEGORIES.find(c => c.value === category)

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
            💳 {member.nickname || member.name}
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

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #e0e0e0',
          background: 'white',
          position: 'sticky',
          top: '61px',
          zIndex: 1,
        }}>
          <button
            onClick={() => setActiveTab('transaction')}
            style={{
              flex: 1,
              padding: '12px',
              border: 'none',
              background: activeTab === 'transaction' ? 'white' : '#f8f9fa',
              borderBottom: activeTab === 'transaction' ? '2px solid #424242' : '2px solid transparent',
              color: activeTab === 'transaction' ? '#424242' : '#999',
              fontSize: '14px',
              fontWeight: activeTab === 'transaction' ? 'bold' : 'normal',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            💰 記帳
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              flex: 1,
              padding: '12px',
              border: 'none',
              background: activeTab === 'history' ? 'white' : '#f8f9fa',
              borderBottom: activeTab === 'history' ? '2px solid #424242' : '2px solid transparent',
              color: activeTab === 'history' ? '#424242' : '#999',
              fontSize: '14px',
              fontWeight: activeTab === 'history' ? 'bold' : 'normal',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            📊 查帳
          </button>
        </div>

        {/* 記帳 Tab */}
        {activeTab === 'transaction' && (
          <div style={{ padding: '20px' }}>
            {/* 會員餘額顯示 */}
            <div style={{
              background: '#f8f9fa',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '20px',
            }}>
              <div style={{ fontSize: '13px', color: '#666', marginBottom: '12px', fontWeight: '600' }}>
                📊 當前餘額
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px',
                fontSize: '13px',
              }}>
                <div>
                  <div style={{ color: '#999', marginBottom: '4px' }}>💰 儲值</div>
                  <div style={{ fontWeight: 'bold', color: '#333' }}>${member.balance.toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ color: '#999', marginBottom: '4px' }}>💎 VIP票券</div>
                  <div style={{ fontWeight: 'bold', color: '#333' }}>${member.vip_voucher_amount.toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ color: '#999', marginBottom: '4px' }}>📚 指定課</div>
                  <div style={{ fontWeight: 'bold', color: '#333' }}>{member.designated_lesson_minutes.toLocaleString()}分</div>
                </div>
                <div>
                  <div style={{ color: '#999', marginBottom: '4px' }}>🚤 G23船券</div>
                  <div style={{ fontWeight: 'bold', color: '#333' }}>{member.boat_voucher_g23_minutes.toLocaleString()}分</div>
                </div>
                <div>
                  <div style={{ color: '#999', marginBottom: '4px' }}>⛵ G21/黑豹</div>
                  <div style={{ fontWeight: 'bold', color: '#333' }}>{member.boat_voucher_g21_panther_minutes.toLocaleString()}分</div>
                </div>
                <div>
                  <div style={{ color: '#999', marginBottom: '4px' }}>🎁 贈送大船</div>
                  <div style={{ fontWeight: 'bold', color: '#333' }}>{member.gift_boat_hours.toLocaleString()}分</div>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              {/* 選擇項目 */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}>
                  項目 *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={inputStyle}
                  required
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 選擇操作 */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}>
                  操作 *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setAdjustType('increase')}
                    style={{
                      padding: '12px',
                      border: adjustType === 'increase' ? '2px solid #4caf50' : '2px solid #e0e0e0',
                      borderRadius: '8px',
                      background: adjustType === 'increase' ? '#e8f5e9' : 'white',
                      color: adjustType === 'increase' ? '#4caf50' : '#666',
                      fontSize: '14px',
                      fontWeight: adjustType === 'increase' ? '600' : 'normal',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    ➕ 增加
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('decrease')}
                    style={{
                      padding: '12px',
                      border: adjustType === 'decrease' ? '2px solid #f44336' : '2px solid #e0e0e0',
                      borderRadius: '8px',
                      background: adjustType === 'decrease' ? '#ffebee' : 'white',
                      color: adjustType === 'decrease' ? '#f44336' : '#666',
                      fontSize: '14px',
                      fontWeight: adjustType === 'decrease' ? '600' : 'normal',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    ➖ 減少
                  </button>
                </div>
              </div>

              {/* 輸入數值 */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}>
                  {selectedCategory?.type === 'amount' ? '金額 (元)' : '時數 (分鐘)'} *
                </label>
                <input
                  type="number"
                  min="0"
                  step={selectedCategory?.type === 'amount' ? '1' : '1'}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={`請輸入${selectedCategory?.type === 'amount' ? '金額' : '分鐘數'}`}
                  style={inputStyle}
                  required
                />
              </div>

              {/* 備註 */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}>
                  備註
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="選填：記錄原因或其他說明"
                  style={{
                    ...inputStyle,
                    minHeight: '80px',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* 提交按鈕 */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: loading ? '#ccc' : '#424242',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (!loading) e.currentTarget.style.background = '#212121'
                }}
                onMouseLeave={(e) => {
                  if (!loading) e.currentTarget.style.background = '#424242'
                }}
              >
                {loading ? '處理中...' : '確認記帳'}
              </button>
            </form>
          </div>
        )}

        {/* 查帳 Tab */}
        {activeTab === 'history' && (
          <div style={{ padding: '20px' }}>
            {/* 月份選擇 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}>
                選擇月份
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* 交易記錄列表 */}
            {loadingHistory ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                載入中...
              </div>
            ) : transactions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                本月無交易記錄
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {transactions.map((tx) => {
                  const categoryConfig = CATEGORIES.find(c => c.value === tx.category)
                  const isIncrease = tx.adjust_type === 'increase'
                  
                  return (
                    <div
                      key={tx.id}
                      style={{
                        background: '#f8f9fa',
                        padding: '14px',
                        borderRadius: '8px',
                        borderLeft: `4px solid ${isIncrease ? '#4caf50' : '#f44336'}`,
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '8px',
                      }}>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
                            {categoryConfig?.label}
                          </div>
                          <div style={{ fontSize: '12px', color: '#999' }}>
                            {new Date(tx.created_at).toLocaleString('zh-TW', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>
                        <div style={{
                          fontSize: '18px',
                          fontWeight: 'bold',
                          color: isIncrease ? '#4caf50' : '#f44336',
                        }}>
                          {isIncrease ? '+' : '-'}{tx.amount ? `$${tx.amount.toLocaleString()}` : `${tx.minutes}分`}
                        </div>
                      </div>
                      {tx.notes && (
                        <div style={{
                          fontSize: '13px',
                          color: '#666',
                          marginTop: '8px',
                          padding: '8px',
                          background: 'white',
                          borderRadius: '4px',
                        }}>
                          💬 {tx.notes}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
