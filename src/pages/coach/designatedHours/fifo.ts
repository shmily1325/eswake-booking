import type {
  CoachDesignatedBatch,
  CoachDesignatedBatchAllocation,
  CoachDesignatedBatches,
  CoachDesignatedEntry,
} from './types'

function chronological(a: CoachDesignatedEntry, b: CoachDesignatedEntry): number {
  const timeDiff = new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
  return timeDiff || a.id - b.id
}

export function buildCoachDesignatedBatches(
  entries: CoachDesignatedEntry[],
): CoachDesignatedBatches {
  const credits = entries
    .filter((entry) => entry.entry_type === 'credit')
    .slice()
    .sort(chronological)
  const deductions = entries
    .filter((entry) => entry.entry_type === 'report_deduction')
    .slice()
    .sort(chronological)

  const batches: CoachDesignatedBatch[] = credits.map((credit) => ({
    credit,
    allocations: [],
    remaining: credit.minutes,
  }))
  const unallocatedDeductions: CoachDesignatedBatchAllocation[] = []

  let batchIndex = 0
  for (const deduction of deductions) {
    let pending = deduction.minutes

    while (pending > 0 && batchIndex < batches.length) {
      const batch = batches[batchIndex]
      if (batch.remaining <= 0) {
        batchIndex += 1
        continue
      }

      const allocated = Math.min(pending, batch.remaining)
      batch.allocations.push({ entry: deduction, minutes: allocated })
      batch.remaining -= allocated
      pending -= allocated

      if (batch.remaining === 0) batchIndex += 1
    }

    if (pending > 0) {
      unallocatedDeductions.push({ entry: deduction, minutes: pending })
    }
  }

  return {
    batches: batches.reverse(),
    unallocatedDeductions,
  }
}
