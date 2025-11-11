import { supabase } from '../lib/supabase'

/**
 * 審計日誌工具
 * 統一管理所有操作的日誌記錄
 */

interface CreateBookingLogParams {
  userEmail: string
  studentName: string
  boatName: string
  startTime: string
  durationMin: number
  coachNames: string[]
}

interface UpdateBookingLogParams {
  userEmail: string
  studentName: string
  startTime: string  // 新增：預約的開始時間
  changes: string[]
}

interface DeleteBookingLogParams {
  userEmail: string
  studentName: string
  boatName: string
  startTime: string
  durationMin: number
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
    coachNames
  } = params

  // 格式化時間：2025-11-09T23:15:00 → 11/09 23:15
  const datetime = startTime.substring(0, 16) // 取到分钟
  const [dateStr, timeStr] = datetime.split('T')
  const [, month, day] = dateStr.split('-')
  const formattedTime = `${month}/${day} ${timeStr}`

  // 格式：日期時間在最前面，方便搜尋
  let details = `${formattedTime} 新增預約：${studentName} / ${boatName} / ${durationMin}分`
  
  if (coachNames.length > 0) {
    details += ` / 教練：${coachNames.join('、')}`
  }

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
  const { userEmail, studentName, startTime, changes } = params

  // 格式化時間：2025-11-09T23:15:00 → 11/09 23:15
  const datetime = startTime.substring(0, 16)
  const [dateStr, timeStr] = datetime.split('T')
  const [, month, day] = dateStr.split('-')
  const formattedTime = `${month}/${day} ${timeStr}`

  // 格式：日期時間在最前面，方便搜尋
  const details = `${formattedTime} 修改預約：${studentName}，變更：${changes.join('、')}`

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
  const { userEmail, studentName, boatName, startTime, durationMin } = params

  // 格式化時間顯示
  const datetime = startTime.substring(0, 16)
  const [dateStr, timeStr] = datetime.split('T')
  const [, month, day] = dateStr.split('-')
  const formattedTime = `${month}/${day} ${timeStr}`
  
  // 格式：日期時間在最前面，方便搜尋
  const details = `${formattedTime} 刪除預約：${studentName} / ${boatName} / ${durationMin}分`

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

  // 格式化時間：2025-11-09T23:15:00 → 11/09 23:15
  const datetime = startTime.substring(0, 16)
  const [dateStr, timeStr] = datetime.split('T')
  const [, month, day] = dateStr.split('-')
  const formattedTime = `${month}/${day} ${timeStr}`

  // 格式：日期時間在最前面，方便搜尋
  const details = `${formattedTime} 排班：${studentName} / ${boatName}，變更：${changes.join('、')}`

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

