/**
 * 船隻相關工具函數
 */

// 船隻顯示順序（與 DayView 一致）
export const BOAT_DISPLAY_ORDER = ['G23', 'G21', '黑豹', '粉紅', '200', '彈簧床']

/**
 * 根據預設順序排序船隻陣列
 * @param boats 船隻陣列，需要有 name 屬性
 * @returns 排序後的船隻陣列
 */
export function sortBoatsByDisplayOrder<T extends { name: string }>(boats: T[]): T[] {
  return [...boats].sort((a, b) => {
    const aIdx = BOAT_DISPLAY_ORDER.indexOf(a.name)
    const bIdx = BOAT_DISPLAY_ORDER.indexOf(b.name)
    // 不在列表中的放最後
    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx)
  })
}

