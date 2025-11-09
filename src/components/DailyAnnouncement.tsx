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

interface ExpiringMembership {
  name: string
  nickname: string | null
  membership_expires_at: string
}

interface ExpiringBoard {
  slot_number: number
  member_name: string
  expires_at: string
}

export function DailyAnnouncement() {
  const { isMobile } = useResponsive()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [timeOffCoaches, setTimeOffCoaches] = useState<string[]>([])
  const [birthdays, setBirthdays] = useState<Birthday[]>([])
  const [expiringMemberships, setExpiringMemberships] = useState<ExpiringMembership[]>([])
  const [expiringBoards, setExpiringBoards] = useState<ExpiringBoard[]>([])
  const [isExpanded, setIsExpanded] = useState(true)

  // 格式化日期為 YYYY/MM/DD
  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    
    // 嘗試解析不同格式的日期
    let date: Date | null = null
    
    // 格式 1: YYYY-MM-DD
    if (dateStr.includes('-') && dateStr.split('-').length === 3) {
      const [year, month, day] = dateStr.split('-')
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    }
    // 格式 2: MM/DD/YYYY
    else if (dateStr.includes('/')) {
      const parts = dateStr.split('/')
      if (parts.length === 3) {
        const [month, day, year] = parts
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      }
    }
    
    if (!date || isNaN(date.getTime())) return dateStr // 無法解析則返回原值
    
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}/${month}/${day}`
  }

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const today = getLocalDateString()
    const todayMD = today.substring(5) // MM-DD
    
    // 計算7天後的日期（純字符串計算，避免時區問題）
    const [year, month, day] = today.split('-').map(Number)
    const date = new Date(year, month - 1, day) // 使用本地日期
    date.setDate(date.getDate() + 7)
    const sevenDaysLaterStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

    // 並行執行所有查詢（重要：從串行改為並行，大幅提升速度）
    const [
      announcementResult,
      timeOffResult,
      birthdayResult,
      membershipResult,
      boardResult
    ] = await Promise.all([
      // 獲取交辦事項
      supabase
        .from('daily_announcements')
        .select('*')
        .eq('display_date', today)
        .limit(5),
      
      // 獲取今日休假教練
      supabase
        .from('coach_time_off')
        .select('coach_id, coaches(name)')
        .lte('start_date', today)
        .or(`end_date.gte.${today},end_date.is.null`),
      
      // 獲取今日生日會員
      supabase
        .from('members')
        .select('name, nickname')
        .eq('status', 'active')
        .like('birthday', `%${todayMD}%`)
        .limit(5),
      
      // 獲取即將到期的會籍（7天內）
      supabase
        .from('members')
        .select('name, nickname, membership_expires_at')
        .eq('status', 'active')
        .not('membership_expires_at', 'is', null)
        .lte('membership_expires_at', sevenDaysLaterStr)
        .order('membership_expires_at', { ascending: true })
        .limit(10),
      
      // 獲取即將到期或已到期的置板（7天內）
      supabase
        .from('board_storage')
        .select('slot_number, members(name), expires_at')
        .lte('expires_at', sevenDaysLaterStr)
        .order('expires_at', { ascending: true })
        .limit(10)
    ])

    // 處理查詢結果
    if (announcementResult.data) setAnnouncements(announcementResult.data)
    
    if (timeOffResult.data) {
      setTimeOffCoaches(timeOffResult.data.map((item: any) => item.coaches?.name).filter(Boolean))
    }
    
    if (birthdayResult.data) setBirthdays(birthdayResult.data)
    
    if (membershipResult.data) setExpiringMemberships(membershipResult.data)
    
    if (boardResult.data) {
      const boardList = boardResult.data.map((b: any) => ({
        slot_number: b.slot_number,
        member_name: b.members?.name || '未知',
        expires_at: b.expires_at
      }))
      setExpiringBoards(boardList)
    }
  }

  const hasAnyData = announcements.length > 0 || timeOffCoaches.length > 0 || 
                      birthdays.length > 0 || expiringMemberships.length > 0 || 
                      expiringBoards.length > 0

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
                <div key={ann.id} style={{ color: '#667eea', fontWeight: '500' }}>
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
            <div style={{ marginBottom: '6px' }}>
              🎂 今日壽星：{birthdays.map(b => b.name).join('、')}
            </div>
          )}

          {expiringMemberships.length > 0 && (
            <div style={{ marginBottom: '6px' }}>
              <div style={{ marginBottom: '3px' }}>⚠️ 會籍即將到期：</div>
              {expiringMemberships.map((m, idx) => (
                <div key={idx} style={{ 
                  paddingLeft: '20px', 
                  fontSize: isMobile ? '12px' : '13px',
                  color: '#666',
                  marginBottom: '2px'
                }}>
                  {m.name} ({formatDate(m.membership_expires_at)})
                </div>
              ))}
            </div>
          )}

          {expiringBoards.length > 0 && (
            <div>
              <div style={{ marginBottom: '3px' }}>🏄 置板即將到期：</div>
              {expiringBoards.map((b, idx) => (
                <div key={idx} style={{ 
                  paddingLeft: '20px', 
                  fontSize: isMobile ? '12px' : '13px',
                  color: '#666',
                  marginBottom: '2px'
                }}>
                  {b.slot_number}號 - {b.member_name} ({formatDate(b.expires_at)})
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

