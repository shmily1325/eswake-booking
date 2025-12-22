// Statistics Dashboard 共用工具函數

/**
 * 格式化時間顯示
 * - 少於 60 分鐘：顯示分鐘
 * - 60 分鐘以上：顯示小時（保留一位小數）
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} 分鐘`
  }
  const hours = Math.round(minutes / 60 * 10) / 10
  return `${hours} 小時`
}

/**
 * 格式化時間顯示（簡短版）
 */
export function formatDurationShort(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}分`
  }
  const hours = Math.round(minutes / 60 * 10) / 10
  return `${hours}h`
}

/**
 * 計算百分比變化
 */
export function calculateChange(current: number, previous: number): { 
  value: number
  direction: 'up' | 'down' | 'same'
  percentage: string 
} {
  if (previous === 0) {
    return { value: 0, direction: 'same', percentage: '-' }
  }
  const change = ((current - previous) / previous) * 100
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'same'
  return {
    value: Math.abs(change),
    direction,
    percentage: `${change > 0 ? '+' : ''}${Math.round(change)}%`
  }
}

/**
 * 取得月份標籤（跨年時顯示年份）
 */
export function getMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split('-')
  const now = new Date()
  const monthNum = parseInt(month)
  
  if (parseInt(year) !== now.getFullYear()) {
    return `${year.slice(2)}年${monthNum}月`
  }
  return `${monthNum}月`
}

/**
 * 取得排名圖示
 */
export function getRankIcon(rank: number): string {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return `${rank}.`
}

/**
 * 計算進度條百分比
 */
export function getProgressPercent(value: number, max: number): number {
  if (max <= 0) return 0
  return Math.min((value / max) * 100, 100)
}

