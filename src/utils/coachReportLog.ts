import { supabase } from '../lib/supabase'

/**
 * 教練回報記錄工具
 * 專門用於追蹤教練回報操作
 */

interface ParticipantInfo {
  name: string
  durationMin: number
  paymentMethod: string
  lessonType?: string
  memberId?: string | null
  isNew: boolean  // 是否為新增的參與者
}

interface LogCoachReportParams {
  coachId: string
  coachEmail?: string
  coachName: string
  bookingId: number
  bookingStartAt: string
  contactName: string
  boatName: string
  actionType: 'create' | 'update'
  participants: ParticipantInfo[]
  driverDurationMin?: number
  previousParticipants?: ParticipantInfo[]  // 修改前的參與者（用於比較變更）
}

/**
 * 記錄教練回報操作
 * 
 * @param params - 回報參數
 * 
 * @example
 * ```typescript
 * await logCoachReport({
 *   coachId: 'xxx',
 *   coachEmail: 'coach@example.com',
 *   coachName: 'Kevin',
 *   bookingId: 553,
 *   bookingStartAt: '2025-12-14T11:00:00',
 *   contactName: 'Josh',
 *   boatName: '黑豹',
 *   actionType: 'create',
 *   participants: [{ name: 'Josh', durationMin: 40, paymentMethod: 'voucher', isNew: true }],
 *   driverDurationMin: 40
 * })
 * ```
 */
export async function logCoachReport(params: LogCoachReportParams) {
  const {
    coachId,
    coachEmail,
    coachName,
    bookingId,
    bookingStartAt,
    contactName,
    boatName,
    actionType,
    participants,
    driverDurationMin,
    previousParticipants
  } = params

  // 生成參與者摘要
  const participantsSummary = participants
    .map(p => {
      const paymentLabel = {
        'cash': '現金',
        'transfer': '匯款',
        'balance': '扣儲值',
        'voucher': '票券'
      }[p.paymentMethod] || p.paymentMethod
      
      return `${p.name} ${p.durationMin}分 ${paymentLabel}${p.isNew ? ' (新增)' : ''}`
    })
    .join(', ')

  // 生成詳細變更記錄
  const changesDetail: Record<string, any> = {
    coach: {
      id: coachId,
      name: coachName,
      email: coachEmail
    },
    participants: participants.map(p => ({
      name: p.name,
      duration_min: p.durationMin,
      payment_method: p.paymentMethod,
      lesson_type: p.lessonType,
      member_id: p.memberId,
      is_new: p.isNew
    }))
  }

  if (driverDurationMin !== undefined) {
    changesDetail.driver_duration_min = driverDurationMin
  }

  if (previousParticipants && previousParticipants.length > 0) {
    changesDetail.previous_participants = previousParticipants.map(p => ({
      name: p.name,
      duration_min: p.durationMin,
      payment_method: p.paymentMethod,
      lesson_type: p.lessonType
    }))
  }

  // 非阻塞寫入
  void (async () => {
    try {
      const { error } = await supabase
        .from('coach_report_logs')
        .insert({
          coach_id: coachId,
          coach_email: coachEmail,
          booking_id: bookingId,
          booking_start_at: bookingStartAt,
          contact_name: contactName,
          boat_name: boatName,
          action_type: actionType,
          participants_summary: participantsSummary,
          driver_duration_min: driverDurationMin,
          changes_detail: changesDetail
        })

      if (error) {
        console.error('教練回報記錄寫入失敗:', error)
      }
    } catch (err) {
      console.error('教練回報記錄寫入異常:', err)
    }
  })()
}

/**
 * 記錄刪除參與者
 */
export async function logParticipantDeletion(params: {
  coachId: string
  coachEmail?: string
  coachName: string
  bookingId: number
  bookingStartAt: string
  contactName: string
  boatName: string
  deletedParticipants: Array<{ name: string; durationMin: number }>
}) {
  const {
    coachId,
    coachEmail,
    coachName,
    bookingId,
    bookingStartAt,
    contactName,
    boatName,
    deletedParticipants
  } = params

  const summary = deletedParticipants
    .map(p => `${p.name} ${p.durationMin}分`)
    .join(', ')

  void (async () => {
    try {
      const { error } = await supabase
        .from('coach_report_logs')
        .insert({
          coach_id: coachId,
          coach_email: coachEmail,
          booking_id: bookingId,
          booking_start_at: bookingStartAt,
          contact_name: contactName,
          boat_name: boatName,
          action_type: 'delete',
          participants_summary: `刪除: ${summary}`,
          changes_detail: {
            coach: { id: coachId, name: coachName, email: coachEmail },
            deleted_participants: deletedParticipants
          }
        })

      if (error) {
        console.error('刪除記錄寫入失敗:', error)
      }
    } catch (err) {
      console.error('刪除記錄寫入異常:', err)
    }
  })()
}

