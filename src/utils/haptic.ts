/**
 * Haptic Feedback Utility for Mobile Devices
 * 為行動裝置提供觸覺回饋
 */

export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error'

/**
 * 觸發觸覺回饋
 * @param type - 回饋類型
 */
export function triggerHaptic(type: HapticType = 'light'): void {
  // 檢查是否支援 Vibration API
  if (!navigator.vibrate) {
    return
  }

  // 根據不同類型觸發不同強度的震動
  const patterns: Record<HapticType, number | number[]> = {
    light: 10,
    medium: 20,
    heavy: 30,
    success: [10, 50, 10],
    warning: [15, 100, 15],
    error: [20, 100, 20, 100, 20],
  }

  try {
    navigator.vibrate(patterns[type])
  } catch (error) {
    // 靜默失敗，不影響使用者體驗
    console.debug('Haptic feedback failed:', error)
  }
}

/**
 * 為按鈕添加觸覺回饋的輔助函數
 * @param callback - 原始的點擊回調
 * @param hapticType - 觸覺回饋類型
 */
export function withHaptic<T extends (...args: any[]) => any>(
  callback: T,
  hapticType: HapticType = 'light'
): T {
  return ((...args: any[]) => {
    triggerHaptic(hapticType)
    return callback(...args)
  }) as T
}

