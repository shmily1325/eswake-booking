export type ActivityCode = 'WB' | 'WS'
/** 含「兩個一起」 */
export type ActivityChoice = ActivityCode | 'BOTH'
export type SkillLevel = 'first_time' | 'experienced'
export type TimePreference = 'morning' | 'afternoon'
export type CoachChoice = 'none' | 'designated'

export interface PreferredDate {
  date: string
  timePreference: TimePreference
}

export type BoatPreference = 'small' | 'big'

export interface LiffBookingFormState {
  activity: ActivityChoice | null
  /** 寬板選小船或大船（7 人↑ 小船＝2 艘）；衝浪／兩項＝大船 */
  boatPreference: BoatPreference | null
  skillLevel: SkillLevel | null
  headcount: number
  /** 幾位初學（0～headcount） */
  beginnerCount: number | null
  /** 跟船人數（不滑水、僅跟船；第 1 位免費） */
  followBoatCount: number
  coachChoice: CoachChoice
  coachId: string | null
  preferredDates: PreferredDate[]
  contactName: string
  contactPhone: string
  notes: string
}

export interface CoachOption {
  id: string
  name: string
  designated_lesson_price_30min: number | null
}

export interface BoatPricingRow {
  id: number
  name: string
  balance_price_per_hour: number | null
}
