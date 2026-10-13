import type { CoachDesignatedEntry } from './types'

function entryTime(entry: CoachDesignatedEntry): number {
  const parsed = new Date(entry.occurred_at).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

export function buildCoachDesignatedRunningBalances(
  entries: CoachDesignatedEntry[],
): Map<number, number> {
  const chronological = [...entries].sort((left, right) => {
    const timeDifference = entryTime(left) - entryTime(right)
    return timeDifference || left.id - right.id
  })
  const balances = new Map<number, number>()
  let balance = 0

  chronological.forEach((entry) => {
    balance += entry.delta_minutes
    balances.set(entry.id, balance)
  })

  return balances
}
