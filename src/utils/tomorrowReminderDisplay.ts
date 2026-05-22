/**
 * 僅學員名單上為「SH綺綺」時，明日提醒／LIFF 預約卡「指定教練」將教練 ED 顯示為 Ebdoooopq
 * 其他任何學員（含同船、同時段、同為 ED 教練）皆回傳真實教練名，不替換。
 * （offline.html 為離線頁無 bundler，內嵌同規則，改此檔時請一併對齊。）
 */
const QIQI_TOMORROW_STUDENT_NAME = 'SH綺綺' as const

export function displayCoachNameForTomorrowReminder(studentName: string, coachName: string): string {
  if (studentName !== QIQI_TOMORROW_STUDENT_NAME || coachName.trim().toUpperCase() !== 'ED') {
    return coachName
  }
  return 'Ebdoooopq'
}
