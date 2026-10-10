export interface CoachDesignatedStudent {
  member_id: string
  name: string
  nickname: string | null
  membership_type: string | null
  balance: number
  regular_balance?: number
  gift_balance?: number
  has_gift_entries?: boolean
  regular_expires_on?: string | null
  gift_expires_on?: string | null
  last_activity_at: string
  entry_count: number
}

export interface AdminCoachDesignatedOverviewCoach {
  coach_id: string
  coach_name: string
  students: CoachDesignatedStudent[]
}

export interface CoachDesignatedEntry {
  id: number
  entry_type: 'credit' | 'report_deduction'
  minutes: number
  regular_minutes?: number
  gift_minutes?: number
  delta_minutes: number
  occurred_at: string
  expires_on?: string | null
  note: string | null
  booking_participant_id: number | null
  booking_id?: number | null
  duration_min?: number | null
  booking_start_at?: string | null
  boat_name?: string | null
  created_at?: string
  updated_at?: string
}

export interface CoachDesignatedEligibleReport {
  participant_id: number
  duration_min: number
  booking_start_at: string
  boat_name: string | null
}

export interface CoachDesignatedCreditReportEntry {
  id: number
  coach_id: string
  coach_name: string
  member_id: string
  member_name: string
  regular_minutes: number
  gift_minutes: number
  total_minutes: number
  occurred_at: string
  note: string | null
}

/** Legacy FIFO view helpers retained for historical tests and old saved links. */
export interface CoachDesignatedBatchAllocation {
  entry: CoachDesignatedEntry
  minutes: number
}

export interface CoachDesignatedBatch {
  credit: CoachDesignatedEntry
  minutes: number
  allocations: CoachDesignatedBatchAllocation[]
  remaining: number
}

export interface CoachDesignatedBatches {
  batches: CoachDesignatedBatch[]
  unallocatedDeductions: CoachDesignatedBatchAllocation[]
}
