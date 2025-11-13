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
  membership_end_date: string
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
    
    // 計算30天後的日期（顯示即將到期的）
    const todayDate = new Date()
    const thirtyDaysLater = new Date(todayDate)
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30)
    const thirtyDaysLaterStr = `${thirtyDaysLater.getFullYear()}-${String(thirtyDaysLater.getMonth() + 1).padStart(2, '0')}-${String(thirtyDaysLater.getDate()).padStart(2, '0')}`
    
    // 計算90天前的日期（顯示最近過期的）
    const ninetyDaysAgo = new Date(todayDate)
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    const ninetyDaysAgoStr = `${ninetyDaysAgo.getFullYear()}-${String(ninetyDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(ninetyDaysAgo.getDate()).padStart(2, '0')}`
    
    console.log('查詢日期範圍:', ninetyDaysAgoStr, '到', thirtyDaysLaterStr)

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
      
      // 獲取所有有生日的會員（在客戶端過濾今日生日）
      supabase
        .from('members')
        .select('name, nickname, birthday')
        .eq('status', 'active')
        .not('birthday', 'is', null),
      
      // 獲取所有有會籍截止日的會員（在客戶端過濾）
      supabase
        .from('members')
        .select('name, nickname, membership_end_date, status')
        // .eq('status', 'active') // 暫時移除 status 過濾來測試
        .not('membership_end_date', 'is', null)
        .order('membership_end_date', { ascending: true }),
      
      // 獲取所有有到期日的置板（在客戶端過濾）
      supabase
        .from('board_storage')
        .select('slot_number, members(name, nickname), expires_at')
        .eq('status', 'active')
        .not('expires_at', 'is', null)
        .order('expires_at', { ascending: true })
    ])

    // 處理查詢結果
    if (announcementResult.data) setAnnouncements(announcementResult.data)
    
    if (timeOffResult.data) {
      setTimeOffCoaches(timeOffResult.data.map((item: any) => item.coaches?.name).filter(Boolean))
    }
    
    if (birthdayResult.data) {
      console.log('生日查詢原始結果:', birthdayResult.data)
      
      // 在客戶端過濾：只顯示今日生日（匹配 MM-DD）
      const filtered = birthdayResult.data.filter((member: any) => {
        if (!member.birthday) return false
        // 提取月-日部分 (YYYY-MM-DD -> MM-DD)
        const birthdayMD = member.birthday.substring(5) // 取 MM-DD 部分
        return birthdayMD === todayMD
      }).slice(0, 5) // 限制最多5筆
      
      console.log('今日生日篩選:', todayMD, '過濾後結果:', filtered)
      setBirthdays(filtered)
    }
    
    if (membershipResult.data) {
      console.log('會籍查詢原始結果:', membershipResult.data)
      console.log('查詢日期範圍:', ninetyDaysAgoStr, '到', thirtyDaysLaterStr)
      
      // 檢查第一筆資料格式
      if (membershipResult.data.length > 0) {
        const sample = membershipResult.data[0]
        console.log('第一筆會員資料:', {
          name: sample.name,
          membership_end_date: sample.membership_end_date,
          status: sample.status,
          type: typeof sample.membership_end_date
        })
      }
      
      // 在客戶端過濾日期範圍（因為資料庫TEXT類型的日期比較不準確）
      const filtered = membershipResult.data.filter((m: any) => {
        if (!m.membership_end_date) return false
        const endDate = m.membership_end_date
        const inRange = endDate >= ninetyDaysAgoStr && endDate <= thirtyDaysLaterStr
        
        // 調試：只打印前3筆
        if (membershipResult.data.indexOf(m) < 3) {
          console.log(`過濾測試 [${m.name}]: 到期=${endDate}, 範圍=${ninetyDaysAgoStr}~${thirtyDaysLaterStr}, 通過=${inRange}`)
        }
        
        return inRange
      }).slice(0, 20) // 限制最多20筆
      
      console.log('過濾後結果:', filtered)
      // 檢查暱稱資料
      filtered.forEach((m: any) => {
        console.log(`會員: ${m.name}, 暱稱: "${m.nickname}", 使用: ${m.nickname || m.name}`)
      })
      setExpiringMemberships(filtered)
    }
    
    if (boardResult.data) {
      console.log('置板查詢原始結果:', boardResult.data)
      
      // 在客戶端過濾：只顯示今天到30天內到期的置板
      const filtered = boardResult.data.filter((b: any) => {
        if (!b.expires_at) return false
        // 比較字符串格式的日期 (YYYY-MM-DD)
        return b.expires_at >= today && b.expires_at <= thirtyDaysLaterStr
      })
      
      const boardList = filtered.map((b: any) => {
        const member = b.members
        const displayName = member 
          ? ((member.nickname && member.nickname.trim()) || member.name)
          : '未知'
        return {
          slot_number: b.slot_number,
          member_name: displayName,
          expires_at: b.expires_at
        }
      }).slice(0, 10) // 限制最多10筆
      
      console.log('置板過濾後結果:', boardList)
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
              🎂 今日壽星：{birthdays.map(b => (b.nickname && b.nickname.trim()) || b.name).join('、')}
            </div>
          )}

          {expiringMemberships.length > 0 && (
            <div style={{ marginBottom: '6px' }}>
              <div style={{ marginBottom: '3px' }}>⚠️ 會籍到期提醒（過去90天～未來30天）：</div>
              {expiringMemberships.map((m, idx) => {
                const today = getLocalDateString()
                const isExpired = m.membership_end_date < today
                const color = isExpired ? '#d32f2f' : '#666'
                
                return (
                  <div key={idx} style={{ 
                    paddingLeft: '20px', 
                    fontSize: isMobile ? '12px' : '13px',
                    color: color,
                    marginBottom: '2px',
                    fontWeight: isExpired ? '600' : 'normal'
                  }}>
                    {(m.nickname && m.nickname.trim()) || m.name} ({formatDate(m.membership_end_date)})
                    {isExpired && ' ⚠️已過期'}
                  </div>
                )
              })}
            </div>
          )}

          {expiringBoards.length > 0 && (
            <div>
              <div style={{ marginBottom: '3px' }}>🏄 置板到期提醒（30天內）：</div>
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

