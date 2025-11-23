/**
 * 共用的型別定義
 */

/**
 * 會員基本資訊（用於搜尋和選擇）
 */
export interface MemberBasic {
  id: string
  name: string
  nickname: string | null
  phone: string | null
  status?: string | null
}

/**
 * 教練基本資訊
 */
export interface CoachBasic {
  id: string
  name: string
  status: string | null
}

/**
 * 船隻基本資訊
 */
export interface BoatBasic {
  id: number
  name: string
  color: string
  is_active: boolean | null
}

/**
 * CSV 導入記錄
 */
export interface ImportRecord {
  name: string
  nickname?: string
  slot_number: number
  expires_at?: string
  notes?: string
}

/**
 * 置板導出資料
 */
export interface BoardExportData {
  id: number
  slot_number: number
  expires_at: string | null
  notes: string | null
  status: string | null
  members: {
    name: string
    nickname: string | null
  } | null
}

/**
 * Papa Parse 結果
 */
export interface ParseResult<T> {
  data: T[]
  errors: any[]
  meta: {
    delimiter: string
    linebreak: string
    aborted: boolean
    truncated: boolean
    cursor: number
  }
}

