interface BoardDateEditDescriptionInput {
  slotNumber: number
  oldStartDate: string | null
  newStartDate: string | null
  oldExpiresAt: string | null
  newExpiresAt: string | null
  memoText?: string
}

export function buildBoardDateEditDescription({
  slotNumber,
  oldStartDate,
  newStartDate,
  oldExpiresAt,
  newExpiresAt,
  memoText = '',
}: BoardDateEditDescriptionInput): string | null {
  const changes: string[] = []
  if (oldStartDate !== newStartDate) {
    changes.push(`開始日 ${oldStartDate || '無'} → ${newStartDate || '無'}`)
  }
  if (oldExpiresAt !== newExpiresAt) {
    changes.push(`到期日 ${oldExpiresAt || '無'} → ${newExpiresAt || '無'}`)
  }

  const extra = memoText.trim()
  if (changes.length === 0 && !extra) return null

  if (changes.length === 0) return `置板 #${slotNumber}：${extra}`

  let description = `置板 #${slotNumber} 修改：${changes.join('、')}`
  if (extra) description += `（${extra}）`
  return description
}
