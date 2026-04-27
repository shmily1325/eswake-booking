/**
 * 僅學員名單上為「SH綺綺」時，明日提醒內文將教練 ED 顯示為 Eb。
 * 其他任何學員（含同船、同時段、同為 ED 教練）皆回傳真實教練名，不替換。
 */
const QIQI_TOMORROW_STUDENT_NAME = 'SH綺綺' as const

export function displayCoachNameForTomorrowReminder(studentName: string, coachName: string): string {
  if (studentName !== QIQI_TOMORROW_STUDENT_NAME || coachName.trim().toUpperCase() !== 'ED') {
    return coachName
  }
  return 'Eb'
}
