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
 * 格式：月/日 抵達時間抵達, 下水時間下水, 預約X分鐘, 船名, 教練名教練
 * 範例：12/12 13:00抵達, 13:30下水, 預約30分鐘, G21, 阿寶教練
 */
export function formatBookingForLine(booking: BookingFormatData): string {
  const datetime = booking.start_at.substring(0, 16)
  const [dateStr, timeStr] = datetime.split('T')
  const [, month, day] = dateStr.split('-')

  // 計算抵達時間（提前 30 分鐘）
  const [hour, minute] = timeStr.split(':').map(Number)
  const arrivalMinutes = hour * 60 + minute - 30
  const arrivalHour = Math.floor(arrivalMinutes / 60)
  const arrivalMin = arrivalMinutes % 60
  const arrivalTimeStr = `${String(arrivalHour).padStart(2, '0')}:${String(arrivalMin).padStart(2, '0')}`

  // 船名
  const boatName = booking.boats?.name || '?'

  // 教練（只有指定教練時才顯示）
  const coachPart = booking.coaches && booking.coaches.length > 0
    ? `, ${booking.coaches.filter(c => c && c.name).map(c => c.name + '教練').join('/')}`
    : ''

  return `${month}/${day} ${arrivalTimeStr}抵達, ${timeStr}下水, 預約${booking.duration_min}分鐘, ${boatName}${coachPart}`
}

/**
 * 格式化單個預約為 LINE 訊息格式（含人名）
 * 格式：人名的預約\n月/日 抵達時間 抵達 下水時間 下水 時長分 船名 教練名教練 活動類型
 * 範例：林敏的預約\n12/12 13:00 抵達 13:30 下水 30分 G21 阿寶教練 WB
 */
export function formatSingleBookingWithName(booking: BookingFormatData): string {
  const name = booking.contact_name || '客人'
  const bookingLine = formatBookingForLine(booking)
  return `${name}的預約\n${bookingLine}`
}

/**
 * 格式化多個預約為 LINE 訊息（含標題）
 * 格式：標題\n月/日 抵達時間 抵達 下水時間 下水 時長分 船名 教練名教練 活動類型
 * 範例：
 * 小王的預約
 * 12/11 13:00 抵達 13:30 下水 30分 G21 阿寶教練 WB
 * 12/12 14:00 抵達 14:30 下水 60分 G23 ED教練 SUP
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
      .map((bm: any) => {
        // 安全檢查：確保 members 不是 null
        if (!bm.members) return null
        return bm.members.nickname || bm.members.name
      })
      .filter(Boolean) as string[]

    // 如果有重複的暱稱，只顯示一個
    const uniqueNames = Array.from(new Set(memberDisplayNames))

    // 如果沒有任何有效的會員名稱，回退到 contact_name
    if (uniqueNames.length === 0) {
      return booking.contact_name || '未命名'
    }

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


/**
 * 格式化時間範圍
 * 範例：05:00 - 06:00
 */
export function formatTimeRange(startAt: string, durationMin: number): string {
  const startTimeStr = startAt.substring(11, 16)
  const [h, m] = startTimeStr.split(':').map(Number)
  const endMinutes = h * 60 + m + durationMin
  const endH = Math.floor(endMinutes / 60)
  const endMin = endMinutes % 60
  const endTimeStr = `${String(endH).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`

  return `${startTimeStr} - ${endTimeStr}`
}

interface BookingCopyData {
  start_at: string
  duration_min: number
  contact_name?: string | null
  boats?: { name: string } | null
  coaches?: { name: string }[]
  activity_types?: string[] | null
  booking_members?: { member_id: string; members?: { id: string; name: string; nickname: string | null } | null }[]
}

/**
 * 格式化預約資訊為複製格式
 * 格式：MM/DD 姓名, 抵達時間抵達, 下水時間下水, 預約X分鐘, 船名, 教練名教練
 * 範例：12/12 小王, 13:00抵達, 13:30下水, 預約30分鐘, G21, 阿寶教練
 * 
 * 備註：
 * - 如果未指定教練，則不顯示教練資訊
 * - 抵達時間 = 下水時間 - 30 分鐘
 * - 不顯示活動類型
 */
export function formatBookingForCopy(booking: BookingCopyData): string {
  const datetime = booking.start_at.substring(0, 16)
  const [dateStr, timeStr] = datetime.split('T')
  const [, month, day] = dateStr.split('-')
  
  // 計算抵達時間（提前 30 分鐘）
  const [hour, minute] = timeStr.split(':').map(Number)
  const arrivalMinutes = hour * 60 + minute - 30
  const arrivalHour = Math.floor(arrivalMinutes / 60)
  const arrivalMin = arrivalMinutes % 60
  const arrivalTimeStr = `${String(arrivalHour).padStart(2, '0')}:${String(arrivalMin).padStart(2, '0')}`
  
  // 取得顯示名稱
  const displayName = getDisplayContactName(booking)
  
  // 船名
  const boatName = booking.boats?.name || '?'
  
  // 教練（只有指定教練時才顯示）
  const coachPart = booking.coaches && booking.coaches.length > 0
    ? `, ${booking.coaches.filter(c => c && c.name).map(c => c.name + '教練').join('/')}`
    : ''
  
  return `${month}/${day} ${displayName}, ${arrivalTimeStr}抵達, ${timeStr}下水, 預約${booking.duration_min}分鐘, ${boatName}${coachPart}`
}