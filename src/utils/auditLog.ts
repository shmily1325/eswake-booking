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
  driverName?: string
}

interface UpdateBookingLogParams {
  userEmail: string
  studentName: string
  changes: string[]
}

interface DeleteBookingLogParams {
  userEmail: string
  studentName: string
  startTime: string
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
    driverName
  } = params

  let details = `新增預約：${studentName} / ${boatName} / ${startTime} / ${durationMin}分鐘`
  
  if (coachNames.length > 0) {
    details += ` / 教練：${coachNames.join('、')}`
  }
  
  if (driverName) {
    details += ` / 駕駛：${driverName}`
  }

  try {
    const { error } = await supabase.from('audit_log').insert({
      user_email: userEmail,
      action: 'create',
      table_name: 'bookings',
      details
    })
    
    if (error) {
      console.error('審計日誌寫入錯誤:', error)
    } else {
      console.log('審計日誌寫入成功:', details)
    }
  } catch (error) {
    console.error('審計日誌記錄失敗:', error)
  }
}

/**
 * 記錄更新預約
 */
export async function logBookingUpdate(params: UpdateBookingLogParams) {
  const { userEmail, studentName, changes } = params

  const details = `修改預約：${studentName}，變更：${changes.join('、')}`

  try {
    await supabase.from('audit_log').insert({
      user_email: userEmail,
      action: 'update',
      table_name: 'bookings',
      details
    })
  } catch (error) {
    console.error('審計日誌記錄失敗:', error)
  }
}

/**
 * 記錄刪除預約
 */
export async function logBookingDeletion(params: DeleteBookingLogParams) {
  const { userEmail, studentName, startTime } = params

  const details = `刪除預約：${studentName} / ${startTime}`

  try {
    await supabase.from('audit_log').insert({
      user_email: userEmail,
      action: 'delete',
      table_name: 'bookings',
      details
    })
  } catch (error) {
    console.error('審計日誌記錄失敗:', error)
  }
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

