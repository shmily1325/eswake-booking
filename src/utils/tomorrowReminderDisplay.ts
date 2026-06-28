/**
 * 僅學員名單上為「EHA綺」時，將教練 ED 顯示為梗用樣式；其他任何學員皆回傳真實教練名。
 *
 * 兩個 export 用途不同，請依場景挑選：
 *   1) displayCoachNameForTomorrowReminder    → UI 用（LIFF 預約卡），回單行 'Ebdooooooooooooooooooooooooooooooopq'。
 *   2) displayCoachNameForTomorrowMessage     → 純文字 LINE 訊息用，回多行 ASCII 排版，
 *      尾端帶 '\n'，配合既有模板 `${coachNames}教練\n` 可讓「教練」獨立成行。
 *
 * （offline.html 為離線頁無 bundler，內嵌同規則，改此檔時請一併對齊 offline.html 中的同名函式。）
 */
const QIQI_TOMORROW_STUDENT_NAME = 'EHA綺' as const

function isQiqiEdCase(studentName: string, coachName: string): boolean {
  return studentName === QIQI_TOMORROW_STUDENT_NAME && coachName.trim().toUpperCase() === 'ED'
}

/** UI 用：LIFF 預約卡等 HTML 場景，回單行字串避免破版。 */
export function displayCoachNameForTomorrowReminder(studentName: string, coachName: string): string {
  if (!isQiqiEdCase(studentName, coachName)) {
    return coachName
  }
  return 'Ebdooooooooooooooooooooooooooooooopq'
}

/**
 * 純文字 LINE 訊息用：回多行 ASCII 排版，並在尾端加上 '\n'，
 * 配合 `${coachNames}教練\n` 模板可讓「教練」自成一行。
 * LINE 訊息用全形字元（Ｅｂｄｏｐｑ、　）避免比例字型導致 b/d 比 o 寬而看起來歪：
 * 　　　　Ｅ
 * 　　ｂ　　　ｄ
 * 　　　ｏｏｏ　
 * 　　ｏｏｏｏｏ
 * 　ｏｏｏｏｏｏｏ
 * 　ｏｏｏｏｏｏｏ
 * 　　ｏｏｏｏｏ
 * 　　　ｏｏｏ　
 * 　　ｐ　　　ｑ
 * 　教練
 */
export function displayCoachNameForTomorrowMessage(studentName: string, coachName: string): string {
  if (!isQiqiEdCase(studentName, coachName)) {
    return coachName
  }
  return '　　　　Ｅ\n　　ｂ　　　ｄ\n　　　ｏｏｏ　\n　　ｏｏｏｏｏ\n　ｏｏｏｏｏｏｏ\n　ｏｏｏｏｏｏｏ\n　　ｏｏｏｏｏ\n　　　ｏｏｏ　\n　　ｐ　　　ｑ\n'
}
