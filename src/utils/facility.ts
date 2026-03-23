// 設施相關工具函數

/**
 * 設施列表（不需要接船時間、不需要駕駛的預約類型）
 */
export const FACILITIES = ['彈簧床', '陸上課程']

/**
 * 可重疊預約的設施（無固定場地，同一時段可多筆預約）
 * 教練衝突檢查仍會執行
 */
export const OVERLAP_ALLOWED_FACILITIES = ['陸上課程']

/**
 * 檢查是否為設施
 * @param boatName 船隻名稱
 * @returns 是否為設施
 */
export function isFacility(boatName: string | undefined | null): boolean {
  if (!boatName) return false
  return FACILITIES.includes(boatName)
}

/**
 * 檢查是否為可重疊預約的設施
 * @param boatName 船隻名稱
 * @returns 是否可重疊
 */
export function isOverlapAllowed(boatName: string | undefined | null): boolean {
  if (!boatName) return false
  return OVERLAP_ALLOWED_FACILITIES.includes(boatName)
}

/**
 * 設施在明日提醒/LINE 訊息的顯示標籤
 * @param boatName 船隻名稱
 * @returns 設施標籤（如「彈簧床」「陸上課程」），非設施回傳 null
 */
export function getFacilityMessageLabel(boatName: string | undefined | null): string | null {
  if (!boatName) return null
  if (boatName === '彈簧床') return '彈簧床'
  if (boatName === '陸上課程') return '陸上課程'
  return null
}

