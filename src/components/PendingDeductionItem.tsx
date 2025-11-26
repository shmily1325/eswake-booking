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
  | 'direct_settlement'  // 直接結清

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
    lesson_type?: string | null  // 教學方式：undesignated/designated_paid/designated_free
    member_id: string | null
    notes?: string | null
    bookings: {
      start_at: string
      contact_name: string
      boats: { id: number; name: string; color: string } | null
    }
    coaches: { id: string; name: string } | null
  }
  onComplete: () => void
}

export function PendingDeductionItem({ report, onComplete }: Props) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [memberData, setMemberData] = useState<any>(null)
  const [coachPrice30min, setCoachPrice30min] = useState<number | null>(null)
  const [boatData, setBoatData] = useState<{ balance_price_per_hour: number | null, vip_price_per_hour: number | null } | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  
  // 判斷是否為現金/匯款結清
  const isCashSettlement = report.payment_method === 'cash' || report.payment_method === 'transfer'
  
  // 判斷是否為彈簧床指定課不收費（也視為結清）
  const boatName = report.bookings.boats?.name || ''
  const isTrampolineFreeLesson = boatName.includes('彈簧床') && report.lesson_type === 'designated_free'
  
  // 是否顯示結清按鈕
  const showSettlementButton = isCashSettlement || isTrampolineFreeLesson
  
  // 根據教練回報的付款方式和船隻判斷預設類別
  const getDefaultCategory = (): DeductionCategory => {
    const paymentMethod = report.payment_method
    
    // 現金/匯款 或 彈簧床指定課不收費 -> 不需要扣款
    if (showSettlementButton) {
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
  
  // 根據船隻價格和時間動態計算金額（儲值用）
  const getCommonAmounts = (): number[] => {
    if (!boatData?.balance_price_per_hour) return []
    
    const pricePerHour = boatData.balance_price_per_hour
    const boatName = report.bookings.boats?.name || ''
    
    // G23（最少30分鐘）
    if (boatName.includes('G23')) {
      return [30, 40, 60, 90].map(min => Math.ceil(pricePerHour * min / 60))
    }
    
    // 其他船隻
    return [20, 30, 40, 60, 90].map(min => Math.ceil(pricePerHour * min / 60))
  }

  // 根據船隻價格和時間動態計算 VIP 票券金額
  const getVipVoucherAmounts = (): number[] => {
    if (!boatData?.vip_price_per_hour) return []
    
    const pricePerHour = boatData.vip_price_per_hour
    const boatName = report.bookings.boats?.name || ''
    
    // G23（最少30分鐘）
    if (boatName.includes('G23')) {
      return [30, 40, 60, 90].map(min => Math.ceil(pricePerHour * min / 60))
    }
    
    // 粉紅/200：沒有 VIP 價格
    if (boatName.includes('粉紅') || boatName.includes('200')) {
      return []
    }
    
    // 其他船隻
    return [20, 30, 40, 60, 90].map(min => Math.ceil(pricePerHour * min / 60))
  }
  
  const defaultCategory = getDefaultCategory()
  
  // 取得預設金額（根據時長和動態價格計算）
  const getDefaultAmount = (): number | undefined => {
    const duration = report.duration_min
    
    if (defaultCategory === 'balance') {
      if (!boatData?.balance_price_per_hour) return undefined
      return Math.ceil(boatData.balance_price_per_hour * duration / 60)
    }
    
    if (defaultCategory === 'vip_voucher') {
      if (!boatData?.vip_price_per_hour) return undefined
      return Math.ceil(boatData.vip_price_per_hour * duration / 60)
    }
    
    return undefined
  }

  // 生成說明（可選是否標注指定課）
  const generateDescription = (isDesignatedLesson: boolean = false): string => {
    const boatName = report.bookings.boats?.name || '未知'
    const coachName = report.coaches?.name || '未知'
    const duration = report.duration_min
    
    // 格式化日期和時間
    const startAt = report.bookings.start_at
    const dateTime = startAt ? (() => {
      const [datePart, timePart] = startAt.split('T')
      const time = timePart ? timePart.substring(0, 5) : ''
      return `${datePart} ${time}`
    })() : ''
    
    // 如果是指定課扣款，加上標注
    const lessonLabel = isDesignatedLesson ? '【指定課】' : ''
    
    // 只有非會員才顯示參與者名稱
    // 檢查 notes 中是否有非會員資訊
    let participantSuffix = ''
    if (report.notes && report.notes.includes('非會員：')) {
      const match = report.notes.match(/非會員：([^\s]+)/)
      if (match && match[1]) {
        participantSuffix = ` (非會員：${match[1]})`
      }
    }
    
    return `${lessonLabel}${dateTime} ${boatName} ${duration}分 ${coachName}教練${participantSuffix}`
  }
  
  // 計算指定課金額（根據教練價格和時長）
  const calculateDesignatedLessonAmount = (minutes: number): number | undefined => {
    if (!coachPrice30min) return undefined
    
    // 只有在預設時長列表中才返回金額，否則返回 undefined（讓用戶用自訂框）
    const presetMinutes = [20, 30, 40, 60, 90]
    if (!presetMinutes.includes(minutes)) {
      return undefined  // 不在預設中，不默認選中
    }
    
    // 按比例計算並無條件進位：(教練30分鐘價格 * 實際分鐘數) / 30
    return Math.ceil(coachPrice30min * minutes / 30)
  }

  // 初始化扣款項目（如果是指定課需收費，自動新增指定課扣款）
  const initializeItems = (): DeductionItem[] => {
    const items: DeductionItem[] = []
    const boatName = report.bookings.boats?.name || ''
    const isTrampoline = boatName.includes('彈簧床')
    
    // 🎯 如果是現金/匯款/彈簧床免費指定課，預設為直接結清（但用戶可以改）
    if (isCashSettlement || isTrampolineFreeLesson) {
      items.push({
        id: '1',
        category: 'direct_settlement',
        minutes: undefined,
        amount: undefined,
        description: generateDescription(false)
      })
      return items
    }
    
    // 如果是彈簧床 + 指定課需收費，只扣指定課，不扣船費
    if (isTrampoline && report.lesson_type === 'designated_paid') {
      const designatedAmount = calculateDesignatedLessonAmount(report.duration_min)
      items.push({
        id: '1',
        category: 'balance',  // 指定課需收費一律扣儲值
        amount: designatedAmount,  // 如果教練有設定價格就帶入，沒有則為 undefined（顯示自訂框）
        description: generateDescription(true)  // 加上【指定課】標注
      })
      return items
    }
    
    // 第一筆：根據付款方式的扣款（船隻/儲值/票券）
    items.push({
      id: '1',
      category: defaultCategory,
      minutes: defaultCategory === 'balance' || defaultCategory === 'vip_voucher' ? undefined : report.duration_min,
      amount: getDefaultAmount(),
      description: generateDescription(false)
    })
    
    // 如果是指定課需收費（非彈簧床），自動新增第二筆：指定課扣款
    if (report.lesson_type === 'designated_paid') {
      const designatedAmount = calculateDesignatedLessonAmount(report.duration_min)
      items.push({
        id: '2',
        category: 'balance',  // 從儲值扣款
        amount: designatedAmount,  // 如果教練有設定價格就帶入，沒有則為 undefined（顯示自訂框）
        description: generateDescription(true),  // 加上【指定課】標注
        minutes: report.duration_min  // 記錄時長，用於判斷是否為指定課
      })
    }
    
    return items
  }
  
  const [items, setItems] = useState<DeductionItem[]>(initializeItems())

  // 載入會員資料、教練價格和船隻價格
  const loadMemberData = async () => {
    if (!report.member_id || memberData) return
    
    try {
      // 取得船隻 ID
      const boatId = report.bookings.boats?.id
      
      // 並行載入會員資料、教練價格和船隻價格
      const [memberResult, coachResult, boatResult] = await Promise.all([
        supabase
          .from('members')
          .select('*')
          .eq('id', report.member_id)
          .single(),
        report.coaches?.id ? 
          supabase
            .from('coaches')
            .select('designated_lesson_price_30min')
            .eq('id', report.coaches.id)
            .single()
          : Promise.resolve({ data: null, error: null }),
        boatId ?
          supabase
            .from('boats')
            .select('balance_price_per_hour, vip_price_per_hour')
            .eq('id', boatId)
            .single()
          : Promise.resolve({ data: null, error: null })
      ])
      
      if (memberResult.data) setMemberData(memberResult.data)
      
      // 載入船隻價格
      if (boatResult.data) {
        setBoatData(boatResult.data)
        
        // 更新船費扣款的金額（儲值或VIP票券）
        setItems(prevItems => 
          prevItems.map(item => {
            // 如果是儲值類別且有價格，計算金額
            if (item.category === 'balance' && boatResult.data.balance_price_per_hour) {
              const duration = report.duration_min
              const amount = Math.ceil(boatResult.data.balance_price_per_hour * duration / 60)
              return { ...item, amount }
            }
            // 如果是VIP票券類別且有價格，計算金額
            if (item.category === 'vip_voucher' && boatResult.data.vip_price_per_hour) {
              const duration = report.duration_min
              const amount = Math.ceil(boatResult.data.vip_price_per_hour * duration / 60)
              return { ...item, amount }
            }
            return item
          })
        )
      }
      
      // 如果加載到教練價格，更新狀態並重新計算指定課金額
      if (coachResult.data?.designated_lesson_price_30min) {
        const price = coachResult.data.designated_lesson_price_30min
        setCoachPrice30min(price)
        
        // 更新所有指定課扣款的金額（包括彈簧床指定課）
        if (report.lesson_type === 'designated_paid') {
          setItems(prevItems => 
            prevItems.map(item => {
              // 判斷是否為指定課扣款：category 是 designated_lesson 或 description 包含【指定課】
              const isDesignatedLessonItem = item.category === 'designated_lesson' || 
                                            (item.description?.includes('【指定課】') || false)
              if (isDesignatedLessonItem) {
                return { ...item, amount: Math.ceil(price * (item.minutes || report.duration_min) / 30) }
              }
              return item
            })
          )
        }
      }
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

  // 結清處理（現金/匯款/彈簧床指定課不收費）
  const handleSettlement = async () => {
    setLoading(true)
    try {
      let settlementLabel = ''
      
      if (report.payment_method === 'cash') {
        settlementLabel = '現金結清'
      } else if (report.payment_method === 'transfer') {
        settlementLabel = '匯款結清'
      } else if (isTrampolineFreeLesson) {
        settlementLabel = '指定課不收費'
      } else {
        settlementLabel = '結清'
      }
      
      const { error } = await supabase
        .from('booking_participants')
        .update({ 
          status: 'processed',
          notes: report.notes ? `${report.notes} [${settlementLabel}]` : `[${settlementLabel}]`
        })
        .eq('id', report.id)

      if (error) throw error
      
      alert(`${settlementLabel}完成`)
      onComplete()
    } catch (error) {
      console.error('結清失敗:', error)
      alert('結清失敗')
    } finally {
      setLoading(false)
    }
  }

  // 驗證扣款項目
  const validateItems = (): boolean => {
    const errors: Record<string, string> = {}
    
    items.forEach((item, index) => {
      const itemKey = `item-${index}`
      
      // 跳過直接結清
      if (item.category === 'direct_settlement') return
      
      // 檢查金額/時數
      if (item.category === 'balance' || item.category === 'vip_voucher') {
        if (!item.amount || item.amount <= 0) {
          errors[`${itemKey}-amount`] = '請輸入有效的金額'
        }
      } else if (item.category !== 'plan') {
        if (!item.minutes || item.minutes <= 0) {
          errors[`${itemKey}-minutes`] = '請輸入有效的時數'
        }
      }
      
      // 檢查方案名稱
      if (item.category === 'plan' && !item.planName?.trim()) {
        errors[`${itemKey}-planName`] = '方案類別必須填寫方案名稱'
      }
      
      // 檢查說明
      if (!item.description?.trim()) {
        errors[`${itemKey}-description`] = '請輸入說明'
      }
    })
    
    setValidationErrors(errors)
    
    if (Object.keys(errors).length > 0) {
      // 滾動到第一個錯誤項目
      const firstErrorKey = Object.keys(errors)[0]
      const itemIndex = parseInt(firstErrorKey.split('-')[1])
      const element = document.getElementById(`deduction-item-${itemIndex}`)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return false
    }
    
    return true
  }

  // 確認扣款
  const handleConfirm = async () => {
    // 檢查是否所有項目都是直接結清
    const allDirectSettlement = items.every(item => item.category === 'direct_settlement')
    if (allDirectSettlement) {
      return handleSettlement()
    }

    // 過濾掉直接結清的項目
    const deductionItems = items.filter(item => item.category !== 'direct_settlement')
    
    if (!report.member_id) {
      alert('非會員無法扣款')
      return
    }

    if (!memberData) {
      alert('會員資料未載入')
      return
    }

    // 驗證扣款項目
    if (!validateItems()) {
      return
    }

    setLoading(true)
    try {
      // 取得當前操作者
      const { data: userData } = await supabase.auth.getUser()
      const operatorId = userData.user?.id

      if (!operatorId) {
        throw new Error('無法取得操作者資訊')
      }

      // ✅ 取得預約日期作為交易日期
      const bookingDate = report.bookings.start_at.split('T')[0] // "YYYY-MM-DD"
      
      // 準備扣款資料（轉換為 JSONB 格式）
      const deductionsData = deductionItems.map(item => ({
        category: item.category,
        amount: item.amount || null,
        minutes: item.minutes || null,
        description: item.description || generateDescription(),
        notes: item.notes || null,
        planName: item.planName || null,
        transactionDate: bookingDate  // 使用預約日期
      }))

      // ✅ 使用資料庫交易函數處理扣款（確保原子性）
      const { data: result, error: rpcError } = await supabase.rpc(
        'process_deduction_transaction',
        {
          p_member_id: report.member_id,
          p_participant_id: report.id,
          p_operator_id: operatorId,
          p_deductions: deductionsData as any
        }
      )

      if (rpcError) {
        console.error('RPC 錯誤:', rpcError)
        throw new Error(rpcError.message || '扣款失敗')
      }

      // 檢查結果（result 是 Json 類型，需要 type assertion）
      const resultData = result as { success?: boolean; error?: string; balances?: any }
      if (!resultData?.success) {
        throw new Error(resultData?.error || '扣款處理失敗')
      }

      alert('扣款完成')
      onComplete()
    } catch (error) {
      console.error('扣款失敗:', error)
      alert(`扣款失敗：${error instanceof Error ? error.message : '未知錯誤'}`)
    } finally {
      setLoading(false)
    }
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
          <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '6px' }}>
            {isExpanded ? '▼' : '▶'} {report.participant_name}
          </div>
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
            {(() => {
              const [datePart] = report.bookings.start_at.split('T')
              return datePart
            })()} • {formatTime(report.bookings.start_at)} • {report.bookings.boats?.name || '未知'} • {report.coaches?.name || '未知'} ({report.duration_min}分)
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {/* 收款方式 */}
            <span style={{
              padding: '2px 8px',
              background: report.payment_method === 'cash' ? '#fff3e0' : 
                         report.payment_method === 'transfer' ? '#e3f2fd' :
                         report.payment_method === 'voucher' ? '#f3e5f5' :
                         '#e8f5e9',
              color: report.payment_method === 'cash' ? '#e65100' :
                     report.payment_method === 'transfer' ? '#1565c0' :
                     report.payment_method === 'voucher' ? '#6a1b9a' :
                     '#2e7d32',
              fontSize: '11px',
              borderRadius: '4px',
              fontWeight: '500'
            }}>
              {report.payment_method === 'cash' ? '💵 現金' :
               report.payment_method === 'transfer' ? '🏦 匯款' :
               report.payment_method === 'voucher' ? '🎫 票券' :
               '💰 扣儲值'}
            </span>
            {/* 教學方式 */}
            {report.lesson_type && report.lesson_type !== 'undesignated' && (
              <span style={{
                padding: '2px 8px',
                background: report.lesson_type === 'designated_paid' ? '#fff9e6' : '#e8f5e9',
                color: report.lesson_type === 'designated_paid' ? '#f57c00' : '#388e3c',
                fontSize: '11px',
                borderRadius: '4px',
                fontWeight: '500'
              }}>
                {report.lesson_type === 'designated_paid' ? '🎓 指定（需收費）' : '🎓 指定（不收費）'}
              </span>
            )}
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
          {/* 結清提示（現金/匯款/彈簧床指定課不收費） */}
          {showSettlementButton && (
            <div style={{ 
              padding: '16px',
              background: isTrampolineFreeLesson 
                ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)'
                : 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
              borderRadius: '12px',
              border: isTrampolineFreeLesson ? '2px solid #bbf7d0' : '2px solid #bae6fd',
              marginBottom: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ 
                  fontSize: '15px', 
                  fontWeight: '600', 
                  color: isTrampolineFreeLesson ? '#15803d' : '#0369a1', 
                  marginBottom: '4px' 
                }}>
                  {isTrampolineFreeLesson ? '🎓 指定課不收費' : `💵 ${report.payment_method === 'cash' ? '現金' : '匯款'}結清`}
                </div>
                <div style={{ fontSize: '13px', color: isTrampolineFreeLesson ? '#166534' : '#075985' }}>
                  {isTrampolineFreeLesson ? '彈簧床指定課（免費），點擊確認結清' : '此筆記錄為現金/匯款付款'}
                </div>
              </div>
              <button
                onClick={handleSettlement}
                disabled={loading}
                style={{
                  padding: '10px 20px',
                  background: isTrampolineFreeLesson 
                    ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
                    : 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: 'pointer',
                  opacity: loading ? 0.6 : 1,
                  boxShadow: isTrampolineFreeLesson 
                    ? '0 2px 8px rgba(34,197,94,0.3)'
                    : '0 2px 8px rgba(14,165,233,0.3)',
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
                  coachPrice30min={coachPrice30min}
                  boatData={boatData}
                  validationErrors={validationErrors}
                  itemIndex={index}
                  onUpdate={(updates) => {
                    updateItem(item.id, updates)
                    // 清除該項目的錯誤
                    const newErrors = { ...validationErrors }
                    Object.keys(newErrors).forEach(key => {
                      if (key.startsWith(`item-${index}-`)) {
                        delete newErrors[key]
                      }
                    })
                    setValidationErrors(newErrors)
                  }}
                  onRemove={() => removeItem(item.id)}
                  canRemove={items.length > 1}
                  totalItems={items.length}
                />
              ))}

              {/* 總覽 + 操作按鈕區域（固定在底部） */}
              <div style={{
                position: 'sticky',
                bottom: 0,
                background: 'white',
                paddingTop: '16px',
                marginTop: '16px',
                borderTop: '2px solid #e0e0e0',
                zIndex: 10
              }}>
                {/* 總覽卡片 - 已移除 */}
                {/* {(() => {
                  // 計算所有扣款的累積影響
                  const deductionItems = items.filter(item => item.category !== 'direct_settlement')
                  
                  if (deductionItems.length === 0) return null

                  // 累積各類別的扣款
                  const summary: Record<string, { before: number, after: number, unit: string, label: string, emoji: string }> = {}
                
                deductionItems.forEach(item => {
                  let key = ''
                  let unit = ''
                  let label = ''
                  let emoji = ''
                  let delta = 0
                  
                  if (item.category === 'balance') {
                    key = 'balance'
                    unit = '元'
                    label = '儲值'
                    emoji = '💰'
                    delta = item.amount || 0
                  } else if (item.category === 'vip_voucher') {
                    key = 'vip_voucher'
                    unit = '元'
                    label = 'VIP票券'
                    emoji = '💎'
                    delta = item.amount || 0
                  } else if (item.category === 'boat_voucher_g23') {
                    key = 'boat_voucher_g23'
                    unit = '分'
                    label = 'G23船券'
                    emoji = '🚤'
                    delta = item.minutes || 0
                  } else if (item.category === 'boat_voucher_g21_panther') {
                    key = 'boat_voucher_g21_panther'
                    unit = '分'
                    label = 'G21/黑豹券'
                    emoji = '⛵'
                    delta = item.minutes || 0
                  } else if (item.category === 'designated_lesson') {
                    key = 'designated_lesson'
                    unit = '分'
                    label = '指定課時數'
                    emoji = '🎓'
                    delta = item.minutes || 0
                  } else if (item.category === 'gift_boat_hours') {
                    key = 'gift_boat_hours'
                    unit = '分'
                    label = '贈送時數'
                    emoji = '🎁'
                    delta = item.minutes || 0
                  } else if (item.category === 'plan') {
                    // 方案不扣款，跳過
                    return
                  }
                  
                  if (key) {
                    if (!summary[key]) {
                      // 計算期初值
                      let before = 0
                      if (!memberData) {
                        before = 0
                      } else if (key === 'balance') {
                        before = memberData.balance || 0
                      } else if (key === 'vip_voucher') {
                        before = memberData.vip_voucher_amount || 0
                      } else if (key === 'boat_voucher_g23') {
                        before = memberData.boat_voucher_g23_minutes || 0
                      } else if (key === 'boat_voucher_g21_panther') {
                        before = memberData.boat_voucher_g21_panther_minutes || 0
                      } else if (key === 'designated_lesson') {
                        before = memberData.designated_lesson_minutes || 0
                      } else if (key === 'gift_boat_hours') {
                        before = memberData.gift_boat_hours || 0
                      }
                      
                      summary[key] = { before, after: before, unit, label, emoji }
                    }
                    summary[key].after -= delta
                  }
                })
                
                const summaryEntries = Object.entries(summary)
                if (summaryEntries.length === 0) return null
                
                  return (
                    <div style={{
                      background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                      borderRadius: '12px',
                      padding: '14px',
                      marginBottom: '12px',
                      border: '2px solid #bae6fd',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                    }}>
                      <div style={{ 
                        fontSize: '13px', 
                        fontWeight: '600', 
                        marginBottom: '10px',
                        color: '#0369a1',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        📊 扣款總覽
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {summaryEntries.map(([key, data]) => (
                          <div key={key} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px 10px',
                            background: 'white',
                            borderRadius: '6px',
                            fontSize: '13px',
                            border: '1px solid #e0e0e0'
                          }}>
                            <span style={{ fontWeight: '500', color: '#64748b' }}>
                              {data.emoji} {data.label}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ color: '#475569', fontSize: '12px' }}>
                                {data.unit === '元' ? `$${data.before.toLocaleString()}` : `${data.before}分`}
                              </span>
                              <span style={{ color: '#94a3b8' }}>→</span>
                              <span style={{
                                fontWeight: '600',
                                color: data.after < 0 ? '#dc2626' : '#16a34a'
                              }}>
                                {data.unit === '元' ? `$${data.after.toLocaleString()}` : `${data.after}分`}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()} */}

                {/* 操作按鈕 */}
                <div style={{ 
                  display: 'flex', 
                  gap: '12px'
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
                    fontSize: '13px', 
                    color: '#f44336',
                    textAlign: 'center'
                  }}>
                    ⚠️ 非會員無法扣款
                  </div>
                )}
              </div>
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
  coachPrice30min: number | null  // 教練指定課價格（30分鐘）
  boatData: { balance_price_per_hour: number | null, vip_price_per_hour: number | null } | null
  validationErrors: Record<string, string>
  itemIndex: number
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
  coachPrice30min,
  boatData: _boatData,
  validationErrors,
  itemIndex,
  onUpdate, 
  onRemove,
  canRemove,
  totalItems: _totalItems
}: DeductionItemRowProps) {
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [showNotes, setShowNotes] = useState(!!item.notes)

  const categories = [
    { value: 'balance', label: '💰 儲值', emoji: '💰' },
    { value: 'vip_voucher', label: '💎 VIP票券', emoji: '💎' },
    { value: 'boat_voucher_g23', label: '🚤 G23船券', emoji: '🚤' },
    { value: 'boat_voucher_g21_panther', label: '🚤 G21/黑豹券', emoji: '🚤' },
    { value: 'designated_lesson', label: '🎓 指定課時數', emoji: '🎓' },
    { value: 'plan', label: '⭐ 方案', emoji: '⭐' },
    { value: 'gift_boat_hours', label: '🎁 贈送時數', emoji: '🎁' },
    { value: 'direct_settlement', label: '✅ 直接結清', emoji: '✅' },
  ]

  const isBalance = item.category === 'balance'
  const isVipVoucher = item.category === 'vip_voucher'
  const isPlan = item.category === 'plan'
  const isDesignatedLesson = item.category === 'designated_lesson'
  const isDirectSettlement = item.category === 'direct_settlement'
  // 判斷是否為指定課扣款（從儲值扣）：category 是 balance 且 description 包含【指定課】
  const isDesignatedLessonFromBalance = isBalance && (item.description?.includes('【指定課】') || false)
  const currentCategory = categories.find(c => c.value === item.category)
  
  // 指定課的常用金額（根據教練價格計算，無條件進位）
  const getDesignatedLessonAmounts = (): number[] => {
    if (!coachPrice30min) return []
    return [20, 30, 40, 60, 90].map(minutes => Math.ceil(coachPrice30min * minutes / 30))
  }

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
  
  // 檢查價格設定 - 暫時註解
  // const isPriceNotSet = (isBalance || isVipVoucher) && (
  //   (isBalance && !boatData?.balance_price_per_hour) ||
  //   (isVipVoucher && !boatData?.vip_price_per_hour)
  // )
  // const isCoachPriceNotSet = (isDesignatedLesson || isDesignatedLessonFromBalance) && !coachPrice30min

  return (
    <div 
      id={`deduction-item-${itemIndex}`}
      style={{
        background: index % 2 === 0 ? 'linear-gradient(to bottom, #f8fcff, #f0f8ff)' : 'linear-gradient(to bottom, #ffffff, #f8f9fa)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '12px',
        border: index % 2 === 0 ? '2px solid #bae6fd' : '2px solid #e0e0e0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        position: 'relative'
      }}
    >
      {/* 標題欄 */}
      {/* {totalItems > 1 && ( */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '12px',
          paddingBottom: '10px',
          borderBottom: '1px solid #e8ecef'
        }}>
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span style={{ 
              fontSize: '11px', 
              fontWeight: '500',
              color: '#9ca3af',
              background: '#f3f4f6',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              {index}
            </span>
            <span style={{ fontSize: '16px' }}>{currentCategory?.emoji}</span>
          </div>
          {canRemove && (
            <button
              onClick={onRemove}
              style={{
                padding: '4px 10px',
                background: '#fff',
                color: '#ef4444',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#fef2f2'
                e.currentTarget.style.borderColor = '#ef4444'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#fff'
                e.currentTarget.style.borderColor = '#fecaca'
              }}
            >
              刪除
            </button>
          )}
        </div>
      {/* )} */}

      {/* 類別選擇 */}
      <div style={{ marginBottom: '14px' }}>
        <select
          value={item.category}
          onChange={(e) => {
            const newCategory = e.target.value as DeductionCategory
            const updates: Partial<DeductionItem> = { category: newCategory }
            const duration = defaultMinutes
            
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

      {/* 價格未設定警告 - 暫時註解 */}
      {/* {(isPriceNotSet || isCoachPriceNotSet) && (
        <div style={{
          marginBottom: '14px',
          padding: '12px 14px',
          background: 'linear-gradient(135deg, #fff9e6 0%, #fef3c7 100%)',
          borderRadius: '8px',
          border: '2px solid #fbbf24',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px'
        }}>
          <span style={{ fontSize: '18px', flexShrink: 0 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#92400e', marginBottom: '4px' }}>
              價格尚未設定
            </div>
            <div style={{ fontSize: '12px', color: '#b45309' }}>
              {isPriceNotSet && (
                <div>
                  {isBalance ? '此船隻的儲值價格尚未設定' : '此船隻的VIP票券價格尚未設定'}
                  ，請在船隻管理頁面設定價格，或使用自訂輸入框。
                </div>
              )}
              {isCoachPriceNotSet && (
                <div>
                  此教練的指定課價格尚未設定，請在人員管理頁面設定價格，或使用自訂輸入框。
                </div>
              )}
            </div>
          </div>
        </div>
      )} */}

      {/* 金額/時數選擇 */}
      <div style={{ marginBottom: '14px' }}>
        {isDirectSettlement ? (
          <div style={{
            background: '#f1f8f4',
            padding: '14px 18px',
            borderRadius: '8px',
            border: '1px solid #c8e6c9',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ fontSize: '18px' }}>✅</span>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#2e7d32' }}>
                直接結清
              </div>
              <div style={{ fontSize: '12px', color: '#558b2f' }}>
                不扣任何費用
              </div>
            </div>
          </div>
        ) : isPlan ? (
          <div style={{
            background: 'linear-gradient(135deg, #fff9f0 0%, #ffe8d6 100%)',
            padding: '14px 18px',
            borderRadius: '8px',
            border: '2px solid #ffb84d',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ fontSize: '18px' }}>⭐</span>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#b35900' }}>
                方案記錄
              </div>
              <div style={{ fontSize: '12px', color: '#cc6600' }}>
                不扣除任何餘額，僅記錄方案使用（請在下方填寫方案名稱）
              </div>
            </div>
          </div>
        ) : isBalance || isVipVoucher || (isDesignatedLesson && coachPrice30min) || isDesignatedLessonFromBalance ? (
          <div>
            <div style={{ 
              fontSize: '13px', 
              color: '#7f8c8d', 
              marginBottom: '8px',
              fontWeight: '500'
            }}>
              扣款金額：
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {/* 下拉選單 */}
              <select
                value={item.amount || ''}
                onChange={(e) => {
                  const value = e.target.value
                  if (value === 'custom') {
                    // 切換到自訂模式
                    onUpdate({ amount: 0 })
                  } else {
                    onUpdate({ amount: parseInt(value) })
                  }
                }}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  background: 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#667eea'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#e0e0e0'}
              >
                <option value="">請選擇金額</option>
                {(isDesignatedLesson || isDesignatedLessonFromBalance ? getDesignatedLessonAmounts() : (isVipVoucher ? vipVoucherAmounts : commonAmounts)).map((amount, idx) => {
                  // 計算對應的分鐘數
                  let minutes = 0
                  if ((isDesignatedLesson || isDesignatedLessonFromBalance) && coachPrice30min) {
                    const minutesOptions = [20, 30, 40, 60, 90]
                    minutes = minutesOptions[idx] || 0
                  } else if (isBalance) {
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
                    <option key={amount} value={amount}>
                      {minutes > 0 ? `${minutes}分 - $${amount.toLocaleString()}` : `$${amount.toLocaleString()}`}
                    </option>
                  )
                })}
                <option value="custom">✏️ 自訂金額</option>
              </select>
              
              {/* 自訂輸入框（當選擇自訂或金額不在列表中時顯示） */}
              {(item.amount && !commonAmounts.concat(vipVoucherAmounts).concat(getDesignatedLessonAmounts()).includes(item.amount)) && (
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="請輸入金額"
                  value={item.amount || ''}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '') // 只允許數字
                    onUpdate({ amount: parseInt(value) || 0 })
                  }}
                  style={{
                    padding: '10px 12px',
                    border: '2px solid #f59e0b',
                    borderRadius: '8px',
                    width: '150px',
                    fontSize: '14px',
                    fontWeight: '600',
                    background: 'white'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#f59e0b'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#f59e0b'}
                />
              )}
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
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {/* 下拉選單 */}
              <select
                value={item.minutes || ''}
                onChange={(e) => {
                  const value = e.target.value
                  if (value === 'custom') {
                    onUpdate({ minutes: 0 })
                  } else {
                    onUpdate({ minutes: parseInt(value) })
                  }
                }}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  background: 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#667eea'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#e0e0e0'}
              >
                <option value="">請選擇時數</option>
                {[20, 30, 40, 60, 90].map(minutes => (
                  <option key={minutes} value={minutes}>{minutes}分鐘</option>
                ))}
                <option value="custom">✏️ 自訂時數</option>
              </select>
              
              {/* 自訂輸入框 */}
              {(item.minutes && ![20, 30, 40, 60, 90].includes(item.minutes)) && (
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="請輸入分鐘數"
                  value={item.minutes || ''}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '') // 只允許數字
                    onUpdate({ minutes: parseInt(value) || 0 })
                  }}
                  style={{
                    padding: '10px 12px',
                    border: '2px solid #f59e0b',
                    borderRadius: '8px',
                    width: '150px',
                    fontSize: '14px',
                    fontWeight: '600',
                    background: 'white'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#f59e0b'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#f59e0b'}
                />
              )}
            </div>
          </div>
        )}
        
        {/* 錯誤提示：金額/時數 */}
        {(validationErrors[`item-${itemIndex}-amount`] || validationErrors[`item-${itemIndex}-minutes`]) && (
          <div style={{
            marginTop: '8px',
            padding: '8px 12px',
            background: '#fef2f2',
            borderRadius: '6px',
            border: '1px solid #fecaca',
            fontSize: '13px',
            color: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span>⚠️</span>
            <span>{validationErrors[`item-${itemIndex}-amount`] || validationErrors[`item-${itemIndex}-minutes`]}</span>
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
              border: validationErrors[`item-${itemIndex}-planName`] ? '2px solid #dc2626' : '2px solid #e0e0e0',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          />
          
          {/* 錯誤提示：方案名稱 */}
          {validationErrors[`item-${itemIndex}-planName`] && (
            <div style={{
              marginTop: '8px',
              padding: '8px 12px',
              background: '#fef2f2',
              borderRadius: '6px',
              border: '1px solid #fecaca',
              fontSize: '13px',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>⚠️</span>
              <span>{validationErrors[`item-${itemIndex}-planName`]}</span>
            </div>
          )}
        </div>
      )}

      {/* 說明（精簡顯示） */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ 
          fontSize: '13px', 
          color: '#7f8c8d', 
          marginBottom: '8px',
          fontWeight: '500',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>說明：</span>
          <button
            type="button"
            onClick={() => setIsEditingDescription(!isEditingDescription)}
            style={{
              padding: '4px 10px',
              background: 'none',
              border: '1px solid #e0e0e0',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#666',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f5f5f5'
              e.currentTarget.style.borderColor = '#999'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none'
              e.currentTarget.style.borderColor = '#e0e0e0'
            }}
          >
            {isEditingDescription ? '收起' : '✏️ 編輯'}
          </button>
        </div>
        
        {isEditingDescription ? (
          <textarea
            value={item.description || defaultDescription}
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder="輸入說明..."
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'white',
              border: validationErrors[`item-${itemIndex}-description`] ? '2px solid #dc2626' : '2px solid #e9ecef',
              borderRadius: '8px',
              fontSize: '14px',
              color: '#495057',
              minHeight: '80px',
              resize: 'vertical',
              fontFamily: 'inherit',
              boxSizing: 'border-box'
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = '#4a90e2'}
            onBlur={(e) => e.currentTarget.style.borderColor = validationErrors[`item-${itemIndex}-description`] ? '#dc2626' : '#e9ecef'}
          />
        ) : (
          <div 
            style={{
              padding: '10px 12px',
              background: '#f8f9fa',
              border: validationErrors[`item-${itemIndex}-description`] ? '2px solid #dc2626' : '1px solid #e9ecef',
              borderRadius: '8px',
              fontSize: '13px',
              color: '#666',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              cursor: 'pointer'
            }}
            onClick={() => setIsEditingDescription(true)}
          >
            {(item.description || defaultDescription) || '點擊編輯說明...'}
          </div>
        )}
        
        {/* 錯誤提示：說明 */}
        {validationErrors[`item-${itemIndex}-description`] && (
          <div style={{
            marginTop: '8px',
            padding: '8px 12px',
            background: '#fef2f2',
            borderRadius: '6px',
            border: '1px solid #fecaca',
            fontSize: '13px',
            color: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span>⚠️</span>
            <span>{validationErrors[`item-${itemIndex}-description`]}</span>
          </div>
        )}
      </div>

      {/* 註解（可選展開） */}
      <div style={{ marginBottom: '14px' }}>
        {!showNotes ? (
          <button
            type="button"
            onClick={() => setShowNotes(true)}
            style={{
              padding: '8px 12px',
              background: 'none',
              border: '1px dashed #cbd5e0',
              borderRadius: '6px',
              fontSize: '13px',
              color: '#718096',
              cursor: 'pointer',
              transition: 'all 0.2s',
              width: '100%',
              textAlign: 'left'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f7fafc'
              e.currentTarget.style.borderColor = '#a0aec0'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none'
              e.currentTarget.style.borderColor = '#cbd5e0'
            }}
          >
            + 新增註解（選填）
          </button>
        ) : (
          <>
            <div style={{ 
              fontSize: '13px', 
              color: '#7f8c8d', 
              marginBottom: '8px',
              fontWeight: '500',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>註解：</span>
              <button
                type="button"
                onClick={() => {
                  setShowNotes(false)
                  onUpdate({ notes: '' })
                }}
                style={{
                  padding: '2px 8px',
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  color: '#999',
                  cursor: 'pointer',
                  lineHeight: 1
                }}
              >
                ×
              </button>
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
          </>
        )}
      </div>

      {/* 餘額顯示（簡化為單行） */}
      {memberData && !isDirectSettlement && !isPlan && (
        <div style={{
          padding: '8px 12px',
          background: balance.after < 0 ? '#fef2f2' : '#f0fdf4',
          borderRadius: '6px',
          fontSize: '13px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          border: balance.after < 0 ? '1px solid #fecaca' : '1px solid #bbf7d0'
        }}>
          <span style={{ color: '#64748b', fontWeight: '500' }}>
            {currentCategory?.emoji} 餘額
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#64748b' }}>
              {(isBalance || isVipVoucher) ? `$${balance.before.toLocaleString()}` : `${balance.before}分`}
            </span>
            <span style={{ color: '#94a3b8' }}>→</span>
            <span style={{ 
              fontWeight: '600',
              color: balance.after < 0 ? '#dc2626' : '#16a34a'
            }}>
              {(isBalance || isVipVoucher) ? `$${balance.after.toLocaleString()}` : `${balance.after}分`}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

