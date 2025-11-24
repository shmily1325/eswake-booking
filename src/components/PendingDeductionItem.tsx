import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/supabase'

// 扣款明細類型
type DeductionCategory = 'balance' | 'boat_voucher_g23' | 'boat_voucher_g21_panther' | 'designated_lesson' | 'package' | 'gift_boat_hours'

interface DeductionDetail {
  id: string // 臨時ID，用於前端管理
  category: DeductionCategory
  amount?: number // 金額（儲值用）
  minutes?: number // 時數（其他類別用）
  packageName?: string // 方案名稱
}

interface PendingDeductionItemProps {
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

export function PendingDeductionItem({ report, onComplete }: PendingDeductionItemProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [deductions, setDeductions] = useState<DeductionDetail[]>([
    {
      id: '1',
      category: 'boat_voucher_g23', // 預設船券
      minutes: report.duration_min, // 來自教練回報
    }
  ])
  const [loading, setLoading] = useState(false)
  const [memberData, setMemberData] = useState<any>(null)

  // 載入會員資料
  const loadMemberData = async () => {
    if (!report.member_id || memberData) return
    
    const { data } = await supabase
      .from('members')
      .select('*')
      .eq('id', report.member_id)
      .single()
    
    if (data) setMemberData(data)
  }

  // 展開時載入會員資料
  const handleToggle = () => {
    if (!isExpanded) {
      loadMemberData()
    }
    setIsExpanded(!isExpanded)
  }

  // 新增扣款項目
  const addDeduction = () => {
    const newDeduction: DeductionDetail = {
      id: Date.now().toString(),
      category: 'boat_voucher_g23',
      minutes: report.duration_min,
    }
    setDeductions([...deductions, newDeduction])
  }

  // 刪除扣款項目
  const removeDeduction = (id: string) => {
    if (deductions.length === 1) {
      alert('至少需要一個扣款項目')
      return
    }
    setDeductions(deductions.filter(d => d.id !== id))
  }

  // 更新扣款項目
  const updateDeduction = (id: string, updates: Partial<DeductionDetail>) => {
    setDeductions(deductions.map(d => 
      d.id === id ? { ...d, ...updates } : d
    ))
  }

  // 確認扣款
  const handleConfirm = async () => {
    if (!report.member_id) {
      alert('非會員無法扣款')
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
      for (const deduction of deductions) {
        // 根據類別更新會員餘額
        const updates: any = {}
        const transactionData: any = {
          member_id: report.member_id,
          booking_participant_id: report.id,
          transaction_type: 'consume',
          category: deduction.category,
          description,
          transaction_date: new Date().toISOString().split('T')[0],
          operator_id: (await supabase.auth.getUser()).data.user?.id
        }

        if (deduction.category === 'balance') {
          // 扣儲值（金額）
          const newBalance = (memberData.balance || 0) - (deduction.amount || 0)
          updates.balance = newBalance
          transactionData.amount = -(deduction.amount || 0)
          transactionData.balance_after = newBalance
        } else {
          // 扣時數
          const minutesField = getCategoryField(deduction.category)
          const newMinutes = (memberData[minutesField] || 0) - (deduction.minutes || 0)
          updates[minutesField] = newMinutes
          transactionData.minutes = -(deduction.minutes || 0)
          transactionData[`${minutesField}_after`] = newMinutes
        }

        // 如果是方案，記錄方案名稱
        if (deduction.category === 'package' && deduction.packageName) {
          transactionData.notes = deduction.packageName
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
    switch (category) {
      case 'boat_voucher_g23': return 'boat_voucher_g23_minutes'
      case 'boat_voucher_g21_panther': return 'boat_voucher_g21_panther_minutes'
      case 'designated_lesson': return 'designated_lesson_minutes'
      case 'gift_boat_hours': return 'gift_boat_hours'
      default: return ''
    }
  }

  // 格式化時間
  const formatTime = (datetime: string) => {
    return new Date(datetime).toLocaleTimeString('zh-TW', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    })
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
            {report.bookings.boats?.name} • {formatTime(report.bookings.start_at)} • {report.coaches?.name} ({report.duration_min}分)
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
          {deductions.map((deduction, index) => (
            <DeductionDetailItem
              key={deduction.id}
              index={index + 1}
              deduction={deduction}
              memberData={memberData}
              defaultMinutes={report.duration_min}
              onUpdate={(updates) => updateDeduction(deduction.id, updates)}
              onRemove={() => removeDeduction(deduction.id)}
              canRemove={deductions.length > 1}
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
              onClick={addDeduction}
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
                cursor: report.member_id ? 'pointer' : 'not-allowed'
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
interface DeductionDetailItemProps {
  index: number
  deduction: DeductionDetail
  memberData: any
  defaultMinutes: number
  onUpdate: (updates: Partial<DeductionDetail>) => void
  onRemove: () => void
  canRemove: boolean
}

function DeductionDetailItem({ 
  index, 
  deduction, 
  memberData,
  defaultMinutes,
  onUpdate, 
  onRemove,
  canRemove 
}: DeductionDetailItemProps) {
  const categories = [
    { value: 'boat_voucher_g23', label: '🚤 G23船券', unit: '分' },
    { value: 'boat_voucher_g21_panther', label: '🚤 G21/黑豹券', unit: '分' },
    { value: 'designated_lesson', label: '🎓 指定課時數', unit: '分' },
    { value: 'balance', label: '💰 儲值', unit: '元' },
    { value: 'package', label: '⭐ 方案', unit: '分' },
    { value: 'gift_boat_hours', label: '🎁 贈送時數', unit: '分' },
  ]

  const currentCategory = categories.find(c => c.value === deduction.category)
  const isBalance = deduction.category === 'balance'
  const isPackage = deduction.category === 'package'

  // 計算餘額
  const calculateBalance = () => {
    if (!memberData) return { before: 0, after: 0 }
    
    if (isBalance) {
      const before = memberData.balance || 0
      const after = before - (deduction.amount || 0)
      return { before, after }
    } else {
      const field = getCategoryField(deduction.category)
      const before = memberData[field] || 0
      const after = before - (deduction.minutes || 0)
      return { before, after }
    }
  }

  const balance = calculateBalance()

  const getCategoryField = (category: DeductionCategory): string => {
    switch (category) {
      case 'boat_voucher_g23': return 'boat_voucher_g23_minutes'
      case 'boat_voucher_g21_panther': return 'boat_voucher_g21_panther_minutes'
      case 'designated_lesson': return 'designated_lesson_minutes'
      case 'gift_boat_hours': return 'gift_boat_hours'
      default: return ''
    }
  }

  return (
    <div style={{
      background: '#f9f9f9',
      borderRadius: '8px',
      padding: '12px',
      marginBottom: '12px',
      border: '1px solid #e0e0e0'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div style={{ fontSize: '14px', fontWeight: '600' }}>明細 {index}</div>
        {canRemove && (
          <button
            onClick={onRemove}
            style={{
              padding: '4px 8px',
              background: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            🗑 刪除
          </button>
        )}
      </div>

      {/* 類別選擇 */}
      <div style={{ marginBottom: '12px' }}>
        <select
          value={deduction.category}
          onChange={(e) => {
            const newCategory = e.target.value as DeductionCategory
            const updates: Partial<DeductionDetail> = { category: newCategory }
            
            // 切換類別時重置值
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
            padding: '8px',
            borderRadius: '6px',
            border: '1px solid #ddd',
            fontSize: '14px'
          }}
        >
          {categories.map(cat => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>
      </div>

      {/* 金額/時數選擇 */}
      <div style={{ marginBottom: '12px' }}>
        {isBalance ? (
          // 儲值：金額按鈕
          <div>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>扣款金額：</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[500, 1000, 1500, 2000].map(amount => (
                <button
                  key={amount}
                  onClick={() => onUpdate({ amount })}
                  style={{
                    padding: '8px 16px',
                    background: deduction.amount === amount ? '#4a90e2' : 'white',
                    color: deduction.amount === amount ? 'white' : '#333',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  ${amount}
                </button>
              ))}
              <input
                type="number"
                placeholder="自訂"
                value={deduction.amount || ''}
                onChange={(e) => onUpdate({ amount: parseInt(e.target.value) || 0 })}
                style={{
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  width: '80px'
                }}
              />
            </div>
          </div>
        ) : (
          // 其他：時數按鈕
          <div>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>扣款時數：</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[30, 60, 90, 120].map(minutes => (
                <button
                  key={minutes}
                  onClick={() => onUpdate({ minutes })}
                  style={{
                    padding: '8px 16px',
                    background: deduction.minutes === minutes ? '#4a90e2' : 'white',
                    color: deduction.minutes === minutes ? 'white' : '#333',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  {minutes}分
                </button>
              ))}
              <input
                type="number"
                placeholder="自訂"
                value={deduction.minutes || ''}
                onChange={(e) => onUpdate({ minutes: parseInt(e.target.value) || 0 })}
                style={{
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  width: '80px'
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 方案名稱 */}
      {isPackage && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>方案名稱：</div>
          <input
            type="text"
            placeholder="例：9999暢滑方案"
            value={deduction.packageName || ''}
            onChange={(e) => onUpdate({ packageName: e.target.value })}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
        </div>
      )}

      {/* 餘額顯示 */}
      {memberData && (
        <div style={{
          padding: '8px',
          background: balance.after < 0 ? '#ffebee' : '#e8f5e9',
          borderRadius: '6px',
          fontSize: '13px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>餘額：</span>
          <span>
            {isBalance ? `$${balance.before}` : `${balance.before}分`}
            <span style={{ margin: '0 8px' }}>→</span>
            <span style={{ 
              fontWeight: '600',
              color: balance.after < 0 ? '#f44336' : '#4CAF50'
            }}>
              {isBalance ? `$${balance.after}` : `${balance.after}分`}
            </span>
          </span>
        </div>
      )}
    </div>
  )
}

