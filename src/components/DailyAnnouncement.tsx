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
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const today = getLocalDateString()
    
    // 獲取交辦事項
    const { data: announcementData } = await supabase
      .from('daily_announcements')
      .select('*')
      .eq('display_date', today)
      .limit(5)
    
    if (announcementData) setAnnouncements(announcementData)

    // 獲取今日休假教練
    const { data: timeOffData } = await supabase
      .from('coach_time_off')
      .select('coach_id, coaches(name)')
      .lte('start_date', today)
      .or(`end_date.gte.${today},end_date.is.null`)
    
    if (timeOffData) {
      setTimeOffCoaches(timeOffData.map((item: any) => item.coaches?.name).filter(Boolean))
    }

    // 獲取今日生日會員
    const todayMD = today.substring(5) // MM-DD
    const { data: birthdayData } = await supabase
      .from('members')
      .select('name, nickname')
      .eq('status', 'active')
      .like('birthday', `%${todayMD}%`)
      .limit(5)
    
    if (birthdayData) setBirthdays(birthdayData)

    // 獲取即將到期的會籍（7天內）
    const sevenDaysLater = new Date()
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7)
    const sevenDaysLaterStr = `${sevenDaysLater.getFullYear()}-${String(sevenDaysLater.getMonth() + 1).padStart(2, '0')}-${String(sevenDaysLater.getDate()).padStart(2, '0')}`

    const { data: membershipData } = await supabase
      .from('members')
      .select('name, nickname, membership_expires_at')
      .eq('status', 'active')
      .not('membership_expires_at', 'is', null)
      .lte('membership_expires_at', sevenDaysLaterStr)
      .order('membership_expires_at', { ascending: true })
      .limit(10)

    if (membershipData) setExpiringMemberships(membershipData)

    // 獲取即將到期或已到期的置板（7天內）
    const { data: boardData } = await supabase
      .from('board_storage')
      .select('slot_number, members(name), expires_at')
      .lte('expires_at', sevenDaysLaterStr)
      .order('expires_at', { ascending: true })
      .limit(10)

    if (boardData) {
      const boardList = boardData.map((b: any) => ({
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
      background: 'linear-gradient(135deg, #5a5a5a 0%, #4a4a4a 100%)',
      borderRadius: '12px',
      padding: isMobile ? '12px' : '16px',
      marginBottom: '20px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
      color: 'white'
    }}>
      {/* Header */}
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
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: isMobile ? '14px' : '16px',
          fontWeight: 'bold'
        }}>
          <span style={{ fontSize: isMobile ? '18px' : '20px' }}>📢</span>
          <span>今日公告</span>
        </div>
        <button style={{
          background: 'rgba(255, 255, 255, 0.2)',
          border: 'none',
          borderRadius: '6px',
          color: 'white',
          padding: '4px 10px',
          fontSize: '12px',
          cursor: 'pointer',
          fontWeight: '500'
        }}>
          {isExpanded ? '收起 ▲' : '展开 ▼'}
        </button>
      </div>

      {/* Content */}
      {isExpanded && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          fontSize: isMobile ? '13px' : '14px'
        }}>
          {/* 休假人员 */}
          {timeOffCoaches.length > 0 && (
            <div style={{
              background: 'rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              padding: '8px 10px'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>🏖️ 休假</div>
              <div>{timeOffCoaches.join('、')}</div>
            </div>
          )}

          {/* 生日快樂 */}
          {birthdays.length > 0 && (
            <div style={{
              background: 'rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              padding: '8px 10px'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>🎂 今日壽星</div>
              <div>{birthdays.map(b => b.nickname || b.name).join('、')}</div>
            </div>
          )}

          {/* 交辦事項 */}
          {announcements.length > 0 && (
            <div style={{
              background: 'rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              padding: '8px 10px'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>📋 交辦事項</div>
              {announcements.map((ann, idx) => (
                <div key={ann.id} style={{ 
                  marginBottom: idx < announcements.length - 1 ? '6px' : '0'
                }}>
                  • {ann.content}
                </div>
              ))}
            </div>
          )}

          {/* 會籍到期 */}
          {expiringMemberships.length > 0 && (
            <div style={{
              background: 'rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              padding: '8px 10px'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>⚠️ 會籍即將到期</div>
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column',
                gap: '4px',
                fontSize: isMobile ? '12px' : '13px'
              }}>
                {expiringMemberships.map((m, idx) => (
                  <div key={idx}>
                    • {m.nickname || m.name} ({m.membership_expires_at})
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 置板到期 */}
          {expiringBoards.length > 0 && (
            <div style={{
              background: 'rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              padding: '8px 10px'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>🏄 置板即將到期</div>
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column',
                gap: '4px',
                fontSize: isMobile ? '12px' : '13px'
              }}>
                {expiringBoards.map((b, idx) => (
                  <div key={idx}>
                    • {b.slot_number}號 - {b.member_name} ({b.expires_at})
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

