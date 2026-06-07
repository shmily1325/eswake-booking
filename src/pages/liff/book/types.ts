export type ActivityCode = 'WB' | 'WS'
export type SkillLevel = 'first_time' | 'experienced'
export type TimePreference = 'morning' | 'afternoon' | 'any'
export type CoachChoice = 'none' | 'designated'

export interface PreferredDate {
  date: string
  timePreference: TimePreference
}

export interface LiffBookingFormState {
  activity: ActivityCode | null
  skillLevel: SkillLevel | null
  headcount: number
  /** 幾位初學（0～headcount） */
  beginnerCount: number | null
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
