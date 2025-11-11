// 設施相關工具函數

/**
 * 設施列表（不需要接船時間的預約類型）
 */
export const FACILITIES = ['彈簧床']

/**
 * 檢查是否為設施
 * @param boatName 船隻名稱
 * @returns 是否為設施
 */
export function isFacility(boatName: string | undefined | null): boolean {
  if (!boatName) return false
  return FACILITIES.includes(boatName)
}

