// LIFF 頁面共用的類型定義

export interface Booking {
  id: number
  start_at: string
  duration_min: number
  boats: { name: string; color: string } | null
  coaches: { name: string }[]
  drivers: { name: string }[]
  activity_types: string[] | null
  notes: string | null
}

export interface Member {
  id: string
  name: string
  nickname: string | null
  phone: string | null
  balance?: number
  vip_voucher_amount?: number
  designated_lesson_minutes?: number
  boat_voucher_g23_minutes?: number
  boat_voucher_g21_panther_minutes?: number
  gift_boat_hours?: number
}

export interface Transaction {
  id: number
  transaction_date: string
  category: string
  adjust_type: string | null
  transaction_type: string
  amount: number | null
  minutes: number | null
  description: string
  notes: string | null
}

export type TabType = 'bookings' | 'balance' | 'cancel'

// 輔助函數：獲取類別標籤
export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    'balance': '💰 儲值餘額',
    'vip_voucher': '💎 VIP票券',
    'designated_lesson': '📚 指定課',
    'boat_voucher_g23': '🚤 G23船券',
    'boat_voucher_g21_panther': '⛵ G21/黑豹',
    'gift_boat': '🎁 贈送大船'
  }
  return labels[category] || category
}

// 輔助函數：獲取類別單位
export function getCategoryUnit(category: string): string {
  if (category === 'balance' || category === 'vip_voucher') {
    return '元'
  }
  return '分'
}

