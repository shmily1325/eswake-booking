// 报表导出工具函数

interface ExportRecord {
  id: number
  duration_min: number
  payment_method: string
  lesson_type?: string | null
  participant_name: string
  member_id: string | null
  notes?: string | null
  transactions?: any[]
  bookings: {
    start_at: string
    boats?: { name: string } | null
  }
  coaches?: { name: string } | null
  members?: { name: string; nickname: string | null } | null
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: '現金',
  transfer: '匯款',
  balance: '扣儲值',
  voucher: '票券'
}

const LESSON_TYPE_LABELS: Record<string, string> = {
  undesignated: '不指定',
  designated_paid: '指定(收費)',
  designated_free: '指定(不收費)'
}

// 格式化日期時間
function formatDateTime(datetime: string): string {
  const [datePart] = datetime.split('T')
  const date = new Date(datetime)
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  return `${datePart} ${time}`
}

// 生成扣款詳情文字
function getDeductionText(record: ExportRecord): string {
  const transactions = record.transactions || []
  
  // 檢查是否為結清
  if (record.notes) {
    if (record.notes.includes('[現金結清]')) return '現金結清'
    if (record.notes.includes('[匯款結清]')) return '匯款結清'
    if (record.notes.includes('[指定課不收費]')) return '指定課不收費'
  }
  
  if (transactions.length === 0) return '-'
  
  const CATEGORY_CONFIG: Record<string, { label: string }> = {
    balance: { label: '儲值' },
    vip_voucher: { label: 'VIP票券' },
    boat_voucher_g23: { label: 'G23船券' },
    boat_voucher_g21_panther: { label: 'G21/黑豹券' },
    designated_lesson: { label: '指定課時數' },
    plan: { label: '方案' },
    gift_boat_hours: { label: '贈送時數' }
  }
  
  const items = transactions.map(tx => {
    const config = CATEGORY_CONFIG[tx.category]
    if (!config) return null
    
    // 方案
    if (tx.category === 'plan') {
      const planName = tx.notes ? tx.notes.split(' - ')[0] : '方案'
      return planName
    }
    
    // 判斷是否為指定課
    const isDesignatedLesson = tx.description?.includes('【指定課】')
    if (isDesignatedLesson && tx.category === 'balance') {
      const amount = tx.amount ? `$${Math.abs(tx.amount).toLocaleString()}` : '$0'
      return `指定課 ${amount}`
    }
    
    // 金額類
    if (tx.amount !== null && tx.amount !== undefined) {
      const amount = `$${Math.abs(tx.amount).toLocaleString()}`
      return `${config.label} ${amount}`
    }
    
    // 時數類
    if (tx.minutes !== null && tx.minutes !== undefined) {
      const minutes = `${Math.abs(tx.minutes)}分`
      return `${config.label} ${minutes}`
    }
    
    return null
  }).filter(Boolean)
  
  return items.length > 0 ? items.join(' + ') : '-'
}

// 1. 匯出所有記錄
export function generateAllRecordsReport(
  records: ExportRecord[], 
  dateRange: string
): string {
  const title = `【教學記錄明細】${dateRange}\n`
  const separator = '='.repeat(80) + '\n'
  
  let content = title + separator + '\n'
  
  // 按預約分組
  const bookingGroups = new Map<number, ExportRecord[]>()
  records.forEach(record => {
    const bookingId = (record as any).booking_id
    if (!bookingGroups.has(bookingId)) {
      bookingGroups.set(bookingId, [])
    }
    bookingGroups.get(bookingId)!.push(record)
  })
  
  bookingGroups.forEach((bookingRecords) => {
    const firstRecord = bookingRecords[0]
    const dateTime = formatDateTime(firstRecord.bookings.start_at)
    const boat = firstRecord.bookings.boats?.name || '未知'
    
    content += `【${dateTime} | ${boat}】\n`
    
    bookingRecords.forEach(record => {
      const coach = record.coaches?.name || '未知'
      const student = record.members?.nickname || record.members?.name || record.participant_name
      const memberTag = !record.member_id ? ' (非會員)' : ''
      const duration = record.duration_min
      const lessonType = LESSON_TYPE_LABELS[record.lesson_type || 'undesignated'] || '不指定'
      const paymentMethod = PAYMENT_METHOD_LABELS[record.payment_method] || record.payment_method
      const deduction = getDeductionText(record)
      
      content += `  教練：${coach} | 學員：${student}${memberTag} | ${duration}分 | ${lessonType} | ${paymentMethod}\n`
      if (deduction !== '-') {
        content += `    ${deduction}\n`
      }
    })
    
    content += '\n'
  })
  
  // 統計
  content += separator
  content += '【統計彙總】\n'
  content += `總教學時數：${records.reduce((sum, r) => sum + r.duration_min, 0)}分 (${(records.reduce((sum, r) => sum + r.duration_min, 0) / 60).toFixed(1)}小時)\n`
  content += `總記錄數：${records.length}筆\n\n`
  
  // 按付款方式統計
  const paymentStats = new Map<string, number>()
  records.forEach(r => {
    const method = PAYMENT_METHOD_LABELS[r.payment_method] || r.payment_method
    paymentStats.set(method, (paymentStats.get(method) || 0) + 1)
  })
  
  content += '付款方式分布：\n'
  paymentStats.forEach((count, method) => {
    content += `  ${method}：${count}筆\n`
  })
  
  return content
}

// 2. 只匯出現金記錄
export function generateCashReport(records: ExportRecord[], dateRange: string): string {
  const cashRecords = records.filter(r => r.payment_method === 'cash')
  
  const title = `【現金收款明細】${dateRange}\n`
  const separator = '='.repeat(80) + '\n'
  
  let content = title + separator + '\n'
  
  // 按教練分組
  const coachGroups = new Map<string, ExportRecord[]>()
  cashRecords.forEach(record => {
    const coach = record.coaches?.name || '未知'
    if (!coachGroups.has(coach)) {
      coachGroups.set(coach, [])
    }
    coachGroups.get(coach)!.push(record)
  })
  
  coachGroups.forEach((coachRecords, coachName) => {
    content += `【${coachName} 教練】\n`
    
    coachRecords.forEach(record => {
      const dateTime = formatDateTime(record.bookings.start_at)
      const student = record.members?.nickname || record.members?.name || record.participant_name
      const memberTag = !record.member_id ? ' (非會員)' : ''
      const boat = record.bookings.boats?.name || '未知'
      const duration = record.duration_min
      const lessonType = LESSON_TYPE_LABELS[record.lesson_type || 'undesignated'] || '不指定'
      
      content += `  ${dateTime} | ${student}${memberTag} | ${boat} | ${duration}分 | ${lessonType}\n`
    })
    
    content += `  小計：${coachRecords.length}筆\n\n`
  })
  
  content += separator
  content += `總計：${cashRecords.length}筆現金\n`
  
  return content
}

// 3. 只匯出匯款記錄
export function generateTransferReport(records: ExportRecord[], dateRange: string): string {
  const transferRecords = records.filter(r => r.payment_method === 'transfer')
  
  const title = `【匯款收款明細】${dateRange}\n`
  const separator = '='.repeat(80) + '\n'
  
  let content = title + separator + '\n'
  
  // 按教練分組
  const coachGroups = new Map<string, ExportRecord[]>()
  transferRecords.forEach(record => {
    const coach = record.coaches?.name || '未知'
    if (!coachGroups.has(coach)) {
      coachGroups.set(coach, [])
    }
    coachGroups.get(coach)!.push(record)
  })
  
  coachGroups.forEach((coachRecords, coachName) => {
    content += `【${coachName} 教練】\n`
    
    coachRecords.forEach(record => {
      const dateTime = formatDateTime(record.bookings.start_at)
      const student = record.members?.nickname || record.members?.name || record.participant_name
      const memberTag = !record.member_id ? ' (非會員)' : ''
      const boat = record.bookings.boats?.name || '未知'
      const duration = record.duration_min
      const lessonType = LESSON_TYPE_LABELS[record.lesson_type || 'undesignated'] || '不指定'
      
      content += `  ${dateTime} | ${student}${memberTag} | ${boat} | ${duration}分 | ${lessonType}\n`
    })
    
    content += `  小計：${coachRecords.length}筆\n\n`
  })
  
  content += separator
  content += `總計：${transferRecords.length}筆匯款\n`
  
  return content
}

// 4. 按教練匯出（現金/匯款）
export function generateCoachCashReport(records: ExportRecord[], dateRange: string): string {
  const cashAndTransferRecords = records.filter(r => 
    r.payment_method === 'cash' || r.payment_method === 'transfer'
  )
  
  const title = `【教練收款明細】${dateRange}\n`
  const separator = '='.repeat(80) + '\n'
  
  let content = title + separator + '\n'
  
  // 按教練分組
  const coachGroups = new Map<string, { cash: ExportRecord[]; transfer: ExportRecord[] }>()
  cashAndTransferRecords.forEach(record => {
    const coach = record.coaches?.name || '未知'
    if (!coachGroups.has(coach)) {
      coachGroups.set(coach, { cash: [], transfer: [] })
    }
    
    if (record.payment_method === 'cash') {
      coachGroups.get(coach)!.cash.push(record)
    } else {
      coachGroups.get(coach)!.transfer.push(record)
    }
  })
  
  coachGroups.forEach((records, coachName) => {
    content += `【${coachName} 教練】\n\n`
    
    // 現金
    if (records.cash.length > 0) {
      content += `  現金：\n`
      records.cash.forEach(record => {
        const dateTime = formatDateTime(record.bookings.start_at)
        const student = record.members?.nickname || record.members?.name || record.participant_name
        const boat = record.bookings.boats?.name || '未知'
        const duration = record.duration_min
        
        content += `    ${dateTime} | ${student} | ${boat} | ${duration}分\n`
      })
      content += `  小計：${records.cash.length}筆\n\n`
    }
    
    // 匯款
    if (records.transfer.length > 0) {
      content += `  匯款：\n`
      records.transfer.forEach(record => {
        const dateTime = formatDateTime(record.bookings.start_at)
        const student = record.members?.nickname || record.members?.name || record.participant_name
        const boat = record.bookings.boats?.name || '未知'
        const duration = record.duration_min
        
        content += `    ${dateTime} | ${student} | ${boat} | ${duration}分\n`
      })
      content += `  小計：${records.transfer.length}筆\n\n`
    }
    
    content += `  ${coachName} 合計：現金${records.cash.length}筆 + 匯款${records.transfer.length}筆\n`
    content += separator + '\n'
  })
  
  // 總計
  const totalCash = cashAndTransferRecords.filter(r => r.payment_method === 'cash').length
  const totalTransfer = cashAndTransferRecords.filter(r => r.payment_method === 'transfer').length
  content += `總計：現金${totalCash}筆 + 匯款${totalTransfer}筆 = ${cashAndTransferRecords.length}筆\n`
  
  return content
}

// 複製到剪貼簿
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (error) {
    console.error('複製失敗:', error)
    return false
  }
}

// 下載為文字檔案
export function downloadAsFile(text: string, filename: string): void {
  try {
    // 建立 Blob 物件
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    
    // 建立下載連結
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    
    // 觸發下載
    document.body.appendChild(link)
    link.click()
    
    // 清理
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('下載失敗:', error)
    throw error
  }
}

// 下載為 CSV 檔案
export function downloadAsCSV(text: string, filename: string): void {
  try {
    // 加上 BOM 讓 Excel 正確識別 UTF-8
    const BOM = '\uFEFF'
    const blob = new Blob([BOM + text], { type: 'text/csv;charset=utf-8' })
    
    // 建立下載連結
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    
    // 觸發下載
    document.body.appendChild(link)
    link.click()
    
    // 清理
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('下載失敗:', error)
    throw error
  }
}

// 生成 CSV 格式的報表
export function generateCSVReport(records: ExportRecord[]): string {
  let csv = ''
  
  // CSV 標題行
  csv += '日期時間,教練,學員,會員狀態,船隻,時長(分),課程類型,付款方式,扣款詳情\n'
  
  // 資料行
  records.forEach(record => {
    const dateTime = formatDateTime(record.bookings.start_at)
    const coach = record.coaches?.name || '未知'
    const student = record.members?.nickname || record.members?.name || record.participant_name
    const memberStatus = record.member_id ? '會員' : '非會員'
    const boat = record.bookings.boats?.name || '未知'
    const duration = record.duration_min
    const lessonType = LESSON_TYPE_LABELS[record.lesson_type || 'undesignated'] || '不指定'
    const paymentMethod = PAYMENT_METHOD_LABELS[record.payment_method] || record.payment_method
    const deduction = getDeductionText(record)
    
    // 處理欄位中的逗號和引號（CSV 規則）
    const escapeCsvField = (field: string | number) => {
      const str = String(field)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }
    
    csv += `${escapeCsvField(dateTime)},${escapeCsvField(coach)},${escapeCsvField(student)},${escapeCsvField(memberStatus)},${escapeCsvField(boat)},${escapeCsvField(duration)},${escapeCsvField(lessonType)},${escapeCsvField(paymentMethod)},${escapeCsvField(deduction)}\n`
  })
  
  return csv
}

