import { useState } from 'react'
import { supabase } from '../lib/supabase'

// 扣款類別
type DeductionCategory = 
  | 'balance' 
  | 'boat_voucher_g23' 
  | 'boat_voucher_g21_panther' 
  | 'designated_lesson' 
  | 'plan' 
  | 'gift_boat_hours'
  | 'vip_voucher'

// 扣款明細
interface DeductionItem {
  id: string
  category: DeductionCategory
  amount?: number  // 金額（儲值用）
  minutes?: number // 時數（其他類別用）
  planName?: string // 方案名稱
  description?: string // 說明（可編輯）
  notes?: string // 註解（手動輸入）
}

// 組件 Props
interface Props {
  report: {
    id: number
    booking_id: number
    participant_name: string
    duration_min: number
    payment_method: string
    member_id: string | null
    notes?: string | null
    bookings: {
      start_at: string
      contact_name: string
      boats: { name: string; color: string } | null
    }
    coaches: { id: string; name: string } | null
  }
  onComplete: () => void
}

export function PendingDeductionItem({ report, onComplete }: Props) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [memberData, setMemberData] = useState<any>(null)
  
  // 判斷是否為現金/匯款結清
  const isCashSettlement = report.payment_method === 'cash' || report.payment_method === 'transfer'
  
  // 根據教練回報的付款方式和船隻判斷預設類別
  const getDefaultCategory = (): DeductionCategory => {
    const paymentMethod = report.payment_method
    const boatName = report.bookings.boats?.name || ''
    
    // 現金/匯款 -> 不需要扣款
    if (isCashSettlement) {
      return 'balance' // 不會用到，只是佔位
    }
    
    // 票券 -> 根據船隻判斷
    if (paymentMethod === 'voucher') {
      if (boatName.includes('G23')) {
        return 'boat_voucher_g23'
      } else if (boatName.includes('G21') || boatName.includes('黑豹')) {
        return 'boat_voucher_g21_panther'
      }
      return 'boat_voucher_g23' // 預設
    }
    
    // 扣儲值 -> 顯示常用金額
    if (paymentMethod === 'balance') {
      return 'balance'
    }
    
    // 預設：根據船隻判斷
    if (boatName.includes('G23')) {
      return 'boat_voucher_g23'
    } else if (boatName.includes('G21') || boatName.includes('黑豹')) {
      return 'boat_voucher_g21_panther'
    }
    
    return 'balance'
  }
  
  // 根據船隻和時間取得常用金額（扣儲值用）
  const getCommonAmounts = (): number[] => {
    const boatName = report.bookings.boats?.name || ''
    
    // G23（最少30分鐘）
    if (boatName.includes('G23')) {
      return [5400, 7200, 10800, 16200] // 30, 40, 60, 90分
    }
    
    // G21/黑豹
    if (boatName.includes('G21') || boatName.includes('黑豹')) {
      return [2000, 3000, 4000, 6000, 9000] // 20, 30, 40, 60, 90分
    }
    
    // 粉紅/200
    if (boatName.includes('粉紅') || boatName.includes('200')) {
      return [1200, 1800, 2400, 3600, 5400] // 20, 30, 40, 60, 90分
    }
    
    // 預設（未知船隻）
    return []
  }

  // 根據船隻和時間取得 VIP 票券金額
  const getVipVoucherAmounts = (): number[] => {
    const boatName = report.bookings.boats?.name || ''
    
    // G23（最少30分鐘）
    if (boatName.includes('G23')) {
      return [4250, 5667, 8500, 12750] // 30, 40, 60, 90分
    }
    
    // G21/黑豹
    if (boatName.includes('G21') || boatName.includes('黑豹')) {
      return [1667, 2500, 3333, 5000, 7500] // 20, 30, 40, 60, 90分
    }
    
    // 粉紅/200：沒有預設金額，只能自己填
    if (boatName.includes('粉紅') || boatName.includes('200')) {
      return []
    }
    
    // 預設
    return []
  }
  
  const defaultCategory = getDefaultCategory()
  
  // 取得預設金額（根據時長選擇對應的金額）
  const getDefaultAmount = (): number | undefined => {
    const boatName = report.bookings.boats?.name || ''
    const duration = report.duration_min
    
    if (defaultCategory === 'balance') {
      // G23
      if (boatName.includes('G23')) {
        if (duration === 30) return 5400
        if (duration === 40) return 7200
        if (duration === 60) return 10800
        if (duration === 90) return 16200
      }
      // G21/黑豹
      if (boatName.includes('G21') || boatName.includes('黑豹')) {
        if (duration === 20) return 2000
        if (duration === 30) return 3000
        if (duration === 40) return 4000
        if (duration === 60) return 6000
        if (duration === 90) return 9000
      }
      // 粉紅/200
      if (boatName.includes('粉紅') || boatName.includes('200')) {
        if (duration === 20) return 1200
        if (duration === 30) return 1800
        if (duration === 40) return 2400
        if (duration === 60) return 3600
        if (duration === 90) return 5400
      }
    }
    
    if (defaultCategory === 'vip_voucher') {
      // G23
      if (boatName.includes('G23')) {
        if (duration === 30) return 4250
        if (duration === 40) return 5667
        if (duration === 60) return 8500
        if (duration === 90) return 12750
      }
      // G21/黑豹
      if (boatName.includes('G21') || boatName.includes('黑豹')) {
        if (duration === 20) return 1667
        if (duration === 30) return 2500
        if (duration === 40) return 3333
        if (duration === 60) return 5000
        if (duration === 90) return 7500
      }
    }
    
    return undefined
  }

  // 生成說明
  const generateDescription = (): string => {
    const boatName = report.bookings.boats?.name || '未知'
    const coachName = report.coaches?.name || '未知'
    const duration = report.duration_min
    
    // 檢查 notes 中是否有非會員資訊
    let participantName = report.participant_name
    if (report.notes && report.notes.includes('非會員：')) {
      const match = report.notes.match(/非會員：([^\s]+)/)
      if (match && match[1]) {
        participantName = `${report.participant_name} (非會員：${match[1]})`
      }
    }
    
    return `${boatName} ${duration}分 ${coachName}教課 (${participantName})`
  }
  
  const [items, setItems] = useState<DeductionItem[]>([
    {
      id: '1',
      category: defaultCategory,
      minutes: defaultCategory === 'balance' || defaultCategory === 'vip_voucher' ? undefined : report.duration_min,
      amount: getDefaultAmount(),
      description: generateDescription()
    }
  ])

  // 載入會員資料
  const loadMemberData = async () => {
    if (!report.member_id || memberData) return
    
    try {
      const { data } = await supabase
        .from('members')
        .select('*')
        .eq('id', report.member_id)
        .single()
      
      if (data) setMemberData(data)
    } catch (error) {
      console.error('載入會員資料失敗:', error)
    }
  }

  // 展開/收起
  const handleToggle = () => {
    if (!isExpanded && !memberData) {
      loadMemberData()
    }
    setIsExpanded(!isExpanded)
  }

  // 格式化時間
  const formatTime = (datetime: string) => {
    const date = new Date(datetime)
    const hours = date.getHours().toString().padStart(2, '0')
    const mins = date.getMinutes().toString().padStart(2, '0')
    return `${hours}:${mins}`
  }

  // 新增扣款項目（使用相同的預設類別）
  const addItem = () => {
    const defaultCat = getDefaultCategory()
    setItems([...items, {
      id: Date.now().toString(),
      category: defaultCat,
      minutes: defaultCat === 'balance' || defaultCat === 'vip_voucher' ? undefined : report.duration_min,
      amount: getDefaultAmount(),
      description: generateDescription()
    }])
  }

  // 刪除扣款項目
  const removeItem = (id: string) => {
    if (items.length === 1) {
      alert('至少需要一個扣款項目')
      return
    }
    setItems(items.filter(item => item.id !== id))
  }

  // 更新扣款項目
  const updateItem = (id: string, updates: Partial<DeductionItem>) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ))
  }

  // 現金/匯款結清
  const handleCashSettlement = async () => {
    setLoading(true)
    try {
      const paymentLabel = report.payment_method === 'cash' ? '現金' : '匯款'
      
      const { error } = await supabase
        .from('booking_participants')
        .update({ 
          status: 'processed',
          notes: report.notes ? `${report.notes} [${paymentLabel}結清]` : `[${paymentLabel}結清]`
        })
        .eq('id', report.id)

      if (error) throw error
      
      alert(`${paymentLabel}結清完成`)
      onComplete()
    } catch (error) {
      console.error('結清失敗:', error)
      alert('結清失敗')
    } finally {
      setLoading(false)
    }
  }

  // 確認扣款
  const handleConfirm = async () => {
    if (!report.member_id) {
      alert('非會員無法扣款')
      return
    }

    if (!memberData) {
      alert('會員資料未載入')
      return
    }

    setLoading(true)
    try {
      // 處理每筆扣款
      for (const item of items) {
        const updates: any = {}
        const transactionData: any = {
          member_id: report.member_id,
          booking_participant_id: report.id,
          transaction_type: 'consume',
          category: item.category,
          description: item.description || generateDescription(),
          transaction_date: new Date().toISOString().split('T')[0],
          operator_id: (await supabase.auth.getUser()).data.user?.id
        }

        // 根據類別處理
        if (item.category === 'plan') {
          // 方案：不扣任何餘額，只記錄使用
          transactionData.amount = 0
          transactionData.minutes = 0
          // 不更新會員餘額
        } else if (item.category === 'balance') {
          // 扣儲值金額
          const newBalance = (memberData.balance || 0) - (item.amount || 0)
          updates.balance = newBalance
          transactionData.amount = -(item.amount || 0)
          transactionData.balance_after = newBalance
        } else if (item.category === 'vip_voucher') {
          // 扣VIP票券金額
          const newAmount = (memberData.vip_voucher_amount || 0) - (item.amount || 0)
          updates.vip_voucher_amount = newAmount
          transactionData.amount = -(item.amount || 0)
          transactionData.vip_voucher_amount_after = newAmount
        } else {
          // 扣時數
          const field = getCategoryField(item.category)
          const current = memberData[field] || 0
          const newValue = current - (item.minutes || 0)
          updates[field] = newValue
          transactionData.minutes = -(item.minutes || 0)
          transactionData[`${field}_after`] = newValue
        }

        // 記錄註解和方案名稱
        if (item.category === 'plan') {
          // 方案：強制記錄方案名稱
          const planNote = item.planName || '未填寫方案名稱'
          transactionData.notes = item.notes ? `${planNote} - ${item.notes}` : planNote
        } else if (item.notes) {
          // 其他類別：記錄註解
          transactionData.notes = item.notes
        }

        // 更新會員餘額（方案不更新）
        if (item.category !== 'plan' && Object.keys(updates).length > 0) {
          const { error: updateError } = await supabase
            .from('members')
            .update(updates)
            .eq('id', report.member_id)

          if (updateError) throw updateError
        }

        // 記錄交易
        const { error: transactionError } = await supabase
          .from('transactions')
          .insert(transactionData)

        if (transactionError) throw transactionError
      }

      // 標記為已處理
      const { error: statusError } = await supabase
        .from('booking_participants')
        .update({ status: 'processed' })
        .eq('id', report.id)

      if (statusError) throw statusError

      alert('扣款完成')
      onComplete()
    } catch (error) {
      console.error('扣款失敗:', error)
      alert('扣款失敗')
    } finally {
      setLoading(false)
    }
  }

  // 取得類別對應的欄位名稱
  const getCategoryField = (category: DeductionCategory): string => {
    const fieldMap: Record<string, string> = {
      'boat_voucher_g23': 'boat_voucher_g23_minutes',
      'boat_voucher_g21_panther': 'boat_voucher_g21_panther_minutes',
      'designated_lesson': 'designated_lesson_minutes',
      'gift_boat_hours': 'gift_boat_hours'
    }
    return fieldMap[category] || ''
  }

  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      border: isExpanded ? '2px solid #4a90e2' : '1px solid #e0e0e0'
    }}>
      {/* 標題列 */}
      <div 
        onClick={handleToggle}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          userSelect: 'none'
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
            {isExpanded ? '▼' : '▶'} {report.participant_name}
          </div>
          <div style={{ fontSize: '14px', color: '#666' }}>
            {report.bookings.boats?.name || '未知'} • {formatTime(report.bookings.start_at)} • {report.coaches?.name || '未知'} ({report.duration_min}分)
          </div>
        </div>
        {!isExpanded && (
          <div style={{
            padding: '6px 12px',
            background: '#f0f0f0',
            borderRadius: '6px',
            fontSize: '14px',
            color: '#666'
          }}>
            點擊展開
          </div>
        )}
      </div>

      {/* 展開內容 */}
      {isExpanded && (
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e0e0e0' }}>
          {/* 現金/匯款提示（可選） */}
          {isCashSettlement && (
            <div style={{ 
              padding: '16px',
              background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
              borderRadius: '12px',
              border: '2px solid #bae6fd',
              marginBottom: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '600', color: '#0369a1', marginBottom: '4px' }}>
                  💵 {report.payment_method === 'cash' ? '現金' : '匯款'}結清
                </div>
                <div style={{ fontSize: '13px', color: '#075985' }}>
                  此筆記錄為現金/匯款付款
                </div>
              </div>
              <button
                onClick={handleCashSettlement}
                disabled={loading}
                style={{
                  padding: '10px 20px',
                  background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: 'pointer',
                  opacity: loading ? 0.6 : 1,
                  boxShadow: '0 2px 8px rgba(14,165,233,0.3)',
                  whiteSpace: 'nowrap'
                }}
              >
                {loading ? '處理中...' : '✅ 確認結清'}
              </button>
            </div>
          )}

          {/* 扣款介面（始終顯示，可選擇） */}
          <>
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>
                扣款項目：
              </div>

              {/* 扣款明細列表 */}
              {items.map((item, index) => (
                <DeductionItemRow
                  key={item.id}
                  index={index + 1}
                  item={item}
                  memberData={memberData}
                  defaultMinutes={report.duration_min}
                  commonAmounts={getCommonAmounts()}
                  vipVoucherAmounts={getVipVoucherAmounts()}
                  defaultDescription={generateDescription()}
                  boatName={report.bookings.boats?.name || ''}
                  onUpdate={(updates) => updateItem(item.id, updates)}
                  onRemove={() => removeItem(item.id)}
                  canRemove={items.length > 1}
                  totalItems={items.length}
                />
              ))}

              {/* 操作按鈕 */}
              <div style={{ 
                display: 'flex', 
                gap: '12px', 
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: '1px solid #e0e0e0'
              }}>
                <button
                  onClick={addItem}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: 'white',
                    border: '2px dashed #4a90e2',
                    borderRadius: '8px',
                    color: '#4a90e2',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  ➕ 新增項目
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={loading || !report.member_id}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: report.member_id ? '#4CAF50' : '#ccc',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontWeight: '600',
                    cursor: report.member_id ? 'pointer' : 'not-allowed',
                    opacity: loading ? 0.6 : 1
                  }}
                >
                  {loading ? '處理中...' : '✅ 確認扣款'}
                </button>
              </div>

              {!report.member_id && (
                <div style={{ 
                  marginTop: '8px', 
                  fontSize: '14px', 
                  color: '#f44336',
                  textAlign: 'center'
                }}>
                  ⚠️ 非會員無法扣款
                </div>
              )}
            </>
          </div>
        )}
      </div>
    )
  }

// 單個扣款明細項目
interface DeductionItemRowProps {
  index: number
  item: DeductionItem
  memberData: any
  defaultMinutes: number
  commonAmounts: number[]
  vipVoucherAmounts: number[]
  defaultDescription: string
  boatName: string
  onUpdate: (updates: Partial<DeductionItem>) => void
  onRemove: () => void
  canRemove: boolean
  totalItems: number
}

function DeductionItemRow({ 
  index, 
  item, 
  memberData,
  defaultMinutes,
  commonAmounts,
  vipVoucherAmounts,
  defaultDescription,
  boatName,
  onUpdate, 
  onRemove,
  canRemove,
  totalItems
}: DeductionItemRowProps) {
  const categories = [
    { value: 'boat_voucher_g23', label: '🚤 G23船券', emoji: '🚤' },
    { value: 'boat_voucher_g21_panther', label: '🚤 G21/黑豹券', emoji: '🚤' },
    { value: 'designated_lesson', label: '🎓 指定課時數', emoji: '🎓' },
    { value: 'balance', label: '💰 儲值', emoji: '💰' },
    { value: 'vip_voucher', label: '💎 VIP票券', emoji: '💎' },
    { value: 'plan', label: '⭐ 方案', emoji: '⭐' },
    { value: 'gift_boat_hours', label: '🎁 贈送時數', emoji: '🎁' },
  ]

  const isBalance = item.category === 'balance'
  const isVipVoucher = item.category === 'vip_voucher'
  const isPlan = item.category === 'plan'
  const currentCategory = categories.find(c => c.value === item.category)

  // 計算餘額
  const calculateBalance = () => {
    if (!memberData) return { before: 0, after: 0 }
    
    if (isBalance) {
      const before = memberData.balance || 0
      const after = before - (item.amount || 0)
      return { before, after }
    } else if (isVipVoucher) {
      const before = memberData.vip_voucher_amount || 0
      const after = before - (item.amount || 0)
      return { before, after }
    } else {
      const fieldMap: Record<string, string> = {
        'boat_voucher_g23': 'boat_voucher_g23_minutes',
        'boat_voucher_g21_panther': 'boat_voucher_g21_panther_minutes',
        'designated_lesson': 'designated_lesson_minutes',
        'gift_boat_hours': 'gift_boat_hours'
      }
      const field = fieldMap[item.category] || ''
      const before = memberData[field] || 0
      const after = before - (item.minutes || 0)
      return { before, after }
    }
  }

  const balance = calculateBalance()

  return (
    <div style={{
      background: index % 2 === 0 ? 'linear-gradient(to bottom, #f8fcff, #f0f8ff)' : 'linear-gradient(to bottom, #ffffff, #f8f9fa)',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '12px',
      border: index % 2 === 0 ? '2px solid #bae6fd' : '2px solid #e0e0e0',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      position: 'relative'
    }}>
      {/* 標題欄（僅多項時顯示） */}
      {totalItems > 1 && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '14px',
          paddingBottom: '12px',
          borderBottom: '2px solid #e8f4f8'
        }}>
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ 
              fontSize: '18px', 
              fontWeight: '700',
              color: index % 2 === 0 ? '#0ea5e9' : '#64748b',
              minWidth: '28px'
            }}>
              {index}.
            </span>
            <span style={{ fontSize: '20px' }}>{currentCategory?.emoji}</span>
          </div>
          {canRemove && (
            <button
              onClick={onRemove}
              style={{
                padding: '6px 12px',
                background: '#fff',
                color: '#e74c3c',
                border: '1px solid #e74c3c',
                borderRadius: '6px',
                fontSize: '13px',
                cursor: 'pointer',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#e74c3c'
                e.currentTarget.style.color = 'white'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#fff'
                e.currentTarget.style.color = '#e74c3c'
              }}
            >
              刪除
            </button>
          )}
        </div>
      )}

      {/* 類別選擇 */}
      <div style={{ marginBottom: '14px' }}>
        <select
          value={item.category}
          onChange={(e) => {
            const newCategory = e.target.value as DeductionCategory
            const updates: Partial<DeductionItem> = { category: newCategory }
            const duration = report.duration_min
            
            if (newCategory === 'balance') {
              // 扣儲值：根據教練回報的分鐘數自動選中對應金額
              updates.minutes = undefined
              if (boatName.includes('G23')) {
                const map: Record<number, number> = { 30: 5400, 40: 7200, 60: 10800, 90: 16200 }
                updates.amount = map[duration]
              } else if (boatName.includes('G21') || boatName.includes('黑豹')) {
                const map: Record<number, number> = { 20: 2000, 30: 3000, 40: 4000, 60: 6000, 90: 9000 }
                updates.amount = map[duration]
              } else if (boatName.includes('粉紅') || boatName.includes('200')) {
                const map: Record<number, number> = { 20: 1200, 30: 1800, 40: 2400, 60: 3600, 90: 5400 }
                updates.amount = map[duration]
              }
            } else if (newCategory === 'vip_voucher') {
              // VIP票券：根據教練回報的分鐘數自動選中對應金額
              updates.minutes = undefined
              if (boatName.includes('G23')) {
                const map: Record<number, number> = { 30: 4250, 40: 5667, 60: 8500, 90: 12750 }
                updates.amount = map[duration]
              } else if (boatName.includes('G21') || boatName.includes('黑豹')) {
                const map: Record<number, number> = { 20: 1667, 30: 2500, 40: 3333, 60: 5000, 90: 7500 }
                updates.amount = map[duration]
              }
            } else {
              // 時數類別
              updates.minutes = defaultMinutes
              updates.amount = undefined
            }
            
            onUpdate(updates)
          }}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: '8px',
            border: '2px solid #e0e0e0',
            fontSize: '15px',
            fontWeight: '500',
            cursor: 'pointer',
            background: 'white',
            transition: 'all 0.2s'
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = '#4a90e2'}
          onBlur={(e) => e.currentTarget.style.borderColor = '#e0e0e0'}
        >
          {categories.map(cat => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>
      </div>

      {/* 金額/時數選擇 */}
      <div style={{ marginBottom: '14px' }}>
        {isBalance || isVipVoucher ? (
          <div>
            <div style={{ 
              fontSize: '13px', 
              color: '#7f8c8d', 
              marginBottom: '8px',
              fontWeight: '500'
            }}>
              扣款金額：
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              {(isVipVoucher ? vipVoucherAmounts : commonAmounts).map((amount) => {
                // 計算對應的分鐘數
                let minutes = 0
                if (isBalance) {
                  if (boatName.includes('G23')) {
                    const map: Record<number, number> = { 5400: 30, 7200: 40, 10800: 60, 16200: 90 }
                    minutes = map[amount] || 0
                  } else if (boatName.includes('G21') || boatName.includes('黑豹')) {
                    const map: Record<number, number> = { 2000: 20, 3000: 30, 4000: 40, 6000: 60, 9000: 90 }
                    minutes = map[amount] || 0
                  } else if (boatName.includes('粉紅') || boatName.includes('200')) {
                    const map: Record<number, number> = { 1200: 20, 1800: 30, 2400: 40, 3600: 60, 5400: 90 }
                    minutes = map[amount] || 0
                  }
                } else if (isVipVoucher) {
                  if (boatName.includes('G23')) {
                    const map: Record<number, number> = { 4250: 30, 5667: 40, 8500: 60, 12750: 90 }
                    minutes = map[amount] || 0
                  } else if (boatName.includes('G21') || boatName.includes('黑豹')) {
                    const map: Record<number, number> = { 1667: 20, 2500: 30, 3333: 40, 5000: 60, 7500: 90 }
                    minutes = map[amount] || 0
                  }
                }

                return (
                  <div key={amount} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    {minutes > 0 && (
                      <div style={{ 
                        fontSize: '11px', 
                        color: '#94a3b8',
                        marginBottom: '4px',
                        fontWeight: '500'
                      }}>
                        {minutes}分
                      </div>
                    )}
                    <button
                      onClick={() => onUpdate({ amount })}
                      style={{
                        padding: '10px 18px',
                        background: item.amount === amount ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'white',
                        color: item.amount === amount ? 'white' : '#2c3e50',
                        border: item.amount === amount ? 'none' : '2px solid #e0e0e0',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '600',
                        boxShadow: item.amount === amount ? '0 2px 8px rgba(102,126,234,0.3)' : 'none',
                        transition: 'all 0.2s',
                        minWidth: '85px'
                      }}
                      onMouseEnter={(e) => {
                        if (item.amount !== amount) {
                          e.currentTarget.style.borderColor = '#667eea'
                          e.currentTarget.style.transform = 'translateY(-1px)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (item.amount !== amount) {
                          e.currentTarget.style.borderColor = '#e0e0e0'
                          e.currentTarget.style.transform = 'translateY(0)'
                        }
                      }}
                    >
                      ${amount}
                    </button>
                  </div>
                )
              })}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ 
                  fontSize: '11px', 
                  color: 'transparent',
                  marginBottom: '4px',
                  fontWeight: '500',
                  userSelect: 'none'
                }}>
                  .
                </div>
                <div style={{ 
                  position: 'relative',
                  display: 'inline-block'
                }}>
                  <div style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '16px',
                    pointerEvents: 'none',
                    zIndex: 1
                  }}>
                    ✏️
                  </div>
                  <input
                    type="number"
                    placeholder="自訂"
                    value={item.amount && !commonAmounts.concat(vipVoucherAmounts).includes(item.amount) ? item.amount : ''}
                    onChange={(e) => onUpdate({ amount: parseInt(e.target.value) || 0 })}
                    style={{
                      padding: '10px 12px 10px 38px',
                      border: '3px dashed #f59e0b',
                      borderRadius: '8px',
                      width: '100px',
                      fontSize: '14px',
                      fontWeight: '700',
                      background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                      color: '#92400e',
                      boxShadow: '0 0 0 3px rgba(245,158,11,0.1)'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#f59e0b'
                      e.currentTarget.style.background = '#fff'
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.3), 0 4px 12px rgba(245,158,11,0.2)'
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#f59e0b'
                      e.currentTarget.style.background = 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)'
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.1)'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ 
              fontSize: '13px', 
              color: '#7f8c8d', 
              marginBottom: '8px',
              fontWeight: '500'
            }}>
              扣款時數：
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[20, 30, 40, 60, 90].map(minutes => (
                <button
                  key={minutes}
                  onClick={() => onUpdate({ minutes })}
                  style={{
                    padding: '10px 18px',
                    background: item.minutes === minutes ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'white',
                    color: item.minutes === minutes ? 'white' : '#2c3e50',
                    border: item.minutes === minutes ? 'none' : '2px solid #e0e0e0',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    boxShadow: item.minutes === minutes ? '0 2px 8px rgba(102,126,234,0.3)' : 'none',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (item.minutes !== minutes) {
                      e.currentTarget.style.borderColor = '#667eea'
                      e.currentTarget.style.transform = 'translateY(-1px)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (item.minutes !== minutes) {
                      e.currentTarget.style.borderColor = '#e0e0e0'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }
                  }}
                >
                  {minutes}分
                </button>
              ))}
              <div style={{ 
                position: 'relative',
                display: 'inline-block'
              }}>
                <div style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '16px',
                  pointerEvents: 'none',
                  zIndex: 1
                }}>
                  ✏️
                </div>
                <input
                  type="number"
                  placeholder="自訂"
                  value={item.minutes || ''}
                  onChange={(e) => onUpdate({ minutes: parseInt(e.target.value) || 0 })}
                  style={{
                    padding: '10px 12px 10px 38px',
                    border: '3px dashed #f59e0b',
                    borderRadius: '8px',
                    width: '100px',
                    fontSize: '14px',
                    fontWeight: '700',
                    background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                    color: '#92400e',
                    boxShadow: '0 0 0 3px rgba(245,158,11,0.1)'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#f59e0b'
                    e.currentTarget.style.background = '#fff'
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.3), 0 4px 12px rgba(245,158,11,0.2)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#f59e0b'
                    e.currentTarget.style.background = 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)'
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.1)'
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 方案名稱 */}
      {isPlan && (
        <div style={{ marginBottom: '14px' }}>
          <div style={{ 
            fontSize: '13px', 
            color: '#7f8c8d', 
            marginBottom: '8px',
            fontWeight: '500'
          }}>
            方案名稱：
          </div>
          <input
            type="text"
            placeholder="例：9999暢滑方案"
            value={item.planName || ''}
            onChange={(e) => onUpdate({ planName: e.target.value })}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '2px solid #e0e0e0',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          />
        </div>
      )}

      {/* 說明（可編輯） */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ 
          fontSize: '13px', 
          color: '#7f8c8d', 
          marginBottom: '8px',
          fontWeight: '500'
        }}>
          說明：
        </div>
        <textarea
          value={item.description || defaultDescription}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="輸入說明..."
          style={{
            width: '100%',
            padding: '10px 12px',
            background: 'white',
            border: '2px solid #e9ecef',
            borderRadius: '8px',
            fontSize: '14px',
            color: '#495057',
            minHeight: '60px',
            resize: 'vertical',
            fontFamily: 'inherit',
            boxSizing: 'border-box'
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = '#4a90e2'}
          onBlur={(e) => e.currentTarget.style.borderColor = '#e9ecef'}
        />
      </div>

      {/* 註解（可編輯） */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ 
          fontSize: '13px', 
          color: '#7f8c8d', 
          marginBottom: '8px',
          fontWeight: '500'
        }}>
          註解：
        </div>
        <input
          type="text"
          placeholder="選填，可用於補充說明..."
          value={item.notes || ''}
          onChange={(e) => onUpdate({ notes: e.target.value })}
          style={{
            width: '100%',
            padding: '10px 12px',
            border: '2px solid #e0e0e0',
            borderRadius: '8px',
            fontSize: '14px'
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = '#667eea'}
          onBlur={(e) => e.currentTarget.style.borderColor = '#e0e0e0'}
        />
      </div>

      {/* 餘額顯示 */}
      {memberData && (
        <div style={{
          padding: '12px 16px',
          background: balance.after < 0 ? 
            'linear-gradient(135deg, #fff5f5 0%, #ffe5e5 100%)' : 
            'linear-gradient(135deg, #f0fff4 0%, #e6f7ed 100%)',
          borderRadius: '8px',
          fontSize: '14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontWeight: '500',
          border: balance.after < 0 ? '1px solid #fecaca' : '1px solid #bbf7d0'
        }}>
          <span style={{ color: '#64748b' }}>餘額：</span>
          <div>
            <span style={{ color: '#475569' }}>
              {(isBalance || isVipVoucher) ? `$${balance.before}` : `${balance.before}分`}
            </span>
            <span style={{ 
              margin: '0 10px',
              color: '#94a3b8',
              fontSize: '16px'
            }}>
              →
            </span>
            <span style={{ 
              fontWeight: '700',
              fontSize: '16px',
              color: balance.after < 0 ? '#dc2626' : '#16a34a'
            }}>
              {(isBalance || isVipVoucher) ? `$${balance.after}` : `${balance.after}分`}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

