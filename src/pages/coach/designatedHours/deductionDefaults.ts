export function defaultCoachDesignatedDeduction(
  balance: number,
  existingDeductionMinutes: number | null,
  deductionDecided = existingDeductionMinutes != null,
): boolean {
  if (deductionDecided) return existingDeductionMinutes != null
  return existingDeductionMinutes != null || balance !== 0
}

export function shouldShowCoachDesignatedControl(
  hasEntries: boolean,
  loadError: boolean,
): boolean {
  return hasEntries || loadError
}
