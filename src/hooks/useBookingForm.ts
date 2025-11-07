import { useState, useEffect } from 'react'
import { getLocalDateString } from '../utils/date'

interface Boat {
  id: number
  name: string
  color: string
}

/**
 * 預約表單狀態管理 Hook
 * 統一管理預約表單的所有基本欄位
 */
export function useBookingForm(defaultBoatId?: number, defaultStartTime?: string) {
  const [boats, setBoats] = useState<Boat[]>([])
  const [selectedBoatId, setSelectedBoatId] = useState(defaultBoatId || 0)
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('00:00')
  const [durationMin, setDurationMin] = useState(60)
  const [activityTypes, setActivityTypes] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // 初始化日期時間
  useEffect(() => {
    if (defaultStartTime) {
      // 解析預設時間 "2025-11-08T14:00"
      const datetime = defaultStartTime.substring(0, 16)
      const [dateStr, timeStr] = datetime.split('T')
      setStartDate(dateStr)
      setStartTime(timeStr)
    } else {
      // 使用當前時間
      const now = new Date()
      const dateStr = getLocalDateString(now)
      const hour = now.getHours()
      const minute = Math.floor(now.getMinutes() / 15) * 15
      const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
      setStartDate(dateStr)
      setStartTime(timeStr)
    }
  }, [defaultStartTime])

  // 切換活動類型
  const toggleActivityType = (type: string) => {
    setActivityTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    )
  }

  // 重置表單
  const reset = () => {
    setSelectedBoatId(defaultBoatId || 0)
    setStartDate('')
    setStartTime('00:00')
    setDurationMin(60)
    setActivityTypes([])
    setNotes('')
    setError('')
    setLoading(false)
  }

  // 獲取完整的開始時間字串
  const getStartDateTime = (): string => {
    return `${startDate}T${startTime}:00`
  }

  // 驗證表單
  const validate = (): boolean => {
    if (!startDate || !startTime) {
      setError('⚠️ 請選擇開始日期和時間')
      return false
    }

    if (!selectedBoatId) {
      setError('⚠️ 請選擇船隻')
      return false
    }

    if (durationMin < 15) {
      setError('⚠️ 時長至少需要 15 分鐘')
      return false
    }

    setError('')
    return true
  }

  return {
    boats,
    setBoats,
    selectedBoatId,
    setSelectedBoatId,
    startDate,
    setStartDate,
    startTime,
    setStartTime,
    durationMin,
    setDurationMin,
    activityTypes,
    setActivityTypes,
    toggleActivityType,
    notes,
    setNotes,
    error,
    setError,
    loading,
    setLoading,
    reset,
    getStartDateTime,
    validate
  }
}

