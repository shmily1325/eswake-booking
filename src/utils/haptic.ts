/**
 * Haptic Feedback Utility for Mobile Devices
 * 为移动设备提供触觉反馈
 */

export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error'

/**
 * 触发触觉反馈
 * @param type - 反馈类型
 */
export function triggerHaptic(type: HapticType = 'light'): void {
  // 检查是否支持 Vibration API
  if (!navigator.vibrate) {
    return
  }

  // 根据不同类型触发不同强度的震动
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
    // 静默失败，不影响用户体验
    console.debug('Haptic feedback failed:', error)
  }
}

/**
 * 为按钮添加触觉反馈的辅助函数
 * @param callback - 原始的点击回调
 * @param hapticType - 触觉反馈类型
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

