import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useResponsive } from '../hooks/useResponsive'

// =============================================
// 船券方案設定（每年可調整）
// =============================================
const BOAT_VOUCHER_PLANS = {
  PLAN_10H: 600,   // 10小時本 = 600分鐘
  PLAN_20H: 1200,  // 20小時本 = 1200分鐘
}

interface Member {
  id: string
  name: string
  nickname: string | null
  balance: number
  vip_voucher_amount: number  // VIP 票券
  designated_lesson_minutes: number
  boat_voucher_g23_minutes: number
  boat_voucher_g21_panther_minutes: number  // G21/黑豹船券
  gift_boat_hours: number  // 贈送大船時數
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
  transaction_type: string
  category: string
  amount: number | null
  minutes: number | null
  description: string
  notes: string | null
  payment_method: string | null
  adjust_type: string | null
  balance_after: number
  designated_lesson_minutes_after: number
  boat_voucher_g23_minutes_after: number
  boat_voucher_g21_panther_minutes_after: number
}

export function TransactionDialog({ open, member, onClose, onSuccess }: TransactionDialogProps) {
  const { isMobile } = useResponsive()
  const [activeTab, setActiveTab] = useState<'transaction' | 'history'>('transaction')
  const [loading, setLoading] = useState(false)
  const [transactionType, setTransactionType] = useState<'charge' | 'purchase' | 'payment' | 'refund' | 'adjust'>('charge')
  const [category, setCategory] = useState<'balance' | 'designated_lesson' | 'boat_voucher_g23' | 'boat_voucher_g21_panther' | 'gift_boat_hours' | 'vip_voucher' | 'membership' | 'board_storage'>('balance')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'deduct_balance' | 'g23_voucher' | 'g21_panther_voucher' | 'designated_paid' | 'designated_free' | 'gift_hours'>('cash')
  const [adjustType, setAdjustType] = useState<'increase' | 'decrease'>('increase')
  const [amount, setAmount] = useState('')
  const [minutes, setMinutes] = useState('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  
  // 交易記錄相關狀態
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

  const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = '#667eea'
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = '#e0e0e0'
  }

  const resetForm = () => {
    setTransactionType('charge')
    setCategory('balance')
    setPaymentMethod('cash')
    setAdjustType('increase')
    setAmount('')
    setMinutes('')
    setDescription('')
    setNotes('')
  }

  // 加載交易記錄
  const loadTransactions = async () => {
    if (!selectedMonth) return
    
    setLoadingHistory(true)
    try {
      const [year, month] = selectedMonth.split('-')
      const startDate = `${year}-${month}-01`
      const endDate = `${year}-${month}-${new Date(parseInt(year), parseInt(month), 0).getDate()}`
      
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('member_id', member.id)
        .gte('created_at', startDate)
        .lte('created_at', endDate + 'T23:59:59')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setTransactions(data || [])
    } catch (error) {
      console.error('載入交易記錄失敗:', error)
      alert('載入交易記錄失敗')
    } finally {
      setLoadingHistory(false)
    }
  }

  // 匯出交易記錄
  const exportTransactions = () => {
    if (transactions.length === 0) {
      alert('沒有交易記錄可匯出')
      return
    }

    const csv = [
      ['日期', '交易類型', '類別', '付款方式', '金額', '分鐘數', '說明', '備註', '餘額', '指定課', 'G23船券', 'G21船券'].join(','),
      ...transactions.map(t => [
        t.created_at.split('T')[0],
        getTypeLabel(t.transaction_type),
        getCategoryLabel(t.category),
        t.payment_method || '',
        t.amount || '',
        t.minutes || '',
        `"${t.description || ''}"`,
        `"${t.notes || ''}"`,
        t.balance_after,
        t.designated_lesson_minutes_after,
        t.boat_voucher_g23_minutes_after,
        t.boat_voucher_g21_panther_minutes_after
      ].join(','))
    ].join('\n')

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${member.name}_交易記錄_${selectedMonth}.csv`
    link.click()
  }

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      charge: '儲值',
      purchase: '購買',
      payment: '付款',
      refund: '退款',
      adjust: '調整',
    }
    return labels[type] || type
  }

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      balance: '餘額',
      designated_lesson: '指定課',
      boat_voucher_g23: 'G23船券',
      boat_voucher_g21_panther: 'G21/黑豹船券',
      gift_boat_hours: '贈送大船時數',
      vip_voucher: 'VIP票券',
      membership: '會籍',
      board_storage: '置板',
    }
    return labels[category] || category
  }

  // 當月份改變時重新載入
  useEffect(() => {
    if (open && activeTab === 'history') {
      loadTransactions()
    }
  }, [selectedMonth, open, activeTab, member.id])

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
      let newBoatVoucherG21PantherMinutes = member.boat_voucher_g21_panther_minutes
      let newGiftBoatHours = member.gift_boat_hours

      // 儲值：增加餘額
      if (transactionType === 'charge' && category === 'balance' && numAmount) {
        newBalance += numAmount
      }

      // 購買：增加分鐘數（船券/指定課/贈送時數）
      if (transactionType === 'purchase') {
        if (numMinutes) {
          if (category === 'designated_lesson') {
            newDesignatedMinutes += Math.abs(numMinutes)
          } else if (category === 'boat_voucher_g23') {
            newBoatVoucherG23Minutes += Math.abs(numMinutes)
          } else if (category === 'boat_voucher_g21_panther') {
            newBoatVoucherG21PantherMinutes += Math.abs(numMinutes)
          } else if (category === 'gift_boat_hours') {
            newGiftBoatHours += Math.abs(numMinutes)
          }
        }
        // 如果有輸入金額，則扣除餘額
        if (numAmount) {
          newBalance -= Math.abs(numAmount)
        }
      }

      // 付款：根據付款方式扣除對應的儲值
      if (transactionType === 'payment') {
        if (paymentMethod === 'cash' || paymentMethod === 'transfer') {
          // 現金或匯款：不扣除任何儲值餘額（客人直接付現）
          // 金額欄位只是記錄收了多少錢
        } else if (paymentMethod === 'deduct_balance' && numAmount) {
          // 扣儲值：扣除餘額
          newBalance -= Math.abs(numAmount)
        } else if (paymentMethod === 'g23_voucher' && numMinutes) {
          // G23船券：扣除G23船券分鐘數
          newBoatVoucherG23Minutes -= Math.abs(numMinutes)
        } else if (paymentMethod === 'g21_panther_voucher' && numMinutes) {
          // G21/黑豹船券：扣除船券分鐘數
          newBoatVoucherG21PantherMinutes -= Math.abs(numMinutes)
        } else if (paymentMethod === 'designated_paid' && numMinutes) {
          // 指定課程（收費）：扣除指定課分鐘數
          newDesignatedMinutes -= Math.abs(numMinutes)
        } else if (paymentMethod === 'designated_free' && numMinutes) {
          // 指定課程（免費）：扣除指定課分鐘數
          newDesignatedMinutes -= Math.abs(numMinutes)
        } else if (paymentMethod === 'gift_hours' && numMinutes) {
          // 贈送大船時數：扣除時數
          newGiftBoatHours -= Math.abs(numMinutes)
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
        } else if (category === 'boat_voucher_g21_panther' && numMinutes) {
          newBoatVoucherG21PantherMinutes += Math.abs(numMinutes)
        } else if (category === 'gift_boat_hours' && numMinutes) {
          // 退款贈送時數：增加時數
          newGiftBoatHours += Math.abs(numMinutes)
        }
      }

      // 調整：根據 adjustType 增加或減少
      if (transactionType === 'adjust') {
        const adjustAmount = adjustType === 'increase' ? Math.abs(numAmount || 0) : -Math.abs(numAmount || 0)
        const adjustMinutes = adjustType === 'increase' ? Math.abs(numMinutes || 0) : -Math.abs(numMinutes || 0)
        
        if (category === 'balance' && numAmount !== null) {
          newBalance = member.balance + adjustAmount
        } else if (category === 'designated_lesson' && numMinutes !== null) {
          newDesignatedMinutes = member.designated_lesson_minutes + adjustMinutes
        } else if (category === 'boat_voucher_g23' && numMinutes !== null) {
          newBoatVoucherG23Minutes = member.boat_voucher_g23_minutes + adjustMinutes
        } else if (category === 'boat_voucher_g21_panther' && numMinutes !== null) {
          newBoatVoucherG21PantherMinutes = member.boat_voucher_g21_panther_minutes + adjustMinutes
        } else if (category === 'gift_boat_hours' && numMinutes !== null) {
          // 調整贈送大船時數
          newGiftBoatHours = member.gift_boat_hours + adjustMinutes
        }
      }

      // 確保不會變成負數
      if (newBalance < 0 || newDesignatedMinutes < 0 || newBoatVoucherG23Minutes < 0 || newBoatVoucherG21PantherMinutes < 0 || newGiftBoatHours < 0) {
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
          boat_voucher_g21_panther_minutes: newBoatVoucherG21PantherMinutes,
          gift_boat_hours: newGiftBoatHours,
        })
        .eq('id', member.id)

      if (updateError) throw updateError

      // 準備交易記錄數據，包含船券類型、付款方式、調整類型
      const now = new Date()
      const createdAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
      
      const transactionData: any = {
        member_id: member.id,
        transaction_type: transactionType,
        category: category,
        amount: numAmount,
        minutes: numMinutes,
        balance_after: newBalance,
        designated_lesson_minutes_after: newDesignatedMinutes,
        boat_voucher_g23_minutes_after: newBoatVoucherG23Minutes,
        boat_voucher_g21_panther_minutes_after: newBoatVoucherG21PantherMinutes,
        description: description || getDefaultDescription(),
        notes: notes || null,
        created_at: createdAt,
      }

      // 如果是付款，記錄付款方式
      if (transactionType === 'payment') {
        transactionData.payment_method = paymentMethod
      }

      // 如果是調整，記錄調整類型
      if (transactionType === 'adjust') {
        transactionData.adjust_type = adjustType
      }

      // 記錄交易
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert([transactionData])

      if (transactionError) throw transactionError
      resetForm()
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('記帳失敗:', error)
      const errorMessage = error?.message || error?.toString() || '未知錯誤'
      alert(`記帳失敗：${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  const getDefaultDescription = () => {
    const typeLabels = {
      charge: '儲值',
      purchase: '購買',
      payment: '付款',
      refund: '退款',
      adjust: '調整',
    }
    const categoryLabels: Record<string, string> = {
      balance: '餘額',
      designated_lesson: '指定課',
      boat_voucher_g23: 'G23 船券',
      boat_voucher_g21_panther: 'G21/黑豹 船券',
      membership: '會籍',
      board_storage: '置板',
    }
    
    let desc = `${typeLabels[transactionType]} - ${categoryLabels[category]}`
    
    // 如果是付款，加上付款方式
    if (transactionType === 'payment') {
      const paymentLabels: Record<string, string> = {
        cash: '現金',
        transfer: '匯款',
        deduct_balance: '扣儲值',
        g23_voucher: 'G23船券',
        g21_voucher: 'G21船券',
        designated_paid: '指定課程（收費）',
        designated_free: '指定課程（免費）',
      }
      desc += ` (${paymentLabels[paymentMethod]})`
    }
    
    // 如果是調整，加上調整類型
    if (transactionType === 'adjust') {
      desc += ` (${adjustType === 'increase' ? '增加' : '減少'})`
    }
    
    return desc
  }

  if (!open) return null

  // 根據交易類型和類別決定顯示哪些輸入框
  const showAmount = category === 'balance'
  const showMinutes = (category === 'designated_lesson' || category === 'boat_voucher_g23' || category === 'boat_voucher_g21_panther' || category === 'gift_boat_hours')
  
  // 購買船券/指定課時，金額是選填（如果要從儲值扣款才填）
  const amountOptional = transactionType === 'purchase' && showMinutes

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
              borderBottom: activeTab === 'transaction' ? '2px solid #667eea' : '2px solid transparent',
              color: activeTab === 'transaction' ? '#667eea' : '#999',
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
              borderBottom: activeTab === 'history' ? '2px solid #667eea' : '2px solid transparent',
              color: activeTab === 'history' ? '#667eea' : '#999',
              fontSize: '14px',
              fontWeight: activeTab === 'history' ? 'bold' : 'normal',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            📊 查帳
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
                {member.boat_voucher_g21_panther_minutes}
              </span>
              <span style={{ color: '#999', fontSize: '13px', marginLeft: '5px' }}>分鐘 (G21船券)</span>
            </div>
          </div>

          {isMobile && (
            <div style={{ height: '80px' }} />
          )}
        </div>

        {/* 記帳表單 */}
        {activeTab === 'transaction' && (
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
                <option value="payment">付款 💸</option>
                <option value="refund">退款 ↩️</option>
                <option value="adjust">調整 🔧</option>
              </select>
            </div>

            {/* 付款方式（僅在選擇「付款」時顯示） */}
            {transactionType === 'payment' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  付款方式 <span style={{ color: 'red' }}>*</span>
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  style={inputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  required
                >
                  <option value="cash">現金</option>
                  <option value="transfer">匯款</option>
                  <option value="deduct_balance">扣儲值</option>
                  <option value="g23_voucher">G23船券</option>
                  <option value="g21_voucher">G21船券</option>
                  <option value="designated_paid">指定課程（收費）</option>
                  <option value="designated_free">指定課程（免費）</option>
                  <option value="gift_boat_hours">贈送大船時數</option>
                  <option value="vip_voucher">VIP票券</option>
                </select>
              </div>
            )}

            {/* 調整類型（僅在選擇「調整」時顯示） */}
            {transactionType === 'adjust' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  調整類型 <span style={{ color: 'red' }}>*</span>
                </label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as any)}
                  style={inputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  required
                >
                  <option value="increase">增加餘額 ⬆️</option>
                  <option value="decrease">減少餘額 ⬇️</option>
                </select>
              </div>
            )}

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
                <option value="boat_voucher_g21_panther">⛵ G21/黑豹 船券</option>
                <option value="gift_hours">⏱️ 贈送大船時數</option>
                <option value="membership">會籍</option>
                <option value="board_storage">置板</option>
              </select>
            </div>

            {/* 金額 */}
            {(showAmount || amountOptional) && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  金額 (元) {amountOptional ? <span style={{ color: '#999', fontSize: '13px' }}>（選填，若從儲值扣款才填）</span> : <span style={{ color: 'red' }}>*</span>}
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={amountOptional ? '選填：若要從儲值扣款才填寫' : (transactionType === 'adjust' ? '輸入正數增加，負數減少' : '請輸入金額')}
                  style={inputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  step="0.01"
                  required={!amountOptional}
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
                
                {/* 船券快捷按鈕 */}
                {transactionType === 'purchase' && (category === 'boat_voucher_g23' || category === 'boat_voucher_g21_panther') && (
                  <div style={{ 
                    display: 'flex', 
                    gap: '8px', 
                    marginTop: '10px',
                    flexWrap: 'wrap'
                  }}>
                    <button
                      type="button"
                      onClick={() => setMinutes(BOAT_VOUCHER_PLANS.PLAN_10H.toString())}
                      style={{
                        padding: '8px 16px',
                        background: minutes === BOAT_VOUCHER_PLANS.PLAN_10H.toString() ? '#667eea' : 'white',
                        color: minutes === BOAT_VOUCHER_PLANS.PLAN_10H.toString() ? 'white' : '#667eea',
                        border: '2px solid #667eea',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (minutes !== BOAT_VOUCHER_PLANS.PLAN_10H.toString()) {
                          e.currentTarget.style.background = '#f0f0ff'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (minutes !== BOAT_VOUCHER_PLANS.PLAN_10H.toString()) {
                          e.currentTarget.style.background = 'white'
                        }
                      }}
                    >
                      📦 10小時本 ({BOAT_VOUCHER_PLANS.PLAN_10H}分)
                    </button>
                    <button
                      type="button"
                      onClick={() => setMinutes(BOAT_VOUCHER_PLANS.PLAN_20H.toString())}
                      style={{
                        padding: '8px 16px',
                        background: minutes === BOAT_VOUCHER_PLANS.PLAN_20H.toString() ? '#667eea' : 'white',
                        color: minutes === BOAT_VOUCHER_PLANS.PLAN_20H.toString() ? 'white' : '#667eea',
                        border: '2px solid #667eea',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (minutes !== BOAT_VOUCHER_PLANS.PLAN_20H.toString()) {
                          e.currentTarget.style.background = '#f0f0ff'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (minutes !== BOAT_VOUCHER_PLANS.PLAN_20H.toString()) {
                          e.currentTarget.style.background = 'white'
                        }
                      }}
                    >
                      📦 20小時本 ({BOAT_VOUCHER_PLANS.PLAN_20H}分)
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 購買時的提示 */}
            {transactionType === 'purchase' && showMinutes && (
              <div style={{
                padding: '12px',
                background: '#e6f7ff',
                border: '1px solid #91d5ff',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '13px',
                color: '#096dd9',
              }}>
                💡 購買船券/指定課：直接輸入分鐘數即可。如果要從儲值扣款，再填寫金額欄位。
              </div>
            )}

            {/* 說明 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                說明 {transactionType === 'adjust' && <span style={{ color: 'red' }}>*</span>}
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={transactionType === 'adjust' ? '請說明調整原因（例如：誤記修正、優惠補貼）' : `預設：${getDefaultDescription()}`}
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
                required={transactionType === 'adjust'}
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
                <li><strong>購買</strong>：增加指定課/船券分鐘數（金額選填，若從儲值扣款才填）</li>
                <li><strong>付款</strong>：預約結帳（可選付款方式）</li>
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
                background: loading ? '#ccc' : '#52c41a',
                color: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
              }}
            >
              {loading ? '處理中...' : '確認記帳'}
            </button>
          </div>
        </form>
        )}

        {/* 查帳記錄 */}
        {activeTab === 'history' && (
          <div style={{ padding: isMobile ? '16px' : '20px' }}>
            {/* 月份選擇和匯出 */}
            <div style={{
              display: 'flex',
              gap: '12px',
              marginBottom: '16px',
              alignItems: 'center',
            }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  選擇月份
                </label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  style={{
                    width: '100%',
                    padding: isMobile ? '12px' : '10px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: isMobile ? '16px' : '14px',
                  }}
                />
              </div>
              <button
                onClick={exportTransactions}
                disabled={transactions.length === 0}
                style={{
                  padding: '10px 20px',
                  borderRadius: '6px',
                  background: transactions.length === 0 ? '#ccc' : 'white',
                  color: transactions.length === 0 ? '#999' : '#666',
                  border: transactions.length === 0 ? 'none' : '2px solid #e0e0e0',
                  cursor: transactions.length === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  whiteSpace: 'nowrap',
                  marginTop: '28px',
                }}
              >
                📥 匯出
              </button>
            </div>

            {/* 交易記錄列表 */}
            {loadingHistory ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
                載入中...
              </div>
            ) : transactions.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
                本月沒有交易記錄
              </div>
            ) : (
              <div style={{
                maxHeight: isMobile ? 'calc(100vh - 350px)' : '500px',
                overflowY: 'auto',
              }}>
                {transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    style={{
                      padding: '16px',
                      background: '#f8f9fa',
                      borderRadius: '8px',
                      marginBottom: '12px',
                      border: '1px solid #e0e0e0',
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '8px',
                    }}>
                      <div>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: 'bold',
                          color: '#333',
                          marginBottom: '4px',
                        }}>
                          {transaction.description}
                        </div>
                        <div style={{ fontSize: '12px', color: '#999' }}>
                          {transaction.created_at.split('T')[0]} {transaction.created_at.split('T')[1].substring(0, 5)}
                        </div>
                      </div>
                      <div style={{
                        fontSize: '16px',
                        fontWeight: 'bold',
                        color: transaction.amount && transaction.amount > 0 ? '#52c41a' : 
                               transaction.amount && transaction.amount < 0 ? '#f5222d' : '#666',
                      }}>
                        {transaction.amount ? `$${transaction.amount > 0 ? '+' : ''}${transaction.amount}` : ''}
                        {transaction.minutes ? `${transaction.minutes > 0 ? '+' : ''}${transaction.minutes}分` : ''}
                      </div>
                    </div>

                    {transaction.notes && (
                      <div style={{
                        fontSize: '12px',
                        color: '#666',
                        marginTop: '8px',
                        padding: '8px',
                        background: 'white',
                        borderRadius: '4px',
                      }}>
                        💬 {transaction.notes}
                      </div>
                    )}

                    <div style={{
                      fontSize: '11px',
                      color: '#999',
                      marginTop: '8px',
                      display: 'flex',
                      gap: '12px',
                      flexWrap: 'wrap',
                    }}>
                      <span>餘額: ${transaction.balance_after}</span>
                      <span>指定課: {transaction.designated_lesson_minutes_after}分</span>
                      <span>G23: {transaction.boat_voucher_g23_minutes_after}分</span>
                      <span>G21/黑豹: {transaction.boat_voucher_g21_panther_minutes_after}分</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

