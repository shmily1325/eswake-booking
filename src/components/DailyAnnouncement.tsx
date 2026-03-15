import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useResponsive } from '../hooks/useResponsive'
import { getLocalDateString } from '../utils/date'
import { getEventDateLabel } from '../utils/announcement'

interface Announcement {
  id: number
  content: string
  display_date: string
  end_date: string | null
  show_one_day_early?: boolean | null
}

interface Birthday {
  name: string
  nickname: string | null
}

interface BoatUnavailable {
  boatName: string
  reason: string
  startDate: string
  startTime: string | null
  endDate: string
  endTime: string | null
}

export function DailyAnnouncement() {
  const { isMobile } = useResponsive()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [timeOffCoaches, setTimeOffCoaches] = useState<string[]>([])
  const [birthdays, setBirthdays] = useState<Birthday[]>([])
  const [unavailableBoats, setUnavailableBoats] = useState<BoatUnavailable[]>([])
  const [isExpanded, setIsExpanded] = useState(true)

  // 格式化維修時間範圍
  const formatMaintenanceRange = (boat: BoatUnavailable): string => {
    const formatDate = (dateStr: string) => {
      // 將 YYYY-MM-DD 格式轉為 MM/DD
      const [, month, day] = dateStr.split('-')
      return `${parseInt(month)}/${parseInt(day)}`
    }

    const formatTime = (timeStr: string) => {
      // 移除前導零，例如 "09:00" -> "9:00"
      const [hour, minute] = timeStr.split(':')
      return `${parseInt(hour)}:${minute}`
    }

    const startDateStr = formatDate(boat.startDate)
    const endDateStr = formatDate(boat.endDate)
    const isSameDay = boat.startDate === boat.endDate

    // 如果有時間資訊
    if (boat.startTime || boat.endTime) {
      const startTimeStr = boat.startTime ? formatTime(boat.startTime) : '0:00'
      const endTimeStr = boat.endTime ? formatTime(boat.endTime) : '23:59'
      
      if (isSameDay) {
        // 同一天：11/28 10:00 - 18:00
        return `${startDateStr} ${startTimeStr} - ${endTimeStr}`
      } else {
        // 不同天：11/28 10:00 - 11/30 18:00
        return `${startDateStr} ${startTimeStr} - ${endDateStr} ${endTimeStr}`
      }
    }

    // 沒有時間資訊
    if (isSameDay) {
      // 同一天：11/28
      return startDateStr
    } else {
      // 不同天：11/28 - 11/30
      return `${startDateStr} - ${endDateStr}`
    }
  }


  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const today = getLocalDateString()
    const todayMD = today.substring(5) // MM-DD

    // 並行執行所有查詢（重要：從串行改為並行，大幅提升速度）
    const [
      announcementResult,
      timeOffResult,
      birthdayResult,
      boatUnavailableResult
    ] = await Promise.all([
      // 獲取交辦事項（支援日期範圍：display_date <= today <= end_date）
      supabase
        .from('daily_announcements')
        .select('*')
        .lte('display_date', today)
        .or(`end_date.gte.${today},end_date.is.null`)
        .order('created_at', { ascending: true }),
      
      // 獲取今日休假教練（排除已隱藏的教練）
      supabase
        .from('coach_time_off')
        .select('coach_id, coaches(name, status)')
        .lte('start_date', today)
        .or(`end_date.gte.${today},end_date.is.null`),
      
      // 獲取所有有生日的會員（在客戶端過濾今日生日）
      supabase
        .from('members')
        .select('name, nickname, birthday')
        .eq('status', 'active')
        .not('birthday', 'is', null),
      
      // 獲取今日停用的船隻
      supabase
        .from('boat_unavailable_dates')
        .select('boat_id, reason, start_date, start_time, end_date, end_time, boats(name, is_active)')
        .eq('is_active', true)
        .lte('start_date', today)
        .gte('end_date', today)
    ])

    // 處理查詢結果
    if (announcementResult.data) setAnnouncements(announcementResult.data as Announcement[])

    if (timeOffResult.data) {
      // 只顯示啟用中的教練，過濾掉已停用或已隱藏的教練
      const coachNames = timeOffResult.data
        .filter((item: any) => item.coaches?.status === 'active')
        .map((item: any) => item.coaches?.name)
        .filter(Boolean)
      const uniqueCoachNames = Array.from(new Set(coachNames))
      setTimeOffCoaches(uniqueCoachNames)
    }
    
    if (birthdayResult.data) {
      // 在客戶端過濾：只顯示今日生日（匹配 MM-DD）
      const filtered = birthdayResult.data.filter((member: any) => {
        if (!member.birthday) return false
        // 提取月-日部分 (YYYY-MM-DD -> MM-DD)
        const birthdayMD = member.birthday.substring(5) // 取 MM-DD 部分
        return birthdayMD === todayMD
      }).slice(0, 5) // 限制最多5筆
      
      setBirthdays(filtered)
    }

    if (boatUnavailableResult.data) {
      // 只顯示啟用中的船隻
      const boats = boatUnavailableResult.data
        .filter((item: any) => item.boats?.is_active)
        .map((item: any) => ({
          boatName: item.boats?.name,
          reason: item.reason,
          startDate: item.start_date,
          startTime: item.start_time,
          endDate: item.end_date,
          endTime: item.end_time
        }))
        .filter((item: BoatUnavailable) => item.boatName)
      
      setUnavailableBoats(boats)
    }
  }

  const hasAnyData = announcements.length > 0 || timeOffCoaches.length > 0 || 
                      birthdays.length > 0 || unavailableBoats.length > 0

  const getDatePrefix = (ann: Announcement) => getEventDateLabel(ann)

  const getAnnouncementDisplayText = (ann: Announcement, sharedPrefix: string | null): string => {
    const prefix = getDatePrefix(ann)
    if (sharedPrefix) return ann.content
    if (prefix) return `${prefix} ${ann.content}`
    return ann.content
  }

  if (!hasAnyData) return null

  return (
    <div style={{
      background: 'white',
      borderRadius: '8px',
      padding: isMobile ? '14px' : '18px',
      marginBottom: '20px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
      border: '1px solid #e0e0e0'
    }}>
      <div 
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: isExpanded ? '12px' : '0',
          cursor: 'pointer'
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={{
          fontSize: isMobile ? '14px' : '15px',
          fontWeight: '600',
          color: '#333'
        }}>
          📢 今日公告
        </div>
        <span style={{
          color: '#999',
          fontSize: '11px',
          fontWeight: '500'
        }}>
          {isExpanded ? '收起 ▲' : '展開 ▼'}
        </span>
      </div>

      {isExpanded && (
        <div style={{
          fontSize: isMobile ? '13px' : '14px',
          color: '#555',
          lineHeight: '1.7'
        }}>
          {announcements.length > 0 && (() => {
            const prefixes = announcements.map(a => getDatePrefix(a))
            const allSame = prefixes.length >= 1 && prefixes.every(p => p === prefixes[0])
            const sharedPrefix = allSame && prefixes[0] ? prefixes[0] : null
            return (
            <div style={{ marginBottom: '6px' }}>
              <div style={{ 
                color: '#667eea', 
                fontWeight: '500',
                marginBottom: '2px'
              }}>
                📋 交辦事項{sharedPrefix ? ` (${sharedPrefix})` : ''}：
              </div>
              {announcements.map((ann, idx) => (
                <div 
                  key={ann.id} 
                  style={{ 
                    color: '#667eea', 
                    fontWeight: '500',
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                    paddingLeft: '1.5em',
                    marginBottom: idx < announcements.length - 1 ? '2px' : '0'
                  }}
                >
                  {getAnnouncementDisplayText(ann, sharedPrefix)}
                </div>
              ))}
            </div>
            )
          })()}

          {timeOffCoaches.length > 0 && (
            <div style={{ marginBottom: '6px' }}>
              🏖️ 休假：{timeOffCoaches.join('、')}
            </div>
          )}

          {unavailableBoats.length > 0 && (
            <div style={{ marginBottom: '6px' }}>
              {unavailableBoats.map((boat, idx) => (
                <div key={idx} style={{ marginBottom: idx < unavailableBoats.length - 1 ? '2px' : '0' }}>
                  🚤 {boat.boatName} 維修：{boat.reason} ({formatMaintenanceRange(boat)})
                </div>
              ))}
            </div>
          )}

          {birthdays.length > 0 && (
            <div>
              🎂 今日壽星：{birthdays.map(b => (b.nickname && b.nickname.trim()) || b.name).join('、')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

