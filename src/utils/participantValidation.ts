/**
 * 参与者验证工具函数
 * 用于 CoachReport 提交前的数据验证
 */

interface Participant {
  member_id: string | null
  participant_name: string
  duration_min: number
  payment_method: string
  lesson_type: string
  notes?: string
  status?: string
}

interface Member {
  id: string
  name: string
  nickname: string | null
  phone: string | null
}

interface PossibleMember {
  inputName: string
  matches: string[]
}

/**
 * 验证参与者列表
 * @throws Error 如果验证失败
 * @returns 有效的参与者列表
 */
export function validateParticipants(participants: Participant[]): Participant[] {
  const validParticipants = participants.filter(p => p.participant_name.trim())

  if (validParticipants.length === 0) {
    throw new Error('请至少新增一位参与者')
  }

  if (validParticipants.some(p => p.duration_min <= 0)) {
    throw new Error('时数必须大于 0')
  }

  return validParticipants
}

/**
 * 检查是否有参与者名字匹配会员但没有选择会员
 * @returns 可能匹配的会员列表
 */
export function checkPossibleMembers(
  participants: Participant[],
  members: Member[]
): PossibleMember[] {
  const possibleMembers: PossibleMember[] = []

  for (const p of participants) {
    if (!p.member_id) {
      // 这是非会员，检查名字是否匹配现有会员
      const matchingMembers = members.filter(m => {
        const memberName = m.nickname || m.name
        const inputName = p.participant_name.trim()
        return (
          memberName.toLowerCase().includes(inputName.toLowerCase()) ||
          inputName.toLowerCase().includes(memberName.toLowerCase())
        )
      })

      if (matchingMembers.length > 0) {
        possibleMembers.push({
          inputName: p.participant_name,
          matches: matchingMembers.map(m => m.nickname || m.name)
        })
      }
    }
  }

  return possibleMembers
}

/**
 * 显示可能会员的确认对话框
 * @returns 用户是否确认继续
 */
export function confirmPossibleMembers(possibleMembers: PossibleMember[]): boolean {
  const messages = possibleMembers.map(pm => 
    `"${pm.inputName}" 可能是会员：${pm.matches.join('、')}`
  )

  const confirmMsg =
    '⚠️ 偵測到以下參與者可能是會員，但沒有選擇會員資料：\n\n' +
    messages.join('\n') +
    '\n\n如果這些是會員，請點擊「取消」回去選擇會員。\n如果確定是非會員（或訪客），請點擊「確定」繼續提交。'

  return confirm(confirmMsg)
}

/**
 * 计算 is_teaching 值
 */
export function calculateIsTeaching(lessonType: string): boolean {
  return lessonType === 'designated_paid' || lessonType === 'designated_free'
}

/**
 * 计算参与者状态
 */
export function calculateParticipantStatus(memberId: string | null): string {
  return memberId ? 'pending' : 'not_applicable'
}

