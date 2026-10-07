export type CoachReportSubmissionType = 'coach' | 'driver' | 'both'

interface ReportParticipantInput {
  participant_name: string
  duration_min: number
  status: string | null
  member_id: string | null
  lesson_type?: string | null
  designated_hours_initialized?: boolean
}

export type CoachReportSubmissionValidation =
  | {
      valid: true
      emptyParticipantCount: number
    }
  | {
      valid: false
      message: string
    }

export function validateCoachReportSubmission(
  reportType: CoachReportSubmissionType,
  participants: ReportParticipantInput[],
): CoachReportSubmissionValidation {
  if (reportType === 'driver') {
    return {
      valid: true,
      emptyParticipantCount: 0,
    }
  }

  const validParticipants = participants.filter((participant) =>
    participant.participant_name.trim(),
  )
  const invalidDuration = validParticipants.find((participant) =>
    !Number.isFinite(Number(participant.duration_min)) ||
    Number(participant.duration_min) <= 0,
  )

  if (invalidDuration) {
    return {
      valid: false,
      message: `「${invalidDuration.participant_name || '未命名'}」的時數必須大於 0`,
    }
  }

  const missingMembers = validParticipants.filter((participant) =>
    participant.status === 'pending' && !participant.member_id,
  )
  if (missingMembers.length > 0) {
    const names = missingMembers
      .map((participant) => participant.participant_name || '(未填寫)')
      .join('、')
    return {
      valid: false,
      message: `以下參與者標記為會員但尚未選擇：${names}。請點擊該參與者從會員列表選擇，或刪除後改用「新增客人」`,
    }
  }

  const pendingDesignatedHours = validParticipants.find((participant) =>
    participant.lesson_type === 'designated_free'
    && !!participant.member_id
    && participant.designated_hours_initialized !== true,
  )
  if (pendingDesignatedHours) {
    return {
      valid: false,
      message: '指定課資料仍在載入，請稍候再送出',
    }
  }

  return {
    valid: true,
    emptyParticipantCount: participants.length - validParticipants.length,
  }
}
