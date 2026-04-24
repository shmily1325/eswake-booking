import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from './ui'
import { useAuthUser } from '../contexts/AuthContext'
import { normalizeDate } from '../utils/date'
import { useMemberSearch } from '../hooks/useMemberSearch'
import { isFacility } from '../utils/facility'

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
    created_by_email?: string | null  // 原始回報者 email
    updated_by_email?: string | null  // 最後修改者 email
    bookings: {
      start_at: string
      contact_name: string
      boats: { id: number; name: string; color: string } | null
    }
    coaches: { id: string; name: string } | null
  }
  onComplete: () => void
  // 提交者資訊（由父組件傳入，已轉換成名字）
  submitterInfo?: {
    createdBy: string | null  // 原始回報者名字
    updatedBy: string | null  // 最後修改者名字
  }
  // 當展開狀態改變時通知父組件（用於暫停自動刷新）
  onExpandChange?: (reportId: number, isExpanded: boolean) => void
}

export function PendingDeductionItem({ report, onComplete, submitterInfo, onExpandChange }: Props) {
  const user = useAuthUser()
  const toast = useToast()
  const [isExpanded, setIsExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [memberData, setMemberData] = useState<any>(null)
  const [coachPrice30min, setCoachPrice30min] = useState<number | null>(null)
  const [boatData, setBoatData] = useState<{ balance_price_per_hour: number | null, vip_price_per_hour: number | null } | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  
  // 代扣會員相關狀態
  const [proxyMemberId, setProxyMemberId] = useState<string | null>(null)
  const [proxyMemberName, setProxyMemberName] = useState<string>('')  // 代扣會員名稱
  const [proxyMemberData, setProxyMemberData] = useState<any>(null)  // 代扣會員完整資料（用於顯示餘額）
  const [showProxyMemberSearch, setShowProxyMemberSearch] = useState(false)
  const [isAutoProxy, setIsAutoProxy] = useState(false)  // 是否為自動帶入的代扣會員
  const [hasCheckedBillingRelation, setHasCheckedBillingRelation] = useState(false)  // 是否已查詢過代扣關係
  
  // 使用會員搜尋 hook
  const { 
    filteredMembers: proxyFilteredMembers, 
    searchTerm: proxySearchTerm,
    handleSearchChange: handleProxySearchChange,
    reset: resetProxySearch
  } = useMemberSearch()
  
  // 判斷是否為現金/匯款結清
  const isCashSettlement = report.payment_method === 'cash' || report.payment_method === 'transfer'
  
  // 判斷是否為設施不需扣款（彈簧床、陸上課程：指定不收費 或 不指定 都視為結清）
  const boatName = report.bookings.boats?.name || ''
  const isFacilityFreeLesson = isFacility(boatName) && 
    (report.lesson_type === 'designated_free' || report.lesson_type === 'undesignated')
  
  // 是否顯示結清按鈕
  const showSettlementButton = isCashSettlement || isFacilityFreeLesson
  
  // 根據教練回報的付款方式和船隻判斷預設類別
  const getDefaultCategory = (): DeductionCategory => {
    const paymentMethod = report.payment_method
    
    // 現金/匯款 或 設施指定課不收費 -> 不需要扣款
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
      return [30, 40, 60, 90].map(min => Math.floor(pricePerHour * min / 60))
    }
    
    // 其他船隻
    return [20, 30, 40, 60, 90].map(min => Math.floor(pricePerHour * min / 60))
  }

  // 根據船隻價格和時間動態計算 VIP 票券金額
  const getVipVoucherAmounts = (): number[] => {
    if (!boatData?.vip_price_per_hour) return []
    
    const pricePerHour = boatData.vip_price_per_hour
    const boatName = report.bookings.boats?.name || ''
    
    // G23（最少30分鐘）
    if (boatName.includes('G23')) {
      return [30, 40, 60, 90].map(min => Math.floor(pricePerHour * min / 60))
    }
    
    // 粉紅/200：沒有 VIP 價格
    if (boatName.includes('粉紅') || boatName.includes('200')) {
      return []
    }
    
    // 其他船隻
    return [20, 30, 40, 60, 90].map(min => Math.floor(pricePerHour * min / 60))
  }
  
  const defaultCategory = getDefaultCategory()
  
  // 計算金額：每小時價格 × 時數 / 60（無條件捨去）
  const calculatePriceByDuration = (pricePerHour: number, durationMin: number): number => {
    return Math.floor(pricePerHour * durationMin / 60)
  }

  // 取得預設金額（根據時長和動態價格計算）
  const getDefaultAmount = (): number | undefined => {
    const duration = report.duration_min
    
    if (defaultCategory === 'balance') {
      if (!boatData?.balance_price_per_hour) return undefined
      return calculatePriceByDuration(boatData.balance_price_per_hour, duration)
    }
    
    if (defaultCategory === 'vip_voucher') {
      if (!boatData?.vip_price_per_hour) return undefined
      return calculatePriceByDuration(boatData.vip_price_per_hour, duration)
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
    
    // 檢查 notes 中是否有原始參與者名稱（關聯會員時記錄的）
    // 支援舊格式「非會員：XXX」和新格式「XXX」
    let participantSuffix = ''
    if (report.notes) {
      // 舊格式：非會員：XXX
      const oldMatch = report.notes.match(/非會員：([^\s\[]+)/)
      // 新格式：直接是名字（第一個詞，不包含 [ 開頭的標記）
      const newMatch = report.notes.match(/^([^\s\[]+)/)
      
      const originalName = oldMatch?.[1] || (newMatch?.[1] && !newMatch[1].startsWith('[') ? newMatch[1] : null)
      if (originalName && originalName !== report.participant_name) {
        participantSuffix = ` (${originalName})`
      }
    }
    
    return `${lessonLabel}${dateTime} ${boatName} ${duration}分 ${coachName}教練${participantSuffix}`
  }
  
  // 計算指定課金額（根據教練價格和時長，任何時長都自動計算）
  const calculateDesignatedLessonAmount = (minutes: number): number | undefined => {
    if (!coachPrice30min) return undefined
    // 按比例計算並無條件捨去：(教練30分鐘價格 * 實際分鐘數) / 30
    return Math.floor(coachPrice30min * minutes / 30)
  }

  // 初始化扣款項目（如果是指定課需收費，自動新增指定課扣款）
  const initializeItems = (): DeductionItem[] => {
    const items: DeductionItem[] = []
    const boatName = report.bookings.boats?.name || ''
    const isNoBoatFee = isFacility(boatName)  // 彈簧床、陸上課程不收船費
    
    // 🎯 如果是現金/匯款/設施免費指定課，預設為直接結清（但用戶可以改）
    if (isCashSettlement || isFacilityFreeLesson) {
      items.push({
        id: '1',
        category: 'direct_settlement',
        minutes: undefined,
        amount: undefined,
        description: generateDescription(false)
      })
      return items
    }
    
    // 如果是設施 + 指定課需收費，只扣指定課，不扣船費
    if (isNoBoatFee && report.lesson_type === 'designated_paid') {
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
    
    // 如果是指定課需收費（非設施），自動新增第二筆：指定課扣款
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
              const amount = calculatePriceByDuration(boatResult.data.balance_price_per_hour, duration)
              return { ...item, amount }
            }
            // 如果是VIP票券類別且有價格，計算金額
            if (item.category === 'vip_voucher' && boatResult.data.vip_price_per_hour) {
              const duration = report.duration_min
              const amount = calculatePriceByDuration(boatResult.data.vip_price_per_hour, duration)
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
        
        // 更新所有指定課扣款的金額（包括設施指定課）
        if (report.lesson_type === 'designated_paid') {
          setItems(prevItems => 
            prevItems.map(item => {
              // 判斷是否為指定課扣款：category 是 designated_lesson 或 description 包含【指定課】
              const isDesignatedLessonItem = item.category === 'designated_lesson' || 
                                            (item.description?.includes('【指定課】') || false)
              if (isDesignatedLessonItem) {
                return { ...item, amount: Math.floor(price * (item.minutes || report.duration_min) / 30) }
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

  // 自動載入代扣關係（如果有設定的話）
  const loadBillingRelation = async () => {
    // 如果已經查詢過，不需要再查詢（避免用戶取消後又自動帶入）
    if (hasCheckedBillingRelation) return
    // 如果已經設定了代扣會員，不需要再查詢
    if (proxyMemberId) return
    
    setHasCheckedBillingRelation(true)
    
    try {
      const { data, error } = await supabase
        .from('billing_relations')
        .select(`
          billing_member_id,
          members:billing_member_id(id, name, nickname)
        `)
        .eq('participant_name', report.participant_name)
        .single()
      
      if (error || !data) return // 沒有找到代扣關係
      
      // 自動帶入代扣會員
      const member = data.members as any
      if (member) {
        setProxyMemberId(data.billing_member_id)
        setProxyMemberName(member.nickname || member.name)
        setIsAutoProxy(true)  // 標記為自動帶入
        
        // 載入代扣會員的完整資料（用於顯示餘額）
        const { data: memberData, error: memberError } = await supabase
          .from('members')
          .select('*')
          .eq('id', data.billing_member_id)
          .single()
        
        if (!memberError && memberData) {
          setProxyMemberData(memberData)
        }
      }
    } catch (error) {
      // 查詢失敗時靜默處理（可能是表不存在或沒有對應記錄）
    }
  }

  // 選擇代扣會員（同時載入完整資料用於顯示餘額）
  const selectProxyMember = async (member: { id: string; name: string; nickname: string | null }) => {
    setProxyMemberId(member.id)
    setProxyMemberName(member.nickname || member.name)
    setIsAutoProxy(false)  // 手動選擇，不是自動帶入
    setShowProxyMemberSearch(false)
    resetProxySearch()
    
    // 載入代扣會員的完整資料（用於顯示餘額）
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('id', member.id)
        .single()
      
      if (!error && data) {
        setProxyMemberData(data)
      }
    } catch (error) {
      console.error('載入代扣會員資料失敗:', error)
    }
  }

  // 取消代扣會員
  const clearProxyMember = () => {
    setProxyMemberId(null)
    setProxyMemberName('')
    setProxyMemberData(null)
    setIsAutoProxy(false)
    resetProxySearch()
  }

  // 判斷是否從非會員關聯過來（notes 中有原始名字）
  const getOriginalNonMemberName = (): string | null => {
    if (!report.notes) return null
    // 舊格式：非會員：XXX
    const oldMatch = report.notes.match(/非會員：([^\s\[]+)/)
    // 新格式：直接是名字（第一個詞，不包含 [ 開頭的標記）
    const newMatch = report.notes.match(/^([^\s\[]+)/)
    
    const originalName = oldMatch?.[1] || (newMatch?.[1] && !newMatch[1].startsWith('[') ? newMatch[1] : null)
    // 只有當原始名字和當前名字不同時才返回
    if (originalName && originalName !== report.participant_name) {
      return originalName
    }
    return null
  }

  const originalNonMemberName = getOriginalNonMemberName()

  // 取消關聯（將會員記錄還原為非會員）
  const handleUnlinkMember = async () => {
    if (!originalNonMemberName) return
    
    const confirmed = window.confirm(
      `確定要取消關聯嗎？\n\n` +
      `這會將記錄還原為非會員「${originalNonMemberName}」\n` +
      `並移回「非會員記錄」區域。`
    )
    
    if (!confirmed) return
    
    setLoading(true)
    try {
      const { error } = await supabase
        .from('booking_participants')
        .update({
          member_id: null,
          participant_name: originalNonMemberName,
          status: 'not_applicable',
          notes: null,
          updated_by_email: null
        })
        .eq('id', report.id)
      
      if (error) throw error
      
      toast.success(`已取消關聯，還原為非會員「${originalNonMemberName}」`)
      onComplete()
    } catch (error) {
      console.error('取消關聯失敗:', error)
      toast.error('取消關聯失敗')
    } finally {
      setLoading(false)
    }
  }

  // 展開/收起
  const handleToggle = () => {
    const newExpanded = !isExpanded
    if (newExpanded) {
      if (!memberData) {
        loadMemberData()
      }
      // 自動載入代扣關係（如果有設定的話）
      loadBillingRelation()
    }
    setIsExpanded(newExpanded)
    // 通知父組件展開狀態改變（用於暫停自動刷新）
    onExpandChange?.(report.id, newExpanded)
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
      toast.warning('至少需要一個扣款項目')
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

  // 結清處理（現金/匯款/設施指定課不收費）
  const handleSettlement = async () => {
    // 驗證用戶登入狀態
    if (!user?.email) {
      toast.error('連線逾時，請重新整理頁面後再試')
      return
    }
    
    setLoading(true)
    try {
      let settlementLabel = ''
      
      if (report.payment_method === 'cash') {
        settlementLabel = '現金結清'
      } else if (report.payment_method === 'transfer') {
        settlementLabel = '匯款結清'
      } else if (isFacilityFreeLesson) {
        settlementLabel = '指定課不收費'
      } else {
        settlementLabel = '結清'
      }
      
      const { error } = await supabase
        .from('booking_participants')
        .update({ 
          status: 'processed',
          notes: report.notes ? `${report.notes} [${settlementLabel}]` : `[${settlementLabel}]`,
          updated_by_email: user?.email || null
        })
        .eq('id', report.id)

      if (error) throw error
      
      toast.success(`${settlementLabel}完成`)
      onComplete()
    } catch (error) {
      console.error('結清失敗:', error)
      toast.error('結清失敗')
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
      
      // 檢查金額/時數（允許 0，但必須有值）
      if (item.category === 'balance' || item.category === 'vip_voucher') {
        if (item.amount === undefined || item.amount === null || item.amount < 0) {
          errors[`${itemKey}-amount`] = '請輸入有效的金額（可以是 0）'
        }
      } else if (item.category !== 'plan') {
        if (item.minutes === undefined || item.minutes === null || item.minutes < 0) {
          errors[`${itemKey}-minutes`] = '請輸入有效的時數（可以是 0）'
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
    
    // 決定實際扣款的會員 ID（如果有代扣會員，使用代扣會員）
    const actualMemberId = proxyMemberId || report.member_id
    const isProxyDeduction = !!proxyMemberId && proxyMemberId !== report.member_id
    
    if (!actualMemberId) {
      toast.warning('非會員無法扣款，請選擇代扣會員')
      return
    }

    // 驗證會員資料已載入
    if (isProxyDeduction) {
      if (!proxyMemberData) {
        toast.warning('代扣會員資料載入中，請稍後再試')
        return
      }
    } else {
      if (!memberData) {
        toast.warning('會員資料未載入')
        return
      }
    }

    // 驗證扣款項目
    if (!validateItems()) {
      return
    }

    // 檢查是否有 0 值項目，需要用戶確認
    const zeroValueItems = deductionItems.filter(item => {
      if (item.category === 'balance' || item.category === 'vip_voucher') {
        return item.amount === 0
      } else if (item.category !== 'plan') {
        return item.minutes === 0
      }
      return false
    })

    if (zeroValueItems.length > 0) {
      const zeroItemsDesc = zeroValueItems.map((item, idx) => {
        const categoryLabels: Record<string, string> = {
          'balance': '💰 儲值',
          'vip_voucher': '💎 VIP票券',
          'boat_voucher_g23': '🚤 G23船券',
          'boat_voucher_g21_panther': '🚤 G21/黑豹券',
          'designated_lesson': '🎓 指定課時數',
          'gift_boat_hours': '🎁 贈送時數',
          'plan': '⭐ 方案',
          'direct_settlement': '✅ 直接結清'
        }
        const categoryLabel = categoryLabels[item.category] || item.category
        
        const value = item.category === 'balance' || item.category === 'vip_voucher' 
          ? '0 元' 
          : '0 分鐘'
        
        return `${idx + 1}. ${categoryLabel}：${value}`
      }).join('\n')

      const confirmed = window.confirm(
        `⚠️ 警告：以下項目的扣款金額/時數為 0\n\n${zeroItemsDesc}\n\n確定要繼續扣款嗎？`
      )

      if (!confirmed) {
        return
      }
    }

    // 如果是代扣，再次確認
    if (isProxyDeduction) {
      const proxyConfirmed = window.confirm(
        `⚠️ 代扣確認\n\n` +
        `實際消費者：${report.participant_name}\n` +
        `扣款帳戶：${proxyMemberName}\n\n` +
        `確定要從 ${proxyMemberName} 的帳戶扣款嗎？`
      )
      if (!proxyConfirmed) {
        return
      }
    }

    setLoading(true)
    try {
      // 取得當前操作者
      const { data: userData } = await supabase.auth.getUser()
      const operatorId = userData.user?.id

      if (!operatorId) {
        throw new Error('無法取得操作者資訊')
      }

      // ✅ 取得預約日期作為交易日期（正規化確保格式正確）
      const bookingDate = normalizeDate(report.bookings.start_at.split('T')[0]) || report.bookings.start_at.split('T')[0]
      
      // 準備代扣標註（如果有代扣會員）
      // 原始參與者的回報記錄會顯示：「(由小華代扣)」
      const proxyNoteForParticipant = isProxyDeduction 
        ? `(由${proxyMemberName}代扣)` 
        : null
      
      // 準備扣款資料（轉換為 JSONB 格式）
      const deductionsData = deductionItems.map(item => {
        // 生成交易說明，如果是代扣則添加參與者名稱
        let description = item.description || generateDescription()
        if (isProxyDeduction) {
          description = `${description} (${report.participant_name})`
        }
        
        return {
          category: item.category,
          // ✅ 使用 ?? 運算符，確保 0 值不會被轉成 null
          amount: item.amount ?? null,
          minutes: item.minutes ?? null,
          description,
          notes: item.notes || null,  // 不再添加代扣標註到 notes，因為已經在 description 中了
          planName: item.planName || null,
          transactionDate: bookingDate  // 使用預約日期
        }
      })

      // ✅ 使用資料庫交易函數處理扣款（確保原子性）
      // 如果有代扣會員，使用代扣會員的 ID
      const { data: result, error: rpcError } = await supabase.rpc(
        'process_deduction_transaction',
        {
          p_member_id: actualMemberId,  // 使用實際扣款的會員 ID（可能是代扣會員）
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
      
      // 扣款成功後，如果是代扣，更新原始參與者的回報記錄 notes
      if (isProxyDeduction && proxyNoteForParticipant) {
        const existingNotes = report.notes || ''
        const newNotes = existingNotes 
          ? `${existingNotes} [${proxyNoteForParticipant}]`
          : `[${proxyNoteForParticipant}]`
        
        await supabase
          .from('booking_participants')
          .update({ notes: newNotes })
          .eq('id', report.id)
      }

      // 顯示成功訊息（如果是代扣，顯示代扣資訊）
      if (isProxyDeduction) {
        toast.success(`扣款完成（由 ${proxyMemberName} 代扣）`)
      } else {
        toast.success('扣款完成')
      }
      onComplete()
    } catch (error) {
      console.error('扣款失敗:', error)
      toast.error(`扣款失敗：${error instanceof Error ? error.message : '未知錯誤'}`)
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
          <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '6px' }}>
            {isExpanded ? '▼' : '▶'} {report.participant_name}
          </div>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
            {(() => {
              const [datePart] = report.bookings.start_at.split('T')
              return datePart
            })()} • {formatTime(report.bookings.start_at)} • {report.bookings.boats?.name || '未知'} • {report.coaches?.name || '未知'} ({report.duration_min}分)
          </div>
          {/* 提交者資訊 */}
          {submitterInfo && (submitterInfo.createdBy || submitterInfo.updatedBy) && (
            <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>
              {submitterInfo.createdBy && submitterInfo.updatedBy && submitterInfo.createdBy !== submitterInfo.updatedBy ? (
                // 有修改者且與回報者不同
                <>📤 由 {submitterInfo.createdBy} 回報，{submitterInfo.updatedBy} 修改</>
              ) : submitterInfo.createdBy ? (
                // 只有回報者（或修改者與回報者相同）
                <>📤 由 {submitterInfo.createdBy} 回報</>
              ) : submitterInfo.updatedBy ? (
                // 只有修改者（舊資料可能沒有 createdBy）
                <>📝 由 {submitterInfo.updatedBy} 修改</>
              ) : null}
            </div>
          )}
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
            <span style={{
              padding: '2px 8px',
              background: report.lesson_type === 'designated_paid' ? '#fff9e6' : 
                         report.lesson_type === 'designated_free' ? '#e8f5e9' :
                         '#f5f5f5',
              color: report.lesson_type === 'designated_paid' ? '#f57c00' : 
                     report.lesson_type === 'designated_free' ? '#388e3c' :
                     '#999',
              fontSize: '11px',
              borderRadius: '4px',
              fontWeight: '500'
            }}>
              {report.lesson_type === 'designated_paid' ? '指定（需收費）' : 
               report.lesson_type === 'designated_free' ? '指定（不收費）' :
               '不指定'}
            </span>
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
          {/* 結清提示（現金/匯款/設施指定課不收費） */}
          {showSettlementButton && (
            <div style={{ 
              padding: '16px',
              background: isFacilityFreeLesson 
                ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)'
                : 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
              borderRadius: '12px',
              border: isFacilityFreeLesson ? '2px solid #bbf7d0' : '2px solid #bae6fd',
              marginBottom: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ 
                  fontSize: '15px', 
                  fontWeight: '600', 
                  color: isFacilityFreeLesson ? '#15803d' : '#0369a1', 
                  marginBottom: '4px' 
                }}>
                  {isFacilityFreeLesson ? '🎓 指定課不收費' : `💵 ${report.payment_method === 'cash' ? '現金' : '匯款'}結清`}
                </div>
                <div style={{ fontSize: '13px', color: isFacilityFreeLesson ? '#166534' : '#075985' }}>
                  {isFacilityFreeLesson ? '設施指定課（免費），點擊確認結清' : '此筆記錄為現金/匯款付款'}
                </div>
              </div>
              <button
                data-track="deduction_settlement"
                onClick={handleSettlement}
                disabled={loading}
                style={{
                  padding: '10px 20px',
                  background: isFacilityFreeLesson 
                    ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
                    : 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                  boxShadow: isFacilityFreeLesson 
                    ? '0 2px 8px rgba(34,197,94,0.3)'
                    : '0 2px 8px rgba(14,165,233,0.3)',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {loading ? (
                  <>
                    <span style={{
                      display: 'inline-block',
                      width: '14px',
                      height: '14px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: 'white',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite'
                    }} />
                    處理中...
                  </>
                ) : '✅ 確認結清'}
              </button>
            </div>
          )}

          {/* 扣款介面（始終顯示，可選擇） */}
          <>
              {/* 代扣會員選擇區塊 */}
              <div style={{ 
                marginBottom: '16px',
                padding: '12px',
                background: proxyMemberId ? '#fff3e0' : '#f5f5f5',
                borderRadius: '8px',
                border: proxyMemberId ? '2px solid #ffcc80' : '1px solid #e0e0e0'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}>
                  <div>
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                      扣款帳戶：
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: '600' }}>
                      {proxyMemberId ? (
                        <div>
                          <span style={{ color: '#e65100' }}>
                            🔄 {proxyMemberName}
                            <span style={{ fontSize: '12px', color: '#999', marginLeft: '8px' }}>
                              (代扣 {report.participant_name} 的費用)
                            </span>
                            {isAutoProxy && (
                              <span style={{ 
                                fontSize: '11px', 
                                color: '#fff',
                                background: '#4CAF50',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                marginLeft: '8px'
                              }}>
                                ✓ 自動帶入
                              </span>
                            )}
                          </span>
                          {proxyMemberData && (
                            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                              💰 儲值 ${(proxyMemberData.balance || 0).toLocaleString()} • 
                              💎 VIP票券 ${(proxyMemberData.vip_voucher_amount || 0).toLocaleString()} • 
                              🚤 G23 {proxyMemberData.boat_voucher_g23_minutes || 0}分 • 
                              ⛵ G21/黑豹 {proxyMemberData.boat_voucher_g21_panther_minutes || 0}分
                            </div>
                          )}
                        </div>
                      ) : (
                        <span>{report.participant_name}</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {proxyMemberId ? (
                      <button
                        onClick={clearProxyMember}
                        style={{
                          padding: '6px 12px',
                          background: '#757575',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '13px',
                          cursor: 'pointer'
                        }}
                      >
                        ✕ 取消代扣
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowProxyMemberSearch(true)}
                        style={{
                          padding: '6px 12px',
                          background: '#ff9800',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '13px',
                          cursor: 'pointer'
                        }}
                      >
                        🔄 切換扣款會員
                      </button>
                    )}
                    {/* 取消關聯按鈕（只有從非會員關聯過來的才顯示） */}
                    {originalNonMemberName && !proxyMemberId && (
                      <button
                        onClick={handleUnlinkMember}
                        disabled={loading}
                        style={{
                          padding: '6px 12px',
                          background: '#f44336',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '13px',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          opacity: loading ? 0.6 : 1
                        }}
                      >
                        ✕ 取消關聯
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>
                扣款項目：
              </div>

              {/* 扣款明細列表 */}
              {items.map((item, index) => {
                // 計算當前項目之前的累計扣款
                const previousDeductions: PreviousDeductions = {
                  balance: 0,
                  vip_voucher: 0,
                  boat_voucher_g23: 0,
                  boat_voucher_g21_panther: 0,
                  designated_lesson: 0,
                  gift_boat_hours: 0
                }
                
                // 累加前面所有項目的扣款
                for (let i = 0; i < index; i++) {
                  const prevItem = items[i]
                  if (prevItem.category === 'balance') {
                    previousDeductions.balance += prevItem.amount || 0
                  } else if (prevItem.category === 'vip_voucher') {
                    previousDeductions.vip_voucher += prevItem.amount || 0
                  } else if (prevItem.category === 'boat_voucher_g23') {
                    previousDeductions.boat_voucher_g23 += prevItem.minutes || 0
                  } else if (prevItem.category === 'boat_voucher_g21_panther') {
                    previousDeductions.boat_voucher_g21_panther += prevItem.minutes || 0
                  } else if (prevItem.category === 'designated_lesson') {
                    previousDeductions.designated_lesson += prevItem.minutes || 0
                  } else if (prevItem.category === 'gift_boat_hours') {
                    previousDeductions.gift_boat_hours += prevItem.minutes || 0
                  }
                }
                
                return (
                  <DeductionItemRow
                    key={item.id}
                    index={index + 1}
                    item={item}
                    memberData={proxyMemberId ? proxyMemberData : memberData}
                    defaultMinutes={report.duration_min}
                    commonAmounts={getCommonAmounts()}
                    vipVoucherAmounts={getVipVoucherAmounts()}
                    defaultDescription={generateDescription()}
                    boatName={report.bookings.boats?.name || ''}
                    coachPrice30min={coachPrice30min}
                    boatData={boatData}
                    validationErrors={validationErrors}
                    itemIndex={index}
                    previousDeductions={previousDeductions}
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
                )
              })}

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
                  data-track="deduction_add_item"
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
                  data-track="deduction_confirm"
                  onClick={handleConfirm}
                  disabled={loading || (!report.member_id && !proxyMemberId)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: (report.member_id || proxyMemberId) 
                      ? (proxyMemberId ? '#ff9800' : '#4CAF50')
                      : '#ccc',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontWeight: '600',
                    cursor: (loading || (!report.member_id && !proxyMemberId)) ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  {loading ? (
                    <>
                      <span style={{
                        display: 'inline-block',
                        width: '14px',
                        height: '14px',
                        border: '2px solid rgba(255,255,255,0.3)',
                        borderTopColor: 'white',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite'
                      }} />
                      處理中...
                    </>
                  ) : proxyMemberId ? `✅ 確認扣款（${proxyMemberName}）` : '✅ 確認扣款'}
                </button>
              </div>

                {!report.member_id && !proxyMemberId && (
                  <div style={{ 
                    marginTop: '8px', 
                    fontSize: '13px', 
                    color: '#f44336',
                    textAlign: 'center'
                  }}>
                    ⚠️ 非會員無法扣款，請選擇「切換扣款會員」
                  </div>
                )}
              </div>
            </>
          </div>
        )}
        
        {/* Spinner 動畫的 CSS */}
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
        
        {/* 代扣會員搜尋對話框 */}
        {showProxyMemberSearch && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '12px',
              maxWidth: '400px',
              width: '100%',
              maxHeight: '80vh',
              overflow: 'hidden',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
            }}>
              {/* 標題 */}
              <div style={{
                padding: '16px',
                borderBottom: '1px solid #e0e0e0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h3 style={{ margin: 0, fontSize: '16px' }}>
                  🔄 選擇代扣會員
                </h3>
                <button
                  onClick={() => {
                    setShowProxyMemberSearch(false)
                    resetProxySearch()
                  }}
                  style={{
                    border: 'none',
                    background: 'none',
                    fontSize: '20px',
                    cursor: 'pointer',
                    color: '#666'
                  }}
                >
                  ×
                </button>
              </div>
              
              {/* 說明 */}
              <div style={{
                padding: '12px 16px',
                background: '#fff3e0',
                fontSize: '13px',
                color: '#e65100'
              }}>
                選擇要代扣的會員帳戶。代扣後：
                <br />• 該會員的交易說明會顯示「教練 ({report.participant_name})」
                <br />• {report.participant_name} 的回報記錄會顯示「(由 XXX 代扣)」
              </div>
              
              {/* 搜尋輸入框 */}
              <div style={{ padding: '16px' }}>
                <input
                  type="text"
                  value={proxySearchTerm}
                  onChange={(e) => handleProxySearchChange(e.target.value)}
                  placeholder="搜尋會員姓名、暱稱或電話..."
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              
              {/* 搜尋結果 */}
              <div style={{ 
                maxHeight: '300px', 
                overflow: 'auto',
                borderTop: '1px solid #e0e0e0'
              }}>
                {proxySearchTerm && proxyFilteredMembers.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#999' }}>
                    找不到會員
                  </div>
                ) : (
                  proxyFilteredMembers.map(member => (
                    <div
                      key={member.id}
                      onClick={() => selectProxyMember(member)}
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #f0f0f0',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f8f9fa'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ fontWeight: '600' }}>
                        {member.nickname || member.name}
                      </div>
                      {member.nickname && member.name !== member.nickname && (
                        <div style={{ fontSize: '14px', color: '#666' }}>
                          {member.name}
                        </div>
                      )}
                      {member.phone && (
                        <div style={{ fontSize: '14px', color: '#999' }}>
                          {member.phone}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

// 單個扣款明細項目
// 累計扣款（用於計算餘額連動）
interface PreviousDeductions {
  balance: number           // 儲值累計扣款金額
  vip_voucher: number       // VIP票券累計扣款金額
  boat_voucher_g23: number  // G23船券累計扣款分鐘
  boat_voucher_g21_panther: number  // G21/黑豹券累計扣款分鐘
  designated_lesson: number // 指定課累計扣款分鐘
  gift_boat_hours: number   // 贈送時數累計扣款分鐘
}

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
  previousDeductions: PreviousDeductions  // 前面項目的累計扣款
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
  defaultDescription,
  boatName,
  coachPrice30min,
  boatData,
  validationErrors,
  itemIndex,
  previousDeductions,
  onUpdate, 
  onRemove,
  canRemove,
  totalItems: _totalItems
}: DeductionItemRowProps) {
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [showNotes, setShowNotes] = useState(!!item.notes)
  const [isAmountFocused, setIsAmountFocused] = useState(false)

  // 計算金額：每小時價格 × 時數 / 60（無條件捨去）
  const calculatePriceByDuration = (pricePerHour: number, durationMin: number): number => {
    return Math.floor(pricePerHour * durationMin / 60)
  }

  // 計算當前時數對應的金額（用於「自訂」選項）
  const calculateAmountForDuration = (category: string): number => {
    const duration = defaultMinutes
    if (category === 'balance' && boatData?.balance_price_per_hour) {
      return calculatePriceByDuration(boatData.balance_price_per_hour, duration)
    }
    if (category === 'vip_voucher' && boatData?.vip_price_per_hour) {
      return calculatePriceByDuration(boatData.vip_price_per_hour, duration)
    }
    return 0
  }

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
  const isDirectSettlement = item.category === 'direct_settlement'
  // 判斷是否為指定課扣款（從儲值扣）：category 是 balance 且 description 包含【指定課】
  const isDesignatedLessonFromBalance = isBalance && (item.description?.includes('【指定課】') || false)
  // memberData 由父層傳入，已為「實際扣款帳戶」（含代扣會員）
  const showGuestMemberBoatBalanceReminder =
    memberData?.membership_type === 'guest' && isBalance && !isDesignatedLessonFromBalance
  const currentCategory = categories.find(c => c.value === item.category)
  

  // 計算餘額（考慮前面項目的累計扣款）
  const calculateBalance = () => {
    if (!memberData) return { before: 0, after: 0 }
    
    if (isBalance) {
      // 原始餘額減去前面項目的累計扣款 = 當前項目的起始餘額
      const originalBalance = memberData.balance || 0
      const before = originalBalance - previousDeductions.balance
      const after = before - (item.amount || 0)
      return { before, after }
    } else if (isVipVoucher) {
      const originalBalance = memberData.vip_voucher_amount || 0
      const before = originalBalance - previousDeductions.vip_voucher
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
      const originalBalance = memberData[field] || 0
      // 取得對應類別的累計扣款
      const prevDeduction = previousDeductions[item.category as keyof PreviousDeductions] || 0
      const before = originalBalance - prevDeduction
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
              let standardAmount: number | undefined
              if (boatName.includes('G23')) {
                const map: Record<number, number> = { 30: 5400, 40: 7200, 60: 10800, 90: 16200 }
                standardAmount = map[duration]
              } else if (boatName.includes('G21') || boatName.includes('黑豹')) {
                const map: Record<number, number> = { 20: 2000, 30: 3000, 40: 4000, 60: 6000, 90: 9000 }
                standardAmount = map[duration]
              } else if (boatName.includes('粉紅') || boatName.includes('200')) {
                const map: Record<number, number> = { 20: 1200, 30: 1800, 40: 2400, 60: 3600, 90: 5400 }
                standardAmount = map[duration]
              }
              // 如果不是標準時數，自動計算金額
              updates.amount = standardAmount ?? calculateAmountForDuration('balance')
            } else if (newCategory === 'vip_voucher') {
              // VIP票券：根據教練回報的分鐘數自動選中對應金額（無條件捨去）
              updates.minutes = undefined
              let standardAmount: number | undefined
              if (boatName.includes('G23')) {
                const map: Record<number, number> = { 30: 4250, 40: 5666, 60: 8500, 90: 12750 }
                standardAmount = map[duration]
              } else if (boatName.includes('G21') || boatName.includes('黑豹')) {
                const map: Record<number, number> = { 20: 1666, 30: 2500, 40: 3333, 60: 5000, 90: 7500 }
                standardAmount = map[duration]
              }
              // 如果不是標準時數，自動計算金額
              updates.amount = standardAmount ?? calculateAmountForDuration('vip_voucher')
            } else if (newCategory === 'plan') {
              // 方案：帶入預設方案名稱
              updates.minutes = undefined
              updates.amount = undefined
              updates.planName = '暢滑方案9999'
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
        ) : isBalance || isVipVoucher || isDesignatedLessonFromBalance ? (
          <div>
            <div style={{ 
              fontSize: '13px', 
              color: '#7f8c8d', 
              marginBottom: '8px',
              fontWeight: '500'
            }}>
              扣款金額：
            </div>
            {showGuestMemberBoatBalanceReminder ? (
              <div
                style={{
                  marginBottom: '10px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #f0c36d',
                  background: 'linear-gradient(135deg, #fffbeb 0%, #fff4d6 100%)',
                  fontSize: '13px',
                  lineHeight: 1.55,
                  color: '#7c5d10'
                }}
              >
                此扣款帳戶為「非會員」；目前金額依船隻「會員價格」計算。若應使用非會員價，請自行改金額並確認。
              </div>
            ) : null}
            {/* 統一設計：直接顯示金額輸入框 + 計算說明 */}
            <div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '16px', color: '#666', fontWeight: '500' }}>$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="請輸入金額"
                  value={isAmountFocused 
                    ? (item.amount ?? '') 
                    : (item.amount != null ? item.amount.toLocaleString() : '')}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '')
                    onUpdate({ amount: value === '' ? 0 : parseInt(value) })
                  }}
                  onFocus={() => setIsAmountFocused(true)}
                  onBlur={() => setIsAmountFocused(false)}
                  style={{
                    flex: 1,
                    padding: '12px 14px',
                    border: '2px solid #667eea',
                    borderRadius: '8px',
                    fontSize: '18px',
                    fontWeight: '600',
                    background: '#f8f9ff'
                  }}
                />
              </div>
              {/* 計算說明 */}
              <div style={{ 
                marginTop: '8px',
                fontSize: '13px', 
                color: '#666',
                background: '#f5f5f5',
                padding: '8px 12px',
                borderRadius: '6px',
                lineHeight: 1.5
              }}>
                {isDesignatedLessonFromBalance ? (
                  coachPrice30min 
                    ? <>📝 ${coachPrice30min.toLocaleString()}/30分 ÷ 30 × {defaultMinutes}分 = <strong>${item.amount?.toLocaleString() || '?'}</strong> <span style={{ color: '#999' }}>(無條件捨去)</span></>
                    : <>📝 指定課費用 <span style={{ color: '#999' }}></span></>
                ) : isBalance ? (
                  boatData?.balance_price_per_hour 
                    ? <>📝 ${boatData.balance_price_per_hour.toLocaleString()}/時 ÷ 60 × {defaultMinutes}分 = <strong>${item.amount?.toLocaleString() || '?'}</strong> <span style={{ color: '#999' }}>(無條件捨去)</span></>
                    : <>📝 儲值扣款 <span style={{ color: '#999' }}></span></>
                ) : isVipVoucher ? (
                  boatData?.vip_price_per_hour 
                    ? <>📝 ${boatData.vip_price_per_hour.toLocaleString()}/時 ÷ 60 × {defaultMinutes}分 = <strong>${item.amount?.toLocaleString() || '?'}</strong> <span style={{ color: '#999' }}>(無條件捨去)</span></>
                    : <>📝 VIP 票券扣款 <span style={{ color: '#999' }}></span></>
                ) : (
                  <>📝 扣款金額 <span style={{ color: '#999' }}></span></>
                )}
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
            {/* 統一設計：直接顯示時數輸入框 */}
            <div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="請輸入分鐘數"
                  value={item.minutes ?? ''}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '')
                    onUpdate({ minutes: value === '' ? 0 : parseInt(value) })
                  }}
                  style={{
                    flex: 1,
                    padding: '12px 14px',
                    border: '2px solid #667eea',
                    borderRadius: '8px',
                    fontSize: '18px',
                    fontWeight: '600',
                    background: '#f8f9ff'
                  }}
                />
                <span style={{ fontSize: '14px', color: '#666' }}>分鐘</span>
              </div>
              {/* 說明 */}
              <div style={{ 
                marginTop: '8px',
                fontSize: '13px', 
                color: '#666',
                background: '#f5f5f5',
                padding: '8px 12px',
                borderRadius: '6px'
              }}>
                📝 依教練回報 {defaultMinutes} 分鐘帶入 <span style={{ color: '#999' }}></span>
              </div>
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
              fontSize: '16px', // 16px 防止 iOS 縮放
              color: '#495057',
              minHeight: '80px',
              resize: 'vertical',
              fontFamily: 'inherit'
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

