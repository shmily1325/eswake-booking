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
 * 格式：月/日 時間 船 教練 時長 活動類型
 * 範例：11/11 05:00 G23 ED 60分 SUP
 */
export function formatBookingForLine(booking: BookingFormatData): string {
  const datetime = booking.start_at.substring(0, 16)
  const [dateStr, timeStr] = datetime.split('T')
  const [, month, day] = dateStr.split('-')
  
  // 組合一行：日期 時間 船 教練 時長 活動類型
  const coaches = booking.coaches && booking.coaches.length > 0 
    ? booking.coaches.map(c => c.name).join('/')
    : '不指定'
  
  const activities = booking.activity_types && booking.activity_types.length > 0
    ? ` ${booking.activity_types.join('+')}`
    : ''
  
  return `${month}/${day} ${timeStr} ${booking.boats?.name || '?'} ${coaches} ${booking.duration_min}分${activities}`
}

/**
 * 格式化單個預約為 LINE 訊息格式（含人名）
 * 格式：人名的預約\n月/日 時間 船 教練 時長 活動類型
 * 範例：林敏的預約\n11/11 05:00 G23 ED 60分 SUP
 */
export function formatSingleBookingWithName(booking: BookingFormatData): string {
  const name = booking.contact_name || '客人'
  const bookingLine = formatBookingForLine(booking)
  return `${name}的預約\n${bookingLine}`
}

/**
 * 格式化多個預約為 LINE 訊息（含標題）
 * 格式：人名的預約\n月/日 時間 船 教練 時長\n月/日 時間 船 教練 時長
 */
export function formatBookingsForLine(bookings: BookingFormatData[], title: string): string {
  if (bookings.length === 0) return ''
  
  let message = `${title}\n`
  
  bookings.forEach((booking) => {
    message += formatBookingForLine(booking) + '\n'
  })
  
  return message.trim()
}

