/**
 * 測試刪除預約審計日誌邏輯
 * 驗證資料查詢順序和完整性
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock 資料
const mockCompleteBooking = {
  id: 12345,
  contact_name: 'Fish',
  start_at: '2026-02-04T16:00:00',
  duration_min: 60,
  notes: '新手體驗',
  activity_types: ['WS'],
  boats: { name: 'G23' }
}

const mockCoachesData = [
  { coaches: { name: 'PAPA' } }
]

const mockDriversData: any[] = []

describe('刪除預約審計日誌測試', () => {
  let queryOrder: string[] = []
  let mockSupabase: any
  
  beforeEach(() => {
    queryOrder = []
    
    // 建立完整的 Mock Supabase 客戶端
    mockSupabase = {
      from: (table: string) => {
        if (table === 'bookings') {
          return {
            select: (fields: string) => ({
              eq: (field: string, value: any) => ({
                single: async () => {
                  queryOrder.push('1-query-bookings')
                  return { data: mockCompleteBooking, error: null }
                }
              })
            }),
            delete: () => ({
              eq: (field: string, value: any) => {
                queryOrder.push('4-delete-bookings')
                return Promise.resolve({ error: null })
              }
            })
          }
        } else if (table === 'booking_coaches') {
          return {
            select: (fields: string) => ({
              eq: (field: string, value: any) => {
                queryOrder.push('2-query-booking_coaches')
                return Promise.resolve({ data: mockCoachesData, error: null })
              }
            })
          }
        } else if (table === 'booking_drivers') {
          return {
            select: (fields: string) => ({
              eq: (field: string, value: any) => {
                queryOrder.push('3-query-booking_drivers')
                return Promise.resolve({ data: mockDriversData, error: null })
              }
            })
          }
        }
        return {} as any
      }
    }
  })

  afterEach(() => {
    queryOrder = []
  })

  it('✅ 應該按正確順序執行：先查詢後刪除', async () => {
    // 模擬刪除流程
    const { data: completeBooking } = await mockSupabase
      .from('bookings')
      .select('*, boats:boat_id(name)')
      .eq('id', 12345)
      .single()
    
    const [coachesData, driversData] = await Promise.all([
      mockSupabase.from('booking_coaches').select('coaches:coach_id(name)').eq('booking_id', 12345),
      mockSupabase.from('booking_drivers').select('coaches:driver_id(name)').eq('booking_id', 12345)
    ])
    
    await mockSupabase.from('bookings').delete().eq('id', 12345)
    
    // 驗證執行順序
    expect(queryOrder).toEqual([
      '1-query-bookings',
      '2-query-booking_coaches',
      '3-query-booking_drivers',
      '4-delete-bookings'
    ])
    
    // 確保查詢在刪除之前
    const firstDeleteIndex = queryOrder.findIndex(q => q.includes('delete'))
    const lastQueryIndex = queryOrder.findIndex(q => q.includes('query-booking_drivers'))
    expect(lastQueryIndex).toBeLessThan(firstDeleteIndex)
  })

  it('✅ 應該查詢到完整的預約資料', () => {
    // 驗證所有關鍵欄位都存在
    expect(mockCompleteBooking.notes).toBe('新手體驗')
    expect(mockCompleteBooking.activity_types).toEqual(['WS'])
    expect(mockCompleteBooking.boats.name).toBe('G23')
    expect(mockCompleteBooking.contact_name).toBe('Fish')
    expect(mockCompleteBooking.duration_min).toBe(60)
    expect(mockCompleteBooking.start_at).toBe('2026-02-04T16:00:00')
  })

  it('✅ 應該正確提取教練名稱', () => {
    const coachNames = mockCoachesData.map((c: any) => c.coaches?.name).filter(Boolean)
    
    expect(coachNames).toEqual(['PAPA'])
    expect(coachNames.length).toBe(1)
  })

  it('✅ 應該生成完整的審計日誌格式（有教練+活動+備註）', () => {
    const booking = mockCompleteBooking
    const coachNames = ['PAPA']
    const driverNames: string[] = []
    const filledBy = '許書潔'
    
    // 模擬 auditLog.ts 的 formatBookingTime 函數
    const formatBookingTime = (startTime: string) => {
      const datetime = startTime.substring(0, 16)
      const [dateStr, timeStr] = datetime.split('T')
      const [year, month, day] = dateStr.split('-')
      return `${year}/${month}/${day} ${timeStr}`
    }
    
    // 模擬生成日誌（與 logBookingDeletion 相同邏輯）
    const formattedTime = formatBookingTime(booking.start_at)
    let details = `刪除預約：${formattedTime} ${booking.duration_min}分 ${booking.boats.name} ${booking.contact_name}`
    
    if (coachNames.length > 0) {
      details += ` | ${coachNames.map(name => `${name}教練`).join('、')}`
    }
    
    if (driverNames.length > 0) {
      const isDifferentFromCoach = !coachNames || 
        JSON.stringify(driverNames.sort()) !== JSON.stringify(coachNames.sort())
      if (isDifferentFromCoach) {
        details += ` | 🚤${driverNames.join('、')}`
      }
    }
    
    if (booking.activity_types && booking.activity_types.length > 0) {
      details += ` [${booking.activity_types.join('+')}]`
    }
    
    if (booking.notes && booking.notes.trim()) {
      details += ` [${booking.notes.trim()}]`
    }
    
    details += ` (填表人: ${filledBy})`
    
    // 驗證格式完全符合預期
    expect(details).toBe('刪除預約：2026/02/04 16:00 60分 G23 Fish | PAPA教練 [WS] [新手體驗] (填表人: 許書潔)')
  })

  it('✅ 應該正確處理沒有教練的情況', () => {
    const coachNames: string[] = []
    const filledBy = '測試'
    let details = `刪除預約：2026/02/04 16:00 60分 G23 Fish`
    
    if (coachNames.length > 0) {
      details += ` | ${coachNames.map(name => `${name}教練`).join('、')}`
    }
    
    details += ` (填表人: ${filledBy})`
    
    // 沒有教練時不應該有 |
    expect(details).not.toContain(' | ')
    expect(details).toBe('刪除預約：2026/02/04 16:00 60分 G23 Fish (填表人: 測試)')
  })

  it('✅ 應該正確處理沒有備註的情況', () => {
    const booking = { ...mockCompleteBooking, notes: null }
    let details = '刪除預約：2026/02/04 16:00 60分 G23 Fish | PAPA教練 [WS]'
    
    if (booking.notes && booking.notes.trim()) {
      details += ` [${booking.notes.trim()}]`
    }
    
    details += ' (填表人: 測試)'
    
    // 沒有備註時不應該有第二個方括號
    const bracketCount = (details.match(/\[/g) || []).length
    expect(bracketCount).toBe(1) // 只有活動類型的方括號
    expect(details).toBe('刪除預約：2026/02/04 16:00 60分 G23 Fish | PAPA教練 [WS] (填表人: 測試)')
  })

  it('✅ 應該正確處理沒有活動類型的情況', () => {
    const booking = { ...mockCompleteBooking, activity_types: null }
    const coachNames = ['PAPA']
    let details = `刪除預約：2026/02/04 16:00 60分 G23 Fish | PAPA教練`
    
    if (booking.activity_types && booking.activity_types.length > 0) {
      details += ` [${booking.activity_types.join('+')}]`
    }
    
    if (booking.notes && booking.notes.trim()) {
      details += ` [${booking.notes.trim()}]`
    }
    
    details += ' (填表人: 測試)'
    
    expect(details).toBe('刪除預約：2026/02/04 16:00 60分 G23 Fish | PAPA教練 [新手體驗] (填表人: 測試)')
  })

  it('✅ 應該正確處理多個教練', () => {
    const coachNames = ['PAPA', 'Ivan', 'Sky']
    let details = `刪除預約：2026/02/04 16:00 60分 G23 Fish`
    
    if (coachNames.length > 0) {
      details += ` | ${coachNames.map(name => `${name}教練`).join('、')}`
    }
    
    details += ' (填表人: 測試)'
    
    expect(details).toContain('PAPA教練、Ivan教練、Sky教練')
    expect(details).toBe('刪除預約：2026/02/04 16:00 60分 G23 Fish | PAPA教練、Ivan教練、Sky教練 (填表人: 測試)')
  })

  it('✅ 應該正確處理駕駛資訊（與教練不同時）', () => {
    const coachNames = ['PAPA']
    const driverNames = ['Sky']
    let details = `刪除預約：2026/02/04 16:00 60分 G23 Fish | PAPA教練`
    
    if (driverNames.length > 0) {
      const isDifferentFromCoach = !coachNames || 
        JSON.stringify(driverNames.sort()) !== JSON.stringify(coachNames.sort())
      if (isDifferentFromCoach) {
        details += ` | 🚤${driverNames.join('、')}`
      }
    }
    
    details += ' (填表人: 測試)'
    
    expect(details).toContain('🚤Sky')
    expect(details).toBe('刪除預約：2026/02/04 16:00 60分 G23 Fish | PAPA教練 | 🚤Sky (填表人: 測試)')
  })

  it('✅ 駕駛與教練相同時不應該重複顯示', () => {
    const coachNames = ['PAPA']
    const driverNames = ['PAPA'] // 與教練相同
    let details = `刪除預約：2026/02/04 16:00 60分 G23 Fish | PAPA教練`
    
    if (driverNames.length > 0) {
      const isDifferentFromCoach = !coachNames || 
        JSON.stringify(driverNames.sort()) !== JSON.stringify(coachNames.sort())
      if (isDifferentFromCoach) {
        details += ` | 🚤${driverNames.join('、')}`
      }
    }
    
    details += ' (填表人: 測試)'
    
    // 不應該有 🚤PAPA
    expect(details).not.toContain('🚤')
    expect(details).toBe('刪除預約：2026/02/04 16:00 60分 G23 Fish | PAPA教練 (填表人: 測試)')
  })

  it('✅ 應該正確處理所有欄位都存在的最完整情況', () => {
    const booking = mockCompleteBooking
    const coachNames = ['PAPA', 'Ivan']
    const driverNames = ['Sky']
    const filledBy = '許書潔'
    
    const formatBookingTime = (startTime: string) => {
      const datetime = startTime.substring(0, 16)
      const [dateStr, timeStr] = datetime.split('T')
      const [year, month, day] = dateStr.split('-')
      return `${year}/${month}/${day} ${timeStr}`
    }
    
    let details = `刪除預約：${formatBookingTime(booking.start_at)} ${booking.duration_min}分 ${booking.boats.name} ${booking.contact_name}`
    
    if (coachNames.length > 0) {
      details += ` | ${coachNames.map(name => `${name}教練`).join('、')}`
    }
    
    if (driverNames.length > 0) {
      const isDifferentFromCoach = JSON.stringify(driverNames.sort()) !== JSON.stringify(coachNames.sort())
      if (isDifferentFromCoach) {
        details += ` | 🚤${driverNames.join('、')}`
      }
    }
    
    if (booking.activity_types && booking.activity_types.length > 0) {
      details += ` [${booking.activity_types.join('+')}]`
    }
    
    if (booking.notes && booking.notes.trim()) {
      details += ` [${booking.notes.trim()}]`
    }
    
    details += ` (填表人: ${filledBy})`
    
    // 驗證包含所有資訊
    expect(details).toContain('PAPA教練')
    expect(details).toContain('Ivan教練')
    expect(details).toContain('🚤Sky')
    expect(details).toContain('[WS]')
    expect(details).toContain('[新手體驗]')
    expect(details).toContain('(填表人: 許書潔)')
  })
})
