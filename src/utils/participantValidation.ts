/**
 * 參與者驗證工具函數
 * 用於 CoachReport 提交前的數據驗證
 */

import type { Participant, Member } from '../types/booking'
import { PARTICIPANT_STATUS } from '../constants/booking'

interface PossibleMember {
  inputName: string
  matches: string[]
}

/**
 * 驗證參與者列表
 * 
 * 檢查參與者列表是否符合以下條件：
 * 1. 至少有一位參與者
 * 2. 所有參與者都有名字
 * 3. 所有參與者的時數都大於 0
 * 
 * @param participants - 參與者列表
 * @returns 有效的參與者列表（過濾掉名字為空的項目）
 * 
 * @throws {TypeError} 如果 participants 不是陣列
 * @throws {Error} 如果驗證失敗（無參與者或時數無效）
 * 
 * @example
 * ```typescript
 * const validated = validateParticipants([
 *   { participant_name: 'John', duration_min: 60, ... },
 *   { participant_name: 'Jane', duration_min: 30, ... }
 * ])
 * ```
 */
export function validateParticipants(participants: Participant[]): Participant[] {
  if (!participants || !Array.isArray(participants)) {
    throw new TypeError('participants 必須是陣列')
  }
  
  const validParticipants = participants.filter(p => p.participant_name.trim())

  if (validParticipants.length === 0) {
    throw new Error('請至少新增一位參與者')
  }

  if (validParticipants.some(p => p.duration_min <= 0)) {
    throw new Error('時數必須大於 0')
  }

  return validParticipants
}

/**
 * 檢查是否有參與者名字匹配會員但沒有選擇會員
 * 
 * 用於智能提示：當用戶手動輸入的名字可能是系統中的會員時，
 * 提醒用戶選擇會員而不是作為訪客處理
 * 
 * @param participants - 參與者列表
 * @param members - 系統中所有會員列表
 * @returns 可能匹配的會員列表
 * 
 * @throws {TypeError} 如果參數不是陣列
 * 
 * @example
 * ```typescript
 * const possible = checkPossibleMembers(participants, members)
 * if (possible.length > 0) {
 *   // 顯示警告
 * }
 * ```
 */
export function checkPossibleMembers(
  participants: Participant[],
  members: Member[]
): PossibleMember[] {
  if (!participants || !Array.isArray(participants)) {
    throw new TypeError('participants 必須是陣列')
  }
  
  if (!members || !Array.isArray(members)) {
    throw new TypeError('members 必須是陣列')
  }
  
  const possibleMembers: PossibleMember[] = []

  for (const p of participants) {
    if (!p.member_id) {
      // 這是非會員，檢查名字是否匹配現有會員
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
 * 顯示可能會員的確認對話框
 * 
 * 當檢測到可能是會員的參與者時，顯示確認對話框，
 * 讓用戶選擇是否繼續提交或返回修改
 * 
 * @param possibleMembers - 可能匹配的會員列表
 * @returns 用戶是否確認繼續提交（true = 繼續，false = 取消）
 * 
 * @throws {TypeError} 如果 possibleMembers 不是陣列
 * 
 * @example
 * ```typescript
 * const shouldContinue = confirmPossibleMembers(possibleMatches)
 * if (!shouldContinue) {
 *   // 用戶取消，不提交
 *   return
 * }
 * ```
 */
export function confirmPossibleMembers(possibleMembers: PossibleMember[]): boolean {
  if (!possibleMembers || !Array.isArray(possibleMembers)) {
    throw new TypeError('possibleMembers 必須是陣列')
  }
  const messages = possibleMembers.map(pm => 
    `"${pm.inputName}" 可能是會員：${pm.matches.join('、')}`
  )

  const confirmMsg =
    '⚠️ 偵測到以下參與者可能是會員，但沒有選擇會員資料：\n\n' +
    messages.join('\n') +
    '\n\n如果這些是會員，請點擊「取消」回去選擇會員。\n如果確定是非會員（或訪客），請點擊「確定」繼續提交。'

  return confirm(confirmMsg)
}

/**
 * 計算 is_teaching 值
 * 
 * 判斷該參與者是否計入教學時數。
 * 只有選擇「指定教練」（需收費或不需收費）的課程才計入教學時數。
 * 
 * @param lessonType - 課程類型 ('undesignated' | 'designated_paid' | 'designated_free')
 * @returns 是否計入教學時數
 * 
 * @throws {TypeError} 如果 lessonType 不是字串
 * 
 * @example
 * ```typescript
 * calculateIsTeaching('designated_paid')  // true
 * calculateIsTeaching('undesignated')     // false
 * ```
 */
export function calculateIsTeaching(lessonType: string): boolean {
  if (typeof lessonType !== 'string') {
    throw new TypeError('lessonType 必須是字串')
  }
  
  return lessonType === 'designated_paid' || lessonType === 'designated_free'
}

/**
 * 計算參與者狀態
 * 
 * 根據是否有會員 ID 來判斷參與者狀態：
 * - 有會員 ID → 'pending' (待處理扣款)
 * - 無會員 ID → 'not_applicable' (非會員，不需扣款)
 * 
 * @param memberId - 會員 ID（可為 null）
 * @returns 參與者狀態 ('pending' | 'not_applicable')
 * 
 * @example
 * ```typescript
 * calculateParticipantStatus('member-123')  // 'pending'
 * calculateParticipantStatus(null)          // 'not_applicable'
 * ```
 */
export function calculateParticipantStatus(memberId: string | null): string {
  return memberId ? PARTICIPANT_STATUS.PENDING : PARTICIPANT_STATUS.NOT_APPLICABLE
}

