import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useResponsive } from '../hooks/useResponsive'
import { getLocalDateString, getLocalTimestamp, normalizeDate } from '../utils/date'
import type { Member } from '../types/booking'
import { useToast } from './ui'

interface TransactionDialogProps {
  open: boolean
  member: Member
  onClose: () => void
  onSuccess: () => void
  defaultDescription?: string  // 自動填入的說明
  defaultTransactionDate?: string  // 自動填入的交易日期
}

interface Transaction {
  id: number
  created_at: string | null
  transaction_date: string
  category: string
  adjust_type: string | null
  amount: number | null
  minutes: number | null
  description: string
  notes: string | null
  balance_after: number | null
  vip_voucher_amount_after: number | null
  designated_lesson_minutes_after: number | null
  boat_voucher_g23_minutes_after: number | null
  boat_voucher_g21_panther_minutes_after: number | null
  gift_boat_hours_after: number | null
}

// 六個項目的配置
const CATEGORIES = [
  { value: 'balance', label: '💰 儲值', unit: '元', type: 'amount' },
  { value: 'vip_voucher', label: '💎 VIP票券', unit: '元', type: 'amount' },
  { value: 'designated_lesson', label: '📚 指定課', unit: '分', type: 'minutes' },
  { value: 'boat_voucher_g23', label: '🚤 G23船券', unit: '分', type: 'minutes' },
  { value: 'boat_voucher_g21_panther', label: '⛵ G21/黑豹船券', unit: '分', type: 'minutes' },
  { value: 'gift_boat_hours', label: '🎁 贈送大船', unit: '分', type: 'minutes' },
]

export function TransactionDialog({ open, member, onClose, onSuccess, defaultDescription, defaultTransactionDate }: TransactionDialogProps) {
  const { isMobile } = useResponsive()
  const toast = useToast()
  const [activeTab, setActiveTab] = useState<'transaction' | 'history'>('transaction')
  const [loading, setLoading] = useState(false)
  
  // 表單狀態
  const [category, setCategory] = useState('balance')
  const [adjustType, setAdjustType] = useState<'increase' | 'decrease'>('increase')
  const [value, setValue] = useState('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [transactionDate, setTransactionDate] = useState(() => getLocalDateString())
  
  // 交易記錄相關
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const today = getLocalDateString() // YYYY-MM-DD
    return today.substring(0, 7) // YYYY-MM
  }) // 空字串 '' 代表「全部」
  const [categoryFilter, setCategoryFilter] = useState<string>('all') // 類別篩選
  const [searchTerm, setSearchTerm] = useState('') // 搜尋關鍵字
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [exporting, setExporting] = useState(false) // 匯出中狀態
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [editCategory, setEditCategory] = useState('')
  const [editAdjustType, setEditAdjustType] = useState<'increase' | 'decrease'>('increase')
  const [editValue, setEditValue] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editTransactionDate, setEditTransactionDate] = useState('')

  const inputStyle = {
    width: '100%',
    padding: isMobile ? '12px' : '10px',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    fontSize: isMobile ? '16px' : '14px',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box' as const,
  }

  const resetForm = () => {
    setCategory('balance')
    setAdjustType('increase')
    setValue('')
    setDescription('')
    setNotes('')
    setTransactionDate(getLocalDateString())
  }

  // 當對話框開啟時，自動填入預約資訊
  useEffect(() => {
    if (open) {
      if (defaultDescription) {
        setDescription(defaultDescription)
      }
      if (defaultTransactionDate) {
        setTransactionDate(defaultTransactionDate)
      }
    }
  }, [open, defaultDescription, defaultTransactionDate])

  // 加載交易記錄
  const loadTransactions = async () => {
    setLoadingHistory(true)
    try {
      let query = supabase
        .from('transactions')
        .select('*')
        .eq('member_id', member.id)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })

      // 如果有選擇月份，加上日期範圍篩選；空字串代表「全部」
      if (selectedMonth) {
        const [year, month] = selectedMonth.split('-')
        const startDate = `${year}-${month}-01`
        const endDate = new Date(parseInt(year), parseInt(month), 0).getDate()
        const endDateStr = `${year}-${month}-${String(endDate).padStart(2, '0')}`
        query = query.gte('transaction_date', startDate).lte('transaction_date', endDateStr)
      }

      const { data, error } = await query

      if (error) throw error
      setTransactions(data || [])
    } catch (error: any) {
      console.error('加載交易記錄失敗:', error)
      toast.error('加載交易記錄失敗')
    } finally {
      setLoadingHistory(false)
    }
  }

  // 編輯交易記錄
  const handleEditTransaction = (tx: Transaction) => {
    setEditingTransaction(tx)
    setEditCategory(tx.category)
    
    // 直接從金額正負推斷調整類型（最可靠，因為 adjust_type 可能與實際金額不一致）
    const rawValue = tx.amount || tx.minutes || 0
    const inferredAdjustType = rawValue >= 0 ? 'increase' : 'decrease'
    setEditAdjustType(inferredAdjustType)
    
    // 使用絕對值，因為 adjust_type 已經決定了增減方向
    setEditValue(Math.abs(rawValue).toString())
    setEditDescription(tx.description)
    setEditNotes(tx.notes || '')
    setEditTransactionDate(tx.transaction_date || (tx.created_at ? tx.created_at.substring(0, 10) : ''))
  }

  const handleSaveEdit = async () => {
    if (!editingTransaction) return
    
    const numValue = parseFloat(editValue)
    if (!numValue || numValue <= 0) {
      toast.warning('請輸入有效的數值')
      return
    }

    if (!editDescription.trim()) {
      toast.warning('請輸入說明')
      return
    }

    if (!editTransactionDate) {
      toast.warning('請選擇交易日期')
      return
    }

    try {
      const categoryConfig = CATEGORIES.find(c => c.value === editCategory)
      const delta = editAdjustType === 'increase' ? numValue : -numValue
      
      // 計算新的餘額/時數（根據新的值重新計算）
      let updates: any = {}
      let afterValues: any = {
        balance_after: member.balance,
        vip_voucher_amount_after: member.vip_voucher_amount,
        designated_lesson_minutes_after: member.designated_lesson_minutes,
        boat_voucher_g23_minutes_after: member.boat_voucher_g23_minutes,
        boat_voucher_g21_panther_minutes_after: member.boat_voucher_g21_panther_minutes,
        gift_boat_hours_after: member.gift_boat_hours,
      }

      // 先計算出原交易對會員資料的影響並還原
      // 使用 Math.abs 確保數值為正數，避免資料庫中有負數 amount 時計算錯誤
      const oldAbsValue = Math.abs(editingTransaction.amount || editingTransaction.minutes || 0)
      const oldDelta = editingTransaction.adjust_type === 'increase' 
        ? oldAbsValue   // 增加的交易，原本加了這麼多
        : -oldAbsValue  // 減少的交易，原本減了這麼多
      
      // 根據舊的category還原
      switch (editingTransaction.category) {
        case 'balance':
          updates.balance = (member.balance ?? 0) - oldDelta + delta
          afterValues.balance_after = updates.balance
          break
        case 'vip_voucher':
          updates.vip_voucher_amount = (member.vip_voucher_amount ?? 0) - oldDelta + delta
          afterValues.vip_voucher_amount_after = updates.vip_voucher_amount
          break
        case 'designated_lesson':
          updates.designated_lesson_minutes = (member.designated_lesson_minutes ?? 0) - oldDelta + delta
          afterValues.designated_lesson_minutes_after = updates.designated_lesson_minutes
          break
        case 'boat_voucher_g23':
          updates.boat_voucher_g23_minutes = (member.boat_voucher_g23_minutes ?? 0) - oldDelta + delta
          afterValues.boat_voucher_g23_minutes_after = updates.boat_voucher_g23_minutes
          break
        case 'boat_voucher_g21_panther':
          updates.boat_voucher_g21_panther_minutes = (member.boat_voucher_g21_panther_minutes ?? 0) - oldDelta + delta
          afterValues.boat_voucher_g21_panther_minutes_after = updates.boat_voucher_g21_panther_minutes
          break
        case 'gift_boat_hours':
          updates.gift_boat_hours = (member.gift_boat_hours ?? 0) - oldDelta + delta
          afterValues.gift_boat_hours_after = updates.gift_boat_hours
          break
      }

      // 如果類別改變了，需要處理新類別
      if (editCategory !== editingTransaction.category) {
        switch (editCategory) {
          case 'balance':
            updates.balance = (member.balance ?? 0) - oldDelta
            afterValues.balance_after = updates.balance + delta
            updates.balance = afterValues.balance_after
            break
          case 'vip_voucher':
            updates.vip_voucher_amount = (member.vip_voucher_amount ?? 0) - oldDelta
            afterValues.vip_voucher_amount_after = updates.vip_voucher_amount + delta
            updates.vip_voucher_amount = afterValues.vip_voucher_amount_after
            break
          case 'designated_lesson':
            updates.designated_lesson_minutes = (member.designated_lesson_minutes ?? 0) - oldDelta
            afterValues.designated_lesson_minutes_after = updates.designated_lesson_minutes + delta
            updates.designated_lesson_minutes = afterValues.designated_lesson_minutes_after
            break
          case 'boat_voucher_g23':
            updates.boat_voucher_g23_minutes = (member.boat_voucher_g23_minutes ?? 0) - oldDelta
            afterValues.boat_voucher_g23_minutes_after = updates.boat_voucher_g23_minutes + delta
            updates.boat_voucher_g23_minutes = afterValues.boat_voucher_g23_minutes_after
            break
          case 'boat_voucher_g21_panther':
            updates.boat_voucher_g21_panther_minutes = (member.boat_voucher_g21_panther_minutes ?? 0) - oldDelta
            afterValues.boat_voucher_g21_panther_minutes_after = updates.boat_voucher_g21_panther_minutes + delta
            updates.boat_voucher_g21_panther_minutes = afterValues.boat_voucher_g21_panther_minutes_after
            break
          case 'gift_boat_hours':
            updates.gift_boat_hours = (member.gift_boat_hours ?? 0) - oldDelta
            afterValues.gift_boat_hours_after = updates.gift_boat_hours + delta
            updates.gift_boat_hours = afterValues.gift_boat_hours_after
            break
        }
      }

      // 更新會員資料
      const { error: updateError } = await supabase
        .from('members')
        .update(updates)
        .eq('id', member.id)

      if (updateError) throw updateError

      // 更新交易記錄
      const { error } = await supabase
        .from('transactions')
        .update({
          category: editCategory,
          adjust_type: editAdjustType,
          amount: categoryConfig?.type === 'amount' ? numValue : null,
          minutes: categoryConfig?.type === 'minutes' ? numValue : null,
          description: editDescription.trim(),
          notes: editNotes.trim() || null,
          transaction_date: normalizeDate(editTransactionDate) || editTransactionDate,
          ...afterValues
        })
        .eq('id', editingTransaction.id)

      if (error) throw error

      // 重新載入
      await loadTransactions()
      onSuccess()
      setEditingTransaction(null)
      setEditCategory('')
      setEditAdjustType('increase')
      setEditValue('')
      setEditDescription('')
      setEditNotes('')
    } catch (error: any) {
      console.error('更新失敗:', error)
      toast.error(`更新失敗：${error.message}`)
    }
  }

  const handleDeleteTransaction = async (tx: Transaction) => {
    if (!confirm('確定要刪除這筆交易記錄嗎？\n\n注意：這將會還原此交易對會員餘額/時數的影響。')) {
      return
    }

    try {
      // 計算需要還原的值
      // 使用 Math.abs 確保數值為正數，避免資料庫中有負數 amount 時計算錯誤
      const absValue = Math.abs(tx.amount || tx.minutes || 0)
      const delta = tx.adjust_type === 'increase' 
        ? -absValue  // 增加 → 刪除時要減回來
        : absValue   // 減少 → 刪除時要加回來
      
      let updates: any = {}
      
      switch (tx.category) {
        case 'balance':
          updates.balance = (member.balance ?? 0) + delta
          break
        case 'vip_voucher':
          updates.vip_voucher_amount = (member.vip_voucher_amount ?? 0) + delta
          break
        case 'designated_lesson':
          updates.designated_lesson_minutes = (member.designated_lesson_minutes ?? 0) + delta
          break
        case 'boat_voucher_g23':
          updates.boat_voucher_g23_minutes = (member.boat_voucher_g23_minutes ?? 0) + delta
          break
        case 'boat_voucher_g21_panther':
          updates.boat_voucher_g21_panther_minutes = (member.boat_voucher_g21_panther_minutes ?? 0) + delta
          break
        case 'gift_boat_hours':
          updates.gift_boat_hours = (member.gift_boat_hours ?? 0) + delta
          break
      }

      // 更新會員資料
      const { error: updateError } = await supabase
        .from('members')
        .update(updates)
        .eq('id', member.id)

      if (updateError) throw updateError

      // 刪除交易記錄
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', tx.id)

      if (error) throw error

      // 重新載入
      await loadTransactions()
      onSuccess()
    } catch (error: any) {
      console.error('刪除失敗:', error)
      toast.error(`刪除失敗：${error.message}`)
    }
  }

  const handleCancelEdit = () => {
    setEditingTransaction(null)
    setEditCategory('')
    setEditAdjustType('increase')
    setEditValue('')
    setEditDescription('')
    setEditNotes('')
  }

  // 匯出交易記錄
  const handleExportTransactions = async () => {
    if (transactions.length === 0) {
      toast.warning('本月無交易記錄可匯出')
      return
    }

    if (!selectedMonth) {
      toast.warning('請先選擇月份才能匯出')
      return
    }

    setExporting(true)
    try {
      const [year, month] = selectedMonth.split('-')
      const startDate = `${year}-${month}-01`
      
      // 查詢該月第一天之前的最後一筆交易，以取得期初值
      const { data: prevTx } = await supabase
        .from('transactions')
        .select('balance_after, vip_voucher_amount_after, designated_lesson_minutes_after, boat_voucher_g23_minutes_after, boat_voucher_g21_panther_minutes_after, gift_boat_hours_after')
        .eq('member_id', member.id)
        .lt('transaction_date', startDate)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      // 期初值（如果沒有上月交易則為 0）
      const initialValues = {
        balance: prevTx?.balance_after ?? 0,
        vip_voucher: prevTx?.vip_voucher_amount_after ?? 0,
        designated_lesson: prevTx?.designated_lesson_minutes_after ?? 0,
        boat_voucher_g23: prevTx?.boat_voucher_g23_minutes_after ?? 0,
        boat_voucher_g21_panther: prevTx?.boat_voucher_g21_panther_minutes_after ?? 0,
        gift_boat_hours: prevTx?.gift_boat_hours_after ?? 0,
      }

      // 按類別分組
      const groupedByCategory: Record<string, Transaction[]> = {}
      CATEGORIES.forEach(cat => {
        groupedByCategory[cat.value] = transactions.filter(tx => tx.category === cat.value)
      })

      const csvLines: string[] = []
      
      // 處理每個類別
      CATEGORIES.forEach(cat => {
        const txList = groupedByCategory[cat.value]
        
        // 移除 emoji
        const categoryLabel = cat.label.replace(/[^\u0000-\u007F\u4E00-\u9FFF]/g, '').trim()
        
        // 計算統計
        const isAmount = cat.type === 'amount'
        const unit = isAmount ? '$' : '分'
        
        // 期初值從查詢結果取得
        const startValue = initialValues[cat.value as keyof typeof initialValues] ?? 0
        
        let endValue = startValue
        let totalIncrease = 0
        let totalDecrease = 0
        
        if (txList.length > 0) {
          // 有交易：期末值取最後一筆交易的 after 值
          const lastTx = txList[0] // transactions 已經按時間倒序排列
          if (cat.value === 'balance') endValue = lastTx.balance_after ?? startValue
          else if (cat.value === 'vip_voucher') endValue = lastTx.vip_voucher_amount_after ?? startValue
          else if (cat.value === 'designated_lesson') endValue = lastTx.designated_lesson_minutes_after ?? startValue
          else if (cat.value === 'boat_voucher_g23') endValue = lastTx.boat_voucher_g23_minutes_after ?? startValue
          else if (cat.value === 'boat_voucher_g21_panther') endValue = lastTx.boat_voucher_g21_panther_minutes_after ?? startValue
          else if (cat.value === 'gift_boat_hours') endValue = lastTx.gift_boat_hours_after ?? startValue
          
          // 計算本月增加和減少
          // 使用 Math.abs 確保數值為正數，避免資料庫中有負數時計算錯誤
          txList.forEach(tx => {
            const value = Math.abs(isAmount ? (tx.amount || 0) : (tx.minutes || 0))
            if (tx.adjust_type === 'increase') {
              totalIncrease += value
            } else {
              totalDecrease += value
            }
          })
        }
        // 如果該月沒有交易，期末值 = 期初值（已在上面設定）
        
        // 跳過空的類別（期初期末都是0且沒有交易）
        if (startValue === 0 && endValue === 0 && txList.length === 0) {
          return
        }
        
        // 統計行（簡化格式）
        csvLines.push('') // 空行
        if (isAmount) {
          csvLines.push(`"【${categoryLabel}】${unit}${startValue.toLocaleString()} → ${unit}${endValue.toLocaleString()}"`)
        } else {
          csvLines.push(`"【${categoryLabel}】${startValue.toLocaleString()} → ${endValue.toLocaleString()}"`)
        }
        
        // 只有有交易時才顯示明細
        if (txList.length > 0) {
          csvLines.push('"日期","說明","動作","金額","備註"')
          
          // 明細行（按時間正序）
          const sortedTxList = [...txList].reverse()
          sortedTxList.forEach(tx => {
            const date = tx.transaction_date || (tx.created_at ? tx.created_at.substring(0, 10) : '')
            // 轉換日期格式為 MM/DD/YYYY
            const [y, m, d] = date.split('-')
            const formattedDate = `${m}/${d}/${y}`
            
            // 分成動詞和數值兩欄
            // 使用 Math.abs 確保顯示正數
            let action: string
            let amount: string
            if (isAmount) {
              // 金額類別
              action = tx.adjust_type === 'increase' ? '儲值' : '扣除'
              amount = `${unit}${Math.abs(tx.amount || 0)}`
            } else {
              // 時數類別
              action = tx.adjust_type === 'increase' ? '增加' : '使用'
              amount = `${Math.abs(tx.minutes || 0)}分`
            }
            
            csvLines.push(`"${formattedDate}","${tx.description || ''}","${action}","${amount}","${tx.notes || ''}"`)
          })
        }
      })

      // 生成 CSV
      const csvContent = csvLines.join('\n')

      // 下載
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      
      const fileName = `${member.nickname || member.name}_交易記錄_${year}年${month}月.csv`
      link.setAttribute('download', fileName)
      
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast.success('匯出成功')
    } catch (error: any) {
      console.error('匯出失敗:', error)
      toast.error('匯出失敗，請稍後再試')
    } finally {
      setExporting(false)
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
      toast.warning('請輸入有效的數值')
      return
    }

    if (!description.trim()) {
      toast.warning('請輸入說明')
      return
    }

    if (!transactionDate) {
      toast.warning('請選擇交易日期')
      return
    }

    setLoading(true)
    try {
      // 計算新值
      const delta = adjustType === 'increase' ? numValue : -numValue
      let updates: any = {}
      let afterValues: any = {
        balance_after: member.balance ?? 0,
        vip_voucher_amount_after: member.vip_voucher_amount ?? 0,
        designated_lesson_minutes_after: member.designated_lesson_minutes ?? 0,
        boat_voucher_g23_minutes_after: member.boat_voucher_g23_minutes ?? 0,
        boat_voucher_g21_panther_minutes_after: member.boat_voucher_g21_panther_minutes ?? 0,
        gift_boat_hours_after: member.gift_boat_hours ?? 0,
      }

      switch (category) {
        case 'balance':
          updates.balance = (member.balance ?? 0) + delta
          afterValues.balance_after = updates.balance
          break
        case 'vip_voucher':
          updates.vip_voucher_amount = (member.vip_voucher_amount ?? 0) + delta
          afterValues.vip_voucher_amount_after = updates.vip_voucher_amount
          break
        case 'designated_lesson':
          updates.designated_lesson_minutes = (member.designated_lesson_minutes ?? 0) + delta
          afterValues.designated_lesson_minutes_after = updates.designated_lesson_minutes
          break
        case 'boat_voucher_g23':
          updates.boat_voucher_g23_minutes = (member.boat_voucher_g23_minutes ?? 0) + delta
          afterValues.boat_voucher_g23_minutes_after = updates.boat_voucher_g23_minutes
          break
        case 'boat_voucher_g21_panther':
          updates.boat_voucher_g21_panther_minutes = (member.boat_voucher_g21_panther_minutes ?? 0) + delta
          afterValues.boat_voucher_g21_panther_minutes_after = updates.boat_voucher_g21_panther_minutes
          break
        case 'gift_boat_hours':
          updates.gift_boat_hours = (member.gift_boat_hours ?? 0) + delta
          afterValues.gift_boat_hours_after = updates.gift_boat_hours
          break
      }

      // 更新會員資料（允許負數）
      const { error: updateError } = await supabase
        .from('members')
        .update(updates)
        .eq('id', member.id)

      if (updateError) throw updateError

      // 記錄交易
      const categoryConfig = CATEGORIES.find(c => c.value === category)
      
      const transactionData: any = {
        member_id: member.id,
        transaction_type: 'adjust',
        category: category,
        adjust_type: adjustType,
        amount: categoryConfig?.type === 'amount' ? numValue : null,
        minutes: categoryConfig?.type === 'minutes' ? numValue : null,
        description: description.trim(),
        notes: notes.trim() || null,
        transaction_date: normalizeDate(transactionDate) || transactionDate,
        created_at: getLocalTimestamp(),
        ...afterValues
      }

      const { error: transactionError } = await supabase
        .from('transactions')
        .insert([transactionData])

      if (transactionError) throw transactionError

      // 顯示詳細的成功訊息
      const catConfig = CATEGORIES.find(c => c.value === category)
      const isAmount = catConfig?.type === 'amount'
      const unit = isAmount ? '$' : '分'
      const changeText = adjustType === 'increase' ? `+${unit}${numValue.toLocaleString()}` : `-${unit}${numValue.toLocaleString()}`
      const newBalance = (() => {
        switch (category) {
          case 'balance': return afterValues.balance_after
          case 'vip_voucher': return afterValues.vip_voucher_amount_after
          case 'designated_lesson': return afterValues.designated_lesson_minutes_after
          case 'boat_voucher_g23': return afterValues.boat_voucher_g23_minutes_after
          case 'boat_voucher_g21_panther': return afterValues.boat_voucher_g21_panther_minutes_after
          case 'gift_boat_hours': return afterValues.gift_boat_hours_after
          default: return 0
        }
      })()
      const balanceText = isAmount ? `$${newBalance.toLocaleString()}` : `${newBalance.toLocaleString()}分`
      toast.success(`${catConfig?.label} ${changeText}，餘額 ${balanceText}`)

      resetForm()
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('記帳失敗:', error)
      toast.error(`記帳失敗：${error.message}`)
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
            📊 交易
          </button>
        </div>

        {/* 記帳 Tab */}
        {activeTab === 'transaction' && (
          <div style={{ 
            padding: '20px', 
            paddingBottom: isMobile ? '100px' : '20px',  // 為底部按鈕留空間
          }}>
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
                  <div style={{ fontWeight: 'bold', color: '#333' }}>${(member.balance ?? 0).toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ color: '#999', marginBottom: '4px' }}>💎 VIP票券</div>
                  <div style={{ fontWeight: 'bold', color: '#333' }}>${(member.vip_voucher_amount ?? 0).toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ color: '#999', marginBottom: '4px' }}>📚 指定課</div>
                  <div style={{ fontWeight: 'bold', color: '#333' }}>{(member.designated_lesson_minutes ?? 0).toLocaleString()}分</div>
                </div>
                <div>
                  <div style={{ color: '#999', marginBottom: '4px' }}>🚤 G23船券</div>
                  <div style={{ fontWeight: 'bold', color: '#333' }}>{(member.boat_voucher_g23_minutes ?? 0).toLocaleString()}分</div>
                </div>
                <div>
                  <div style={{ color: '#999', marginBottom: '4px' }}>⛵ G21/黑豹船券</div>
                  <div style={{ fontWeight: 'bold', color: '#333' }}>{(member.boat_voucher_g21_panther_minutes ?? 0).toLocaleString()}分</div>
                </div>
                <div>
                  <div style={{ color: '#999', marginBottom: '4px' }}>🎁 贈送大船</div>
                  <div style={{ fontWeight: 'bold', color: '#333' }}>{(member.gift_boat_hours ?? 0).toLocaleString()}分</div>
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
                      border: adjustType === 'increase' ? '2px solid #1976d2' : '2px solid #e0e0e0',
                      borderRadius: '8px',
                      background: adjustType === 'increase' ? '#e3f2fd' : 'white',
                      color: adjustType === 'increase' ? '#1976d2' : '#666',
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
                      border: adjustType === 'decrease' ? '2px solid #757575' : '2px solid #e0e0e0',
                      borderRadius: '8px',
                      background: adjustType === 'decrease' ? '#f5f5f5' : 'white',
                      color: adjustType === 'decrease' ? '#757575' : '#666',
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
                  type="text"
                  inputMode="numeric"
                  value={value}
                  onChange={(e) => {
                    const numValue = e.target.value.replace(/\D/g, '') // 只允許數字
                    setValue(numValue)
                  }}
                  placeholder={`請輸入${selectedCategory?.type === 'amount' ? '金額' : '分鐘數'}`}
                  style={inputStyle}
                  required
                />
              </div>

              {/* 交易日期 */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}>
                  交易日期 *
                </label>
                <input
                  type="date"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>

              {/* 說明（必填） */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}>
                  說明 *
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="例如：儲值、購買課程、退款等"
                  style={inputStyle}
                  required
                />
              </div>

              {/* 備註（選填） */}
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

              {/* 確認前預覽 */}
              {value && parseFloat(value) > 0 && (() => {
                const numValue = parseFloat(value)
                const isAmount = selectedCategory?.type === 'amount'
                const currentValue = (() => {
                  switch (category) {
                    case 'balance': return member.balance ?? 0
                    case 'vip_voucher': return member.vip_voucher_amount ?? 0
                    case 'designated_lesson': return member.designated_lesson_minutes ?? 0
                    case 'boat_voucher_g23': return member.boat_voucher_g23_minutes ?? 0
                    case 'boat_voucher_g21_panther': return member.boat_voucher_g21_panther_minutes ?? 0
                    case 'gift_boat_hours': return member.gift_boat_hours ?? 0
                    default: return 0
                  }
                })()
                const newValue = adjustType === 'increase' 
                  ? currentValue + numValue 
                  : currentValue - numValue
                const changeText = adjustType === 'increase' 
                  ? `+${isAmount ? '$' : ''}${numValue.toLocaleString()}${!isAmount ? '分' : ''}` 
                  : `-${isAmount ? '$' : ''}${numValue.toLocaleString()}${!isAmount ? '分' : ''}`
                const newValueText = `${isAmount ? '$' : ''}${newValue.toLocaleString()}${!isAmount ? '分' : ''}`
                
                return (
                  <div style={{
                    background: adjustType === 'increase' ? '#e8f5e9' : '#fff3e0',
                    border: `1px solid ${adjustType === 'increase' ? '#a5d6a7' : '#ffcc80'}`,
                    borderRadius: '8px',
                    padding: '12px 16px',
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap',
                    fontSize: '14px',
                  }}>
                    <span>{selectedCategory?.label}</span>
                    <span style={{ 
                      fontWeight: 'bold',
                      color: adjustType === 'increase' ? '#2e7d32' : '#e65100',
                    }}>
                      {changeText}
                    </span>
                    <span style={{ color: '#999' }}>→</span>
                    <strong style={{ color: newValue < 0 ? '#d32f2f' : '#333' }}>
                      {newValueText}
                    </strong>
                    {newValue < 0 && <span style={{ color: '#d32f2f' }}>⚠️</span>}
                  </div>
                )
              })()}

              {/* 桌面版提交按鈕 */}
              {!isMobile && (
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
              )}
            </form>
          </div>
        )}

        {/* 手機版固定底部提交按鈕 */}
        {activeTab === 'transaction' && isMobile && (
          <div style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '16px 20px',
            paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
            background: 'white',
            borderTop: '1px solid #e0e0e0',
            zIndex: 1002,
          }}>
            <button
              type="button"
              disabled={loading}
              onClick={(e) => {
                e.preventDefault()
                const form = document.querySelector('form')
                if (form) {
                  form.requestSubmit()
                }
              }}
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
            >
              {loading ? '處理中...' : '確認記帳'}
            </button>
          </div>
        )}

        {/* 查帳 Tab */}
        {activeTab === 'history' && (
          <div style={{ 
            padding: '20px',
            paddingBottom: isMobile ? '40px' : '20px',  // 手機版增加底部留白，確保最後一筆可以完整顯示
          }}>
            {/* 月份選擇和匯出按鈕 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}>
                選擇月份
              </label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={() => setSelectedMonth('')}
                  style={{
                    padding: '10px 16px',
                    background: selectedMonth === '' ? '#424242' : 'white',
                    color: selectedMonth === '' ? 'white' : '#666',
                    border: selectedMonth === '' ? '2px solid #424242' : '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: selectedMonth === '' ? '600' : 'normal',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s',
                  }}
                >
                  全部
                </button>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  style={{ ...inputStyle, flex: 1, minWidth: 0 }}
                />
                <button
                  onClick={() => handleExportTransactions()}
                  disabled={transactions.length === 0 || selectedMonth === '' || exporting}
                  title={selectedMonth === '' ? '請先選擇月份才能匯出' : ''}
                  style={{
                    padding: '10px 20px',
                    background: (transactions.length === 0 || selectedMonth === '' || exporting) ? '#ccc' : '#4caf50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: (transactions.length === 0 || selectedMonth === '' || exporting) ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (transactions.length > 0 && selectedMonth !== '' && !exporting) e.currentTarget.style.background = '#388e3c'
                  }}
                  onMouseLeave={(e) => {
                    if (transactions.length > 0 && selectedMonth !== '' && !exporting) e.currentTarget.style.background = '#4caf50'
                  }}
                >
                  {exporting ? '匯出中...' : '📥 匯出'}
                </button>
              </div>
            </div>

            {/* 類別篩選按鈕 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}>
                篩選類別
              </label>
              {/* 第一行：全部 + 金額類 */}
              <div style={{ 
                display: 'flex', 
                gap: '8px', 
                marginBottom: '8px',
                flexWrap: 'wrap',
              }}>
                <button
                  onClick={() => setCategoryFilter('all')}
                  style={{
                    padding: '8px 16px',
                    border: categoryFilter === 'all' ? '2px solid #424242' : '2px solid #e0e0e0',
                    borderRadius: '20px',
                    background: categoryFilter === 'all' ? '#f5f5f5' : 'white',
                    color: categoryFilter === 'all' ? '#424242' : '#666',
                    fontSize: '13px',
                    fontWeight: categoryFilter === 'all' ? '600' : 'normal',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  全部
                </button>
                {CATEGORIES.filter(cat => cat.type === 'amount').map(cat => (
                  <button
                    key={cat.value}
                    onClick={() => setCategoryFilter(cat.value)}
                    style={{
                      padding: '8px 16px',
                      border: categoryFilter === cat.value ? '2px solid #424242' : '2px solid #e0e0e0',
                      borderRadius: '20px',
                      background: categoryFilter === cat.value ? '#f5f5f5' : 'white',
                      color: categoryFilter === cat.value ? '#424242' : '#666',
                      fontSize: '13px',
                      fontWeight: categoryFilter === cat.value ? '600' : 'normal',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
              {/* 第二行：時數類 */}
              <div style={{ 
                display: 'flex', 
                gap: '8px',
                flexWrap: 'wrap',
              }}>
                {CATEGORIES.filter(cat => cat.type === 'minutes').map(cat => (
                  <button
                    key={cat.value}
                    onClick={() => setCategoryFilter(cat.value)}
                    style={{
                      padding: '8px 16px',
                      border: categoryFilter === cat.value ? '2px solid #424242' : '2px solid #e0e0e0',
                      borderRadius: '20px',
                      background: categoryFilter === cat.value ? '#f5f5f5' : 'white',
                      color: categoryFilter === cat.value ? '#424242' : '#666',
                      fontSize: '13px',
                      fontWeight: categoryFilter === cat.value ? '600' : 'normal',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 搜尋框 */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="🔍 搜尋說明或備註..."
                  style={{
                    ...inputStyle,
                    paddingRight: searchTerm ? '36px' : '12px',
                  }}
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: '#999',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '22px',
                      height: '22px',
                      fontSize: '12px',
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
            </div>

            {/* 統計摘要 - 只在選擇特定月份且篩選特定類別時顯示 */}
            {transactions.length > 0 && selectedMonth && categoryFilter !== 'all' && (() => {
              const catConfig = CATEGORIES.find(c => c.value === categoryFilter)
              if (!catConfig) return null
              
              // 篩選當前類別的交易
              let filteredTxForStats = transactions.filter(tx => tx.category === categoryFilter)
              if (searchTerm.trim()) {
                const lowerSearch = searchTerm.toLowerCase()
                filteredTxForStats = filteredTxForStats.filter(tx => 
                  tx.description?.toLowerCase().includes(lowerSearch) ||
                  tx.notes?.toLowerCase().includes(lowerSearch)
                )
              }
              
              if (filteredTxForStats.length === 0) return null
              
              // 計算統計
              const isAmount = catConfig.type === 'amount'
              let increase = 0
              let decrease = 0
              
              filteredTxForStats.forEach(tx => {
                const val = Math.abs(isAmount ? (tx.amount || 0) : (tx.minutes || 0))
                if (tx.adjust_type === 'increase') increase += val
                else decrease += val
              })
              
              const net = increase - decrease
              
              return (
                <div style={{
                  background: '#f0f7ff',
                  border: '1px solid #bbdefb',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  marginBottom: '16px',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  flexWrap: 'wrap',
                }}>
                  <span style={{ fontWeight: '600', color: '#1976d2' }}>
                    {selectedMonth.split('-')[1]}月 {catConfig.label}
                  </span>
                  <span style={{ color: '#2e7d32' }}>+{isAmount ? '$' : ''}{increase.toLocaleString()}{!isAmount ? '分' : ''}</span>
                  <span style={{ color: '#c62828' }}>-{isAmount ? '$' : ''}{decrease.toLocaleString()}{!isAmount ? '分' : ''}</span>
                  <span style={{ 
                    fontWeight: '600',
                    color: net >= 0 ? '#2e7d32' : '#c62828'
                  }}>
                    = {net >= 0 ? '+' : ''}{isAmount ? '$' : ''}{net.toLocaleString()}{!isAmount ? '分' : ''}
                  </span>
                </div>
              )
            })()}

            {/* 交易記錄列表 */}
            {loadingHistory ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                載入中...
              </div>
            ) : transactions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                {selectedMonth === '' ? '無交易記錄' : '本月無交易記錄'}
              </div>
            ) : (() => {
              // 篩選交易記錄
              let filteredTransactions = categoryFilter === 'all' 
                ? transactions 
                : transactions.filter(tx => tx.category === categoryFilter)
              
              // 搜尋篩選
              if (searchTerm.trim()) {
                const lowerSearch = searchTerm.toLowerCase()
                filteredTransactions = filteredTransactions.filter(tx => 
                  tx.description?.toLowerCase().includes(lowerSearch) ||
                  tx.notes?.toLowerCase().includes(lowerSearch)
                )
              }
              
              if (filteredTransactions.length === 0) {
                return (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                    {searchTerm ? '找不到符合的交易記錄' : '此類別無交易記錄'}
                  </div>
                )
              }
              
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {filteredTransactions.map((tx) => {
                  const categoryConfig = CATEGORIES.find(c => c.value === tx.category)
                  const isIncrease = tx.adjust_type === 'increase'
                  const isEditing = editingTransaction?.id === tx.id
                  
                  return (
                    <div
                      key={tx.id}
                      style={{
                        background: '#f8f9fa',
                        padding: '14px',
                        borderRadius: '8px',
                        borderLeft: `4px solid ${isIncrease ? '#4caf50' : '#f44336'}`,
                        cursor: isEditing ? 'default' : 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onClick={() => !isEditing && handleEditTransaction(tx)}
                      onMouseEnter={(e) => {
                        if (!isEditing) e.currentTarget.style.background = '#eeeff1'
                      }}
                      onMouseLeave={(e) => {
                        if (!isEditing) e.currentTarget.style.background = '#f8f9fa'
                      }}
                    >
                      {isEditing ? (
                        // 編輯模式
                        <div onClick={(e) => e.stopPropagation()}>
                          <div style={{ marginBottom: '12px' }}>
                            <div style={{ fontSize: '12px', color: '#999', marginBottom: '12px' }}>
                              記帳時間：{tx.created_at ? new Date(tx.created_at).toLocaleString('zh-TW', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              }) : '-'}
                            </div>
                            
                            {/* 項目 */}
                            <div style={{ marginBottom: '12px' }}>
                              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600' }}>
                                項目 *
                              </label>
                              <select
                                value={editCategory}
                                onChange={(e) => setEditCategory(e.target.value)}
                                style={{ ...inputStyle, fontSize: '14px' }}
                              >
                                {CATEGORIES.map(cat => (
                                  <option key={cat.value} value={cat.value}>
                                    {cat.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* 操作 */}
                            <div style={{ marginBottom: '12px' }}>
                              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600' }}>
                                操作 *
                              </label>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                <button
                                  type="button"
                                  onClick={() => setEditAdjustType('increase')}
                                  style={{
                                    padding: '8px',
                                    border: editAdjustType === 'increase' ? '2px solid #1976d2' : '2px solid #e0e0e0',
                                    borderRadius: '6px',
                                    background: editAdjustType === 'increase' ? '#e3f2fd' : 'white',
                                    color: editAdjustType === 'increase' ? '#1976d2' : '#666',
                                    fontSize: '13px',
                                    fontWeight: editAdjustType === 'increase' ? '600' : 'normal',
                                    cursor: 'pointer',
                                  }}
                                >
                                  ➕ 增加
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditAdjustType('decrease')}
                                  style={{
                                    padding: '8px',
                                    border: editAdjustType === 'decrease' ? '2px solid #757575' : '2px solid #e0e0e0',
                                    borderRadius: '6px',
                                    background: editAdjustType === 'decrease' ? '#f5f5f5' : 'white',
                                    color: editAdjustType === 'decrease' ? '#757575' : '#666',
                                    fontSize: '13px',
                                    fontWeight: editAdjustType === 'decrease' ? '600' : 'normal',
                                    cursor: 'pointer',
                                  }}
                                >
                                  ➖ 減少
                                </button>
                              </div>
                            </div>

                            {/* 數值 */}
                            <div style={{ marginBottom: '12px' }}>
                              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600' }}>
                                {CATEGORIES.find(c => c.value === editCategory)?.type === 'amount' ? '金額 (元)' : '時數 (分鐘)'} *
                              </label>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={editValue}
                                onChange={(e) => {
                                  const numValue = e.target.value.replace(/\D/g, '') // 只允許數字
                                  setEditValue(numValue)
                                }}
                                style={{ ...inputStyle, fontSize: '14px' }}
                              />
                            </div>

                            {/* 交易日期 */}
                            <div style={{ marginBottom: '12px' }}>
                              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600' }}>
                                交易日期 *
                              </label>
                              <input
                                type="date"
                                value={editTransactionDate}
                                onChange={(e) => setEditTransactionDate(e.target.value)}
                                style={{ ...inputStyle, fontSize: '14px' }}
                              />
                            </div>

                            {/* 說明 */}
                            <div style={{ marginBottom: '12px' }}>
                              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600' }}>
                                說明 *
                              </label>
                              <input
                                type="text"
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                style={{ ...inputStyle, fontSize: '14px' }}
                              />
                            </div>

                            {/* 備註 */}
                            <div style={{ marginBottom: '12px' }}>
                              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600' }}>
                                備註
                              </label>
                              <textarea
                                value={editNotes}
                                onChange={(e) => setEditNotes(e.target.value)}
                                style={{
                                  ...inputStyle,
                                  fontSize: '14px',
                                  minHeight: '60px',
                                  resize: 'vertical',
                                  fontFamily: 'inherit',
                                }}
                              />
                            </div>
                          </div>
                          
                          {/* 按鈕 */}
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={handleSaveEdit}
                              style={{
                                flex: 1,
                                padding: '10px',
                                background: '#1976d2',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontWeight: '600',
                                cursor: 'pointer',
                              }}
                            >
                              ✓ 儲存
                            </button>
                            <button
                              onClick={() => handleDeleteTransaction(tx)}
                              style={{
                                padding: '10px 16px',
                                background: '#757575',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontWeight: '600',
                                cursor: 'pointer',
                              }}
                            >
                              🗑️
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              style={{
                                padding: '10px 16px',
                                background: '#e0e0e0',
                                color: '#666',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontWeight: '600',
                                cursor: 'pointer',
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ) : (
                        // 顯示模式
                        <>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginBottom: '8px',
                          }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
                                {categoryConfig?.label}
                              </div>
                              <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                                {tx.description}
                              </div>
                              <div style={{ fontSize: '12px', color: '#999' }}>
                                {tx.transaction_date || (tx.created_at ? tx.created_at.substring(0, 10) : '-')}
                              </div>
                            </div>
                            <div style={{
                              fontSize: '18px',
                              fontWeight: 'bold',
                              color: isIncrease ? '#1976d2' : '#757575',
                              whiteSpace: 'nowrap',
                              marginLeft: '12px',
                            }}>
                              {isIncrease ? '+' : '-'}{tx.amount ? `$${Math.abs(tx.amount).toLocaleString()}` : `${Math.abs(tx.minutes || 0)}分`}
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
                              備註：{tx.notes}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
                </div>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
