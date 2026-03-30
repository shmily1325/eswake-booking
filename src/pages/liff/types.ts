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
  birthday?: string | null
  membership_type?: string | null
  membership_partner_id?: string | null
  membership_end_date?: string | null
  board_slot_number?: string | null
  board_expiry_date?: string | null
  /** 置板明細（board_storage，與後台一致；多筆時逐列顯示） */
  board_slots?: Array<{
    id: number
    slot_number: number
    start_date: string | null
    expires_at: string | null
  }>
  /** 雙人會員配對對象（由 LIFF 額外查詢） */
  partner?: { name: string; nickname: string | null } | null
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

export type TabType = 'bookings' | 'balance' | 'profile' | 'cancel'

export function getMembershipTypeLabel(type: string | null | undefined): string {
  switch (type) {
    case 'general':
      return '會員'
    case 'dual':
      return '雙人會員'
    case 'guest':
      return '非會員'
    case 'es':
      return 'ES'
    default:
      return type?.trim() ? type : '—'
  }
}

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

