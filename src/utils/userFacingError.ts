/**
 * 給使用者看的錯誤：白話繁中；技術細節只寫 console。
 */

export function userFacingError(
  logLabel: string,
  technicalDetail: string,
  userMessage: string
): Error {
  console.error(logLabel, technicalDetail)
  return new Error(userMessage)
}

/** 教練回報提交：已知白話訊息（不含 DB 原文） */
export const COACH_REPORT_USER_ERRORS = {
  stampBeforeParticipants:
    '無法完成回報，請檢查網路後再按「提交」試一次。若仍失敗，請聯絡管理員。',
  stampAfterParticipants:
    '參與者資料已存檔，但這堂尚未標記為「已回報」。請再按「提交」試一次；若仍失敗，請聯絡管理員。',
  loadExisting:
    '無法讀取這堂的回報資料，請重新整理後再按「提交」試一次。若仍失敗，請聯絡管理員。',
  deleteParticipant: '無法刪除參與者，請再試一次。若仍失敗，請聯絡管理員。',
  updateParticipant: '無法更新參與者資料，請再試一次。若仍失敗，請聯絡管理員。',
  insertParticipant: '無法儲存參與者資料，請再試一次。若仍失敗，請聯絡管理員。',
  genericSubmit: '請稍後再試。若仍失敗，請聯絡管理員。',
} as const

export function reportStampSaveError(
  dbMessage: string,
  options?: { participantsAlreadySaved?: boolean }
): Error {
  return userFacingError(
    '回報完成標記寫入失敗',
    dbMessage,
    options?.participantsAlreadySaved
      ? COACH_REPORT_USER_ERRORS.stampAfterParticipants
      : COACH_REPORT_USER_ERRORS.stampBeforeParticipants
  )
}

/** 是否為刻意寫給使用者看的訊息（可安全顯示在 toast） */
export function isUserFacingErrorMessage(message: string): boolean {
  const known = Object.values(COACH_REPORT_USER_ERRORS) as string[]
  if (known.includes(message)) return true
  return /請再|請重新整理|請聯絡管理員|參與者資料已存檔|無法取得您的帳號|無法/.test(message)
}

export const GENERIC_USER_RETRY =
  '操作失敗，請稍後再試。若仍失敗，請聯絡管理員。'
