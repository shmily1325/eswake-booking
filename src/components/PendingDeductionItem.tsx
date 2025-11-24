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

// 扣款明細
interface DeductionItem {
  id: string
  category: DeductionCategory
  amount?: number  // 金額（儲值用）
  minutes?: number // 時數（其他類別用）
  planName?: string // 方案名稱
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
  
  // 根據船隻自動判斷預設類別
  const getDefaultCategory = (): DeductionCategory => {
    const boatName = report.bookings.boats?.name || ''
    
    if (boatName.includes('G23') || boatName.includes('23')) {
      return 'boat_voucher_g23'
    } else if (boatName.includes('G21') || boatName.includes('21') || boatName.includes('黑豹')) {
      return 'boat_voucher_g21_panther'
    } else if (boatName.includes('粉紅') || boatName.includes('200')) {
      return 'balance'
    }
    
    // 預設：G23船券
    return 'boat_voucher_g23'
  }
  
  const defaultCategory = getDefaultCategory()
  
  const [items, setItems] = useState<DeductionItem[]>([
    {
      id: '1',
      category: defaultCategory,
      minutes: defaultCategory === 'balance' ? undefined : report.duration_min,
      amount: defaultCategory === 'balance' ? 1000 : undefined
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
      minutes: defaultCat === 'balance' ? undefined : report.duration_min,
      amount: defaultCat === 'balance' ? 1000 : undefined
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
      // 生成說明
      const boatName = report.bookings.boats?.name || '未知'
      const coachName = report.coaches?.name || '未知'
      const contactName = report.bookings.contact_name
      const description = `${boatName} ${report.duration_min}分 ${coachName}教課 (${contactName})`

      // 處理每筆扣款
      for (const item of items) {
        const updates: any = {}
        const transactionData: any = {
          member_id: report.member_id,
          booking_participant_id: report.id,
          transaction_type: 'consume',
          category: item.category,
          description: description,
          transaction_date: new Date().toISOString().split('T')[0],
          operator_id: (await supabase.auth.getUser()).data.user?.id
        }

        // 根據類別處理
        if (item.category === 'balance') {
          // 扣儲值金額
          const newBalance = (memberData.balance || 0) - (item.amount || 0)
          updates.balance = newBalance
          transactionData.amount = -(item.amount || 0)
          transactionData.balance_after = newBalance
        } else {
          // 扣時數
          const field = getCategoryField(item.category)
          const current = memberData[field] || 0
          const newValue = current - (item.minutes || 0)
          updates[field] = newValue
          transactionData.minutes = -(item.minutes || 0)
          transactionData[`${field}_after`] = newValue
        }

        // 如果是方案，記錄方案名稱
        if (item.category === 'plan' && item.planName) {
          transactionData.notes = item.planName
        }

        // 更新會員餘額
        const { error: updateError } = await supabase
          .from('members')
          .update(updates)
          .eq('id', report.member_id)

        if (updateError) throw updateError

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
              onUpdate={(updates) => updateItem(item.id, updates)}
              onRemove={() => removeItem(item.id)}
              canRemove={items.length > 1}
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
  onUpdate: (updates: Partial<DeductionItem>) => void
  onRemove: () => void
  canRemove: boolean
}

function DeductionItemRow({ 
  index, 
  item, 
  memberData,
  defaultMinutes,
  onUpdate, 
  onRemove,
  canRemove 
}: DeductionItemRowProps) {
  const categories = [
    { value: 'boat_voucher_g23', label: '🚤 G23船券', emoji: '🚤' },
    { value: 'boat_voucher_g21_panther', label: '🚤 G21/黑豹券', emoji: '🚤' },
    { value: 'designated_lesson', label: '🎓 指定課時數', emoji: '🎓' },
    { value: 'balance', label: '💰 儲值', emoji: '💰' },
    { value: 'plan', label: '⭐ 方案', emoji: '⭐' },
    { value: 'gift_boat_hours', label: '🎁 贈送時數', emoji: '🎁' },
  ]

  const isBalance = item.category === 'balance'
  const isPlan = item.category === 'plan'
  const currentCategory = categories.find(c => c.value === item.category)

  // 計算餘額
  const calculateBalance = () => {
    if (!memberData) return { before: 0, after: 0 }
    
    if (isBalance) {
      const before = memberData.balance || 0
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
      background: 'linear-gradient(to bottom, #ffffff, #f8f9fa)',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '12px',
      border: '1px solid #e0e0e0',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
    }}>
      {/* 標題欄 */}
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
          <span style={{ fontSize: '24px' }}>{currentCategory?.emoji}</span>
          <span style={{ 
            fontSize: '15px', 
            fontWeight: '600',
            color: '#2c3e50'
          }}>
            明細 {index}
          </span>
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

      {/* 類別選擇 */}
      <div style={{ marginBottom: '14px' }}>
        <select
          value={item.category}
          onChange={(e) => {
            const newCategory = e.target.value as DeductionCategory
            const updates: Partial<DeductionItem> = { category: newCategory }
            
            if (newCategory === 'balance') {
              updates.amount = 1000
              updates.minutes = undefined
            } else {
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
        {isBalance ? (
          <div>
            <div style={{ 
              fontSize: '13px', 
              color: '#7f8c8d', 
              marginBottom: '8px',
              fontWeight: '500'
            }}>
              扣款金額：
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[500, 1000, 1500, 2000].map(amount => (
                <button
                  key={amount}
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
                    transition: 'all 0.2s'
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
              ))}
              <input
                type="number"
                placeholder="自訂"
                value={item.amount || ''}
                onChange={(e) => onUpdate({ amount: parseInt(e.target.value) || 0 })}
                style={{
                  padding: '10px 12px',
                  border: '2px solid #94a3b8',
                  borderRadius: '8px',
                  width: '100px',
                  fontSize: '14px',
                  fontWeight: '600',
                  background: 'white'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#667eea'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#94a3b8'}
              />
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
              {[30, 60, 90, 120].map(minutes => (
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
              <input
                type="number"
                placeholder="自訂"
                value={item.minutes || ''}
                onChange={(e) => onUpdate({ minutes: parseInt(e.target.value) || 0 })}
                style={{
                  padding: '10px 12px',
                  border: '2px solid #94a3b8',
                  borderRadius: '8px',
                  width: '80px',
                  fontSize: '14px',
                  fontWeight: '600',
                  textAlign: 'center',
                  background: 'white'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#667eea'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#94a3b8'}
              />
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
              {isBalance ? `$${balance.before}` : `${balance.before}分`}
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
              {isBalance ? `$${balance.after}` : `${balance.after}分`}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

