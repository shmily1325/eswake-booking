import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/PageHeader'
import { useResponsive } from '../hooks/useResponsive'
import { Footer } from '../components/Footer'
import { formatBookingsForLine } from '../utils/bookingFormat'

interface Booking {
  id: number
  start_at: string
  duration_min: number
  contact_name: string
  notes: string | null
  activity_types: string[] | null
  status: string
  boats: { name: string; color: string } | null
  coaches: { id: string; name: string }[]
  booking_members?: Array<{
    member_id: string
    members: { id: string; name: string } | null
  }>
}

interface Member {
  id: string
  name: string
  nickname: string | null
  phone: string | null
}

interface SearchBookingsProps {
  user: User
  isEmbedded?: boolean
}

export function SearchBookings({ user, isEmbedded = false }: SearchBookingsProps) {
  const { isMobile } = useResponsive()
  const [searchName, setSearchName] = useState('')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  
  const [filterType, setFilterType] = useState<'all' | 'today' | 'range'>('all')
  const [timeFilter, setTimeFilter] = useState<'future' | 'past'>('future') // 新增：未來/過去切換
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [copySuccess, setCopySuccess] = useState(false)
  
  const [members, setMembers] = useState<Member[]>([])
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([])
  const [showMemberDropdown, setShowMemberDropdown] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)

  useEffect(() => {
    loadMembers()
  }, [])

  const loadMembers = async () => {
    const { data } = await supabase
      .from('members')
      .select('id, name, nickname, phone')
      .eq('status', 'active')
      .order('name')
    
    if (data) {
      setMembers(data)
    }
  }

  useEffect(() => {
    if (searchName.trim()) {
      const filtered = members.filter(m =>
        m.name.toLowerCase().includes(searchName.toLowerCase()) ||
        m.nickname?.toLowerCase().includes(searchName.toLowerCase()) ||
        m.phone?.includes(searchName)
      )
      setFilteredMembers(filtered)
      setShowMemberDropdown(filtered.length > 0 && !selectedMemberId)
    } else {
      setFilteredMembers([])
      setShowMemberDropdown(false)
    }
  }, [searchName, members, selectedMemberId])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!searchName.trim()) {
      return
    }

    setLoading(true)
    setHasSearched(true)
    setCopySuccess(false)

    try {
      const now = new Date()
      const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`
      
      // 步驟 1: 從多個來源查詢匹配的預約 ID
      // 1.1 從 booking_members 查詢會員名稱
      const memberQuery = supabase
        .from('booking_members')
        .select('booking_id, members!inner(name)')
        .ilike('members.name', `%${searchName.trim()}%`)
      
      // 1.2 從 bookings 表查詢 contact_name（備選方案）
      const bookingQuery = supabase
        .from('bookings')
        .select('id')
        .ilike('contact_name', `%${searchName.trim()}%`)
      
      const [memberResult, bookingResult] = await Promise.all([
        memberQuery,
        bookingQuery
      ])
      
      console.log('搜尋結果 - 會員:', memberResult.data)
      console.log('搜尋結果 - contact_name:', bookingResult.data)
      
      // 合併找到的預約 ID
      const bookingIds = new Set<number>()
      memberResult.data?.forEach(item => bookingIds.add(item.booking_id))
      bookingResult.data?.forEach(item => bookingIds.add(item.id))
      
      console.log('找到的預約 IDs:', Array.from(bookingIds))
      
      if (bookingIds.size === 0) {
        console.log('沒有找到任何預約 ID')
        setBookings([])
        setLoading(false)
        return
      }
      
      // 步驟 2: 查詢這些預約的詳細資訊
      let query = supabase
        .from('bookings')
        .select('*, boats:boat_id (name, color), booking_members(member_id, members(id, name))')
        .in('id', Array.from(bookingIds))
      
      // 根據篩選類型添加條件
      if (filterType === 'all') {
        // 根據時間篩選（未來/過去）
        if (timeFilter === 'future') {
          query = query.gte('start_at', nowStr)
        } else {
          query = query.lt('start_at', nowStr)
        }
      } else if (filterType === 'today') {
        // 今日新增的預約（不限時間）
        const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
        const tomorrow = new Date(now)
        tomorrow.setDate(tomorrow.getDate() + 1)
        const tomorrowDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
        
        query = query.gte('created_at', `${todayDate}T00:00:00`).lt('created_at', `${tomorrowDate}T00:00:00`)
      } else if (filterType === 'range' && startDate && endDate) {
        // 特定區間內的未來預約
        query = query.gte('start_at', `${startDate}T00:00:00`).lte('start_at', `${endDate}T23:59:59`)
        query = query.gte('start_at', nowStr)
      }
      
      // 執行預約查詢（根據時間篩選決定排序）
      const bookingsResult = await query.order('start_at', { ascending: timeFilter === 'future' })

      console.log('預約詳細查詢結果:', bookingsResult.data)
      console.log('查詢錯誤:', bookingsResult.error)

      if (bookingsResult.error) {
        console.error('Error fetching bookings:', bookingsResult.error)
        console.error('Error details:', bookingsResult.error.details, bookingsResult.error.hint)
        setBookings([])
      } else if (bookingsResult.data && bookingsResult.data.length > 0) {
        // 同時查詢教練信息（重要：立即發起查詢而不是等待）
        const bookingIds = bookingsResult.data.map(b => b.id)
        const coachesResult = await supabase
          .from('booking_coaches')
          .select('booking_id, coaches:coach_id(id, name)')
          .in('booking_id', bookingIds)

        if (coachesResult.error) {
          console.error('Error fetching coaches:', coachesResult.error)
        }

        // 合併教練信息
        const coachesByBooking: { [key: number]: { id: string; name: string }[] } = {}
        for (const item of coachesResult.data || []) {
          const bookingId = item.booking_id
          const coach = (item as any).coaches
          if (coach) {
            if (!coachesByBooking[bookingId]) {
              coachesByBooking[bookingId] = []
            }
            coachesByBooking[bookingId].push(coach)
          }
        }

        const bookingsWithCoaches = bookingsResult.data.map(booking => ({
          ...booking,
          coaches: coachesByBooking[booking.id] || []
        }))

        setBookings(bookingsWithCoaches as Booking[])
      } else {
        setBookings([])
      }
    } catch (err) {
      console.error('Search error:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatDateTime = (isoString: string) => {
    // 純字符串處理（避免時區問題）
    const datetime = isoString.substring(0, 16) // "2025-11-01T13:55"
    const [dateStr, timeStr] = datetime.split('T')
    const [year, month, day] = dateStr.split('-')
    
    // 計算星期幾（英文縮寫）
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const weekday = weekdays[date.getDay()]
    
    return `${year}/${month}/${day}(${weekday}) ${timeStr}`
  }

  const isPastBooking = (isoString: string) => {
    const datetime = isoString.substring(0, 16) // "2025-11-01T13:55"
    const now = new Date()
    const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    return datetime < nowStr
  }

  // 生成 LINE 格式的文字（簡化版）
  const generateLineMessage = () => {
    if (bookings.length === 0) return ''
    
    // 取得第一個預約的聯絡人名稱
    const firstBooking = bookings[0]
    const contactNames = firstBooking.booking_members
      ?.map(bm => bm.members?.name)
      .filter(Boolean)
      .join(', ') || searchName
    
    return formatBookingsForLine(bookings, `${contactNames}的預約`)
  }
  
  const handleCopyToClipboard = async () => {
    const message = generateLineMessage()
    try {
      await navigator.clipboard.writeText(message)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
      alert('複製失敗，請手動複製')
    }
  }

  return (
    <div style={{ 
      padding: isEmbedded ? '0' : '20px',
      maxWidth: '1200px',
      margin: '0 auto',
      minHeight: isEmbedded ? 'auto' : '100vh',
      backgroundColor: isEmbedded ? 'transparent' : '#f5f5f5',
    }}>
      {!isEmbedded && <PageHeader title="🔍 預約查詢" user={user} />}

      {/* Search Form */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '15px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
      }}>
        <form onSubmit={handleSearch}>
          <div style={{ marginBottom: '20px', position: 'relative' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '13px',
              color: '#868e96',
              fontWeight: '500'
            }}>
              預約人
            </label>
            <input
              type="text"
              value={searchName}
              onChange={(e) => {
                setSearchName(e.target.value)
                setSelectedMemberId(null)
              }}
              onFocus={(e) => {
                if (filteredMembers.length > 0) {
                  setShowMemberDropdown(true)
                }
                e.target.style.borderColor = '#007bff'
              }}
              onBlur={(e) => {
                setTimeout(() => setShowMemberDropdown(false), 200)
                e.target.style.borderColor = '#e0e0e0'
              }}
              placeholder="搜尋會員或直接輸入姓名"
              required
              style={{
                width: '100%',
                padding: '14px 16px',
                fontSize: isMobile ? '16px' : '15px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s'
              }}
            />
            
            {showMemberDropdown && filteredMembers.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                maxHeight: '200px',
                overflowY: 'auto',
                backgroundColor: 'white',
                border: '1px solid #dee2e6',
                borderRadius: '8px',
                marginTop: '4px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: 1000
              }}>
                {filteredMembers.map(member => (
                  <div
                    key={member.id}
                    onClick={() => {
                      setSearchName(member.name)
                      setSelectedMemberId(member.id)
                      setShowMemberDropdown(false)
                    }}
                    style={{
                      padding: '12px 16px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f0f0f0',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                  >
                    <div style={{ fontWeight: '500', color: '#333' }}>{member.name}</div>
                    {(member.nickname || member.phone) && (
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                        {member.nickname && `${member.nickname}`}
                        {member.nickname && member.phone && ' · '}
                        {member.phone}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 篩選選項 */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ 
              marginBottom: '12px', 
              fontSize: '13px', 
              color: '#868e96',
              fontWeight: '500'
            }}>
              查詢模式
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <button
                type="button"
                onClick={() => setFilterType('all')}
                style={{
                  flex: 1,
                  minWidth: '120px',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: filterType === 'all' ? '2px solid #007bff' : '1px solid #e9ecef',
                  backgroundColor: filterType === 'all' ? '#e7f3ff' : 'white',
                  color: filterType === 'all' ? '#007bff' : '#495057',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                全部預約
              </button>
              <button
                type="button"
                onClick={() => setFilterType('today')}
                style={{
                  flex: 1,
                  minWidth: '120px',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: filterType === 'today' ? '2px solid #28a745' : '1px solid #e9ecef',
                  backgroundColor: filterType === 'today' ? '#d4edda' : 'white',
                  color: filterType === 'today' ? '#28a745' : '#495057',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                今日新增
              </button>
              <button
                type="button"
                onClick={() => setFilterType('range')}
                style={{
                  flex: 1,
                  minWidth: '120px',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: filterType === 'range' ? '2px solid #ffc107' : '1px solid #e9ecef',
                  backgroundColor: filterType === 'range' ? '#fff8e1' : 'white',
                  color: filterType === 'range' ? '#f59f00' : '#495057',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                指定日期
              </button>
            </div>
            
            {/* 時間範圍切換（僅在全部預約模式顯示） */}
            {filterType === 'all' && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setTimeFilter('future')}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: timeFilter === 'future' ? '2px solid #007bff' : '1px solid #e9ecef',
                    backgroundColor: timeFilter === 'future' ? '#e7f3ff' : 'white',
                    color: timeFilter === 'future' ? '#007bff' : '#495057',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  📅 未來預約
                </button>
                <button
                  type="button"
                  onClick={() => setTimeFilter('past')}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: timeFilter === 'past' ? '2px solid #6c757d' : '1px solid #e9ecef',
                    backgroundColor: timeFilter === 'past' ? '#e9ecef' : 'white',
                    color: timeFilter === 'past' ? '#495057' : '#6c757d',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  📜 過去預約
                </button>
              </div>
            )}
          </div>

          {/* 日期區間選擇 */}
          {filterType === 'range' && (
            <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#fff8e1', borderRadius: '8px', border: '1px solid #ffe082' }}>
              <div style={{ marginBottom: '14px' }}>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  placeholder="開始日期"
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    fontSize: '16px',
                    border: '1px solid #dee2e6',
                    borderRadius: '8px',
                    boxSizing: 'border-box',
                    backgroundColor: 'white'
                  }}
                />
              </div>
              <div>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  placeholder="結束日期"
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    fontSize: '16px',
                    border: '1px solid #dee2e6',
                    borderRadius: '8px',
                    boxSizing: 'border-box',
                    backgroundColor: 'white'
                  }}
                />
              </div>
            </div>
          )}

          {/* 搜尋按鈕 */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '18px',
              fontSize: '24px',
              fontWeight: '600',
              background: !loading ? 'linear-gradient(135deg, #5a5a5a 0%, #4a4a4a 100%)' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: !loading ? 'pointer' : 'not-allowed',
              touchAction: 'manipulation',
              boxShadow: !loading ? '0 4px 12px rgba(0, 0, 0, 0.3)' : 'none',
              transition: 'transform 0.1s'
            }}
            onTouchStart={(e) => !loading && (e.currentTarget.style.transform = 'scale(0.98)')}
            onTouchEnd={(e) => !loading && (e.currentTarget.style.transform = 'scale(1)')}
          >
            {loading ? '...' : '🔍'}
          </button>
        </form>
      </div>

      {/* Results */}
      {hasSearched && (
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{
              fontSize: '16px',
              color: '#666',
              fontWeight: '500',
            }}>
              找到 {bookings.length} 筆預約
            </div>
            
            {bookings.length > 0 && (
              <button
                onClick={handleCopyToClipboard}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: '500',
                  background: copySuccess ? '#28a745' : '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s'
                }}
              >
                {copySuccess ? '✓ 已複製' : '📋 複製 LINE 格式'}
              </button>
            )}
          </div>

          {bookings.length === 0 ? (
            <div style={{
              padding: '40px',
              backgroundColor: 'white',
              borderRadius: '8px',
              textAlign: 'center',
              color: '#999',
              fontSize: '16px',
            }}>
              😔 沒有找到相關預約記錄
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {bookings.map((booking) => {
                const isPast = isPastBooking(booking.start_at)
                return (
                  <div
                    key={booking.id}
                    style={{
                      padding: '16px',
                      backgroundColor: 'white',
                      borderRadius: '8px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      borderLeft: `4px solid ${booking.boats?.color || '#ccc'}`,
                      opacity: isPast ? 0.7 : 1,
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '12px',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}>
                      <div>
                        <div style={{
                          fontSize: '18px',
                          fontWeight: '600',
                          color: '#000',
                          marginBottom: '4px',
                        }}>
                          {booking.booking_members?.map(bm => bm.members?.name).filter(Boolean).join(', ') || booking.contact_name || '無聯絡人'}
                        </div>
                        <div style={{
                          fontSize: '14px',
                          color: '#666',
                        }}>
                          {formatDateTime(booking.start_at)}
                        </div>
                      </div>
                      {isPast && (
                        <span style={{
                          padding: '4px 8px',
                          backgroundColor: '#6c757d',
                          color: 'white',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '500',
                        }}>
                          已結束
                        </span>
                      )}
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: '12px',
                      fontSize: '14px',
                    }}>
                      <div>
                        <span style={{ color: '#666' }}>🚤 船隻：</span>
                        <span style={{ fontWeight: '500', color: '#000' }}>
                          {booking.boats?.name || '未指定'}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: '#666' }}>🎓 教練：</span>
                        <span style={{ fontWeight: '500', color: '#000' }}>
                          {booking.coaches && booking.coaches.length > 0
                            ? booking.coaches.map(c => c.name).join(' / ')
                            : '未指定'}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: '#666' }}>⏱️ 時長：</span>
                        <span style={{ fontWeight: '500', color: '#000' }}>
                          {booking.duration_min} 分鐘
                        </span>
                      </div>
                      {booking.activity_types && booking.activity_types.length > 0 && (
                        <div>
                          <span style={{ color: '#666' }}>🏄 活動：</span>
                          <span style={{ fontWeight: '500', color: '#000' }}>
                            {booking.activity_types.join(' + ')}
                          </span>
                        </div>
                      )}
                    </div>

                    {booking.notes && (
                      <div style={{
                        marginTop: '12px',
                        padding: '8px',
                        backgroundColor: '#f8f9fa',
                        borderRadius: '4px',
                        fontSize: '13px',
                        color: '#666',
                      }}>
                        📝 {booking.notes}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {!isEmbedded && <Footer />}
    </div>
  )
}

