import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useResponsive } from '../hooks/useResponsive'
import { getLocalDateString } from '../utils/date'

interface Announcement {
  id: string
  content: string
}

interface Birthday {
  name: string
  nickname: string | null
}

export function DailyAnnouncement() {
  const { isMobile } = useResponsive()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [timeOffCoaches, setTimeOffCoaches] = useState<string[]>([])
  const [birthdays, setBirthdays] = useState<Birthday[]>([])
  const [isExpanded, setIsExpanded] = useState(true)


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
      birthdayResult
    ] = await Promise.all([
      // 獲取交辦事項
      supabase
        .from('daily_announcements')
        .select('*')
        .eq('display_date', today)
        .order('created_at', { ascending: true }),
      
      // 獲取今日休假教練
      supabase
        .from('coach_time_off')
        .select('coach_id, coaches(name)')
        .lte('start_date', today)
        .or(`end_date.gte.${today},end_date.is.null`),
      
      // 獲取所有有生日的會員（在客戶端過濾今日生日）
      supabase
        .from('members')
        .select('name, nickname, birthday')
        .eq('status', 'active')
        .not('birthday', 'is', null)
    ])

    // 處理查詢結果
    if (announcementResult.data) setAnnouncements(announcementResult.data)
    
    if (timeOffResult.data) {
      // 使用 Set 去除重複的教練名字
      const coachNames = timeOffResult.data.map((item: any) => item.coaches?.name).filter(Boolean)
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
  }

  const hasAnyData = announcements.length > 0 || timeOffCoaches.length > 0 || 
                      birthdays.length > 0

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
          {announcements.length > 0 && (
            <div style={{ marginBottom: '6px' }}>
              {announcements.map((ann, idx) => (
                <div 
                  key={ann.id} 
                  style={{ 
                    color: '#667eea', 
                    fontWeight: '500',
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                    marginBottom: idx < announcements.length - 1 ? '4px' : '0'
                  }}
                >
                  {idx === 0 && '📋 交辦事項：'}
                  {idx > 0 && '　　　　'}
                  {ann.content}
                </div>
              ))}
            </div>
          )}

          {timeOffCoaches.length > 0 && (
            <div style={{ marginBottom: '6px' }}>
              🏖️ 休假：{timeOffCoaches.join('、')}
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

