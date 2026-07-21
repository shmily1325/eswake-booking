export type CoachReportSubmissionType = 'coach' | 'driver' | 'both'

interface ReportParticipantInput {
  participant_name: string
  duration_min: number
  status: string | null
  member_id: string | null
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
  driverDuration: number,
  participants: ReportParticipantInput[],
): CoachReportSubmissionValidation {
  if (
    (reportType === 'driver' || reportType === 'both') &&
    (!Number.isFinite(driverDuration) || driverDuration <= 0)
  ) {
    return {
      valid: false,
      message: '駕駛時數必須大於 0',
    }
  }

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

  return {
    valid: true,
    emptyParticipantCount: participants.length - validParticipants.length,
  }
}
