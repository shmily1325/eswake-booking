import { supabase } from '../lib/supabase'

/**
 * 審計日誌工具
 * 統一管理所有操作的日誌記錄
 */

/**
 * 統一的時間格式化函數
 * 格式化時間：2025-11-09T23:15:00 → 2025/11/09 23:15
 * 包含年份以避免跨年度預約混淆
 */
function formatBookingTime(startTime: string): string {
  const datetime = startTime.substring(0, 16) // 取到分鐘
  const [dateStr, timeStr] = datetime.split('T')
  const [year, month, day] = dateStr.split('-')
  return `${year}/${month}/${day} ${timeStr}`
}

interface CreateBookingLogParams {
  userEmail: string
  studentName: string
  boatName: string
  startTime: string
  durationMin: number
  coachNames: string[]
  filledBy?: string
}

interface UpdateBookingLogParams {
  userEmail: string
  studentName: string
  startTime: string  // 新增：預約的開始時間
  changes: string[]
  filledBy?: string
}

interface DeleteBookingLogParams {
  userEmail: string
  studentName: string
  boatName: string
  startTime: string
  durationMin: number
  filledBy?: string
}

/**
 * 記錄新增預約
 */
export async function logBookingCreation(params: CreateBookingLogParams) {
  const {
    userEmail,
    studentName,
    boatName,
    startTime,
    durationMin,
    coachNames,
    filledBy
  } = params

  const formattedTime = formatBookingTime(startTime)

  // 格式：2025/11/20 14:45 60分 G23 小楊 | 小胖教練、Ivan教練 (填表人: xxx)
  // 使用 | 分隔會員和教練，避免解析混亂
  let details = `${formattedTime} ${durationMin}分 ${boatName} ${studentName}`
  
  if (coachNames.length > 0) {
    details += ` | ${coachNames.map(name => `${name}教練`).join('、')}`
  }
  
  // 加上填表人資訊
  if (filledBy && filledBy.trim()) {
    details += ` (填表人: ${filledBy})`
  }
  
  details = `新增預約：${details}`

  // 非阻塞寫入：在後台默默記錄，不等待完成
  void (async () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hour = String(now.getHours()).padStart(2, '0')
    const minute = String(now.getMinutes()).padStart(2, '0')
    const second = String(now.getSeconds()).padStart(2, '0')
    const created_at = `${year}-${month}-${day}T${hour}:${minute}:${second}`
    
    const { error } = await supabase.from('audit_log').insert({
      user_email: userEmail,
      action: 'create',
      table_name: 'bookings',
      details,
      created_at
    })
    if (error) {
      console.error('審計日誌寫入錯誤:', error)
    }
  })()
}

/**
 * 記錄更新預約
 */
export async function logBookingUpdate(params: UpdateBookingLogParams) {
  const { userEmail, studentName, startTime, changes, filledBy } = params

  const formattedTime = formatBookingTime(startTime)

  // 格式：2025/11/20 14:45 小楊，變更：... (填表人: xxx)
  let details = `修改預約：${formattedTime} ${studentName}，變更：${changes.join('、')}`
  
  // 加上填表人資訊
  if (filledBy && filledBy.trim()) {
    details += ` (填表人: ${filledBy})`
  }

  // 非阻塞寫入
  void (async () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hour = String(now.getHours()).padStart(2, '0')
    const minute = String(now.getMinutes()).padStart(2, '0')
    const second = String(now.getSeconds()).padStart(2, '0')
    const created_at = `${year}-${month}-${day}T${hour}:${minute}:${second}`
    
    const { error } = await supabase.from('audit_log').insert({
      user_email: userEmail,
      action: 'update',
      table_name: 'bookings',
      details,
      created_at
    })
    if (error) {
      console.error('審計日誌寫入錯誤:', error)
    }
  })()
}

/**
 * 記錄刪除預約
 */
export async function logBookingDeletion(params: DeleteBookingLogParams) {
  const { userEmail, studentName, boatName, startTime, durationMin, filledBy } = params

  const formattedTime = formatBookingTime(startTime)
  
  // 格式：2025/11/20 14:45 60分 G23 小楊 (填表人: xxx)
  // 刪除記錄不包含教練資訊，所以不需要 | 分隔符
  let details = `刪除預約：${formattedTime} ${durationMin}分 ${boatName} ${studentName}`
  
  // 加上填表人資訊
  if (filledBy && filledBy.trim()) {
    details += ` (填表人: ${filledBy})`
  }

  // 非阻塞寫入
  void (async () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hour = String(now.getHours()).padStart(2, '0')
    const minute = String(now.getMinutes()).padStart(2, '0')
    const second = String(now.getSeconds()).padStart(2, '0')
    const created_at = `${year}-${month}-${day}T${hour}:${minute}:${second}`
    
    const { error } = await supabase.from('audit_log').insert({
      user_email: userEmail,
      action: 'delete',
      table_name: 'bookings',
      details,
      created_at
    })
    if (error) {
      console.error('審計日誌寫入錯誤:', error)
    }
  })()
}

/**
 * 記錄會員操作
 */
export async function logMemberAction(
  userEmail: string,
  action: 'create' | 'update' | 'delete',
  memberName: string,
  details?: string
) {
  const actionText = {
    create: '新增',
    update: '修改',
    delete: '刪除'
  }[action]

  const logDetails = details 
    ? `${actionText}會員：${memberName}，${details}`
    : `${actionText}會員：${memberName}`

  try {
    await supabase.from('audit_log').insert({
      user_email: userEmail,
      action,
      table_name: 'members',
      details: logDetails
    })
  } catch (error) {
    console.error('審計日誌記錄失敗:', error)
  }
}

/**
 * 記錄交易操作
 */
export async function logTransaction(
  userEmail: string,
  memberName: string,
  transactionType: string,
  amount: number,
  notes?: string
) {
  const details = notes
    ? `${memberName} / ${transactionType} / $${amount} / ${notes}`
    : `${memberName} / ${transactionType} / $${amount}`

  try {
    await supabase.from('audit_log').insert({
      user_email: userEmail,
      action: 'create',
      table_name: 'transactions',
      details
    })
  } catch (error) {
    console.error('審計日誌記錄失敗:', error)
  }
}

/**
 * 記錄一般操作
 */
export async function logAction(
  userEmail: string,
  action: 'create' | 'update' | 'delete',
  tableName: string,
  details: string
) {
  try {
    await supabase.from('audit_log').insert({
      user_email: userEmail,
      action,
      table_name: tableName,
      details
    })
  } catch (error) {
    console.error('審計日誌記錄失敗:', error)
  }
}

interface CoachAssignmentLogParams {
  userEmail: string
  studentName: string
  boatName: string
  startTime: string
  changes: string[]
}

/**
 * 記錄排班操作（教練/駕駛分配、排班註解）
 */
export async function logCoachAssignment(params: CoachAssignmentLogParams) {
  const { userEmail, studentName, boatName, startTime, changes } = params

  const formattedTime = formatBookingTime(startTime)

  // 格式：2025/11/20 14:45 G23 小楊，變更：...
  const details = `排班：${formattedTime} ${boatName} ${studentName}，變更：${changes.join('、')}`

  // 非阻塞寫入
  void (async () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hour = String(now.getHours()).padStart(2, '0')
    const minute = String(now.getMinutes()).padStart(2, '0')
    const second = String(now.getSeconds()).padStart(2, '0')
    const created_at = `${year}-${month}-${day}T${hour}:${minute}:${second}`
    
    const { error } = await supabase.from('audit_log').insert({
      user_email: userEmail,
      action: 'update',
      table_name: 'coach_assignment',
      details,
      created_at
    })
    if (error) {
      console.error('審計日誌寫入錯誤:', error)
    }
  })()
}

