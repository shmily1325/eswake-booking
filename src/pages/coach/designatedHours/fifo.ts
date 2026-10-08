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
  source: 'total' | 'regular' | 'gift' = 'total',
): CoachDesignatedBatches {
  const sourceMinutes = (entry: CoachDesignatedEntry): number => {
    if (source === 'regular') return entry.regular_minutes ?? entry.minutes
    if (source === 'gift') return entry.gift_minutes ?? 0
    return entry.minutes
  }
  const credits = entries
    .filter((entry) => entry.entry_type === 'credit' && sourceMinutes(entry) > 0)
    .slice()
    .sort(chronological)
  const deductions = entries
    .filter((entry) => entry.entry_type === 'report_deduction' && sourceMinutes(entry) > 0)
    .slice()
    .sort(chronological)

  const batches: CoachDesignatedBatch[] = credits.map((credit) => ({
    credit,
    minutes: sourceMinutes(credit),
    allocations: [],
    remaining: sourceMinutes(credit),
  }))
  const unallocatedDeductions: CoachDesignatedBatchAllocation[] = []

  let batchIndex = 0
  for (const deduction of deductions) {
    let pending = sourceMinutes(deduction)

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
