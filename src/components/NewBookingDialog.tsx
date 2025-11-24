import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { logBookingCreation } from '../utils/auditLog'
import { useResponsive } from '../hooks/useResponsive'
import { useBookingForm } from '../hooks/useBookingForm'



interface NewBookingDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  defaultBoatId: number
  defaultStartTime: string
  user: User
}

export function NewBookingDialog({
  isOpen,
  onClose,
  onSuccess,
  defaultBoatId,
  defaultStartTime,
  user,
}: NewBookingDialogProps) {

  const { isMobile } = useResponsive()

  // 使用 useBookingForm Hook
  const {
    // State
    boats,
    selectedBoatId,
    coaches,
    selectedCoaches,
    members,
    memberSearchTerm,
    selectedMemberIds,
    showMemberDropdown,
    manualStudentName,
    manualNames,
    startDate,
    startTime,
    durationMin,
    activityTypes,
    notes,
    requiresDriver,
    error,
    loading,
    loadingCoaches,

    // Derived
    selectedCoachesSet,
    activityTypesSet,
    filteredMembers,
    finalStudentName,
    isSelectedBoatFacility,
    canRequireDriver,

    // Setters
    setSelectedBoatId,
    setSelectedCoaches,
    setMemberSearchTerm,
    setSelectedMemberIds,
    setShowMemberDropdown,
    setManualStudentName,
    setManualNames,
    setStartDate,
    setStartTime,
    setDurationMin,
    setNotes,
    setRequiresDriver,
    setError,
    setLoading,

    // Actions
    fetchAllData,
    toggleCoach,
    toggleActivityType,
    handleMemberSearch,
    performConflictCheck,
    resetForm
  } = useBookingForm({
    defaultBoatId,
    defaultDate: defaultStartTime
  })

  // 重複預約相關狀態 (保留在組件內)
  const [isRepeat, setIsRepeat] = useState(false)
  const [repeatCount, setRepeatCount] = useState(8)
  const [repeatEndDate, setRepeatEndDate] = useState('')

  useEffect(() => {
    if (isOpen) {
      fetchAllData()
    }
  }, [isOpen])

  const generateRepeatDates = (): Date[] => {
    const [year, month, day] = startDate.split('-').map(Number)
    const [hour, minute] = startTime.split(':').map(Number)
    const baseDateTime = new Date(year, month - 1, day, hour, minute, 0)

    if (!isRepeat) {
      return [baseDateTime]
    }

    const dates: Date[] = []
    const currentDate = new Date(baseDateTime)

    if (repeatEndDate) {
      const [endYear, endMonth, endDay] = repeatEndDate.split('-').map(Number)
      const endDate = new Date(endYear, endMonth - 1, endDay, 23, 59, 59)
      while (currentDate <= endDate) {
        dates.push(new Date(currentDate))
        currentDate.setDate(currentDate.getDate() + 7)
      }
    } else {
      for (let i = 0; i < repeatCount; i++) {
        dates.push(new Date(currentDate))
        currentDate.setDate(currentDate.getDate() + 7)
      }
    }

    return dates
  }

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // ... validation logic ...

    setLoading(true)

    try {
      const datesToCreate = generateRepeatDates()

      if (datesToCreate.length === 0) {
        setError('沒有可創建的預約日期')
        setLoading(false)
        return
      }

      // 用於追蹤結果
      const results = {
        success: [] as string[],
        skipped: [] as { date: string; reason: string }[],
      }

      // 獲取船名稱（用於審計日誌和衝突檢查）
      const { data: boatData } = await supabase
        .from('boats')
        .select('name')
        .eq('id', selectedBoatId)
        .single()
      const boatName = boatData?.name || '未知船隻'



      // 對每個日期進行處理
      for (const dateTime of datesToCreate) {
        // 使用本地日期組件構建 ISO 字符串（避免時區偏移）
        const year = dateTime.getFullYear()
        const month = (dateTime.getMonth() + 1).toString().padStart(2, '0')
        const day = dateTime.getDate().toString().padStart(2, '0')
        const hours = dateTime.getHours().toString().padStart(2, '0')
        const minutes = dateTime.getMinutes().toString().padStart(2, '0')
        const dateStr = `${year}-${month}-${day}`
        const timeStr = `${hours}:${minutes}`
        const displayDate = `${dateStr} ${timeStr}`

        // 手動構建 ISO 字符串（TEXT 格式，不含時區）
        const newStartAt = `${dateStr}T${timeStr}:00`

        // 使用 Hook 檢查衝突
        const conflictResult = await performConflictCheck()

        // 如果有衝突，跳過這個日期
        if (conflictResult.hasConflict) {
          results.skipped.push({ date: displayDate, reason: conflictResult.reason })
          continue
        }

        // ... existing insertion logic ...



        // 創建預約
        const bookingToInsert = {
          boat_id: selectedBoatId,
          member_id: selectedMemberIds[0] || null,  // 主要會員 ID（向下相容）
          contact_name: finalStudentName,           // 聯絡人姓名
          contact_phone: null,                      // TODO: 之後可以加電話
          start_at: newStartAt,
          duration_min: durationMin,
          activity_types: activityTypes.length > 0 ? activityTypes : null,
          notes: notes || null,
          requires_driver: requiresDriver,          // 是否需要駕駛
          status: 'confirmed',
          created_by: user.id,
          created_at: (() => {
            // 使用本地時間格式（TEXT，不含時區）
            const now = new Date()
            const year = now.getFullYear()
            const month = String(now.getMonth() + 1).padStart(2, '0')
            const day = String(now.getDate()).padStart(2, '0')
            const hour = String(now.getHours()).padStart(2, '0')
            const minute = String(now.getMinutes()).padStart(2, '0')
            const second = String(now.getSeconds()).padStart(2, '0')
            return `${year}-${month}-${day}T${hour}:${minute}:${second}`
          })(),
        }

        const { data: insertedBooking, error: insertError } = await supabase
          .from('bookings')
          .insert([bookingToInsert])
          .select('id')
          .single()

        if (insertError) {
          results.skipped.push({
            date: displayDate,
            reason: insertError.message || '插入失敗'
          })
          continue
        }

        // 插入教練關聯（有教練記錄 = 指定教練）
        if (selectedCoaches.length > 0 && insertedBooking) {
          const bookingCoachesToInsert = selectedCoaches.map(coachId => ({
            booking_id: insertedBooking.id,
            coach_id: coachId,
          }))

          const { error: coachInsertError } = await supabase
            .from('booking_coaches')
            .insert(bookingCoachesToInsert)

          if (coachInsertError) {
            // 如果插入教練關聯失敗，刪除剛剛創建的預約
            await supabase.from('bookings').delete().eq('id', insertedBooking.id)
            results.skipped.push({
              date: displayDate,
              reason: '插入教練關聯失敗'
            })
            continue
          }
        }

        // 插入會員關聯（V5 新增：支援多會員）
        if (selectedMemberIds.length > 0 && insertedBooking) {
          const bookingMembersToInsert = selectedMemberIds.map(memberId => {
            // 使用本地時間格式（TEXT，不含時區）
            const now = new Date()
            const year = now.getFullYear()
            const month = String(now.getMonth() + 1).padStart(2, '0')
            const day = String(now.getDate()).padStart(2, '0')
            const hour = String(now.getHours()).padStart(2, '0')
            const minute = String(now.getMinutes()).padStart(2, '0')
            const second = String(now.getSeconds()).padStart(2, '0')
            const createdAt = `${year}-${month}-${day}T${hour}:${minute}:${second}`

            return {
              booking_id: insertedBooking.id,
              member_id: memberId,
              created_at: createdAt
            }
          })

          const { error: memberInsertError } = await supabase
            .from('booking_members')
            .insert(bookingMembersToInsert)

          if (memberInsertError) {
            console.error('插入會員關聯失敗:', memberInsertError)
            // 不中斷流程，只記錄錯誤
          }
        }

        // 記錄到審計日誌（人類可讀格式）
        const coachNames = selectedCoaches.length > 0
          ? coaches.filter(c => selectedCoaches.includes(c.id)).map(c => c.name)
          : []

        await logBookingCreation({
          userEmail: user.email || '',
          studentName: finalStudentName,
          boatName,
          startTime: newStartAt,
          durationMin,
          coachNames
        })

        // 記錄成功
        results.success.push(displayDate)
      }

      // 顯示結果
      if (results.success.length === 0) {
        // 顯示詳細的衝突原因
        let errorMessage = ''
        results.skipped.forEach(({ date, reason }, index) => {
          if (index > 0) errorMessage += '\n\n'
          errorMessage += `${date}\n${reason}`
        })
        setError(errorMessage)
        setLoading(false)
        return
      }

      // 如果有跳過的，顯示詳細報告
      if (results.skipped.length > 0) {
        let message = `✅ 成功創建 ${results.success.length} 個預約\n⚠️ 跳過 ${results.skipped.length} 個衝突:\n\n`
        results.skipped.forEach(({ date, reason }) => {
          message += `• ${date}: ${reason}\n`
        })
        alert(message)
      }

      // Success - 重置表單
      resetForm()
      setIsRepeat(false)
      setRepeatCount(8)
      setRepeatEndDate('')
      setLoading(false)
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || '新增失敗')
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      resetForm()
      setIsRepeat(false)
      setRepeatCount(8)
      setRepeatEndDate('')
      onClose()
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
        overflowY: 'auto',
      }}
      onClick={handleClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '500px',
          color: '#000',
          maxHeight: '90vh',
          overflowY: 'auto',
          margin: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, color: '#000', fontSize: '20px' }}>新增預約</h2>

        <form onSubmit={handleSubmit}>
          {/* 預約人選擇（會員搜尋或手動輸入） */}
          <div style={{ marginBottom: '18px', position: 'relative' }}>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              color: '#000',
              fontSize: '15px',
              fontWeight: '500',
            }}>
              預約人 {selectedMemberIds.length > 0 && <span style={{ color: '#4caf50', fontSize: '13px' }}>（已選 {selectedMemberIds.length} 位）</span>}
            </label>

            {/* 已選會員和手動輸入標籤 */}
            {(selectedMemberIds.length > 0 || manualNames.length > 0) && (
              <div style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {/* 會員標籤（淺藍底色 - 與教練統一） */}
                {selectedMemberIds.map(memberId => {
                  const member = members.find(m => m.id === memberId)
                  return member ? (
                    <span key={memberId} style={{
                      padding: '6px 12px',
                      background: '#dbeafe',
                      color: '#1e40af',
                      border: '1px solid #3b82f6',
                      borderRadius: '6px',
                      fontSize: '15px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: '600'
                    }}>
                      {member.nickname || member.name}
                      <button
                        type="button"
                        onClick={() => setSelectedMemberIds(prev => prev.filter(id => id !== memberId))}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#1e40af',
                          cursor: 'pointer',
                          padding: '0',
                          fontSize: '18px',
                          lineHeight: '1'
                        }}
                      >×</button>
                    </span>
                  ) : null
                })}

                {/* 非會員標籤（白底虛線邊框） */}
                {manualNames.map((name, index) => (
                  <span key={index} style={{
                    padding: '6px 12px',
                    background: 'white',
                    color: '#666',
                    border: '1.5px dashed #ccc',
                    borderRadius: '6px',
                    fontSize: '15px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: '500'
                  }}>
                    {name}
                    <button
                      type="button"
                      onClick={() => setManualNames(prev => prev.filter((_, i) => i !== index))}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#999',
                        cursor: 'pointer',
                        padding: '0',
                        fontSize: '18px',
                        lineHeight: '1'
                      }}
                    >×</button>
                  </span>
                ))}
              </div>
            )}

            {/* 搜尋會員 */}
            <input
              type="text"
              value={memberSearchTerm}
              onChange={(e) => {
                const value = e.target.value
                setMemberSearchTerm(value)

                handleMemberSearch(value)
              }}
              onFocus={() => {
                if (memberSearchTerm.trim()) {
                  setShowMemberDropdown(true)
                }
              }}
              placeholder="搜尋會員暱稱/姓名/電話...（可多選）"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: selectedMemberIds.length > 0 ? '2px solid #4caf50' : '1px solid #ccc',
                boxSizing: 'border-box',
                fontSize: '16px',
                touchAction: 'manipulation',
              }}
            />

            {/* 會員下拉選單 */}
            {showMemberDropdown && filteredMembers.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                maxHeight: '200px',
                overflowY: 'auto',
                background: 'white',
                border: '1px solid #ccc',
                borderRadius: '8px',
                marginTop: '4px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: 1000,
              }}>
                {filteredMembers.map((member) => {
                  const isSelected = selectedMemberIds.includes(member.id)
                  return (
                    <div
                      key={member.id}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedMemberIds(prev => prev.filter(id => id !== member.id))
                        } else {
                          setSelectedMemberIds(prev => [...prev, member.id])
                        }
                        setMemberSearchTerm('')
                        setShowMemberDropdown(false)
                      }}
                      style={{
                        padding: '12px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f0f0f0',
                        transition: 'background 0.2s',
                        background: isSelected ? '#e8f5e9' : 'white'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = isSelected ? '#c8e6c9' : '#f5f5f5'}
                      onMouseLeave={(e) => e.currentTarget.style.background = isSelected ? '#e8f5e9' : 'white'}
                    >
                      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                        {isSelected && '✓ '}{member.nickname || member.name}
                        {member.nickname && <span style={{ color: '#666', fontWeight: 'normal', marginLeft: '6px' }}>({member.name})</span>}
                      </div>
                      {member.phone && (
                        <div style={{ fontSize: '13px', color: '#999' }}>
                          📱 {member.phone}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* 或手動輸入（非會員） */}
            <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'stretch' }}>
              <input
                type="text"
                value={manualStudentName}
                onChange={(e) => setManualStudentName(e.target.value)}
                onKeyDown={(e) => {
                  // 檢查是否正在使用輸入法（避免中文輸入時 Enter 確認選字被誤觸發）
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing && manualStudentName.trim()) {
                    e.preventDefault()
                    setManualNames(prev => [...prev, manualStudentName.trim()])
                    setManualStudentName('')
                  }
                }}
                placeholder="或直接輸入姓名（非會員/首次體驗）"
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #ff9800',
                  boxSizing: 'border-box',
                  fontSize: '16px',
                  touchAction: 'manipulation',
                }}
              />
              <button
                type="button"
                onClick={() => {
                  if (manualStudentName.trim()) {
                    setManualNames(prev => [...prev, manualStudentName.trim()])
                    setManualStudentName('')
                  }
                }}
                disabled={!manualStudentName.trim()}
                style={{
                  padding: '0 20px',
                  background: manualStudentName.trim() ? '#ff9800' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '20px',
                  fontWeight: 'bold',
                  cursor: manualStudentName.trim() ? 'pointer' : 'not-allowed',
                  minWidth: '52px',
                  touchAction: 'manipulation',
                }}
              >
                +
              </button>
            </div>

            {/* 清除所有會員選擇 */}
            {selectedMemberIds.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedMemberIds([])
                  setMemberSearchTerm('')
                }}
                style={{
                  marginTop: '8px',
                  padding: '6px 12px',
                  background: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                清除所有會員
              </button>
            )}
          </div>

          {/* 船隻選擇 - 大按鈕 */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{
              display: 'block',
              marginBottom: '10px',
              color: '#000',
              fontSize: '15px',
              fontWeight: '600',
            }}>
              船隻
            </label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '10px',
            }}>
              {boats.map(boat => {
                const isSelected = selectedBoatId === boat.id
                return (
                  <button
                    key={boat.id}
                    type="button"
                    onClick={() => setSelectedBoatId(boat.id)}
                    style={{
                      padding: '14px 8px',
                      border: isSelected ? '2px solid #3b82f6' : '1px solid #e0e0e0',
                      borderRadius: '8px',
                      background: isSelected ? '#dbeafe' : 'white',
                      color: '#333',
                      fontSize: '15px',
                      fontWeight: isSelected ? '600' : '500',
                      cursor: 'pointer',
                    }}
                    onTouchStart={(e) => {
                      e.currentTarget.style.background = isSelected ? '#dbeafe' : '#fafafa'
                    }}
                    onTouchEnd={(e) => {
                      e.currentTarget.style.background = isSelected ? '#dbeafe' : 'white'
                    }}
                  >
                    {boat.name}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 教練選擇 - 大按鈕 */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{
              display: 'block',
              marginBottom: '10px',
              color: '#000',
              fontSize: '15px',
              fontWeight: '600',
            }}>
              教練（可複選）
            </label>

            {/* 已選教練顯示 */}
            {selectedCoaches.length > 0 && (
              <div style={{
                marginBottom: '12px',
                padding: '12px 14px',
                background: '#dbeafe',
                borderRadius: '8px',
                border: '2px solid #3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flex: 1,
                  minWidth: 0,
                }}>
                  <span style={{ color: '#1e40af', fontSize: '15px', fontWeight: '600', flexShrink: 0 }}>
                    已選：
                  </span>
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    flex: 1,
                  }}>
                    {selectedCoaches.map(coachId => {
                      const coach = coaches.find(c => c.id === coachId)
                      return coach ? (
                        <span
                          key={coachId}
                          style={{
                            padding: '6px 12px',
                            background: 'white',
                            borderRadius: '6px',
                            border: '1px solid #3b82f6',
                            color: '#1e40af',
                            fontSize: '15px',
                            fontWeight: '600',
                          }}
                        >
                          {coach.name}
                        </span>
                      ) : null
                    })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCoaches([])}
                  style={{
                    padding: '6px 12px',
                    background: 'white',
                    border: '1px solid #3b82f6',
                    borderRadius: '6px',
                    color: '#1e40af',
                    fontSize: '13px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    flexShrink: 0,
                  }}
                >
                  清除
                </button>
              </div>
            )}

            {loadingCoaches ? (
              <div style={{ padding: '12px', color: '#666', fontSize: '14px' }}>
                載入教練列表中...
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '10px',
              }}>
                {/* 不指定教練 */}
                <button
                  type="button"
                  onClick={() => setSelectedCoaches([])}
                  style={{
                    padding: '14px 10px',
                    border: selectedCoaches.length === 0 ? '2px solid #3b82f6' : '1px solid #e0e0e0',
                    borderRadius: '8px',
                    background: selectedCoaches.length === 0 ? '#dbeafe' : 'white',
                    color: '#333',
                    fontSize: '15px',
                    fontWeight: selectedCoaches.length === 0 ? '600' : '500',
                    cursor: 'pointer',
                    gridColumn: '1 / -1',
                  }}
                  onTouchStart={(e) => {
                    e.currentTarget.style.background = selectedCoaches.length === 0 ? '#dbeafe' : '#fafafa'
                  }}
                  onTouchEnd={(e) => {
                    e.currentTarget.style.background = selectedCoaches.length === 0 ? '#dbeafe' : 'white'
                  }}
                >
                  不指定教練
                </button>

                {/* 教練列表 */}
                {coaches.map((coach) => {
                  const isSelected = selectedCoachesSet.has(coach.id)
                  return (
                    <button
                      key={coach.id}
                      type="button"
                      onClick={() => toggleCoach(coach.id)}
                      style={{
                        padding: '14px 10px',
                        border: isSelected ? '2px solid #3b82f6' : '1px solid #e0e0e0',
                        borderRadius: '8px',
                        background: isSelected ? '#dbeafe' : 'white',
                        color: '#333',
                        fontSize: '15px',
                        fontWeight: isSelected ? '600' : '500',
                        cursor: 'pointer',
                      }}
                      onTouchStart={(e) => {
                        e.currentTarget.style.background = isSelected ? '#dbeafe' : '#fafafa'
                      }}
                      onTouchEnd={(e) => {
                        e.currentTarget.style.background = isSelected ? '#dbeafe' : 'white'
                      }}
                    >
                      {coach.name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* 需要駕駛勾選框 */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              cursor: canRequireDriver ? 'pointer' : 'not-allowed',
              padding: '12px',
              backgroundColor: requiresDriver ? '#dbeafe' : (canRequireDriver ? '#f8f9fa' : '#f5f5f5'),
              borderRadius: '8px',
              border: requiresDriver ? '2px solid #3b82f6' : '1px solid #e0e0e0',
              transition: 'all 0.2s',
              opacity: canRequireDriver ? 1 : 0.6,
            }}>
              <input
                type="checkbox"
                checked={requiresDriver}
                onChange={(e) => setRequiresDriver(e.target.checked)}
                disabled={!canRequireDriver}
                style={{
                  marginRight: '10px',
                  width: '18px',
                  height: '18px',
                  cursor: canRequireDriver ? 'pointer' : 'not-allowed',
                }}
              />
              <div style={{ flex: 1 }}>
                <span style={{
                  fontSize: '15px',
                  fontWeight: '500',
                  color: requiresDriver ? '#3b82f6' : (canRequireDriver ? '#333' : '#999'),
                }}>
                  需要駕駛（勾選後在排班時必須指定駕駛）
                </span>
                {!canRequireDriver && (
                  <div style={{ fontSize: '12px', color: '#f59e0b', marginTop: '4px' }}>
                    {isSelectedBoatFacility ? '⚠️ 彈簧床不需要駕駛' : '⚠️ 未指定教練不能選駕駛'}
                  </div>
                )}
              </div>
            </label>
          </div>

          <div style={{ marginBottom: '18px' }}>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              color: '#000',
              fontSize: '15px',
              fontWeight: '500',
            }}>
              開始日期
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #ccc',
                boxSizing: 'border-box',
                fontSize: '16px',
                touchAction: 'manipulation',
              }}
            />
          </div>

          <div style={{ marginBottom: '18px' }}>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              color: '#000',
              fontSize: '15px',
              fontWeight: '500',
            }}>
              開始時間
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                value={startTime.split(':')[0]}
                onChange={(e) => {
                  const hour = e.target.value
                  const minute = startTime.split(':')[1] || '00'
                  setStartTime(`${hour}:${minute}`)
                }}
                required
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #ccc',
                  boxSizing: 'border-box',
                  fontSize: '16px',
                  touchAction: 'manipulation',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                }}
              >
                {Array.from({ length: 24 }, (_, i) => {
                  const hour = String(i).padStart(2, '0')
                  return <option key={hour} value={hour}>{hour}</option>
                })}
              </select>
              <select
                value={startTime.split(':')[1] || '00'}
                onChange={(e) => {
                  const hour = startTime.split(':')[0]
                  const minute = e.target.value
                  setStartTime(`${hour}:${minute}`)
                }}
                required
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #ccc',
                  boxSizing: 'border-box',
                  fontSize: '16px',
                  touchAction: 'manipulation',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                }}
              >
                <option value="00">00</option>
                <option value="15">15</option>
                <option value="30">30</option>
                <option value="45">45</option>
              </select>
            </div>
          </div>

          {/* 時長選擇 - 常用按鈕 + 自訂輸入 */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{
              display: 'block',
              marginBottom: '10px',
              color: '#000',
              fontSize: '15px',
              fontWeight: '600',
            }}>
              時長（分鐘）
            </label>

            {/* 常用時長按鈕 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '8px',
              marginBottom: '12px',
            }}>
              {[30, 60, 90, 120, 150, 180, 210, 240].map(minutes => {
                const isSelected = durationMin === minutes
                return (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => setDurationMin(minutes)}
                    style={{
                      padding: '12px 8px',
                      border: isSelected ? '3px solid #1976d2' : '2px solid #e0e0e0',
                      borderRadius: '8px',
                      background: isSelected ? '#e3f2fd' : 'white',
                      color: isSelected ? '#1976d2' : '#333',
                      fontSize: '14px',
                      fontWeight: isSelected ? '700' : '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: isSelected ? '0 2px 8px rgba(25,118,210,0.2)' : '0 1px 3px rgba(0,0,0,0.05)',
                    }}
                    onTouchStart={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.transform = 'scale(0.95)'
                      }
                    }}
                    onTouchEnd={(e) => {
                      e.currentTarget.style.transform = 'scale(1)'
                    }}
                  >
                    {minutes}
                  </button>
                )
              })}
            </div>

            {/* 自訂時長輸入 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '14px', color: '#666', flexShrink: 0 }}>自訂：</span>
              <input
                type="number"
                value={durationMin}
                onChange={(e) => {
                  const value = Number(e.target.value)
                  if (value > 0 && value <= 999) {
                    setDurationMin(value)
                  }
                }}
                min="1"
                max="999"
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '16px',
                  textAlign: 'center',
                  fontWeight: '600',
                  color: '#333',
                  boxSizing: 'border-box',
                }}
                placeholder="輸入分鐘數"
              />
              <span style={{ fontSize: '14px', color: '#666', flexShrink: 0 }}>分</span>
            </div>
          </div>

          {/* 活動類型選擇 - 大按鈕 */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{
              display: 'block',
              marginBottom: '10px',
              color: '#000',
              fontSize: '15px',
              fontWeight: '600',
            }}>
              活動類型（可複選）
            </label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '10px',
            }}>
              <button
                type="button"
                onClick={() => toggleActivityType('WB')}
                style={{
                  padding: '14px 10px',
                  border: activityTypesSet.has('WB') ? '2px solid #3b82f6' : '1px solid #e0e0e0',
                  borderRadius: '8px',
                  background: activityTypesSet.has('WB') ? '#dbeafe' : 'white',
                  color: '#333',
                  fontSize: '15px',
                  fontWeight: activityTypesSet.has('WB') ? '600' : '500',
                  cursor: 'pointer',
                }}
                onTouchStart={(e) => {
                  e.currentTarget.style.background = activityTypesSet.has('WB') ? '#dbeafe' : '#fafafa'
                }}
                onTouchEnd={(e) => {
                  e.currentTarget.style.background = activityTypesSet.has('WB') ? '#dbeafe' : 'white'
                }}
              >
                WB
              </button>
              <button
                type="button"
                onClick={() => toggleActivityType('WS')}
                style={{
                  padding: '14px 10px',
                  border: activityTypesSet.has('WS') ? '2px solid #3b82f6' : '1px solid #e0e0e0',
                  borderRadius: '8px',
                  background: activityTypesSet.has('WS') ? '#dbeafe' : 'white',
                  color: '#333',
                  fontSize: '15px',
                  fontWeight: activityTypesSet.has('WS') ? '600' : '500',
                  cursor: 'pointer',
                }}
                onTouchStart={(e) => {
                  e.currentTarget.style.background = activityTypesSet.has('WS') ? '#dbeafe' : '#fafafa'
                }}
                onTouchEnd={(e) => {
                  e.currentTarget.style.background = activityTypesSet.has('WS') ? '#dbeafe' : 'white'
                }}
              >
                WS
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '18px' }}>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              color: '#000',
              fontSize: '15px',
              fontWeight: '500',
            }}>
              註解（選填）
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="例如：初學者、特殊需求..."
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #ccc',
                boxSizing: 'border-box',
                fontSize: '15px',
                fontFamily: 'inherit',
                resize: 'vertical',
                touchAction: 'manipulation',
              }}
            />
          </div>

          {/* 重複預約功能 - 暫時隱藏，保留程式碼供未來使用 */}
          {false && <div style={{ marginBottom: '18px', padding: '14px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              marginBottom: isRepeat ? '12px' : '0',
            }}>
              <input
                type="checkbox"
                checked={isRepeat}
                onChange={(e) => setIsRepeat(e.target.checked)}
                style={{ marginRight: '8px', width: '16px', height: '16px' }}
              />
              <span style={{ fontSize: '15px', fontWeight: '500', color: '#000' }}>重複預約（每週同一時間）</span>
            </label>

            {isRepeat && (
              <div style={{ marginTop: '12px', paddingLeft: '24px' }}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#666' }}>
                    重複次數（含首次）
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="52"
                    value={repeatCount}
                    onChange={(e) => {
                      setRepeatCount(Number(e.target.value))
                      setRepeatEndDate('')
                    }}
                    disabled={!!repeatEndDate}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '6px',
                      border: '1px solid #ccc',
                      fontSize: '15px',
                      backgroundColor: repeatEndDate ? '#f5f5f5' : 'white',
                    }}
                  />
                </div>

                <div style={{ textAlign: 'center', margin: '10px 0', color: '#999', fontSize: '13px' }}>
                  或
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#666' }}>
                    重複至日期
                  </label>
                  <input
                    type="date"
                    value={repeatEndDate}
                    onChange={(e) => {
                      // 驗證結束日期不能早於開始日期
                      if (e.target.value && e.target.value < startDate) {
                        setError('結束日期不能早於開始日期')
                        return
                      }
                      setRepeatEndDate(e.target.value)
                      if (e.target.value) {
                        setRepeatCount(1)
                      }
                    }}
                    min={startDate}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '6px',
                      border: '1px solid #ccc',
                      fontSize: '15px',
                    }}
                  />
                </div>
              </div>
            )}
          </div>}

          {/* 錯誤訊息 */}
          {error && (
            <div style={{
              padding: '14px 16px',
              backgroundColor: '#fff3cd',
              border: '2px solid #ffc107',
              borderRadius: '8px',
              marginTop: '20px',
              color: '#856404',
              fontSize: '15px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
            }}>
              <span style={{ fontSize: '20px' }}>⚠️</span>
              <span style={{ whiteSpace: 'pre-line', flex: 1 }}>{error}</span>
            </div>
          )}

          <div style={{
            display: 'flex',
            gap: '12px',
            marginTop: '20px',
            paddingBottom: 'calc(20px + env(safe-area-inset-bottom))'
          }}>
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              style={{
                flex: 1,
                padding: '14px',
                borderRadius: '8px',
                border: '1px solid #ccc',
                backgroundColor: 'white',
                color: '#333',
                fontSize: '16px',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
                touchAction: 'manipulation',
                minHeight: '52px',
              }}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1,
                padding: '14px',
                borderRadius: '8px',
                border: 'none',
                background: loading ? '#ccc' : 'linear-gradient(135deg, #5a5a5a 0%, #4a4a4a 100%)',
                color: 'white',
                fontSize: '16px',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer',
                touchAction: 'manipulation',
                minHeight: '52px',
              }}
            >
              {loading ? '處理中...' : '確認新增'}
            </button>
          </div>
        </form>
        {isMobile && (
          <div style={{ height: '80px' }} />
        )}
      </div>
    </div>
  )
}
