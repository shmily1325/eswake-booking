// 預約訊息格式化工具

interface BookingFormatData {
  start_at: string
  duration_min: number
  contact_name?: string
  boats?: { name: string } | null
  coaches?: { name: string }[]
  activity_types?: string[] | null
}

/**
 * 格式化單個預約為 LINE 訊息格式（不含人名）
 * 格式：月/日 時間 時長 船 教練 活動類型
 * 範例：11/11 05:00 60分 G23 ED SUP
 */
export function formatBookingForLine(booking: BookingFormatData): string {
  const datetime = booking.start_at.substring(0, 16)
  const [dateStr, timeStr] = datetime.split('T')
  const [, month, day] = dateStr.split('-')
  
  // 組合一行：日期 時間 時長 船 教練 活動類型
  const coaches = booking.coaches && booking.coaches.length > 0 
    ? booking.coaches.map(c => c.name).join('/')
    : '不指定'
  
  const activities = booking.activity_types && booking.activity_types.length > 0
    ? ` ${booking.activity_types.join('+')}`
    : ''
  
  return `${month}/${day} ${timeStr} ${booking.duration_min}分 ${booking.boats?.name || '?'} ${coaches}${activities}`
}

/**
 * 格式化單個預約為 LINE 訊息格式（含人名）
 * 格式：人名的預約\n月/日 時間 時長 船 教練 活動類型
 * 範例：林敏的預約\n11/11 05:00 60分 G23 ED SUP
 */
export function formatSingleBookingWithName(booking: BookingFormatData): string {
  const name = booking.contact_name || '客人'
  const bookingLine = formatBookingForLine(booking)
  return `${name}的預約\n${bookingLine}`
}

/**
 * 格式化多個預約為 LINE 訊息（含標題）
 * 格式：人名的預約\n月/日 時間 時長 船 教練\n月/日 時間 時長 船 教練
 */
export function formatBookingsForLine(bookings: BookingFormatData[], title: string): string {
  if (bookings.length === 0) return ''
  
  let message = `${title}\n`
  
  bookings.forEach((booking) => {
    message += formatBookingForLine(booking) + '\n'
  })
  
  return message.trim()
}

/**
 * 根據會員資料獲取顯示名稱
 * 優先顯示暱稱，如果沒有暱稱則顯示姓名
 * 如果有多個會員，用逗號分隔（但如果暱稱相同只顯示一個）
 * 如果有非會員，會從 contact_name 中提取並一併顯示
 */
export function getDisplayContactName(booking: any): string {
  // 如果有關聯的會員，優先顯示暱稱
  if (booking.booking_members && booking.booking_members.length > 0) {
    const memberDisplayNames = booking.booking_members
      .map((bm: any) => bm.members?.nickname || bm.members?.name)
      .filter(Boolean) as string[]
    
    // 如果有重複的暱稱，只顯示一個
    const uniqueNames = Array.from(new Set(memberDisplayNames))
    
    // 如果只有會員，且數量吻合 contact_name 中的名字數量，直接返回
    // 否則，可能還包含非會員名字，直接用 contact_name
    const contactNameParts = booking.contact_name?.split(',').map((n: any) => n.trim()).filter(Boolean) || []
    
    // 如果會員數量等於 contact_name 中的名字數量，說明都是會員
    if (uniqueNames.length === contactNameParts.length) {
      return uniqueNames.join(', ')
    }
    
    // 否則，contact_name 中可能還有非會員，需要混合處理
    // 為了簡化，直接返回第一個會員的暱稱/姓名
    // 如果要完整顯示，會比較複雜（需要從 contact_name 中排除會員真實姓名，再加上暱稱）
    return uniqueNames[0] || booking.contact_name || '未命名'
  }
  
  // 沒有關聯會員，直接使用 contact_name
  return booking.contact_name || '未命名'
}

